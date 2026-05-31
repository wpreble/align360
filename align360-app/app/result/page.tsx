import Link from 'next/link';

// Placeholder. The full combined-profile result page (matching the reference
// HTMLs) + AI narrative generation + PDF export are the next build steps.
export default function ResultPage() {
  return (
    <div className="result-placeholder">
      <div className="result-pulse" />
      <h1>Your profile is taking shape</h1>
      <p>
        You’ve completed the assessment. The full combined-profile result page — with AI-Era Intelligence,
        your advantage stack, and a PDF you can download — is the next thing being built. Your answers are
        saved on this device for now; once accounts are wired, they’ll live in your Align tab.
      </p>
      <Link href="/align" className="quiz-go">
        ← Back to Align
      </Link>
    </div>
  );
}
