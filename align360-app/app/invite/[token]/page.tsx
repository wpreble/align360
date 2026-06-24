'use client';

import '../../org/org.css';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { acceptInvite } from '@/lib/orgs';

export default function AcceptInvitePage() {
  const { token } = useParams() as { token: string };
  const router = useRouter();
  const [state, setState] = useState<'working' | 'error'>('working');
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const orgId = await acceptInvite(token);
        router.replace(`/org/${orgId}`);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Could not accept this invitation.');
        setState('error');
      }
    })();
  }, [token, router]);

  return (
    <div className="org-page">
      <h1 className="org-h1">{state === 'working' ? 'Joining your organization…' : 'Invitation problem'}</h1>
      {state === 'error' && (
        <>
          <p className="org-err">{err}</p>
          <p className="org-muted" style={{ marginTop: '1rem' }}>
            Make sure you&apos;re signed in with the email the invite was sent to. <Link href="/login" className="org-link">Sign in</Link>
          </p>
        </>
      )}
    </div>
  );
}
