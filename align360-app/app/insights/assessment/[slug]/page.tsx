'use client';

import '../report.css';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import GenLoader from '@/app/_components/GenLoader';
import WiringReport from './_components/WiringReport';
import OrientationReport from './_components/OrientationReport';
import RejectionReport from './_components/RejectionReport';
import { RepChrome, CompletionBlock, useReveal } from './_components/report-bits';
// Type-only imports from report-scoring: importing a runtime value from there
// would pull lib/assessments (node:fs) into the client bundle.
import type { ReportScores, WiringScores, OrientationScores, RejectionScores } from '@/lib/report-scoring';
import type { ReportNarrative, WiringNarrative, OrientationNarrative, RejectionNarrative } from '@/lib/report';
import { getAnswers, getAssessmentReport, setAssessmentReport, ASSESSMENT_SLUGS } from '@/lib/storage';

const isReportSlug = (s: string) => (ASSESSMENT_SLUGS as readonly string[]).includes(s);

type State =
  | { phase: 'loading' }
  | { phase: 'generating' }
  | { phase: 'ready'; scores: ReportScores; narrative: ReportNarrative; generated: boolean }
  | { phase: 'empty' }
  | { phase: 'unknown' }
  | { phase: 'error'; message: string };

function ReportInner() {
  const params = useParams();
  const sp = useSearchParams();
  const router = useRouter();
  const slug = String(params.slug || '');
  const demo = sp.get('demo') === '1';
  const [state, setState] = useState<State>({ phase: 'loading' });
  const [done, setDone] = useState({ wiring: false, orientation: false, 'rejection-gift': false });
  const aliveRef = useRef(true);
  const inFlightRef = useRef(false);

  useReveal(state.phase);

  const generate = useCallback(
    async (opts: { demo?: boolean; force?: boolean }) => {
      if (!isReportSlug(slug)) { setState({ phase: 'unknown' }); return; }
      if (!opts.demo && !opts.force) {
        const saved = getAssessmentReport(slug);
        if (saved?.narrative) { setState({ phase: 'ready', scores: saved.scores, narrative: saved.narrative, generated: true }); return; }
      }
      const answers = getAnswers()[slug];
      if (!opts.demo && (!answers || Object.keys(answers).length === 0)) { setState({ phase: 'empty' }); return; }
      if (inFlightRef.current) return; // dedupe concurrent runs (no double credit charge)
      inFlightRef.current = true;

      setState({ phase: 'generating' });
      let name = 'Friend';
      try { name = localStorage.getItem('align360:name') || 'Friend'; } catch {}
      try {
        const res = await fetch('/api/assessment/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(opts.demo ? { slug, demo: true } : { slug, name, answers }),
        });
        const data = await res.json();
        if (!aliveRef.current) return; // navigated away mid-generation
        if (!res.ok) throw new Error(data.error || data.message || 'Generation failed');
        if (!opts.demo) setAssessmentReport(slug, { scores: data.scores, narrative: data.narrative, name, generatedAt: new Date().toISOString() });
        setState({ phase: 'ready', scores: data.scores, narrative: data.narrative, generated: data.generated });
      } catch (err) {
        if (aliveRef.current) setState({ phase: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
      } finally {
        inFlightRef.current = false;
      }
    },
    [slug],
  );

  useEffect(() => {
    aliveRef.current = true;
    try {
      const a = getAnswers();
      setDone({ wiring: !!a.wiring, orientation: !!a.orientation, 'rejection-gift': !!a['rejection-gift'] });
    } catch {}
    generate({ demo });
    return () => { aliveRef.current = false; };
  }, [generate, demo]);

  if (state.phase === 'unknown') {
    return (
      <div className="result-placeholder">
        <h1>Result not found</h1>
        <p>There is no report for &ldquo;{slug}&rdquo;.</p>
        <Link href="/insights" className="quiz-go">← Back to Insights</Link>
      </div>
    );
  }
  if (state.phase === 'empty') {
    return (
      <div className="result-placeholder">
        <h1>No result yet</h1>
        <p>Take this assessment and your report generates here.</p>
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
      <div className="report" data-assessment={slug}>
        <div className="report-gen">
          {state.phase === 'generating'
            ? <GenLoader messages={['Reading your answers', 'Finding the pattern', 'Composing your report', 'Setting the type']} />
            : <div><div className="gen-pulse" /><p>Loading&hellip;</p></div>}
        </div>
      </div>
    );
  }

  const onRegen = () => generate({ demo, force: true });
  return (
    <div className="report" data-assessment={slug}>
      <div className="report-noise" />
      <RepChrome generated={state.generated} demo={demo} onRegen={onRegen} />
      {slug === 'wiring' && <WiringReport scores={state.scores as WiringScores} narrative={state.narrative as WiringNarrative} />}
      {slug === 'orientation' && <OrientationReport scores={state.scores as OrientationScores} narrative={state.narrative as OrientationNarrative} />}
      {slug === 'rejection-gift' && <RejectionReport scores={state.scores as RejectionScores} narrative={state.narrative as RejectionNarrative} />}
      <CompletionBlock done={done} />
      <div className="rep-footer">Align360 · {state.scores.title} · © {new Date().getFullYear()} Align360. All rights reserved.</div>
    </div>
  );
}

export default function AssessmentReportPage() {
  return (
    <Suspense fallback={<div className="report"><div className="report-gen"><div><div className="gen-pulse" /><p>Loading…</p></div></div></div>}>
      <ReportInner />
    </Suspense>
  );
}
