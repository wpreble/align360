'use client';

import '../result/profile.css';
import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import CombinedProfile from '../result/_components/CombinedProfile';
import type { Profile } from '@/lib/profile';
import type { Scores } from '@/lib/scoring';
import { getAnswers, getProfile, setProfile, getOnboarding } from '@/lib/storage';
import { synthesize } from '@/lib/onboarding';

type State =
  | { phase: 'loading' }
  | { phase: 'generating' }
  | { phase: 'ready'; profile: Profile; scores: Scores; generated: boolean }
  | { phase: 'empty' }
  | { phase: 'error'; message: string };

function InsightsInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const demo = sp.get('demo') === '1';
  const [state, setState] = useState<State>({ phase: 'loading' });

  const generate = useCallback(async (opts: { demo?: boolean; force?: boolean }) => {
    if (!opts.demo && !opts.force) {
      const saved = getProfile();
      if (saved?.profile) { setState({ phase: 'ready', profile: saved.profile, scores: saved.scores, generated: true }); return; }
    }
    const answers = getAnswers();
    if (!opts.demo && Object.keys(answers).length === 0) { setState({ phase: 'empty' }); return; }

    setState({ phase: 'generating' });
    let name = 'Friend';
    try { name = localStorage.getItem('align360:name') || 'Friend'; } catch {}
    try {
      const res = await fetch('/api/profile/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opts.demo ? { demo: true } : { name, answers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      if (!opts.demo) setProfile({ profile: data.profile, scores: data.scores, generatedAt: new Date().toISOString() });
      setState({ phase: 'ready', profile: data.profile, scores: data.scores, generated: data.generated });
    } catch (err) {
      setState({ phase: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
    }
  }, []);

  useEffect(() => { generate({ demo }); }, [generate, demo]);

  if (state.phase === 'empty') {
    const ob = getOnboarding();
    const s = ob ? synthesize(ob) : null;
    return (
      <div className="result-placeholder">
        {s ? (
          <>
            <h1>Your preliminary read</h1>
            <div className="pg-card" style={{ textAlign: 'left', maxWidth: 480, margin: '0 auto 24px' }}>
              <div className="pg-label">Likely primary wiring</div>
              <div className="pg-name">The {s.primaryGift}</div>
              <div className="pg-note">A working read from your onboarding signals. Take <strong>Wiring for Impact</strong> to confirm your full profile and unlock your combined Insights.</div>
            </div>
            <Link href="/assessment/wiring" className="quiz-go">→ Take Wiring for Impact</Link>
          </>
        ) : (
          <>
            <h1>No insights yet</h1>
            <p>Take an assessment and your combined profile will generate here — and your AI will instantly know how you&apos;re wired. Start with Wiring for Impact.</p>
            <Link href="/resources" className="quiz-go">→ Browse frameworks</Link>
          </>
        )}
      </div>
    );
  }
  if (state.phase === 'error') {
    return (
      <div className="result-placeholder">
        <h1>Something went wrong</h1>
        <p>{state.message}</p>
        <button className="quiz-go" onClick={() => generate({ demo, force: true })} style={{ background: 'none', border: 'none' }}>↻ Try again</button>
      </div>
    );
  }
  if (state.phase === 'loading' || state.phase === 'generating') {
    return (
      <div className="result-gen">
        <div><div className="gen-pulse" /><p>{state.phase === 'generating' ? 'Reading your signals and composing your profile…' : 'Loading…'}</p></div>
      </div>
    );
  }

  return (
    <>
      <button className="result-back" onClick={() => router.push('/')} aria-label="Back to chat" title="Back to chat">← Back</button>
      <div className="result-toolbar">
        {!state.generated && <span style={{ marginRight: 'auto', color: '#8A6E3A', fontSize: 12, fontStyle: 'italic' }}>Preview (deterministic fallback)</span>}
        {!demo && <button className="rt-btn" onClick={() => generate({ demo: false, force: true })}>↻ Regenerate</button>}
        <button className="rt-btn primary" onClick={() => window.print()}>↓ Download PDF</button>
      </div>
      <CombinedProfile profile={state.profile} scores={state.scores} />
    </>
  );
}

export default function InsightsPage() {
  return (
    <Suspense fallback={<div className="result-gen"><div><div className="gen-pulse" /><p>Loading…</p></div></div>}>
      <InsightsInner />
    </Suspense>
  );
}
