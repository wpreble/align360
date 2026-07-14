'use client';

import '../../subscribe/subscribe.css';
import '../../login/auth.css';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient, supabaseConfigured } from '@/lib/supabase/client';
import { createOrg } from '@/lib/orgs';

const SEAT_USD = 19;
const MIN_SEATS = 5;
const MAX_SEATS = 25; // 25+ is Enterprise (sales-led — see /pricing)
const PENDING_KEY = 'align360:pendingOrg';

type Pending = { orgName: string; seats: number };

/**
 * Org-FIRST team signup. The buyer establishes the organization (name + seats)
 * up front, then the admin account — so it's clear they're signing up an org, not
 * themselves. Flow: create org (you become owner) → seat checkout → org dashboard.
 * Reuses the same createOrg + org-mode checkout the /subscribe "My team" tab uses.
 */
export default function TeamSignupPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<'loading' | 'form' | 'sent' | 'finishing'>('loading');
  const [authed, setAuthed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const [orgName, setOrgName] = useState('');
  const [seats, setSeats] = useState(MIN_SEATS);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const clampSeats = (n: number) => Math.min(MAX_SEATS, Math.max(MIN_SEATS, Math.floor(n) || MIN_SEATS));

  // Create the org (caller becomes owner), start seat checkout, and fall back to
  // the org dashboard when checkout isn't available (billing dormant / unconfigured).
  const finishOrg = useCallback(async (o: string, n: number) => {
    setPhase('finishing'); setErr('');
    try {
      const orgId = await createOrg(o);
      try {
        const res = await fetch('/api/stripe/checkout', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'org', orgId, seats: n }),
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.url) { try { localStorage.removeItem(PENDING_KEY); } catch {} window.location.href = data.url; return; }
      } catch { /* fall through to dashboard */ }
      try { localStorage.removeItem(PENDING_KEY); } catch {}
      router.replace(`/org/${orgId}?setup=1`);
    } catch (e) {
      try { localStorage.removeItem(PENDING_KEY); } catch {}
      setErr(e instanceof Error ? e.message : 'Could not create your organization. Please try again.');
      setPhase('form');
    }
  }, [router]);

  // On mount: if already signed in and returning from signup/OAuth with a pending
  // org (or ?complete=1), finish automatically; otherwise show the form.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabaseConfigured) { setPhase('form'); return; }
      let user: { email?: string } | null = null;
      try { const { data } = await createClient().auth.getUser(); user = data.user; } catch {}
      if (cancelled) return;
      setAuthed(!!user);
      let pending: Pending | null = null;
      try { const raw = localStorage.getItem(PENDING_KEY); if (raw) pending = JSON.parse(raw); } catch {}
      let complete = false;
      try { complete = new URLSearchParams(window.location.search).get('complete') === '1'; } catch {}
      if (user && (pending || complete)) {
        const o = pending?.orgName || orgName;
        const n = clampSeats(pending?.seats || seats);
        if (o) { finishOrg(o, n); return; }
      }
      if (user?.email) setEmail(user.email);
      if (pending) { setOrgName((v) => v || pending!.orgName); setSeats(clampSeats(pending!.seats)); }
      setPhase('form');
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function validate(): boolean {
    if (!orgName.trim()) { setErr('Enter your organization name.'); return false; }
    return true;
  }
  function stashPending() {
    try { localStorage.setItem(PENDING_KEY, JSON.stringify({ orgName: orgName.trim(), seats: clampSeats(seats) })); } catch {}
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (!validate()) return;
    if (authed) { finishOrg(orgName.trim(), clampSeats(seats)); return; }
    if (!supabaseConfigured) { setErr('Accounts are not configured in this environment.'); return; }
    setBusy(true);
    try {
      stashPending();
      const supabase = createClient();
      const next = '/signup/team?complete=1';
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: name }, emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
      });
      if (error) throw error;
      const { data: { session } } = await supabase.auth.getSession();
      if (session) { finishOrg(orgName.trim(), clampSeats(seats)); }
      else { setPhase('sent'); }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not create your account.');
      setBusy(false);
    }
  }

  async function google() {
    setErr('');
    if (!validate()) return;
    if (!supabaseConfigured) { setErr('Accounts are not configured in this environment.'); return; }
    stashPending();
    const next = '/signup/team?complete=1';
    const { error } = await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) setErr(error.message);
  }

  const total = clampSeats(seats) * SEAT_USD;

  if (phase === 'loading' || phase === 'finishing') {
    return (
      <div className="sub-page"><div className="sub-card" style={{ textAlign: 'center' }}>
        <div className="sub-eyebrow">Align360 · Teams</div>
        <p className="sub-sub" style={{ marginTop: 18 }}>{phase === 'finishing' ? 'Setting up your organization…' : 'One moment…'}</p>
      </div></div>
    );
  }

  if (phase === 'sent') {
    return (
      <div className="sub-page"><div className="sub-card" style={{ textAlign: 'center' }}>
        <div className="sub-eyebrow">Align360 · Teams</div>
        <h1 className="sub-title">Confirm your email</h1>
        <p className="sub-sub">We sent a link to <strong>{email}</strong>. Click it to finish creating <strong>{orgName}</strong> and set up your team.</p>
        <Link href="/login" className="sub-link">Back to sign in</Link>
      </div></div>
    );
  }

  return (
    <div className="sub-page">
      <div className="sub-card">
        <div className="sub-eyebrow">Align360 · Teams</div>
        <h1 className="sub-title">Set up your organization</h1>
        <p className="sub-sub">You&apos;re creating a team account. Name your organization and choose seats — you&apos;ll be the owner, then invite your team.</p>

        {err && <div className="sub-err">{err}</div>}

        <form onSubmit={onSubmit}>
          <div className="sub-plan">
            <div className="sub-plan-name">Team</div>
            <div className="sub-price"><span>${SEAT_USD}</span>/seat / month</div>
            <div className="sub-alpha">Alpha pilot price</div>
            <ul className="sub-feats">
              <li>Everything in Individual, for every seat</li>
              <li>Invite your team by email and assign seats</li>
              <li>One bill, managed from your org dashboard</li>
            </ul>
          </div>

          <label className="sub-field"><span>Organization name</span>
            <input className="sub-input" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Acme Inc." maxLength={80} required />
          </label>

          <label className="sub-field"><span>Seats <small>({MIN_SEATS}–{MAX_SEATS})</small></span>
            <div className="sub-seats">
              <button type="button" className="sub-step" onClick={() => setSeats((s) => clampSeats(s - 1))} aria-label="Fewer seats">−</button>
              <input className="sub-input sub-seats-in" type="number" min={MIN_SEATS} max={MAX_SEATS} value={seats} onChange={(e) => setSeats(clampSeats(Number(e.target.value)))} />
              <button type="button" className="sub-step" onClick={() => setSeats((s) => clampSeats(s + 1))} aria-label="More seats">+</button>
            </div>
          </label>
          <div className="sub-total">${total}<small>/month for {clampSeats(seats)} seats</small></div>

          {!authed && (
            <>
              <div style={{ textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', margin: '6px 0 10px' }}>Your admin account</div>
              <button type="button" className="auth-google" onClick={google} style={{ marginBottom: 12 }}>
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.97 10.72A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3.01-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/></svg>
                Continue with Google
              </button>
              <div className="auth-or"><span>or</span></div>
              <label className="sub-field"><span>Your name</span>
                <input className="sub-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={60} autoComplete="name" />
              </label>
              <label className="sub-field"><span>Work email</span>
                <input className="sub-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" maxLength={120} autoComplete="email" required />
              </label>
              <label className="sub-field"><span>Password</span>
                <input className="sub-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" minLength={8} autoComplete="new-password" required />
              </label>
            </>
          )}

          <button className="sub-btn" type="submit" disabled={busy}>{busy ? 'One moment…' : authed ? 'Create organization →' : 'Create team account →'}</button>
        </form>

        <p className="sub-note">Alpha pilot pricing, subject to change. Minimum 5 seats — need 25+? <a href="/contact" style={{ color: 'var(--accent)' }}>Contact us</a>. Secure checkout via Stripe.</p>
        <Link href="/pricing" className="sub-link">← Back to pricing</Link>
      </div>
    </div>
  );
}
