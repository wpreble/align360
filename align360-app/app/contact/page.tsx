'use client';

import '../landing.css';
import './contact.css';
import { useState } from 'react';
import Link from 'next/link';
import AlignMark from '@/app/_components/AlignMark';

const TEAM_SIZES = ['25–50', '50–150', '150+', 'Not sure yet'];

export default function Contact() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [teamSize, setTeamSize] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (!email.trim() || !email.includes('@')) { setErr('Please enter a valid work email.'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, company, teamSize, message }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Something went wrong. Please try again.');
      setSent(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pr">
      <header className="lp-nav">
        <div className="wrap">
          <Link href="/" className="lp-brand"><AlignMark /><span className="lp-word">Align</span></Link>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
            <Link href="/pricing" className="lp-btn ghost small">Pricing</Link>
            <Link href="/chat" className="lp-btn primary small">Log In</Link>
          </div>
        </div>
      </header>

      <main className="ct-wrap">
        <div className="ct-head">
          <div className="ct-eyebrow">Contact</div>
          <h1 className="ct-title">Align360 for your organization</h1>
          <p className="ct-lead">Teams of 25 or more, or want a tailored rollout? Tell us a little and we&apos;ll be in touch to build the right plan with you.</p>
        </div>

        <div className="ct-card">
          {sent ? (
            <div className="ct-ok">
              <div className="ct-ok-mark">&#10003;</div>
              <div className="ct-ok-h">Thanks &mdash; we&apos;ve got it.</div>
              <p className="ct-ok-p">We&apos;ll reach out at <strong>{email}</strong> shortly. In the meantime, feel free to <Link href="/pricing" style={{ color: '#7E1A4C' }}>explore the plans</Link>.</p>
            </div>
          ) : (
            <form onSubmit={submit}>
              {err && <div className="ct-err">{err}</div>}
              <label className="ct-field"><span>Your name</span>
                <input className="ct-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" maxLength={120} autoComplete="name" />
              </label>
              <label className="ct-field"><span>Work email</span>
                <input className="ct-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" maxLength={160} autoComplete="email" />
              </label>
              <label className="ct-field"><span>Organization</span>
                <input className="ct-input" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company or team name" maxLength={160} autoComplete="organization" />
              </label>
              <label className="ct-field"><span>Team size</span>
                <select className="ct-select" value={teamSize} onChange={(e) => setTeamSize(e.target.value)}>
                  <option value="">Select&hellip;</option>
                  {TEAM_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="ct-field"><span>What are you looking for?</span>
                <textarea className="ct-textarea" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="A sentence or two about your team and what you're hoping Align360 can do." maxLength={4000} />
              </label>
              <button className="ct-btn" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send →'}</button>
              <p className="ct-note">We&apos;ll only use this to reach out about Align360. Prefer to self-serve? <Link href="/pricing" style={{ color: '#7E1A4C' }}>See pricing</Link>.</p>
            </form>
          )}
        </div>
      </main>

      <footer className="lp-foot">
        <div className="wrap">
          <AlignMark white />
          <span className="lp-foot-word">Align360</span>
          <span className="lp-foot-copy">&copy; 2026 Align360. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
