'use client';

import './profile.css';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import CombinedProfile from './_components/CombinedProfile';
import type { Profile } from '@/lib/profile';
import type { Scores } from '@/lib/scoring';

const SLUGS = ['wiring', 'orientation', 'rejection-gift'] as const;

function loadAnswers() {
  const out: Record<string, Record<string, string>> = {};
  if (typeof window === 'undefined') return out;
  for (const slug of SLUGS) {
    try {
      const raw = localStorage.getItem(`align360:answers:${slug}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.answers) out[slug] = parsed.answers;
      }
    } catch {
      /* ignore */
    }
  }
  return out;
}

type State =
  | { phase: 'idle' }
  | { phase: 'generating' }
  | { phase: 'ready'; profile: Profile; scores: Scores; generated: boolean; warning?: string }
  | { phase: 'empty' }
  | { phase: 'error'; message: string };

export default function ResultPage() {
  const [state, setState] = useState<State>({ phase: 'idle' });

  const generate = useCallback(async () => {
    const demo = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('demo');
    const answers = loadAnswers();
    if (!demo && Object.keys(answers).length === 0) {
      setState({ phase: 'empty' });
      return;
    }
    setState({ phase: 'generating' });
    let name = 'Friend';
    try {
      name = localStorage.getItem('align360:name') || 'Friend';
    } catch {
      /* ignore */
    }
    try {
      const res = await fetch('/api/profile/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(demo ? { demo: true } : { name, answers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setState({ phase: 'ready', profile: data.profile, scores: data.scores, generated: data.generated, warning: data.warning });
    } catch (err) {
      setState({ phase: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
    }
  }, []);

  useEffect(() => {
    generate();
  }, [generate]);

  if (state.phase === 'empty') {
    return (
      <div className="result-placeholder">
        <h1>No assessment results yet</h1>
        <p>
          Take the assessments first — start with Wiring for Impact. Once you complete them, your combined
          profile generates here.
        </p>
        <Link href="/align" className="quiz-go">
          → Go to Align
        </Link>
      </div>
    );
  }

  if (state.phase === 'error') {
    return (
      <div className="result-placeholder">
        <h1>Something went wrong</h1>
        <p>{state.message}</p>
        <button className="quiz-go" onClick={generate} style={{ background: 'none', border: 'none' }}>
          ↻ Try again
        </button>
      </div>
    );
  }

  if (state.phase === 'idle' || state.phase === 'generating') {
    return (
      <div className="result-gen">
        <div>
          <div className="gen-pulse" />
          <p>Reading your signals and composing your profile…</p>
        </div>
      </div>
    );
  }

  // ready
  return (
    <>
      <div className="result-toolbar">
        {!state.generated && (
          <span style={{ marginRight: 'auto', color: '#8A6E3A', fontSize: 12, fontStyle: 'italic' }}>
            Preview (deterministic fallback — AI narrative off)
          </span>
        )}
        <button className="rt-btn" onClick={generate}>
          ↻ Regenerate
        </button>
        <button className="rt-btn primary" onClick={() => window.print()}>
          ↓ Download PDF
        </button>
      </div>
      <CombinedProfile profile={state.profile} scores={state.scores} />
    </>
  );
}
