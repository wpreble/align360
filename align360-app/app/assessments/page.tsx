import Link from 'next/link';
import { listAssessments } from '@/lib/assessments';

export const dynamic = 'force-dynamic'; // read the .md banks at request time

const SOON = [
  'Decision Simulation Lab',
  'Impact Pathways & Skill Builder',
  'Job & Market Trends Intelligence',
  'Family Mechanics Simulator',
];

export default function AssessmentsPage() {
  const assessments = listAssessments();
  return (
    <div className="assess-page">
      <div className="assess-intro">
        <h1>Assessments</h1>
        <p>
          Pick one and take it. Start with <strong>Wiring for Impact</strong> — it reveals how you
          naturally create value, and everything else builds on it. Your results feed Align360 AI so it
          knows how you&apos;re wired.
        </p>
      </div>

      <div className="assess-grid">
        {assessments.map((a, i) => (
          <Link key={a.slug} href={`/assessment/${a.slug}`} className="assess-card live">
            <div className="assess-card-top">
              <span className="assess-index">{String(i + 1).padStart(2, '0')}</span>
              {i === 0 ? <span className="assess-badge">Start here</span> : <span className="assess-badge">Core</span>}
            </div>
            <h2>{a.title}</h2>
            <p className="assess-blurb">{a.blurb}</p>
            <div className="assess-meta">
              {a.questionCount} questions
              <span className="assess-go">Begin →</span>
            </div>
          </Link>
        ))}

        {SOON.map((name, i) => (
          <div key={name} className="assess-card soon">
            <div className="assess-card-top">
              <span className="assess-index">{String(assessments.length + i + 1).padStart(2, '0')}</span>
              <span className="assess-badge soon">Soon</span>
            </div>
            <h2>{name}</h2>
            <p className="assess-blurb">Coming after the alpha.</p>
            <div className="assess-meta">Not yet available</div>
          </div>
        ))}
      </div>
    </div>
  );
}
