import Link from 'next/link';
import { getAssessment } from '@/lib/assessments';
import Runner from './_components/Runner';

export const dynamic = 'force-dynamic'; // read the .md bank at request time

export default function AssessmentPage({ params }: { params: { slug: string } }) {
  const assessment = getAssessment(params.slug);

  if (!assessment) {
    return (
      <div className="runner-missing">
        <h1>Assessment not found</h1>
        <p>No question bank for “{params.slug}”.</p>
        <Link href="/align" className="quiz-go">
          ← Back to Align
        </Link>
      </div>
    );
  }

  // Flatten to an ordered question list; keep section name on each for the runner.
  const questions = assessment.sections.flatMap((s) =>
    s.questions.map((q) => ({ ...q, section: s.name })),
  );

  return <Runner title={assessment.title} slug={assessment.slug} questions={questions} />;
}
