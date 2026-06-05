'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getAnswers, STORE_EVENT } from '@/lib/storage';

type Tool = { name: string; slug?: string };
type Family = { key: string; name: string; accent: string; status: 'live' | 'soon'; blurb: string; tools: Tool[] };

// The full system from the Knowledge File (System Prompt §15 stacks). The three
// DesignSuite assessments (slug) route to the runner / Insights; every other
// live tool launches a guided chat ("Run <name>"). Coming-soon families are locked.
const FAMILIES: Family[] = [
  {
    key: 'design', name: 'DesignSuite', accent: '#A03A6E', status: 'live',
    blurb: 'Understand how you are wired: identity, judgment, resilience, and decision clarity.',
    tools: [
      { name: 'Wiring for Impact', slug: 'wiring' },
      { name: 'Orientation for Impact', slug: 'orientation' },
      { name: 'Rejection Gift Finder', slug: 'rejection-gift' },
      { name: 'Decision Simulation Lab' },
      { name: 'Impact Pathways' },
      { name: 'Job & Market Trends' },
      { name: 'Family Mechanics Simulator' },
    ],
  },
  {
    key: 'career', name: 'Career Navigator', accent: '#2E7D6E', status: 'live',
    blurb: 'Move forward without losing yourself: clarity, acceleration, and confidence.',
    tools: [
      { name: 'Career Alignment Assessment' },
      { name: 'Resume Analyzer + Builder' },
      { name: 'Job Opportunity Finder' },
      { name: 'Skills Gap Analyzer' },
      { name: 'Job Market Insights' },
      { name: 'Interview Preparation' },
      { name: 'Salary Negotiation Calculator' },
      { name: 'LinkedIn Optimization' },
    ],
  },
  {
    key: 'integrate', name: 'Integrate360', accent: '#3A5BA0', status: 'soon',
    blurb: 'Life systems alignment: sustainability, wholeness, and capacity.',
    tools: [
      { name: 'Alignment Coach' }, { name: 'Formation360' }, { name: 'Financial Steward' },
      { name: 'Career360' }, { name: 'Relationship360' }, { name: 'Capacity360' }, { name: 'Life Integration Dashboard' },
    ],
  },
  {
    key: 'figures', name: '627 Figures', accent: '#9A6E2E', status: 'soon',
    blurb: 'Leadership, value creation, and income acceleration: turn experience into influence.',
    tools: [
      { name: 'Risk & Readiness' }, { name: 'Signal & Story' }, { name: 'OfferCraft' },
      { name: 'Growth Channels' }, { name: 'Build Systems' }, { name: 'Venture Pathways' },
    ],
  },
  {
    key: 'legacy', name: 'LegacyLab', accent: '#6E3F8A', status: 'soon',
    blurb: 'Ownership, succession, and wealth transfer: preserve and transfer value.',
    tools: [
      { name: 'Transition Readiness' }, { name: 'Legacy Mapping' }, { name: 'Successor Matching' },
      { name: 'Transition Planning' }, { name: 'Knowledge Transfer' }, { name: 'Post-Transfer Stewardship' }, { name: 'YM Lab' },
    ],
  },
];

export default function FrameworksPage() {
  const [done, setDone] = useState<Record<string, boolean>>({});

  const refresh = useCallback(() => {
    const answers = getAnswers();
    const d: Record<string, boolean> = {};
    for (const slug of Object.keys(answers)) d[slug] = true;
    setDone(d);
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(STORE_EVENT, refresh);
    return () => window.removeEventListener(STORE_EVENT, refresh);
  }, [refresh]);

  return (
    <div className="fwk-page">
      <div className="fwk-intro">
        <h1>Frameworks</h1>
        <p>The full Align360 system. DesignSuite and Career Navigator are live; the rest are coming soon. Tap a tool to begin.</p>
      </div>

      {FAMILIES.map((f) => (
        <section className={`fwk-family${f.status === 'soon' ? ' soon' : ''}`} key={f.key} style={{ ['--fwa']: f.accent } as CSSProperties}>
          <div className="fwk-head">
            <span className="fwk-name">{f.name}</span>
            <span className={`fwk-status ${f.status}`}>{f.status === 'live' ? 'Live' : 'Coming soon'}</span>
          </div>
          <p className="fwk-blurb">{f.blurb}</p>
          <div className="fwk-tools">
            {f.tools.map((t) => {
              if (f.status === 'soon') {
                return (
                  <span className="fwk-tool locked" key={t.name}>
                    <span className="fwk-dot" />
                    <span className="fwk-tool-name">{t.name}</span>
                    <span className="fwk-lock" aria-hidden>🔒</span>
                  </span>
                );
              }
              if (t.slug) {
                const completed = done[t.slug];
                return (
                  <Link key={t.name} href={completed ? '/insights/profile' : `/assessment/${t.slug}`} className="fwk-tool live">
                    <span className="fwk-dot" />
                    <span className="fwk-tool-name">{t.name}</span>
                    <span className="fwk-go">{completed ? 'View result →' : 'Start →'}</span>
                  </Link>
                );
              }
              return (
                <Link key={t.name} href={`/chat?run=${encodeURIComponent(t.name)}`} className="fwk-tool live">
                  <span className="fwk-dot" />
                  <span className="fwk-tool-name">{t.name}</span>
                  <span className="fwk-go">Run →</span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
