'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient, supabaseConfigured } from '@/lib/supabase/client';
import { SIGNUPS_OPEN } from '@/lib/signups';

export default function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const sp = useSearchParams();
  // Only allow same-origin relative paths — blocks open-redirect via ?next=//evil.com
  // or ?next=https://evil.com (router.push to an absolute URL would navigate away).
  const rawNext = sp.get('next') || '/insights';
  const next = /^\/(?!\/)/.test(rawNext) ? rawNext : '/insights';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  if (!supabaseConfigured) {
    return (
      <div className="auth-card">
        <h1 className="auth-title">Accounts not configured yet</h1>
        <p className="auth-sub">Supabase keys aren&apos;t set in this environment. Add them to <code>.env.local</code> and reload.</p>
      </div>
    );
  }

  // New-account signups are closed (safety guard). Existing users still sign in
  // via /login; only the signup surface is shut off here.
  if (mode === 'signup' && !SIGNUPS_OPEN) {
    return (
      <div className="auth-card">
        <h1 className="auth-title">Sign-ups are closed</h1>
        <p className="auth-sub">Align360 isn&apos;t open for new accounts right now. If you already have an account, you can sign in.</p>
        <Link href="/login" className="auth-link">Go to sign in</Link>
      </div>
    );
  }

  const supabase = createClient();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name }, emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
        });
        if (error) throw error;
        const { data: { session } } = await supabase.auth.getSession();
        if (session) { router.push(next); router.refresh(); } else { setSent(true); }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push(next);
        router.refresh();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setErr('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) setErr(error.message);
  }

  if (sent) {
    return (
      <div className="auth-card">
        <h1 className="auth-title">Check your email</h1>
        <p className="auth-sub">We sent a confirmation link to <strong>{email}</strong>. Click it to finish creating your account.</p>
        <Link href="/login" className="auth-link">Back to sign in</Link>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <h1 className="auth-title">{mode === 'signup' ? 'Create your account' : 'Welcome back'}</h1>
      <p className="auth-sub">{mode === 'signup' ? 'Start your Align360 profile.' : 'Sign in to continue.'}</p>

      <button type="button" className="auth-google" onClick={google}>
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.97 10.72A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3.01-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/></svg>
        Continue with Google
      </button>

      <div className="auth-or"><span>or</span></div>

      <form onSubmit={submit}>
        {mode === 'signup' && (
          <label className="auth-label">Name
            <input className="auth-input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Your name" />
          </label>
        )}
        <label className="auth-label">Email
          <input className="auth-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" />
        </label>
        <label className="auth-label">Password
          <input className="auth-input" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} placeholder="At least 8 characters" />
        </label>
        {err && <div className="auth-err">{err}</div>}
        <button type="submit" className="auth-submit" disabled={busy}>
          {busy ? 'One moment…' : mode === 'signup' ? 'Create account' : 'Sign in'}
        </button>
      </form>

      {(mode === 'signup' || SIGNUPS_OPEN) && (
        <p className="auth-switch">
          {mode === 'signup' ? (
            <>Already have an account? <Link href="/login" className="auth-link">Sign in</Link></>
          ) : (
            <>New here? <Link href="/signup" className="auth-link">Create an account</Link></>
          )}
        </p>
      )}
    </div>
  );
}
