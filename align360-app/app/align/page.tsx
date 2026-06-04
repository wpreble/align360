import { redirect } from 'next/navigation';

// Legacy path. The app home is the chat at /chat now ('/' is the landing page).
export default function AlignRedirect() {
  redirect('/chat');
}
