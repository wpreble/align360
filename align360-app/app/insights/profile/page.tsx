'use client';

import '../../result/profile.css';
import '../clarity/clarity.css';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import CombinedProfile from '../../result/_components/CombinedProfile';
import GenLoader from '@/app/_components/GenLoader';
import ClarityLayerSummary from '../_components/ClarityLayerSummary';
import type { Profile } from '@/lib/profile';
import type { Scores } from '@/lib/scoring';
import { getAnswers, getProfile, setProfile, hashAnswers } from '@/lib/storage';

type State =
  | { phase: 'loading' }
  | { phase: 'generating' }
  | { phase: 'ready'; profile: Profile; scores: Scores; generated: boolean }
  | { phase: 'empty' }
  | { phase: 'error'; message: string };

function ProfileInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const demo = sp.get('demo') === '1';
  const [state, setState] = useState<State>({ phase: 'loading' });
  const aliveRef = useRef(true);
  const inFlightRef = useRef(false);

  const generate = useCallback(async (opts: { demo?: boolean; force?: boolean }) => {
    const answers = getAnswers();
    const answersHash = hashAnswers(answers);
    if (!opts.demo && !opts.force) {
      const saved = getProfile();
      // Reuse the cached profile only if it was generated from these exact answers.
      if (saved?.profile && saved.answersHash === answersHash) { setState({ phase: 'ready', profile: saved.profile, scores: saved.scores, generated: true }); return; }
    }
    if (!opts.demo && Object.keys(answers).length === 0) { setState({ phase: 'empty' }); return; }
    if (inFlightRef.current) return; // dedupe concurrent runs (no double credit charge / race)
    inFlightRef.current = true;

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
      if (!aliveRef.current) return; // user navigated away mid-generation
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      if (!opts.demo) setProfile({ profile: data.profile, scores: data.scores, answersHash, generatedAt: new Date().toISOString() });
      setState({ phase: 'ready', profile: data.profile, scores: data.scores, generated: data.generated });
    } catch (err) {
      if (aliveRef.current) setState({ phase: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    generate({ demo });
    return () => { aliveRef.current = false; };
  }, [generate, demo]);

  if (state.phase === 'empty') {
    return (
      <div className="result-placeholder">
        <h1>No profile yet</h1>
        <p>Take an assessment and your combined profile generates here, and your AI instantly knows how you&apos;re wired.</p>
        <Link href="/insights" className="quiz-go">← Back to Insights</Link>
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
        {state.phase === 'generating'
          ? <GenLoader messages={['Reading your signals', 'Mapping how you are wired', 'Finding the convergence', 'Composing your profile', 'Polishing the language']} />
          : <div><div className="gen-pulse" /><p>Loading&hellip;</p></div>}
      </div>
    );
  }

  return (
    <>
      <button className="result-back" onClick={() => router.push('/insights')} aria-label="Back to Insights" title="Back to Insights">← Insights</button>
      <div className="result-toolbar">
        {!state.generated && <span style={{ marginRight: 'auto', color: '#8A6E3A', fontSize: 12, fontStyle: 'italic' }}>Preview (deterministic fallback)</span>}
        {!demo && <button className="rt-btn" onClick={() => generate({ demo: false, force: true })}>↻ Regenerate</button>}
        <button className="rt-btn primary" onClick={() => window.print()}>↓ Download PDF</button>
      </div>
      <CombinedProfile profile={state.profile} scores={state.scores} />
      <ClarityLayerSummary />
    </>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="result-gen"><div><div className="gen-pulse" /><p>Loading…</p></div></div>}>
      <ProfileInner />
    </Suspense>
  );
}
