// src/components/auth/AuthGate.jsx
//
// Forced sign-in gate. Rendered by App.jsx whenever there is no Supabase
// session — no app features are reachable until the user signs in.
// Three ways in (founder, 2026-11-08: "as simple as possible … drop Facebook … I hate having to go to
// email; password instead"): Google, Apple (always visible — App Store requires it when other social
// logins are offered), and EMAIL + PASSWORD with no email step — with Supabase's "Confirm email" off, Create
// account signs you straight in (the welcome screen asks name, birthday and @username). The inbox is only
// for a forgotten password: "Email me a sign-in button" sends the one-tap sign-in email
// (globeskimmers.io/open/signin hands its token to the app). If confirmation is still on, a new account
// gets that same email instead of a code. On native, the social buttons open the in-app browser and the
// session completes via the deep-link callback handled in AuthContext.
import React, { useState } from 'react';
import { Globe, Loader2, Eye, EyeOff, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { IVORY, TEAL_DEEP, TEAL_GRADIENT } from '@/components/redesign/constants';
import siwaLogo from './siwa-logo-left-white-medium.svg';

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 4.5 29.5 2.5 24 2.5 12.1 2.5 2.5 12.1 2.5 24S12.1 45.5 24 45.5 45.5 35.9 45.5 24c0-1.2-.1-2.3-.4-3.5z"/>
      <path fill="#FF3D00" d="M5.3 14.7l6.6 4.8C13.7 15.1 18.5 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 4.5 29.5 2.5 24 2.5 16 2.5 9.1 7 5.3 14.7z"/>
      <path fill="#4CAF50" d="M24 45.5c5.4 0 10.3-2 14-5.3l-6.5-5.5C29.6 36 26.9 37 24 37c-5.2 0-9.6-3.3-11.2-8l-6.6 5.1C9 41 15.9 45.5 24 45.5z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.4l6.5 5.5c-.5.4 7-5.1 7-14.9 0-1.2-.1-2.3-.2-3.5z"/>
    </svg>
  );
}
// Sign in with Apple: App Review rejected build 13 (Guideline 4, 2026-10-10)
// because the old hand-drawn logo wasn't Apple's artwork. The file is Apple's
// "Logo - SIWA - Left-aligned - White - Medium" from Apple Design Resources,
// byte-for-byte: never redraw, crop or recolor it. Apple's custom-button rules:
// the logo file's height equals the button height (44pt is this file's native
// size), white logo and white title on black, and a title 43% of the button
// height (44px button → 19px title). The file carries its own padding, so the
// Apple button's gap is smaller to line its logo up with Google.
function AppleLogo() {
  return <img src={siwaLogo} alt="" aria-hidden="true" width={31} height={44} className="h-11 w-auto shrink-0" />;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AuthGate() {
  const { signInWithProvider, signInWithApple, signInWithEmail, signUpWithEmail, sendSignInLink, authError } = useAuth();
  const [mode, setMode] = useState('signin');   // 'signin' | 'signup' | 'sent' (the one-tap email is on its way)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(null);     // 'google' | 'apple' | 'link' | 'password' | null
  const [info, setInfo] = useState(null);
  const [localError, setLocalError] = useState(null);

  const disabled = busy !== null;
  const address = email.trim().toLowerCase();

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

  const sendLink = async (e) => {
    if (e) e.preventDefault();
    setInfo(null); setLocalError(null);
    if (!EMAIL_RE.test(address)) { setLocalError('Enter your email address.'); return; }
    setBusy('link');
    try {
      await sendSignInLink(address);
      setMode('sent');
    } catch {
      // authError surfaced by context
    } finally {
      setBusy(null);
    }
  };

  const submitPassword = async (e) => {
    e.preventDefault();
    setInfo(null); setLocalError(null);
    if (!EMAIL_RE.test(address) || !password) { setLocalError('Enter your email and password.'); return; }
    if (mode === 'signup' && password.length < 8) { setLocalError('Pick a password of at least 8 characters.'); return; }
    setBusy('password');
    try {
      if (mode === 'signup') {
        // With "Confirm email" off this returns a session and the welcome screen takes over. If it is
        // still on, Supabase sent the one-tap email instead; say so.
        const { needsConfirmation } = await signUpWithEmail({ email: address, password });
        if (needsConfirmation) setMode('sent');
      } else {
        await signInWithEmail(address, password);
      }
    } catch {
      // authError surfaced by context
    } finally {
      setBusy(null);
    }
  };

  const errorMsg = localError || authError?.message;

  // The sign-in buttons share Apple's proportions (see AppleLogo): 44px tall, a 19px
  // system-font title, so none is smaller than the Apple button.
  const socialCls =
    'w-full h-11 rounded-xl flex items-center justify-center overflow-hidden ' +
    'font-semibold text-[19px] [font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif] ' +
    'disabled:opacity-50 active:scale-[.99] transition';
  const inputCls =
    'w-full h-12 px-4 rounded-xl border border-black/10 bg-white text-[16px] text-[#0F1419] ' +
    'placeholder:text-black/35 outline-none focus:border-[#0E7C73] focus:ring-2 focus:ring-[#0E7C73]/20 transition';
  const linkCls = 'block mx-auto text-[13px] text-black/50 hover:text-[#0E7C73] underline underline-offset-2 disabled:opacity-50 transition';

  const brand = (title, sub) => (
    <div className="flex flex-col items-center text-center mb-8">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg mb-4" style={{ background: TEAL_GRADIENT }}>
        <Globe className="w-8 h-8 text-white" />
      </div>
      <h1 className="text-2xl font-bold text-[#0F1419]">{title}</h1>
      <p className="text-[15px] text-black/50 mt-1">{sub}</p>
    </div>
  );

  // "Check your email": the link is on its way. Tapping it on this phone opens the app signed in.
  if (mode === 'sent') {
    return (
      <div className="min-h-screen font-sans flex flex-col px-6 py-10" style={{ background: IVORY }}>
        <div className="w-full max-w-sm mx-auto flex-1 flex flex-col justify-center">
          {brand('Check your email', 'We just sent a green button to')}
          <p className="text-center font-semibold text-[#0F1419] -mt-6 mb-6 break-all">{address}</p>
          <div className="rounded-2xl p-4" style={{ background: '#fff', border: '1px solid rgba(0,0,0,.08)' }}>
            <div className="flex items-start gap-3">
              <Mail className="w-6 h-6 shrink-0" style={{ color: TEAL_DEEP }} />
              <p className="text-[15px] leading-snug text-[#0F1419] m-0">Open that email on this phone and tap the green button. It signs you in — nothing to type.</p>
            </div>
          </div>
          <p className="text-[13px] text-black/50 text-center mt-4 leading-snug">Nothing there after a minute? Check Spam or Junk, or search your mail for Globeskimmers.</p>
          {info && <p className="text-[13px] text-[#0E7C73] font-medium text-center mt-3">{info}</p>}
          {errorMsg && <p className="text-[13px] text-red-600 font-medium text-center mt-3">{errorMsg}</p>}
          <button type="button" onClick={async () => { await sendLink(); if (!authError) setInfo('A new email is on its way.'); }} disabled={disabled} className={linkCls + ' mt-6'}>
            {busy === 'link' ? 'Sending…' : 'Send it again'}
          </button>
          <button type="button" onClick={() => { setMode('signin'); setInfo(null); setLocalError(null); }} disabled={disabled} className={linkCls + ' mt-3'}>
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  const isSignup = mode === 'signup';
  return (
    <div className="min-h-screen font-sans flex flex-col px-6 py-10" style={{ background: IVORY }}>
      <div className="w-full max-w-sm mx-auto flex-1 flex flex-col justify-center">
        {brand('Globeskimmers', isSignup ? 'Your email and a password, and you’re in' : 'Sign in to keep exploring')}

        {/* The phone's own sign-in first: one tap, nothing to type. Sign-up is email and password alone
            (founder, 2026-11-08: "a different page without google and apple"). */}
        {!isSignup && (<>
        <div className="space-y-3">
          <button type="button" onClick={() => runProvider('google')} disabled={disabled}
            className={`${socialCls} bg-white border border-black/10 gap-3 text-[#0F1419]`}>
            {busy === 'google' ? <Loader2 className="w-5 h-5 animate-spin" /> : <GoogleIcon />}
            Continue with Google
          </button>
          <button type="button" onClick={() => runProvider('apple')} disabled={disabled}
            className={`${socialCls} bg-black gap-1 text-white`}>
            {busy === 'apple'
              ? <span className="w-[31px] h-11 shrink-0 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin" /></span>
              : <AppleLogo />}
            Continue with Apple
          </button>
        </div>

        <div className="flex items-center gap-3 my-6">
          <div className="h-px flex-1 bg-black/10" />
          <span className="text-xs font-medium text-black/40 uppercase tracking-wide">or</span>
          <div className="h-px flex-1 bg-black/10" />
        </div>
        </>)}

        {/* Email + password. Create account signs you straight in (no email step). */}
        <form onSubmit={submitPassword} className="space-y-3">
          <input className={inputCls} type="email" autoComplete="email" inputMode="email" autoCapitalize="none" placeholder="Email"
            value={email} onChange={(e) => setEmail(e.target.value)} disabled={disabled} />
          <div className="relative">
            <input className={inputCls + ' pr-12'} type={showPassword ? 'text' : 'password'}
              autoComplete={isSignup ? 'new-password' : 'current-password'} placeholder={isSignup ? 'Choose a password (8+ characters)' : 'Password'}
              value={password} onChange={(e) => setPassword(e.target.value)} disabled={disabled} />
            <button type="button" onClick={() => setShowPassword((s) => !s)} disabled={disabled}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-black/40 hover:text-black/70 disabled:opacity-50 transition">
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          {info && <p className="text-[13px] text-[#0E7C73] font-medium px-1">{info}</p>}
          {errorMsg && <p className="text-[13px] text-red-600 font-medium px-1">{errorMsg}</p>}

          <Button type="submit" disabled={disabled}
            className="w-full h-12 text-white text-[15px] font-semibold rounded-xl shadow-md hover:opacity-95"
            style={{ background: TEAL_DEEP }}>
            {busy === 'password' ? <Loader2 className="w-5 h-5 animate-spin" /> : (isSignup ? 'Create account' : 'Sign in')}
          </Button>

          {!isSignup && (
            <button type="button" onClick={sendLink} disabled={disabled} className={linkCls}>
              {busy === 'link' ? 'Sending…' : 'Forgot your password? Email me a sign-in button'}
            </button>
          )}
        </form>

        <p className="text-center text-[14px] text-black/55 mt-6">
          {isSignup ? 'Already have an account?' : 'New here?'}{' '}
          <button type="button" disabled={disabled}
            onClick={() => { setMode(isSignup ? 'signin' : 'signup'); setInfo(null); setLocalError(null); }}
            className="font-semibold text-[#0E7C73] disabled:opacity-50">
            {isSignup ? 'Sign in' : 'Create an account'}
          </button>
        </p>

        {/* Apple 1.2: people agree to the Terms (no objectionable content, no
            abuse) before they can post anything. Every way in passes here. */}
        <p className="text-center text-[12.5px] leading-snug text-black/50 mt-5">
          By continuing you agree to our{' '}
          <a href="https://globeskimmers.io/legal/terms" target="_blank" rel="noreferrer" className="underline underline-offset-2 text-black/60">Terms</a>
          : no objectionable content or abusive behavior. We remove it and the accounts that post it.
        </p>
      </div>
    </div>
  );
}
