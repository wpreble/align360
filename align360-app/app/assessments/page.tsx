import { redirect } from 'next/navigation';

// Assessments live inside Resources (DesignSuite) now.
export default function AssessmentsRedirect() {
  redirect('/resources');
}
