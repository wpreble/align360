'use client';

import '../../result/profile.css';
import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import CombinedProfile from '../../result/_components/CombinedProfile';
import type { Profile } from '@/lib/profile';
import type { Scores } from '@/lib/scoring';
import { getAnswers, getProfile, setProfile } from '@/lib/storage';

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
        <div><div className="gen-pulse" /><p>{state.phase === 'generating' ? 'Reading your signals and composing your profile…' : 'Loading…'}</p></div>
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
