'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getAnswers, getClarityAnswers, getProfile, getOnboarding, STORE_EVENT } from '@/lib/storage';
import { synthesize } from '@/lib/onboarding';

const ASSESSMENTS = [
  { slug: 'wiring', name: 'Wiring for Impact', core: true, blurb: 'How you naturally create value, under pressure and at your best. The foundational read.' },
  { slug: 'orientation', name: 'Orientation for Impact', blurb: 'How you read situations, think through complexity, and make decisions.' },
  { slug: 'rejection-gift', name: 'Rejection Gift Finder', blurb: 'How adversity forged a specific capability that is now an edge.' },
];

// The Clarity Layer: behavioral readiness, scored 0 to 100. Separate from the gift profile.
const CLARITY = [
  { slug: 'impact-readiness', name: 'Impact Readiness', blurb: 'Your Conviction Score across identity, capability, rejection, direction, and belonging. How ready you are to create impact right now.' },
  { slug: 'value-spectrum', name: 'Value Spectrum', blurb: 'How you perceive and protect your own worth, independent of outside validation.' },
];

export default function InsightsHub() {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [clarityDone, setClarityDone] = useState<Record<string, boolean>>({});
  const [hasProfile, setHasProfile] = useState(false);
  const [archetype, setArchetype] = useState<string>('');
  const [prelim, setPrelim] = useState<string>('');

  const refresh = useCallback(() => {
    const answers = getAnswers();
    const d: Record<string, boolean> = {};
    for (const a of ASSESSMENTS) d[a.slug] = !!answers[a.slug];
    setDone(d);
    const clarity = getClarityAnswers();
    const cd: Record<string, boolean> = {};
    for (const a of CLARITY) cd[a.slug] = !!clarity[a.slug];
    setClarityDone(cd);
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
  const clarityCount = Object.values(clarityDone).filter(Boolean).length;

  return (
    <div className="ins-page">
      <div className="ins-intro">
        <h1>Insights</h1>
        <p>Your living profile. Complete assessments to sharpen it. Each one is remembered and fed straight into your AI.</p>
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
              ? 'Open your full identity document: wiring, behavioral intelligence, currency map, and AI-era calibration.'
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
              {/* Whole-card click target (stretched link). */}
              <Link
                href={isDone ? '/insights/profile' : `/assessment/${a.slug}`}
                className="ins-card-cover"
                aria-label={`${a.name}: ${isDone ? 'view your result' : 'take the assessment'}`}
              />
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
                  <span className="ins-link go">View result →</span>
                  <Link href={`/assessment/${a.slug}`} className="ins-link muted ins-retake">Retake</Link>
                </div>
              ) : (
                <span className="ins-link go">Take it →</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Clarity Layer — behavioral readiness, scored 0 to 100. Separate from the gift profile. */}
      <div className="ins-section-label">Clarity Layer {clarityCount > 0 ? `· ${clarityCount}/${CLARITY.length} complete` : ''}</div>
      <div className="ins-list">
        {CLARITY.map((a) => {
          const isDone = clarityDone[a.slug];
          return (
            <div key={a.slug} className={`ins-card${isDone ? ' done' : ''}`}>
              {/* Whole-card click target (stretched link): view result when done, else take it. */}
              <Link
                href={isDone ? `/insights/clarity/${a.slug}` : `/assessment/${a.slug}`}
                className="ins-card-cover"
                aria-label={`${a.name}: ${isDone ? 'view your result' : 'take the assessment'}`}
              />
              <span className={`ins-dot${isDone ? ' on' : ''}`} />
              <div className="ins-card-body">
                <div className="ins-card-top">
                  <span className="ins-card-name">{a.name}</span>
                  <span className={`ins-status${isDone ? ' done' : ''}`}>{isDone ? '✓ Completed' : 'Not started'}</span>
                </div>
                <p className="ins-card-blurb">{a.blurb}</p>
              </div>
              {isDone ? (
                <div className="ins-card-actions">
                  <span className="ins-link go">View result →</span>
                  <Link href={`/assessment/${a.slug}`} className="ins-link muted ins-retake">Retake</Link>
                </div>
              ) : (
                <span className="ins-link go">Take it →</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
