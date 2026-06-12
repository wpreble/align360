'use client';

import '../../../result/profile.css'; // shared result chrome: toolbar, back button, placeholder, gen pulse
import '../clarity.css';
import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import ClarityReport from './_components/ClarityReport';
import type { ClarityScores } from '@/lib/clarity-scoring';
import type { ClarityNarrative } from '@/lib/clarity';
import { getClarityAnswers, getClarityReport, setClarityReport, CLARITY_SLUGS } from '@/lib/storage';

type State =
  | { phase: 'loading' }
  | { phase: 'generating' }
  | { phase: 'ready'; scores: ClarityScores; narrative: ClarityNarrative; generated: boolean }
  | { phase: 'empty' }
  | { phase: 'unknown' }
  | { phase: 'error'; message: string };

function ClarityInner() {
  const params = useParams();
  const sp = useSearchParams();
  const router = useRouter();
  const slug = String(params.slug || '');
  const demo = sp.get('demo') === '1';
  const [state, setState] = useState<State>({ phase: 'loading' });

  const generate = useCallback(
    async (opts: { demo?: boolean; force?: boolean }) => {
      if (!(CLARITY_SLUGS as readonly string[]).includes(slug)) {
        setState({ phase: 'unknown' });
        return;
      }
      if (!opts.demo && !opts.force) {
        const saved = getClarityReport(slug);
        if (saved?.narrative) {
          setState({ phase: 'ready', scores: saved.scores, narrative: saved.narrative, generated: true });
          return;
        }
      }
      const answers = getClarityAnswers()[slug];
      if (!opts.demo && (!answers || Object.keys(answers).length === 0)) {
        setState({ phase: 'empty' });
        return;
      }

      setState({ phase: 'generating' });
      let name = 'Friend';
      try { name = localStorage.getItem('align360:name') || 'Friend'; } catch {}
      try {
        const res = await fetch('/api/clarity/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(opts.demo ? { slug, demo: true } : { slug, name, answers }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Generation failed');
        if (!opts.demo) setClarityReport(slug, { scores: data.scores, narrative: data.narrative, name, generatedAt: new Date().toISOString() });
        setState({ phase: 'ready', scores: data.scores, narrative: data.narrative, generated: data.generated });
      } catch (err) {
        setState({ phase: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
      }
    },
    [slug],
  );

  useEffect(() => { generate({ demo }); }, [generate, demo]);

  if (state.phase === 'unknown') {
    return (
      <div className="result-placeholder">
        <h1>Result not found</h1>
        <p>There is no Clarity Layer result for &ldquo;{slug}&rdquo;.</p>
        <Link href="/insights" className="quiz-go">← Back to Insights</Link>
      </div>
    );
  }
  if (state.phase === 'empty') {
    return (
      <div className="result-placeholder">
        <h1>No result yet</h1>
        <p>Take this assessment and your scored result generates here.</p>
        <Link href={`/assessment/${slug}`} className="quiz-go">Take the assessment →</Link>
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
        <div><div className="gen-pulse" /><p>{state.phase === 'generating' ? 'Scoring your answers and composing your analysis…' : 'Loading…'}</p></div>
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
      <ClarityReport scores={state.scores} narrative={state.narrative} />
    </>
  );
}

export default function ClarityResultPage() {
  return (
    <Suspense fallback={<div className="result-gen"><div><div className="gen-pulse" /><p>Loading…</p></div></div>}>
      <ClarityInner />
    </Suspense>
  );
}
