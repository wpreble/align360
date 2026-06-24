'use client';

import './org.css';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { listMyOrgs, createOrg, type Org } from '@/lib/orgs';

export default function OrgsPage() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    listMyOrgs().then(setOrgs).catch((e) => setErr(e instanceof Error ? e.message : 'Failed to load')).finally(() => setLoading(false));
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const id = await createOrg(name);
      router.push(`/org/${id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not create organization');
      setBusy(false);
    }
  }

  return (
    <div className="org-page">
      <h1 className="org-h1">Organizations</h1>
      {loading ? (
        <p className="org-muted">Loading…</p>
      ) : (
        <>
          {orgs.length > 0 && (
            <div className="org-list">
              {orgs.map((o) => (
                <Link key={o.id} href={`/org/${o.id}`} className="org-card">
                  <span className="org-card-name">{o.name}</span>
                  <span className="org-link">Manage →</span>
                </Link>
              ))}
            </div>
          )}
          <form className="org-create" onSubmit={create}>
            <h2 className="org-h2" style={{ marginTop: 0 }}>Create an organization</h2>
            <p className="org-muted">You become the owner. Then buy seats and invite your team by email.</p>
            <div className="org-row">
              <input className="org-input" placeholder="Organization name" value={name} onChange={(e) => setName(e.target.value)} required />
              <button className="org-btn" disabled={busy || !name.trim()}>{busy ? 'Creating…' : 'Create'}</button>
            </div>
            {err && <div className="org-err">{err}</div>}
          </form>
        </>
      )}
    </div>
  );
}
