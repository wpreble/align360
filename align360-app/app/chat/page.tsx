import { redirect } from 'next/navigation';

// Chat now lives at the center home ('/'). Keep this path working.
export default function ChatRedirect() {
  redirect('/');
}
