// src/components/auth/AuthGate.jsx
//
// Forced sign-in gate. Rendered by App.jsx whenever there is no Supabase
// session — no app features are reachable until the user signs in or signs up.
// Four methods: Google, Facebook, Apple (always visible — App Store requires it
// when other social logins are offered), and email + password (with a first-name
// field on sign-up). On native, the OAuth buttons open the in-app browser and
// the session completes via the deep-link callback handled in AuthContext.
import React, { useState } from 'react';
import { Globe, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { IVORY, TEAL_DEEP, TEAL_GRADIENT } from '@/components/redesign/constants';

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 4.5 29.5 2.5 24 2.5 12.1 2.5 2.5 12.1 2.5 24S12.1 45.5 24 45.5 45.5 35.9 45.5 24c0-1.2-.1-2.3-.3-3.5z"/>
      <path fill="#FF3D00" d="M5.3 14.7l6.6 4.8C13.7 15.1 18.5 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 4.5 29.5 2.5 24 2.5 16 2.5 9.1 7 5.3 14.7z"/>
      <path fill="#4CAF50" d="M24 45.5c5.4 0 10.3-2 14-5.3l-6.5-5.5C29.6 36 26.9 37 24 37c-5.2 0-9.6-3.3-11.2-8l-6.6 5.1C9 41 15.9 45.5 24 45.5z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.4l6.5 5.5c-.5.4 7-5.1 7-14.9 0-1.2-.1-2.3-.2-3.5z"/>
    </svg>
  );
}
function AppleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.37 1.43c.04 1.06-.37 2.1-1.06 2.86-.72.79-1.9 1.4-3 1.32-.05-1.05.42-2.13 1.07-2.83.72-.78 1.97-1.36 2.99-1.35zM20.5 17.2c-.55 1.27-.81 1.83-1.52 2.95-.99 1.56-2.39 3.5-4.12 3.51-1.54.02-1.93-1-4.02-.99-2.09.01-2.52 1.01-4.06.99-1.73-.02-3.05-1.77-4.04-3.33C-.02 16.95-.32 12-1 9.9c-1.05-3.07.46-5.83 1.92-6.65 1.04-.6 2.36-.6 3.34-.6 1.18 0 1.92.65 3.07.65 1.11 0 1.79-.65 3.15-.65 1.03 0 2.12.28 2.9.77-2.55 1.4-2.13 5.04.62 6.13-.46 1.05-.7 1.55-1.5 2.45z" transform="translate(2.5 .8)"/>
    </svg>
  );
}
function FacebookIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#1877F2" aria-hidden="true">
      <path d="M24 12c0-6.63-5.37-12-12-12S0 5.37 0 12c0 5.99 4.39 10.95 10.13 11.85v-8.38H7.08V12h3.05V9.36c0-3.01 1.79-4.67 4.53-4.67 1.31 0 2.69.23 2.69.23v2.96h-1.52c-1.49 0-1.96.93-1.96 1.88V12h3.33l-.53 3.47h-2.8v8.38C19.61 22.95 24 17.99 24 12z"/>
    </svg>
  );
}

export default function AuthGate() {
  const { signInWithProvider, signInWithApple, signInWithEmail, signUpWithEmail, authError } = useAuth();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [busy, setBusy] = useState(null); // 'google' | 'facebook' | 'apple' | 'email' | null
  const [info, setInfo] = useState(null);
  const [localError, setLocalError] = useState(null);

  const disabled = busy !== null;
  const isSignup = mode === 'signup';

  const runProvider = async (provider) => {
    setInfo(null); setLocalError(null); setBusy(provider);
    try {
      if (provider === 'apple') await signInWithApple();
      else await signInWithProvider(provider);
    } catch {
      // authError is surfaced by the context; just clear the spinner.
    } finally {
      setBusy(null);
    }
  };

  const submitEmail = async (e) => {
    e.preventDefault();
    setInfo(null); setLocalError(null);
    if (!email || !password) { setLocalError('Enter your email and password.'); return; }
    if (isSignup && !firstName.trim()) { setLocalError('Enter your first name.'); return; }
    setBusy('email');
    try {
      if (isSignup) {
        const { needsConfirmation } = await signUpWithEmail({ email, password, firstName: firstName.trim() });
        if (needsConfirmation) {
          setInfo('Almost there — check your email to confirm your account, then sign in.');
          setMode('signin');
        }
      } else {
        await signInWithEmail(email, password);
      }
    } catch {
      // authError surfaced by context
    } finally {
      setBusy(null);
    }
  };

  const errorMsg = localError || authError?.message;

  const inputCls =
    'w-full h-12 px-4 rounded-xl border border-black/10 bg-white text-[15px] text-[#0F1419] ' +
    'placeholder:text-black/35 outline-none focus:border-[#0E7C73] focus:ring-2 focus:ring-[#0E7C73]/20 transition';

  return (
    <div className="min-h-screen font-sans flex flex-col px-6 py-10" style={{ background: IVORY }}>
      <div className="w-full max-w-sm mx-auto flex-1 flex flex-col justify-center">
        {/* Brand lockup */}
        <div className="flex flex-col items-center text-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg mb-4"
            style={{ background: TEAL_GRADIENT }}
          >
            <Globe className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#0F1419]">Globeskimmers</h1>
          <p className="text-[15px] text-black/50 mt-1">
            {isSignup ? 'Create your account to get started' : 'Sign in to keep exploring'}
          </p>
        </div>

        {/* OAuth buttons */}
        <div className="space-y-3">
          <button
            type="button" onClick={() => runProvider('google')} disabled={disabled}
            className="w-full h-12 rounded-xl bg-white border border-black/10 flex items-center justify-center gap-3 font-semibold text-[#0F1419] disabled:opacity-50 active:scale-[.99] transition"
          >
            {busy === 'google' ? <Loader2 className="w-5 h-5 animate-spin" /> : <GoogleIcon />}
            Continue with Google
          </button>
          <button
            type="button" onClick={() => runProvider('facebook')} disabled={disabled}
            className="w-full h-12 rounded-xl bg-white border border-black/10 flex items-center justify-center gap-3 font-semibold text-[#0F1419] disabled:opacity-50 active:scale-[.99] transition"
          >
            {busy === 'facebook' ? <Loader2 className="w-5 h-5 animate-spin" /> : <FacebookIcon />}
            Continue with Facebook
          </button>
          <button
            type="button" onClick={() => runProvider('apple')} disabled={disabled}
            className="w-full h-12 rounded-xl bg-black text-white flex items-center justify-center gap-3 font-semibold disabled:opacity-50 active:scale-[.99] transition"
          >
            {busy === 'apple' ? <Loader2 className="w-5 h-5 animate-spin" /> : <AppleIcon />}
            Continue with Apple
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="h-px flex-1 bg-black/10" />
          <span className="text-xs font-medium text-black/40 uppercase tracking-wide">or</span>
          <div className="h-px flex-1 bg-black/10" />
        </div>

        {/* Email form */}
        <form onSubmit={submitEmail} className="space-y-3">
          {isSignup && (
            <input
              className={inputCls} type="text" autoComplete="given-name" placeholder="First name"
              value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={disabled}
            />
          )}
          <input
            className={inputCls} type="email" autoComplete="email" placeholder="Email"
            value={email} onChange={(e) => setEmail(e.target.value)} disabled={disabled}
          />
          <input
            className={inputCls} type="password"
            autoComplete={isSignup ? 'new-password' : 'current-password'} placeholder="Password"
            value={password} onChange={(e) => setPassword(e.target.value)} disabled={disabled}
          />

          {info && <p className="text-[13px] text-[#0E7C73] font-medium px-1">{info}</p>}
          {errorMsg && <p className="text-[13px] text-red-600 font-medium px-1">{errorMsg}</p>}

          <Button
            type="submit" disabled={disabled}
            className="w-full h-12 text-white text-[15px] font-semibold rounded-xl shadow-md hover:opacity-95"
            style={{ background: TEAL_DEEP }}
          >
            {busy === 'email'
              ? <Loader2 className="w-5 h-5 animate-spin" />
              : (isSignup ? 'Create account' : 'Sign in')}
          </Button>
        </form>

        {/* Mode toggle */}
        <p className="text-center text-[14px] text-black/55 mt-6">
          {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            type="button" disabled={disabled}
            onClick={() => { setMode(isSignup ? 'signin' : 'signup'); setInfo(null); setLocalError(null); }}
            className="font-semibold text-[#0E7C73] disabled:opacity-50"
          >
            {isSignup ? 'Sign in' : 'Sign up'}
          </button>
        </p>
      </div>
    </div>
  );
}
