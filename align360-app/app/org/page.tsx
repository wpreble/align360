'use client';

import './org.css';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listMyOrgs, type Org } from '@/lib/orgs';

export default function OrgsPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    listMyOrgs()
      .then(setOrgs)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="org-page">
      <h1 className="org-h1">Your teams</h1>

      {loading ? (
        <p className="org-muted">Loading&hellip;</p>
      ) : orgs.length > 0 ? (
        <>
          <div className="org-list">
            {orgs.map((o) => (
              <Link key={o.id} href={`/org/${o.id}`} className="org-card">
                <span className="org-card-name">{o.name}</span>
                <span className="org-link">Manage &rarr;</span>
              </Link>
            ))}
          </div>
          <div className="org-create">
            <p className="org-muted" style={{ margin: 0 }}>Need another organization?</p>
            <Link href="/signup/team" className="org-btn" style={{ marginTop: '.8rem', display: 'inline-block' }}>Set up a team &rarr;</Link>
          </div>
        </>
      ) : (
        <div className="org-create">
          <h2 className="org-h2" style={{ marginTop: 0 }}>Set up your team</h2>
          <p className="org-muted">Create an organization, choose your seats, and invite your team by email. You become the owner and admin, and manage everything from one dashboard.</p>
          <Link href="/signup/team" className="org-btn" style={{ marginTop: '.4rem', display: 'inline-block' }}>Set up a team &rarr;</Link>
        </div>
      )}

      {err && <div className="org-err">{err}</div>}
    </div>
  );
}
