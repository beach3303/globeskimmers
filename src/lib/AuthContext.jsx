// src/lib/AuthContext.jsx
//
// Supabase-backed auth context. This REPLACES the old Base44 auth provider —
// accounts, sessions, the onboarding flag, and the CRM all live in the project's
// own Supabase project now. Export names (AuthProvider / useAuth) and the
// isAuthenticated / isLoadingAuth shape are preserved so existing consumers
// (App.jsx, ProtectedRoute, NavigationTracker) keep working unchanged.
//
// Responsibilities:
//   - restore + track the Supabase session (persisted in native device storage)
//   - load the user's public.profiles row (drives onboarding gating + greeting)
//   - append a login_events row on each real sign-in (CRM audit log)
//   - complete native OAuth: catch globeskimmers://auth/callback and exchange code
import React, {
  createContext, useContext, useState, useEffect, useCallback, useMemo,
} from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { supabase } from '@/lib/supabaseClient';
import { isAdminEmail } from '@/lib/admins';
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
        if (!url || !url.startsWith(OAUTH_REDIRECT_TO)) return;
        try { await Browser.close(); } catch { /* no-op on Android */ }
        try {
          setAuthError(null);
          await completeOAuthFromUrl(url); // onAuthStateChange picks up the session
        } catch (e) {
          setAuthError({ type: 'oauth', message: e?.message || 'Sign-in failed' });
        }
      }).then((l) => { appListener = l; });
    }

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
      appListener?.remove?.();
    };
  }, [loadProfile]);

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
    try { await authSignOut(); } finally {
      setSession(null); setUser(null); setProfile(null); setCanRefresh(false);
    }
  }, []);

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
    // actions
    signInWithProvider,
    signInWithApple: signInApple,
    signInWithEmail,
    signUpWithEmail,
    resendConfirmation,
    verifyEmailOtp,
    refreshProfile,
    bumpWelcomeSplashCount,
    logout,
    // ---- backward-compat shims for old Base44 consumers ----
    isLoadingPublicSettings: false,
    authChecked: !isLoadingAuth,
    checkUserAuth: refreshProfile,
    navigateToLogin: () => {}, // gate is rendered by App.jsx now; no redirect
  }), [
    session, user, profile, isLoadingAuth, authError, canRefresh, signInTick,
    signInWithProvider, signInApple, signInWithEmail, signUpWithEmail,
    verifyEmailOtp, refreshProfile, bumpWelcomeSplashCount, logout,
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
