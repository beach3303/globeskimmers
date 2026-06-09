// src/lib/nativeAuth.js
//
// Low-level Supabase auth actions for native (Capacitor) + web. The React
// AuthContext wraps these; keep these as plain async functions that throw on
// error so callers can show inline messages.
//
// OAuth (Google / Facebook): on native we open Supabase's authorization URL in
// the in-app browser, the provider redirects to globeskimmers://auth/callback
// (?code=...), @capacitor/app's appUrlOpen catches it, and we exchange the code
// for a session via PKCE (the verifier persists in Capacitor Preferences — see
// supabaseClient.js). On web we let supabase-js handle the redirect normally.
//
// Apple: on iOS we use the NATIVE Sign in with Apple sheet (the only place
// Apple exposes the user's name, and the App-Store-compliant path), then sign
// into Supabase with the returned identity token and persist the name ourselves
// (Apple returns it ONLY on the first authorization). On web/Android we fall
// back to the same OAuth deep-link flow as Google/Facebook.
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { SignInWithApple } from '@capacitor-community/apple-sign-in';
import { supabase } from './supabaseClient';

export const OAUTH_REDIRECT_TO = 'globeskimmers://auth/callback';

const isNative = () => Capacitor.isNativePlatform();

// --- OAuth: Google / Facebook (and Apple on web/Android) ---------------------
export async function startProviderSignIn(provider /* 'google' | 'facebook' | 'apple' */) {
  if (isNative()) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: OAUTH_REDIRECT_TO, skipBrowserRedirect: true },
    });
    if (error) throw error;
    if (!data?.url) throw new Error('Supabase returned no OAuth URL');
    // signInWithOAuth has already written the PKCE code-verifier to Preferences.
    await Browser.open({ url: data.url });
    return; // session completes asynchronously via the appUrlOpen handler
  }
  // Web: standard redirect flow; supabase handles ?code= via detectSessionInUrl.
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
}

// --- OAuth callback: parse ?code= from the deep link and exchange it ----------
// Called by the appUrlOpen listener registered in AuthContext.
export async function completeOAuthFromUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Malformed callback URL: ' + url);
  }
  const errDesc =
    parsed.searchParams.get('error_description') || parsed.searchParams.get('error');
  if (errDesc) throw new Error(errDesc);
  const code = parsed.searchParams.get('code');
  if (!code) throw new Error('No "code" in callback URL');
  // exchangeCodeForSession wants the CODE STRING (not the full URL). The
  // verifier is read back from Preferences here.
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw error;
  return data.session;
}

// --- Apple ------------------------------------------------------------------
export async function signInWithApple() {
  // iOS → native sheet (captures name); web/Android → OAuth deep-link/redirect.
  if (Capacitor.getPlatform() === 'ios') return signInWithAppleNative();
  return startProviderSignIn('apple');
}

async function signInWithAppleNative() {
  const result = await SignInWithApple.authorize({
    clientId: 'com.globeskimmers.app',
    redirectURI: OAUTH_REDIRECT_TO,
    scopes: 'name email',
  });
  const { identityToken, givenName, familyName } = result?.response || {};
  if (!identityToken) throw new Error('Apple did not return an identity token');

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: identityToken,
  });
  if (error) throw error;

  // Apple returns the name ONLY on the first authorization → persist it now,
  // guarded (subsequent sign-ins return null and must not wipe a saved name).
  if (givenName || familyName) {
    const full = [givenName, familyName].filter(Boolean).join(' ').trim();
    await supabase.auth.updateUser({
      data: {
        ...(givenName ? { given_name: givenName } : {}),
        ...(familyName ? { family_name: familyName } : {}),
        ...(full ? { full_name: full } : {}),
      },
    });
  }
  return data;
}

// --- Email + password -------------------------------------------------------
export async function signInWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

// Returns { needsConfirmation: boolean }. When Supabase "Confirm email" is ON,
// signUp returns a user but NO session until the user clicks the email link.
export async function signUpWithEmail({ email, password, firstName }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: firstName ? { first_name: firstName } : {} },
  });
  if (error) throw error;
  const needsConfirmation = !data.session; // no session ⇒ email confirmation required
  return { data, needsConfirmation };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// --- CRM: append a login_events row (best-effort audit; never blocks UX) -----
export async function logLoginEvent(userId, provider) {
  if (!userId) return;
  try {
    await supabase.from('login_events').insert({ user_id: userId, provider: provider || 'email' });
  } catch {
    /* audit log is non-critical */
  }
}
