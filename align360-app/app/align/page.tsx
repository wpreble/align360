import { redirect } from 'next/navigation';

// The Align tab is replaced by the Insight Engine (right panel). Tools launch
// from there now. Keep this path working.
export default function AlignRedirect() {
  redirect('/');
}
