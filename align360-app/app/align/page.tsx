import Link from 'next/link';
import { listAssessments } from '@/lib/assessments';

export const dynamic = 'force-dynamic'; // read the .md banks at request time

export default function AlignPage() {
  const assessments = listAssessments();
  return (
    <div className="align-home">
      <div className="align-intro">
        <h1>Your Align</h1>
        <p>
          Start with <strong>Wiring for Impact</strong> — it reveals how you naturally create value, and
          everything else builds on it. Each takes a few minutes. Your results live here and make the AI
          Chat personal to you.
        </p>
        <p style={{ marginTop: 10, fontSize: 14 }}>
          <Link href="/result?demo=1" className="quiz-go">
            Preview a sample profile →
          </Link>
        </p>
      </div>

      <div className="quiz-grid">
        {assessments.map((a, i) => (
          <Link key={a.slug} href={`/assessment/${a.slug}`} className="quiz-card">
            <div className="quiz-card-top">
              <span className="quiz-index">{String(i + 1).padStart(2, '0')}</span>
              {i === 0 && <span className="quiz-badge">Start here</span>}
            </div>
            <h2>{a.title}</h2>
            <p className="quiz-blurb">{a.blurb}</p>
            <div className="quiz-meta">
              {a.questionCount} questions
              <span className="quiz-go">Begin →</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
