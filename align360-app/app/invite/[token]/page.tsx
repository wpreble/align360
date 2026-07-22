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
        // The org now covers this person's access. If they were already paying
        // individually, cancel that subscription so they are not charged twice
        // for the same access (Drew, 2026-07-22). Best-effort: never block the
        // join on this, and a brief flash of "canceled" isn't shown here — the
        // account panel's billing section reflects the true state either way.
        try {
          const r = await fetch('/api/stripe/cancel-individual', { method: 'POST' });
          const d = await r.json().catch(() => null);
          if (d?.canceled) {
            try { sessionStorage.setItem('align360:individualCanceledOnJoin', '1'); } catch {}
          }
        } catch { /* best-effort */ }
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
