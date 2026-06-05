'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getAnswers, STORE_EVENT } from '@/lib/storage';

type Kind = 'assessment' | 'guided' | 'video' | 'guide';
type Item = {
  id: string;
  kind: Kind;
  title: string;
  desc: string;
  meta?: string;          // e.g. "12 questions", "6 min", "PDF"
  slug?: string;          // assessment route
  runName?: string;       // guided chat launch
  soon?: boolean;         // placeholder content
};
type Section = { title: string; sub?: string; items: Item[] };

const SECTIONS: Section[] = [
  {
    title: 'Watch',
    sub: 'Short videos to get the most from Align360.',
    items: [
      { id: 'v1', kind: 'video', soon: true, title: 'Welcome to Align360', desc: 'A 3-minute orientation to how the system works.', meta: '3 min' },
      { id: 'v2', kind: 'video', soon: true, title: 'Reading Your Profile', desc: 'Make sense of your combined identity document.', meta: '5 min' },
      { id: 'v3', kind: 'video', soon: true, title: 'The Nine Gifts', desc: 'A tour of the wiring gifts and what they mean.', meta: '8 min' },
      { id: 'v4', kind: 'video', soon: true, title: 'Aligning for the AI Era', desc: 'Positioning your edge as the market shifts.', meta: '6 min' },
    ],
  },
  {
    title: 'Guides & Docs',
    sub: 'Read at your own pace.',
    items: [
      { id: 'g1', kind: 'guide', soon: true, title: 'The Align360 Field Guide', desc: 'Concepts, language, and how the frameworks connect.', meta: 'PDF' },
      { id: 'g2', kind: 'guide', soon: true, title: 'True Riches Currency Map', desc: 'The currencies that compound regardless of market.', meta: 'PDF' },
      { id: 'g3', kind: 'guide', soon: true, title: 'Rejection Gift Workbook', desc: 'Turn a specific setback into a named advantage.', meta: 'Worksheet' },
      { id: 'g4', kind: 'guide', soon: true, title: 'Career Navigator Playbook', desc: 'A step-by-step for your next move.', meta: 'PDF' },
    ],
  },
];

const ICONS: Record<Kind, string> = {
  assessment: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  guided: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  video: 'M23 7l-7 5 7 5V7zM1 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H1z',
  guide: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
};
const KIND_LABEL: Record<Kind, string> = { assessment: 'Assessment', guided: 'Guided', video: 'Video', guide: 'Doc' };

function Icon({ d }: { d: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
}

export default function ResourcesPage() {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState<Item | null>(null);

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function cardInner(it: Item) {
    const completed = it.slug && done[it.slug];
    return (
      <>
        <span className={`lib-poster k-${it.kind}`}>
          <span className="lib-poster-icon"><Icon d={ICONS[it.kind]} /></span>
          <span className="lib-kind">{KIND_LABEL[it.kind]}</span>
          {completed && <span className="lib-done">✓ Done</span>}
          {it.soon && <span className="lib-soon">Soon</span>}
        </span>
        <span className="lib-card-body">
          <span className="lib-title">{it.title}</span>
          <span className="lib-desc">{it.desc}</span>
          {it.meta && <span className="lib-meta">{it.meta}</span>}
        </span>
      </>
    );
  }

  return (
    <div className="lib-page">
      <div className="lib-intro">
        <h1>Resources</h1>
        <p>Videos and guides to go deeper. Tap any card to begin.</p>
      </div>

      {SECTIONS.map((sec) => (
        <section className="lib-section" key={sec.title}>
          <div className="lib-section-head">
            <h2>{sec.title}</h2>
            {sec.sub && <p>{sec.sub}</p>}
          </div>
          <div className="lib-grid">
            {sec.items.map((it) => {
              // Real, routable cards become links; placeholders open a detail sheet.
              if (it.slug) {
                const completed = done[it.slug];
                return (
                  <Link key={it.id} href={completed ? '/insights/profile' : `/assessment/${it.slug}`} className="lib-card">
                    {cardInner(it)}
                  </Link>
                );
              }
              if (it.runName) {
                return (
                  <Link key={it.id} href={`/chat?run=${encodeURIComponent(it.runName)}`} className="lib-card">
                    {cardInner(it)}
                  </Link>
                );
              }
              return (
                <button key={it.id} className="lib-card" onClick={() => setOpen(it)}>
                  {cardInner(it)}
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {open && (
        <div className="lib-modal-scrim" onClick={() => setOpen(null)}>
          <div className="lib-modal" onClick={(e) => e.stopPropagation()}>
            <div className={`lib-modal-poster k-${open.kind}`}>
              <span className="lib-poster-icon"><Icon d={ICONS[open.kind]} /></span>
              <span className="lib-kind">{KIND_LABEL[open.kind]}{open.meta ? ` · ${open.meta}` : ''}</span>
            </div>
            <div className="lib-modal-body">
              <h3>{open.title}</h3>
              <p>{open.desc}</p>
              <div className="lib-modal-note">This {open.kind === 'video' ? 'video' : 'resource'} is coming soon. We&apos;ll drop you a note when it&apos;s live.</div>
              <button className="lib-modal-close" onClick={() => setOpen(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
