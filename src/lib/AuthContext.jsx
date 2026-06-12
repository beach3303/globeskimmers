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

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  const loadProfile = useCallback(async (userId) => {
    if (!userId) { setProfile(null); return null; }
    try {
      const { data, error } = await supabase
        .from('profiles').select('*').eq('id', userId).single();
      // Right after signup the row may not exist for a beat (DB trigger creates
      // it). Treat "no row" as null rather than an error.
      if (error) { setProfile(null); return null; }
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
    try { await startProviderSignIn(provider); }
    catch (e) { setAuthError({ type: 'oauth', message: e?.message || 'Sign-in failed' }); throw e; }
  }, []);

  const signInApple = useCallback(async () => {
    setAuthError(null);
    try { await signInWithApple(); }
    catch (e) { setAuthError({ type: 'oauth', message: e?.message || 'Apple sign-in failed' }); throw e; }
  }, []);

  const signInWithEmail = useCallback(async (email, password) => {
    setAuthError(null);
    try { return await emailSignIn(email, password); }
    catch (e) { setAuthError({ type: 'email', message: e?.message || 'Sign-in failed' }); throw e; }
  }, []);

  const signUpWithEmail = useCallback(async (args) => {
    setAuthError(null);
    try { return await emailSignUp(args); }
    catch (e) { setAuthError({ type: 'email', message: e?.message || 'Sign-up failed' }); throw e; }
  }, []);

  const verifyEmailOtp = useCallback(async (email, token) => {
    setAuthError(null);
    try { return await authVerifyOtp(email, token); }
    catch (e) { setAuthError({ type: 'email', message: e?.message || 'Verification failed' }); throw e; }
  }, []);

  const logout = useCallback(async () => {
    try { await authSignOut(); } finally {
      setSession(null); setUser(null); setProfile(null);
    }
  }, []);

  const value = useMemo(() => ({
    // Supabase auth state
    session,
    user,
    profile,
    isAuthenticated: !!session?.user,
    isLoadingAuth,
    authError,
    // actions
    signInWithProvider,
    signInWithApple: signInApple,
    signInWithEmail,
    signUpWithEmail,
    resendConfirmation,
    verifyEmailOtp,
    refreshProfile,
    logout,
    // ---- backward-compat shims for old Base44 consumers ----
    isLoadingPublicSettings: false,
    authChecked: !isLoadingAuth,
    checkUserAuth: refreshProfile,
    navigateToLogin: () => {}, // gate is rendered by App.jsx now; no redirect
  }), [
    session, user, profile, isLoadingAuth, authError,
    signInWithProvider, signInApple, signInWithEmail, signUpWithEmail,
    verifyEmailOtp, refreshProfile, logout,
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
