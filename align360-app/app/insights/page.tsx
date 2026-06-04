'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getAnswers, getProfile, getOnboarding, STORE_EVENT } from '@/lib/storage';
import { synthesize } from '@/lib/onboarding';

const ASSESSMENTS = [
  { slug: 'wiring', name: 'Wiring for Impact', core: true, blurb: 'How you naturally create value — under pressure and at your best. The foundational read.' },
  { slug: 'orientation', name: 'Orientation for Impact', blurb: 'How you read situations, think through complexity, and make decisions.' },
  { slug: 'rejection-gift', name: 'Rejection Gift Finder', blurb: 'How adversity forged a specific capability that is now an edge.' },
];

export default function InsightsHub() {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [hasProfile, setHasProfile] = useState(false);
  const [archetype, setArchetype] = useState<string>('');
  const [prelim, setPrelim] = useState<string>('');

  const refresh = useCallback(() => {
    const answers = getAnswers();
    const d: Record<string, boolean> = {};
    for (const a of ASSESSMENTS) d[a.slug] = !!answers[a.slug];
    setDone(d);
    const p = getProfile();
    setHasProfile(!!p?.profile);
    if (p?.profile?.hero) {
      const title = String(p.profile.hero.title || '').replace(/<[^>]+>/g, '');
      setArchetype(title);
    } else {
      const ob = getOnboarding();
      if (ob) { try { setPrelim('The ' + synthesize(ob).primaryGift); } catch {} }
    }
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(STORE_EVENT, refresh);
    return () => window.removeEventListener(STORE_EVENT, refresh);
  }, [refresh]);

  const completedCount = Object.values(done).filter(Boolean).length;
  const anyDone = completedCount > 0;

  return (
    <div className="ins-page">
      <div className="ins-intro">
        <h1>Insights</h1>
        <p>Your living profile. Complete assessments to sharpen it — each one is remembered and fed straight into your AI.</p>
      </div>

      {/* Combined profile hero */}
      <div className="ins-hero">
        <div className="ins-hero-main">
          <div className="ins-hero-label">{hasProfile ? 'Your combined profile' : anyDone ? 'Ready to generate' : 'Preliminary read'}</div>
          <div className="ins-hero-name">
            {hasProfile && archetype ? archetype : anyDone ? 'Your profile is ready' : prelim ? prelim : 'Not yet assessed'}
          </div>
          <p className="ins-hero-note">
            {hasProfile
              ? 'Open your full identity document — wiring, behavioral intelligence, currency map, and AI-era calibration.'
              : anyDone
                ? 'You have completed an assessment. Generate your full combined profile now.'
                : prelim
                  ? 'A working read from your onboarding signals. Take Wiring for Impact to confirm your full profile.'
                  : 'Take your first assessment to unlock your combined profile.'}
          </p>
        </div>
        <div className="ins-hero-action">
          {anyDone ? (
            <Link href="/insights/profile" className="ins-btn primary">{hasProfile ? 'View full profile →' : 'Generate profile →'}</Link>
          ) : (
            <Link href="/assessment/wiring" className="ins-btn primary">Take Wiring for Impact →</Link>
          )}
        </div>
      </div>

      {/* Assessment status */}
      <div className="ins-section-label">Assessments {anyDone ? `· ${completedCount}/${ASSESSMENTS.length} complete` : ''}</div>
      <div className="ins-list">
        {ASSESSMENTS.map((a) => {
          const isDone = done[a.slug];
          return (
            <div key={a.slug} className={`ins-card${isDone ? ' done' : ''}`}>
              <span className={`ins-dot${isDone ? ' on' : ''}`} />
              <div className="ins-card-body">
                <div className="ins-card-top">
                  <span className="ins-card-name">{a.name}</span>
                  {a.core && <span className="ins-badge">Core</span>}
                  <span className={`ins-status${isDone ? ' done' : ''}`}>{isDone ? '✓ Completed' : 'Not started'}</span>
                </div>
                <p className="ins-card-blurb">{a.blurb}</p>
              </div>
              {isDone ? (
                <div className="ins-card-actions">
                  <Link href="/insights/profile" className="ins-link">View result</Link>
                  <Link href={`/assessment/${a.slug}`} className="ins-link muted">Retake</Link>
                </div>
              ) : (
                <Link href={`/assessment/${a.slug}`} className="ins-link go">Take it →</Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
