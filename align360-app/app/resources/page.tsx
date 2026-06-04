'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getAnswers, STORE_EVENT } from '@/lib/storage';

type Tool = { name: string; slug?: string; badge?: string };
type Framework = { key: string; name: string; status: 'active' | 'preview'; desc: string; tools?: Tool[] };

const FRAMEWORKS: Framework[] = [
  {
    key: 'designsuite', name: 'DesignSuite', status: 'active',
    desc: 'Identity, judgment, resilience, and decision clarity. Understand how you are wired before you build on guesses.',
    tools: [
      { name: 'Wiring for Impact', slug: 'wiring', badge: 'Core' },
      { name: 'Orientation for Impact', slug: 'orientation' },
      { name: 'Rejection Gift Finder', slug: 'rejection-gift' },
      { name: 'Decision Simulation Lab' },
      { name: 'Impact Pathways & Skill Builder' },
      { name: 'Job & Market Trends Intelligence' },
      { name: 'Family Mechanics Simulator' },
    ],
  },
  {
    key: 'careernav', name: 'Career Navigator', status: 'active',
    desc: 'Career clarity, acceleration, and confidence without burnout. Move forward without losing yourself.',
    tools: [
      { name: 'Career Alignment Assessment' },
      { name: 'Resume Analyzer + Builder' },
      { name: 'Job Opportunity Finder' },
      { name: 'Skills Gap Analyzer' },
      { name: 'Interview Preparation' },
      { name: 'Salary Negotiation Calculator' },
      { name: 'LinkedIn Optimization' },
    ],
  },
  { key: 'integrate360', name: 'Integrate360', status: 'preview', desc: 'Life systems alignment: sustainability, wholeness, capacity. Stay aligned as complexity increases.' },
  { key: '627', name: '627 Figures', status: 'preview', desc: 'Leadership, value creation, and income acceleration. Turn experience into influence.' },
  { key: 'legacylab', name: 'LegacyLab', status: 'preview', desc: 'Ownership, succession, and wealth transfer. Preserve and transfer value, not lose it.' },
];

export default function ResourcesPage() {
  const [open, setOpen] = useState<string | null>('designsuite');
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
    <div className="resources-page">
      <div className="resources-intro">
        <h1>Resources</h1>
        <p>The Align360 frameworks. Assessments build your profile; the other tools launch a guided chat with your AI. Expand one to begin.</p>
      </div>

      <div className="fw-list">
        {FRAMEWORKS.map((fw) => {
          const isOpen = open === fw.key;
          return (
            <div key={fw.key} className={`fw${isOpen ? ' open' : ''}`}>
              <button className="fw-head" onClick={() => setOpen(isOpen ? null : fw.key)} aria-expanded={isOpen}>
                <span className={`fw-status ${fw.status}`} />
                <span className="fw-name">{fw.name}</span>
                <span className={`fw-tag ${fw.status}`}>{fw.status === 'active' ? 'Active' : 'Preview'}</span>
                <svg className={`fw-caret${isOpen ? ' open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
              </button>

              {isOpen && (
                <div className="fw-body">
                  <p className="fw-desc">{fw.desc}</p>
                  {fw.status === 'preview' ? (
                    <div className="fw-preview">Coming after the alpha. This framework is in preview.</div>
                  ) : (
                    <div className="fw-tools">
                      {fw.tools!.map((t) => {
                        // Assessment (has a slug): completed → view result; else take it.
                        if (t.slug) {
                          const completed = done[t.slug];
                          return (
                            <Link
                              key={t.name}
                              href={completed ? '/insights/profile' : `/assessment/${t.slug}`}
                              className="fw-tool live"
                            >
                              <span className="fw-tool-dot" />
                              <span className="fw-tool-name">{t.name}</span>
                              {t.badge && <span className="fw-tool-badge">{t.badge}</span>}
                              {completed && <span className="fw-tool-done">✓ Completed</span>}
                              <span className="fw-tool-go">{completed ? 'View result →' : 'Start →'}</span>
                            </Link>
                          );
                        }
                        // Non-assessment tool: launch a guided chat ("Run <name>").
                        return (
                          <Link
                            key={t.name}
                            href={`/chat?run=${encodeURIComponent(t.name)}`}
                            className="fw-tool live"
                          >
                            <span className="fw-tool-dot" />
                            <span className="fw-tool-name">{t.name}</span>
                            <span className="fw-tool-go">Run →</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
