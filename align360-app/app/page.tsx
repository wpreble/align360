import { redirect } from 'next/navigation';

// On entry, land in the Align tab (Wiring is the first call-to-action there).
// When auth lands, signup will route here → /align.
export default function Home() {
  redirect('/align');
}
