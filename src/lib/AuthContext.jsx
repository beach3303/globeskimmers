// src/lib/AuthContext.jsx
//
// Supabase-backed auth context. This REPLACES the old Base44 auth provider —
// accounts, sessions, the onboarding flag, and the CRM all live in the project's
// own Supabase project now. Export names (AuthProvider / useAuth) and the
// isAuthenticated / isLoadingAuth shape are preserved so existing consumers
// (App.jsx and every useAuth caller) keep working unchanged.
//
// Responsibilities:
//   - restore + track the Supabase session (persisted in native device storage)
//   - load the user's public.profiles row (drives onboarding gating + greeting)
//   - append a login_events row on each real sign-in (CRM audit log)
//   - complete native OAuth: catch globeskimmers://auth/callback and exchange code
import React, {
  createContext, useContext, useState, useEffect, useCallback, useMemo, useRef,
} from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { supabase } from '@/lib/supabaseClient';
import { isAdminEmail } from '@/lib/admins';
import { attachPushListeners, syncPushToken, unregisterPush, askAlertsOnce } from '@/lib/pushAlerts';
import {
  startProviderSignIn,
  signInWithApple,
  signInWithEmail as emailSignIn,
  signUpWithEmail as emailSignUp,
  resendConfirmation,
  verifyEmailOtp as authVerifyOtp,
  signOut as authSignOut,
  completeOAuthFromUrl,
  logLoginEvent,
  OAUTH_REDIRECT_TO,
} from '@/lib/nativeAuth';
import { callWorker } from '@/lib/callWorker';
import { syncAppTransaction, syncOsAge } from "@/lib/ageSignal";
import { AGE_GATE_EVENT } from '@/lib/ageGate';
import { listenForSharedPhotos } from '@/lib/sharedPhotos';

// sessionStorage flag set the moment the USER initiates a sign-in/sign-up, so we
// can tell a fresh sign-in from a plain app-launch session restore. sessionStorage
// (not a module var) survives a web OAuth redirect and the native deep-link return.
const PENDING_SIGNIN_KEY = 'gs_pending_fresh_signin';
const markPendingSignIn = () => { try { sessionStorage.setItem(PENDING_SIGNIN_KEY, '1'); } catch { /* ignore */ } };

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  // Whether this user sees the global "refresh app cache" button in the nav.
  const [canRefresh, setCanRefresh] = useState(false);
  // Bumps once per FRESH (user-initiated) sign-in / sign-up — never on a plain
  // app-launch session restore. Home watches this to show the welcome splash.
  const [signInTick, setSignInTick] = useState(0);
  // A team-alert link waiting for the session: set by the admin/members branch
  // in appUrlOpen, pushed by the effect that follows the listener's effect.
  const [pendingRoute, setPendingRoute] = useState(null);

  const loadProfile = useCallback(async (userId) => {
    if (!userId) { setProfile(null); return null; }
    try {
      let { data, error } = await supabase
        .from('profiles').select('*').eq('id', userId).single();
      // Brand-new signups: the row may not be readable yet — the handle_new_user
      // DB trigger can race this first read, or be misconfigured. Self-heal by
      // creating our own row (RLS "profiles_insert_own" permits it) so the
      // onboarding gate always has a row to key off (onboarding_completed
      // defaults to false → Onboarding fires). Idempotent: if the trigger
      // already created the row, the upsert just returns it unchanged (only `id`
      // is written, so onboarding_completed / answers are never reset).
      if (error || !data) {
        const { data: created, error: upsertErr } = await supabase
          .from('profiles')
          .upsert({ id: userId }, { onConflict: 'id' })
          .select('*')
          .single();
        if (upsertErr || !created) { setProfile(null); return null; }
        data = created;
      }
      setProfile(data);
      return data;
    } catch {
      setProfile(null);
      return null;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    const uid = data?.user?.id;
    if (uid) { setUser(data.user); return loadProfile(uid); }
    return null;
  }, [loadProfile]);

  // Persist +1 to the per-account welcome-splash counter (capped check lives in
  // Home). No-op / best-effort: if the column isn't migrated yet the update just
  // errors and is swallowed, so nothing breaks pre-migration.
  const bumpWelcomeSplashCount = useCallback(async () => {
    try {
      const uid = user?.id || session?.user?.id;
      if (!uid) return;
      const next = (profile?.welcome_splash_count ?? 0) + 1;
      await supabase.from('profiles').update({ welcome_splash_count: next }).eq('id', uid);
      await refreshProfile();
    } catch { /* ignore (e.g. column not migrated yet) */ }
  }, [user, session, profile, refreshProfile]);

  useEffect(() => {
    let mounted = true;
    let appListener;
    let shareListener;

    // 1) Initial session (for first paint).
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) loadProfile(s.user.id);
      setIsLoadingAuth(false);
    });

    // 2) Track auth changes. Defer any supabase calls out of the callback with
    //    setTimeout(0) — calling supabase inside the callback can deadlock.
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      setIsLoadingAuth(false);
      if (event === 'SIGNED_OUT') { setProfile(null); return; }
      if (s?.user) {
        setTimeout(() => {
          if (!mounted) return;
          loadProfile(s.user.id);
          if (event === 'SIGNED_IN') {
            logLoginEvent(s.user.id, s.user.app_metadata?.provider || 'email');
            // Only a USER-INITIATED sign-in/sign-up flagged PENDING_SIGNIN_KEY
            // bumps the signal — an app-launch session restore does not (it
            // fires INITIAL_SESSION or a flagless SIGNED_IN). This is what makes
            // the welcome splash appear on sign-in but NOT on routine re-opens.
            try {
              if (sessionStorage.getItem(PENDING_SIGNIN_KEY)) {
                sessionStorage.removeItem(PENDING_SIGNIN_KEY);
                setSignInTick((t) => t + 1);
              }
            } catch { /* ignore */ }
          }
        }, 0);
      }
    });

    // 3) Native OAuth callback: catch globeskimmers://auth/callback, exchange code.
    if (Capacitor.isNativePlatform()) {
      App.addListener('appUrlOpen', async ({ url }) => {
        // Passport buddy-tag claim: globeskimmers://passport/claim?token=… →
        // stash the token + route to the Passport page (which shows the claim card).
        if (url && url.includes('passport/claim')) {
          try {
            const token = (url.split('token=')[1] || '').split(/[&#]/)[0];
            if (token) {
              try { sessionStorage.setItem('pp_claim_token', decodeURIComponent(token)); } catch { /* ignore */ }
              window.history.pushState({}, '', '/Passport');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }
          } catch { /* ignore malformed deep link */ }
          return;
        }
        // A held username's claim link: globeskimmers://handle/claim?token=… →
        // stash the token + route to the Passport, where the claim card shows.
        if (url && url.includes('handle/claim')) {
          try {
            const token = (url.split('token=')[1] || '').split(/[&#]/)[0];
            if (token) {
              try { sessionStorage.setItem('gs_held_token', decodeURIComponent(token)); sessionStorage.removeItem('gsk_held_snooze'); } catch { /* ignore */ }
              window.history.pushState({}, '', '/Passport');
              window.dispatchEvent(new PopStateEvent('popstate'));
              window.dispatchEvent(new Event('gs:held-token'));
            }
          } catch { /* ignore malformed deep link */ }
          return;
        }
        // A shared passport: globeskimmers://passport/view?u=<slug> opens the
        // visit page. Pushed once the session is in (the effect below), the
        // same way as a team alert: a full reload would land on Home and
        // lose the slug.
        if (url && url.includes('passport/view')) {
          try {
            const slug = (url.split(/[?&]u=/)[1] || '').split(/[&#]/)[0];
            if (slug) setPendingRoute(`/Traveler?slug=${encodeURIComponent(decodeURIComponent(slug))}`);
          } catch { /* ignore malformed deep link */ }
          return;
        }
        // A team alert (founder, 2026-10-13): globeskimmers://admin/members?m=57
        // → the Admin page with member #57 picked out. Pushed once the session
        // is in (the effect below), or a cold start would lose it.
        if (url && url.startsWith('globeskimmers://admin/members')) {
          const m = (url.split(/[?&]m=/)[1] || '').split(/[&#]/)[0];
          if (/^\d{1,9}$/.test(m) && Number(m) > 0) setPendingRoute(`/AdminAnalytics?member=${Number(m)}`);
          return;
        }
        if (!url || !url.startsWith(OAUTH_REDIRECT_TO)) return;
        try { await Browser.close(); } catch { /* no-op on Android */ }
        try {
          setAuthError(null);
          await completeOAuthFromUrl(url); // onAuthStateChange picks up the session
        } catch (e) {
          setAuthError({ type: 'oauth', message: e?.message || 'Sign-in failed' });
        }
      }).then((l) => { appListener = l; });

      // Photos shared from the phone's gallery (src/lib/sharedPhotos.js) open Stamp a place on
      // the Passport, once the session is in. A Passport already open takes them itself.
      listenForSharedPhotos(() => {
        if (window.location.pathname !== '/Passport') setPendingRoute('/Passport');
      }).then((l) => { shareListener = l; });
    }

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
      appListener?.remove?.();
      shareListener?.remove?.();
    };
  }, [loadProfile]);

  // Push a waiting team-alert link once the session is in. An alert's tap
  // usually starts a closed app: Capacitor hands the link over as soon as the
  // listener above is added, often while the stored session is still being
  // restored (an expired token waits on a network refresh) — and App.jsx
  // sends each restored session to Home once, which would replace a route
  // pushed earlier. This effect runs after that redirect in the same commit
  // (a child's effects run before its parent's), so the link lands on top.
  const signedIn = !!session?.user;
  useEffect(() => {
    if (!pendingRoute || isLoadingAuth || !signedIn) return;
    setPendingRoute(null);
    window.history.pushState({}, '', pendingRoute);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, [pendingRoute, isLoadingAuth, signedIn]);

  // --- Auth actions (wrap nativeAuth; set/clear error for the gate UI) -------
  const signInWithProvider = useCallback(async (provider) => {
    setAuthError(null);
    markPendingSignIn();
    try { await startProviderSignIn(provider); }
    catch (e) { setAuthError({ type: 'oauth', message: e?.message || 'Sign-in failed' }); throw e; }
  }, []);

  const signInApple = useCallback(async () => {
    setAuthError(null);
    markPendingSignIn();
    try { await signInWithApple(); }
    catch (e) { setAuthError({ type: 'oauth', message: e?.message || 'Apple sign-in failed' }); throw e; }
  }, []);

  const signInWithEmail = useCallback(async (email, password) => {
    setAuthError(null);
    markPendingSignIn();
    try { return await emailSignIn(email, password); }
    catch (e) { setAuthError({ type: 'email', message: e?.message || 'Sign-in failed' }); throw e; }
  }, []);

  const signUpWithEmail = useCallback(async (args) => {
    setAuthError(null);
    markPendingSignIn();
    try { return await emailSignUp(args); }
    catch (e) { setAuthError({ type: 'email', message: e?.message || 'Sign-up failed' }); throw e; }
  }, []);

  const verifyEmailOtp = useCallback(async (email, token) => {
    setAuthError(null);
    markPendingSignIn();
    try { return await authVerifyOtp(email, token); }
    catch (e) { setAuthError({ type: 'email', message: e?.message || 'Verification failed' }); throw e; }
  }, []);

  const logout = useCallback(async () => {
    await unregisterPush().catch(() => {});   // this phone stops getting this account's alerts
    try { await authSignOut(); } finally {
      setSession(null); setUser(null); setProfile(null); setCanRefresh(false);
    }
  }, []);

  // Permanently delete the signed-in user's account + data (Apple Guideline
  // 5.1.1(v) / Google Play requirement for account-creation apps). The anon-key
  // client CANNOT delete an auth user, so this calls the Worker's /delete-account
  // route (callWorker attaches the user's JWT as Bearer); the Worker verifies the
  // token, then hard-deletes the auth user with the service role — which cascades
  // the profiles + login_events rows. On success we purge the local session +
  // state exactly like logout (a failing signOut here is fine — the account is
  // already gone server-side), so App.jsx re-renders the signed-out auth gate.
  const deleteAccount = useCallback(async () => {
    const uid = user?.id || session?.user?.id;
    if (!uid) throw new Error('Not signed in');
    const { error } = await callWorker('delete-account', {});
    if (error) throw new Error(error);
    try { await authSignOut(); } catch { /* token already invalid — account deleted */ }
    setSession(null); setUser(null); setProfile(null); setCanRefresh(false);
  }, [user, session]);

  // Social tier from the worker's age gate: 'adult' | 'teen' | 'blocked' |
  // 'confirm' | null (no birthday yet). 'blocked' (under 13) freezes the whole
  // app (App.jsx shows FrozenScreen); 'teen' holds the social doors until 18
  // (founder, 2026-10-11); 'confirm' (a birth year that could be either side
  // of a birthday that matters, with no month or day) holds stamping and
  // posting until the month and day are given — App.jsx's ConfirmBirthday
  // asks for them (go-live decision 2, 2026-10-13). Re-read after a birthday
  // is entered and after any age refusal (src/lib/ageGate.js). A read that
  // fails keeps the tier we had: a network blip must never unfreeze an
  // account or lift a hold.
  // socialTierReady is false from a user change (and while signed out) until
  // that user's age read settles, success or failure. Social surfaces wait for
  // it, so a teen never glimpses social UI before the hold applies. A read
  // that started for an earlier user, or before a newer read, is dropped.
  const [socialTier, setSocialTier] = useState(null);
  const [socialTierReady, setSocialTierReady] = useState(false);
  const tierRead = useRef(0);
  const tierRef = useRef(null);
  tierRef.current = socialTier;
  const refreshSocialTier = useCallback(async () => {
    const n = ++tierRead.current;
    try {
      const { data, error } = await callWorker('social/age', {});
      if (error || !data || data.error) return tierRef.current;
      const t = data.tier || null;
      if (n === tierRead.current) setSocialTier(t);
      return t;
    } catch { return tierRef.current; } finally {
      if (n === tierRead.current) setSocialTierReady(true);
    }
  }, []);
  useEffect(() => {
    tierRead.current += 1;
    setSocialTier(null);
    setSocialTierReady(false);
    if (!user?.id) return;
    refreshSocialTier();
  }, [user?.id, refreshSocialTier]);
  // An age refusal anywhere (callWorker announces it) or a saved birthday
  // re-reads the tier, so the screen matches the server at once: a frozen
  // account gets FrozenScreen, a held teen the hold notes. A burst of
  // refusals costs one read.
  useEffect(() => {
    if (!user?.id) return undefined;
    let timer = null;
    const onAgeGate = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { refreshSocialTier(); }, 300);
    };
    window.addEventListener(AGE_GATE_EVENT, onAgeGate);
    return () => { clearTimeout(timer); window.removeEventListener(AGE_GATE_EVENT, onAgeGate); };
  }, [user?.id, refreshSocialTier]);
  // The phone's own age answer and its App Store download id (teens plan Phase 0), once the
  // tier is known for this user: a tier the answer changed (a cap, an under-13 freeze) is
  // re-read at once, so the screen follows.
  useEffect(() => {
    if (!user?.id || !socialTierReady) return undefined;
    let gone = false;
    (async () => {
      await syncAppTransaction();
      const r = await syncOsAge();
      if (!gone && r?.tier && r.tier !== tierRef.current) refreshSocialTier();
    })();
    return () => { gone = true; };
  }, [user?.id, socialTierReady, refreshSocialTier]);

  // Alerts outside the app (push, 2026-10-19): a tapped alert opens the screen it names, the
  // same way a deep link does; the phone's token goes to the worker whenever an adult opens
  // the app with alerts already allowed (tokens rotate). Below the tier state on purpose: a hook above its `const` reads it before it
  // exists (the boot check caught exactly that).
  useEffect(() => { attachPushListeners((route) => setPendingRoute(route)); }, []);
  useEffect(() => {
    if (!(user?.id && socialTierReady && socialTier === 'adult')) return undefined;
    syncPushToken();
    // Alerts on from the start (founder, 2026-10-19): the phone's one Allow is asked on the first
    // open, a moment after the app settles, instead of after a first postcard or follow.
    const t = setTimeout(() => { askAlertsOnce(); }, 2500);
    return () => clearTimeout(t);
  }, [user?.id, socialTierReady, socialTier]);

  // canRefresh = admin email (always) OR an email an admin granted in the
  // Supabase `refresh_access` table. Re-evaluated whenever the user changes, so
  // revoking access takes effect on the user's next sign-in.
  useEffect(() => {
    let cancelled = false;
    const email = (user?.email || '').toLowerCase();
    if (!email) { setCanRefresh(false); return; }
    if (isAdminEmail(email)) { setCanRefresh(true); return; }
    (async () => {
      try {
        const { data } = await supabase
          .from('refresh_access').select('email').eq('email', email).maybeSingle();
        if (!cancelled) setCanRefresh(!!data);
      } catch { if (!cancelled) setCanRefresh(false); }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const value = useMemo(() => ({
    // Supabase auth state
    session,
    user,
    profile,
    isAuthenticated: !!session?.user,
    isLoadingAuth,
    authError,
    canRefresh,
    signInTick,
    socialTier,
    socialTierReady,
    // actions
    refreshSocialTier,
    signInWithProvider,
    signInWithApple: signInApple,
    signInWithEmail,
    signUpWithEmail,
    resendConfirmation,
    verifyEmailOtp,
    refreshProfile,
    bumpWelcomeSplashCount,
    logout,
    deleteAccount,
    // ---- backward-compat shims for old Base44 consumers ----
    isLoadingPublicSettings: false,
    authChecked: !isLoadingAuth,
    checkUserAuth: refreshProfile,
    navigateToLogin: () => {}, // gate is rendered by App.jsx now; no redirect
  }), [
    session, user, profile, isLoadingAuth, authError, canRefresh, signInTick, socialTier, socialTierReady, refreshSocialTier,
    signInWithProvider, signInApple, signInWithEmail, signUpWithEmail,
    verifyEmailOtp, refreshProfile, bumpWelcomeSplashCount, logout, deleteAccount,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
