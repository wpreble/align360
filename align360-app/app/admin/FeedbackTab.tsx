'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FeedbackItem } from './types';
import { fmtDateTime } from './ui';

/** In-app feedback, newest first. Unchanged in substance, now behind its own tab. */
export default function FeedbackTab() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setBusy(true); setErr('');
    try {
      const d = await fetch('/api/admin/feedback').then((r) => r.json());
      if (d.error) setErr(d.error);
      setItems(Array.isArray(d.items) ? d.items : []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load feedback');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const needle = q.trim().toLowerCase();
  const shown = needle
    ? items.filter((f) => f.message.toLowerCase().includes(needle) || (f.email || '').toLowerCase().includes(needle))
    : items;

  return (
    <>
      <div className="adm-tabbar-actions">
        <span className="adm-note">{items.length} most recent</span>
        <button className="adm-btn sm" onClick={load} disabled={busy}>{busy ? 'Refreshing…' : 'Refresh'}</button>
      </div>

      <section className="adm-panel">
        <div className="adm-userbar">
          <input className="adm-input adm-search" type="search" placeholder="Search feedback…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        {err && <div className="adm-err">{err}</div>}

        {shown.length ? (
          <div className="adm-tablewrap">
            <table className="adm-table">
              <thead><tr><th>When</th><th>From</th><th>Message</th><th>Page</th></tr></thead>
              <tbody>
                {shown.map((f) => (
                  <tr key={f.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(f.created_at)}</td>
                    <td>{f.email || '—'}</td>
                    <td style={{ whiteSpace: 'pre-wrap', maxWidth: 440 }}>{f.message}</td>
                    <td>{f.path || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="adm-note">{needle ? 'Nothing matches that search.' : 'No feedback yet.'}</p>}
      </section>
    </>
  );
}
