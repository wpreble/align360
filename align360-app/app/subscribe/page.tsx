'use client';

import './subscribe.css';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, supabaseConfigured } from '@/lib/supabase/client';
import { createOrg } from '@/lib/orgs';

const ORG_SEAT_USD = 19;
const MIN_SEATS = 5;

export default function SubscribePage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [plan, setPlan] = useState<'individual' | 'org'>('individual');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Organization form state.
  const [orgName, setOrgName] = useState('');
  const [contactName, setContactName] = useState('');
  const [workEmail, setWorkEmail] = useState('');
  const [seats, setSeats] = useState(MIN_SEATS);

  // Prefill contact from the signed-in account; skip the paywall if already active.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (supabaseConfigured) {
          createClient().auth.getUser().then(({ data }) => {
            if (cancelled) return;
            if (data.user?.email) setWorkEmail((e) => e || data.user!.email!);
          }).catch(() => {});
        }
        try { const n = localStorage.getItem('align360:name'); if (n) setContactName((c) => c || n); } catch {}
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

  async function subscribeIndividual() {
    setErr(''); setBusy(true);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'individual' }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || 'Could not start checkout. Please try again.');
      window.location.href = data.url;
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong'); setBusy(false);
    }
  }

  async function subscribeOrg(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (!orgName.trim()) { setErr('Enter your organization name.'); return; }
    const n = Math.max(MIN_SEATS, Math.floor(Number(seats) || MIN_SEATS));
    setBusy(true);
    try {
      // 1) Create the org (you become the owner), then 2) checkout the seats.
      const orgId = await createOrg(orgName);
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'org', orgId, seats: n, contactName: contactName.trim(), contactEmail: workEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || 'Could not start checkout. Please try again.');
      window.location.href = data.url;
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not start your organization. Please try again.');
      setBusy(false);
    }
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

  const orgTotal = Math.max(MIN_SEATS, Math.floor(Number(seats) || MIN_SEATS)) * ORG_SEAT_USD;

  return (
    <div className="sub-page">
      <div className="sub-card">
        <div className="sub-eyebrow">Align360</div>
        <h1 className="sub-title">Activate your account</h1>
        <p className="sub-sub">Choose how you want to use Align360. Start your plan to unlock your full profile, every assessment, and your AI guide.</p>

        <div className="sub-seg" role="tablist" aria-label="Plan type">
          <button role="tab" aria-selected={plan === 'individual'} className={`sub-seg-btn${plan === 'individual' ? ' on' : ''}`} onClick={() => { setPlan('individual'); setErr(''); }}>Just me</button>
          <button role="tab" aria-selected={plan === 'org'} className={`sub-seg-btn${plan === 'org' ? ' on' : ''}`} onClick={() => { setPlan('org'); setErr(''); }}>My team</button>
        </div>

        {err && <div className="sub-err">{err}</div>}

        {plan === 'individual' ? (
          <>
            <div className="sub-plan">
              <div className="sub-plan-name">Individual</div>
              <div className="sub-price"><span>$25</span>/month</div>
              <div className="sub-alpha">Alpha pilot price</div>
              <ul className="sub-feats">
                <li>Your full combined profile and every assessment</li>
                <li>An AI guide that knows how you are wired</li>
                <li>Clarity Layer reports and frameworks</li>
              </ul>
            </div>
            <button className="sub-btn" onClick={subscribeIndividual} disabled={busy}>{busy ? 'Starting checkout…' : 'Subscribe →'}</button>
          </>
        ) : (
          <form onSubmit={subscribeOrg}>
            <div className="sub-plan">
              <div className="sub-plan-name">Team</div>
              <div className="sub-price"><span>${ORG_SEAT_USD}</span>/seat / month</div>
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
            <label className="sub-field"><span>Your name</span>
              <input className="sub-input" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Contact name" maxLength={60} />
            </label>
            <label className="sub-field"><span>Work email</span>
              <input className="sub-input" type="email" value={workEmail} onChange={(e) => setWorkEmail(e.target.value)} placeholder="you@company.com" maxLength={120} />
            </label>
            <label className="sub-field"><span>Seats <small>(minimum {MIN_SEATS})</small></span>
              <div className="sub-seats">
                <button type="button" className="sub-step" onClick={() => setSeats((s) => Math.max(MIN_SEATS, s - 1))} aria-label="Fewer seats">−</button>
                <input className="sub-input sub-seats-in" type="number" min={MIN_SEATS} value={seats} onChange={(e) => setSeats(Math.max(MIN_SEATS, Math.floor(Number(e.target.value) || MIN_SEATS)))} />
                <button type="button" className="sub-step" onClick={() => setSeats((s) => s + 1)} aria-label="More seats">+</button>
              </div>
            </label>
            <div className="sub-total">${orgTotal}<small>/month for {Math.max(MIN_SEATS, Math.floor(Number(seats) || MIN_SEATS))} seats</small></div>

            <button className="sub-btn" type="submit" disabled={busy}>{busy ? 'Starting checkout…' : 'Continue to checkout →'}</button>
          </form>
        )}

        <button className="sub-link" onClick={async () => { try { if (supabaseConfigured) await createClient().auth.signOut(); } catch {} window.location.href = '/login'; }}>Use a different account</button>
        <p className="sub-note">Secure checkout via Stripe. Cancel anytime.{plan === 'org' ? ' After payment, invite your team from the org dashboard.' : ''}</p>
      </div>
    </div>
  );
}
