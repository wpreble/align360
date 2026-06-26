'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { PSR } from '@/lib/report';

export const ROMANS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];

/** Reveal `.report .reveal` blocks on scroll; fallback reveals all after 2.5s so
 *  nothing can stay permanently hidden if the observer misbehaves. */
export function useReveal(dep?: unknown) {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll('.report .reveal'));
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visible'); }),
      { threshold: 0.08 },
    );
    els.forEach((el) => obs.observe(el));
    const t = setTimeout(() => els.forEach((el) => el.classList.add('visible')), 2500);
    return () => { obs.disconnect(); clearTimeout(t); };
  }, [dep]);
}

/** True after first paint, to drive bar-grow transitions from 0 to target. */
export function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => { const r = requestAnimationFrame(() => setM(true)); return () => cancelAnimationFrame(r); }, []);
  return m;
}

export function PSRTrio({ psr, labels }: { psr: PSR; labels?: [string, string, string] }) {
  const L = labels || ['Under Pressure', 'Under Stress', 'Risk Posture'];
  const items: [string, string, { heading: string; body: string }][] = [
    ['p', L[0], psr.pressure],
    ['s', L[1], psr.stress],
    ['r', L[2], psr.risk],
  ];
  return (
    <div className="psr-trio">
      {items.map(([k, lbl, v]) => (
        <div className={`psr ${k}`} key={k}>
          <div className="psr-lbl">{lbl}</div>
          <div className="psr-h">{v.heading}</div>
          <div className="psr-b">{v.body}</div>
        </div>
      ))}
    </div>
  );
}

type DoneMap = { wiring: boolean; orientation: boolean; 'rejection-gift': boolean };

export function CompletionBlock({ done }: { done: DoneMap }) {
  const steps = [
    { key: 'wiring', label: 'Wiring' },
    { key: 'orientation', label: 'Orientation' },
    { key: 'rejection-gift', label: 'Rejection Gift' },
  ] as const;
  const count = steps.filter((s) => done[s.key]).length;
  const pct = Math.round((count / 3) * 100);
  const allDone = count === 3;
  const next = steps.find((s) => !done[s.key]);
  return (
    <div className="chapter reveal">
      <div className="completion">
        <div className="comp-row">
          <div className="comp-label">DesignSuite profile completion<span>{count} of 3 assessments complete</span></div>
          <div className="comp-pct">{pct}%</div>
        </div>
        <div className="steps">{steps.map((s) => <div key={s.key} className={`step${done[s.key] ? ' done' : ''}`} />)}</div>
        <div className="step-labels">{steps.map((s) => <div key={s.key} className={`slabel${done[s.key] ? ' done' : ''}`}>{s.label}{done[s.key] ? ' ✦' : ''}</div>)}</div>
        <div className="comp-note">
          {allDone
            ? 'DesignSuite complete. Your combined identity profile is ready. See how all three signals converge into your full strategic model.'
            : `Next: ${next?.label}. Each assessment compounds the previous one to produce your complete strategic identity.`}
        </div>
        {allDone
          ? <Link href="/insights/profile" className="comp-cta">View combined profile →</Link>
          : <Link href={`/assessment/${next?.key}`} className="comp-cta">Take {next?.label} →</Link>}
      </div>
    </div>
  );
}

export function RepChrome({ generated, demo, onRegen }: { generated: boolean; demo: boolean; onRegen: () => void }) {
  // Sticky header bar within the report (clear of the app sidebar): Back on the
  // left where it belongs, actions on the right.
  return (
    <div className="rep-bar">
      <Link href="/insights" className="rep-btn">← Insights</Link>
      <div className="rep-bar-actions">
        {!generated && <span className="rep-flag">Preview</span>}
        {!demo && <button className="rep-btn" onClick={onRegen}>↻ Regenerate</button>}
        <button className="rep-btn primary" onClick={() => window.print()}>↓ PDF</button>
      </div>
    </div>
  );
}
