import { redirect } from 'next/navigation';

// Results now live under Insights.
export default function ResultRedirect() {
  redirect('/insights');
}
