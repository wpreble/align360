'use client';

import './subscribe.css';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, supabaseConfigured } from '@/lib/supabase/client';

export default function SubscribePage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // If the user already has access (admin or active sub), don't show the paywall.
  useEffect(() => {
    fetch('/api/access/status').then((r) => r.json()).then((d) => { if (d?.access) router.replace('/insights'); }).catch(() => {});
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
