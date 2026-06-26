'use client';

import './subscribe.css';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, supabaseConfigured } from '@/lib/supabase/client';

export default function SubscribePage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const [checking, setChecking] = useState(true);

  // If the user already has access, skip the paywall. First reconcile with Stripe
  // (covers a just-completed checkout whose webhook has not landed yet), then
  // fall back to the plain access check.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await fetch('/api/stripe/sync', { method: 'POST' }).then((r) => r.json()).catch(() => null);
        if (!cancelled && s?.access) { router.replace('/insights'); return; }
        const d = await fetch('/api/access/status').then((r) => r.json()).catch(() => null);
        if (!cancelled && d?.access) { router.replace('/insights'); return; }
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  async function subscribe() {
    setErr('');
    setBusy(true);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'individual' }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || 'Could not start checkout. Please try again.');
      window.location.href = data.url;
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong');
      setBusy(false);
    }
  }

  async function signOut() {
    try { if (supabaseConfigured) await createClient().auth.signOut(); } catch {}
    window.location.href = '/login';
  }

  if (checking) {
    return (
      <div className="sub-page">
        <div className="sub-card" style={{ textAlign: 'center' }}>
          <div className="sub-eyebrow">Align360</div>
          <p className="sub-sub" style={{ marginTop: 18 }}>Checking your account&hellip;</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sub-page">
      <div className="sub-card">
        <div className="sub-eyebrow">Align360</div>
        <h1 className="sub-title">Activate your account</h1>
        <p className="sub-sub">Align360 is a subscription. Start your plan to unlock your full profile, every assessment, and your AI guide.</p>
        <div className="sub-plan">
          <div className="sub-plan-name">Individual</div>
          <div className="sub-price"><span>$49</span>/month</div>
          <ul className="sub-feats">
            <li>Your full combined profile and every assessment</li>
            <li>An AI guide that knows how you are wired</li>
            <li>Clarity Layer reports and frameworks</li>
          </ul>
        </div>
        {err && <div className="sub-err">{err}</div>}
        <button className="sub-btn" onClick={subscribe} disabled={busy}>{busy ? 'Starting checkout…' : 'Subscribe →'}</button>
        <button className="sub-link" onClick={signOut}>Use a different account</button>
        <p className="sub-note">Secure checkout via Stripe. Cancel anytime.</p>
      </div>
    </div>
  );
}
