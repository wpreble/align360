'use client';

import '../landing.css';
import './fit.css';
import { useState } from 'react';
import Link from 'next/link';
import AlignMark from '@/app/_components/AlignMark';

/**
 * Find Your Fit — segmentation funnel. Ported from Samuel's
 * align360_find_your_fit.html (2026-08-31) with the copy kept verbatim.
 *
 * The original was wired as a Netlify form (`data-netlify="true"`), which is inert
 * on Vercel, so the form would have silently collected nothing. It now posts to
 * /api/contact, the same route the enterprise contact form uses, carrying the
 * selected audience through to HubSpot.
 *
 * The Book a Call link is Samuel's Calendly and is preserved exactly as supplied.
 */

const BOOK_A_CALL = 'https://calendly.com/samuel-align360/30min';

type Key = 'enterprise' | 'advisors' | 'family' | 'school';

const OPTIONS: { key: Key; title: string; sub: string }[] = [
  { key: 'enterprise', title: 'Enterprise', sub: 'CEO, COO, CHRO, or transformation leader' },
  { key: 'advisors', title: 'Advisors & Operators', sub: 'M&A integration, fractional COO, executive coach' },
  { key: 'family', title: 'Family Office', sub: 'Principal, family office executive, or advisor' },
  { key: 'school', title: 'School', sub: 'Superintendent, principal, or counseling director' },
];

const DETAIL: Record<Key, { eyebrow: string; pitch: string; qa: { q: string; a: string }[] }> = {
  enterprise: {
    eyebrow: 'For Enterprise',
    pitch: 'Align helps leaders see, fix, and measure people problems before they become expensive business problems.',
    qa: [
      { q: 'Why you should care:', a: "Preventable people costs, leadership bandwidth, and dependency risk are already on your P&L. They're just invisible until they've already cost you." },
      { q: "What's in it for you:", a: 'Better talent deployment, recovered leadership time and capacity, less dependency, better execution. Measured, not assumed.' },
      { q: 'Why Align:', a: 'One living model of your people that gets more useful the longer it runs, not a one-time survey or a static dashboard you have to re-interpret every quarter.' },
    ],
  },
  advisors: {
    eyebrow: 'For Advisors & Operators',
    pitch: 'Align helps advisors see more, intervene better, and prove the work, without replacing your methodology.',
    qa: [
      { q: 'Why you should care:', a: "You're already diagnosing these conditions by hand, slowly. A consultant is an intervention; your clients need something that outlasts the engagement." },
      { q: "What's in it for you:", a: 'Sharper diagnosis, measurable value instead of anecdote, and a persistent reason your clients bring you back.' },
      { q: 'Why Align:', a: "The same underlying intelligence layer works across M&A integration, fractional operating, and coaching. You get the infrastructure, we don't touch your methodology." },
    ],
  },
  family: {
    eyebrow: 'For Family Offices',
    pitch: 'Align helps family offices strengthen the human side of wealth: development, relationships, readiness, succession, and legacy.',
    qa: [
      { q: 'Why you should care:', a: 'Your advisors manage the wealth. Almost nobody is systematically developing the people who will inherit responsibility for it.' },
      { q: "What's in it for you:", a: 'Evidence-based succession readiness, captured institutional judgment, and a family that trusts what gets surfaced because each member gets real value too.' },
      { q: 'Why Align:', a: "Relationship Bridge™ lets Align work across an entire family system, parent, sibling, advisor, without collapsing everyone's privacy into one shared view." },
    ],
  },
  school: {
    eyebrow: 'For Schools',
    pitch: 'Align helps schools understand and develop students more effectively, from enrollment through graduation.',
    qa: [
      { q: 'Why you should care:', a: 'One counselor for hundreds of students means real problems get caught after the crisis, not before it.' },
      { q: "What's in it for you:", a: "Give every student the guidance of a dedicated counselor, without replacing the counselor, and catch disengagement while it's still reversible." },
      { q: 'Why Align:', a: 'One student model that starts in 9th grade and keeps compounding, not a one-time career quiz that resets every year.' },
    ],
  },
};

const ORG_SIZES = ['1-24', '25-49', '50-499', '500-999', '1,000+'];

export default function FindYourFit() {
  const [picked, setPicked] = useState<Key | null>(null);
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [email, setEmail] = useState('');
  const [org, setOrg] = useState('');
  const [orgSize, setOrgSize] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (!name.trim()) { setErr('Please enter your name.'); return; }
    if (!email.trim() || !email.includes('@')) { setErr('Please enter a valid email.'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, email, title,
          company: org,
          teamSize: orgSize,
          message,
          audience: picked ? OPTIONS.find((o) => o.key === picked)?.title : '',
          source: 'find_your_fit',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Something went wrong.');
      setSent(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  const d = picked ? DETAIL[picked] : null;

  return (
    <div className="fyf">
      <div className="fyf-wrap">
        <header className="fyf-head">
          <AlignMark />
          <span className="fyf-word">ALIGN</span>
        </header>

        <h1 className="fyf-h1">Which one are you?</h1>
        <p className="fyf-sub">Tell us, and we&apos;ll show you the version of Align built for you.</p>

        <div className="fyf-cards">
          {OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              className={`fyf-card ${picked === o.key ? 'on' : ''}`}
              aria-pressed={picked === o.key}
              onClick={() => setPicked(o.key)}
            >
              <span className="fyf-card-t">{o.title}</span>
              <span className="fyf-card-s">{o.sub}</span>
            </button>
          ))}
        </div>

        {d && (
          <section className="fyf-detail">
            <div className="fyf-eyebrow">{d.eyebrow}</div>
            <p className="fyf-pitch">{d.pitch}</p>
            {d.qa.map((x) => (
              <div className="fyf-qa" key={x.q}>
                <b>{x.q}</b>
                <p>{x.a}</p>
              </div>
            ))}
          </section>
        )}

        {picked && (
          <section>
            <div className="fyf-label">Tell us more</div>

            {sent ? (
              <div className="fyf-form fyf-sent">
                <h2>Thanks. That&apos;s with us.</h2>
                <p>We&apos;ll come back to you shortly. If you&apos;d rather just talk, grab a time below.</p>
              </div>
            ) : (
              <form className="fyf-form" onSubmit={submit} noValidate>
                <div className="fyf-row2">
                  <div className="fyf-field">
                    <label htmlFor="fyf-name">Name</label>
                    <input id="fyf-name" value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                  <div className="fyf-field">
                    <label htmlFor="fyf-title">Title</label>
                    <input id="fyf-title" value={title} onChange={(e) => setTitle(e.target.value)} />
                  </div>
                </div>
                <div className="fyf-row2">
                  <div className="fyf-field">
                    <label htmlFor="fyf-email">Email</label>
                    <input id="fyf-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className="fyf-field">
                    <label htmlFor="fyf-org">Organization</label>
                    <input id="fyf-org" value={org} onChange={(e) => setOrg(e.target.value)} />
                  </div>
                </div>
                <div className="fyf-field">
                  <label htmlFor="fyf-size">Organization size</label>
                  <select id="fyf-size" value={orgSize} onChange={(e) => setOrgSize(e.target.value)}>
                    <option value="">Select one</option>
                    {ORG_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="fyf-field">
                  <label htmlFor="fyf-msg">What are you hoping to explore?</label>
                  <textarea id="fyf-msg" value={message} onChange={(e) => setMessage(e.target.value)} />
                </div>
                {err && <p className="fyf-err">{err}</p>}
                <button type="submit" className="fyf-submit" disabled={busy}>
                  {busy ? 'Sending…' : 'Send Inquiry'}
                </button>
              </form>
            )}

            <div className="fyf-or"><span>OR</span></div>

            <div className="fyf-book">
              <div className="fyf-book-t">Skip the form. Grab time directly.</div>
              <div className="fyf-book-s">30 minutes, no prep needed.</div>
              <a className="fyf-book-btn" href={BOOK_A_CALL} target="_blank" rel="noopener noreferrer">Book a Call</a>
            </div>
          </section>
        )}

        <footer className="fyf-foot">
          ALIGN360 · <Link href="/">align360.io</Link>
        </footer>
      </div>
    </div>
  );
}
