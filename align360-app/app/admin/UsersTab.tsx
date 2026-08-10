'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PaymentState, UsersPage } from './types';
import UserDrawer from './UserDrawer';
import { DataWarnings, STATE_LABEL, StateBadge, fmtDate, fmtMoney, fmtNum, fmtUnix, relTime } from './ui';

const FILTERS: { key: string; label: string }[] = [
  { key: '', label: 'Everyone' },
  { key: 'active,past_due,org_seat', label: 'Paying' },
  { key: 'free', label: 'Free' },
  { key: 'trialing', label: 'On trial' },
  { key: 'past_due', label: 'Payment failed' },
  { key: 'canceled', label: 'Churned' },
  { key: 'org_seat', label: 'Team seats' },
];

type Sort = 'created' | 'email' | 'state' | 'mrr' | 'last_seen';

/**
 * Every signup, with payment state on the row. Search, filter, sort, paginate,
 * and click through to the full history. This is the view the portal did not
 * have: previously you could see the 10 most recent signups and a separate
 * unjoined list of Stripe customers, and nothing else.
 */
export default function UsersTab({ initialFilter }: { initialFilter?: string }) {
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [filter, setFilter] = useState(initialFilter ?? '');
  const [sort, setSort] = useState<Sort>('created');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<UsersPage | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  // Applying a filter from an Overview card should reset paging.
  useEffect(() => { if (initialFilter !== undefined) { setFilter(initialFilter); setPage(1); } }, [initialFilter]);

  // Debounce the search box so typing does not fire a request per keystroke.
  const qRef = useRef(q);
  qRef.current = q;
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(qRef.current); setPage(1); }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async (fresh = false) => {
    setBusy(true); setErr('');
    const params = new URLSearchParams({ sort, dir, page: String(page), pageSize: '50' });
    if (debouncedQ) params.set('q', debouncedQ);
    if (filter) params.set('state', filter);
    if (fresh) params.set('refresh', '1');
    try {
      const r = await fetch(`/api/admin/users?${params}`);
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setData(d);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setBusy(false);
    }
  }, [debouncedQ, filter, sort, dir, page]);

  useEffect(() => { load(); }, [load]);

  function toggleSort(next: Sort) {
    if (sort === next) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSort(next); setDir('desc'); }
    setPage(1);
  }

  const sortIndicator = (col: Sort) => (sort === col ? (dir === 'asc' ? ' ↑' : ' ↓') : '');

  const summary = useMemo(() => {
    if (!data) return '';
    const shown = data.items.length;
    const from = (data.page - 1) * data.pageSize + 1;
    if (!data.total) return 'No users match.';
    return `${fmtNum(from)}–${fmtNum(from + shown - 1)} of ${fmtNum(data.total)}${data.total !== data.unfilteredTotal ? ` (filtered from ${fmtNum(data.unfilteredTotal)})` : ''}`;
  }, [data]);

  return (
    <>
      <div className="adm-tabbar-actions">
        <span className="adm-note">{data ? `Updated ${relTime(new Date(data.generatedAt).toISOString())}` : 'Loading…'}</span>
        <button className="adm-btn sm" onClick={() => load(true)} disabled={busy}>{busy ? 'Refreshing…' : 'Refresh'}</button>
      </div>

      {data && <DataWarnings truncated={data.truncated} available={data.available} />}

      <section className="adm-panel">
        <div className="adm-userbar">
          <input
            className="adm-input adm-search"
            type="search"
            placeholder="Search by email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="adm-chips">
            {FILTERS.map((f) => (
              <button
                key={f.key || 'all'}
                className={`adm-chip ${filter === f.key ? 'on' : ''}`}
                onClick={() => { setFilter(f.key); setPage(1); }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {err && <div className="adm-err">{err}</div>}

        <div className="adm-tablewrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th><button className="adm-th" onClick={() => toggleSort('email')}>User{sortIndicator('email')}</button></th>
                <th><button className="adm-th" onClick={() => toggleSort('state')}>Status{sortIndicator('state')}</button></th>
                <th>Plan</th>
                <th className="num"><button className="adm-th" onClick={() => toggleSort('mrr')}>Monthly{sortIndicator('mrr')}</button></th>
                <th>Renews</th>
                <th><button className="adm-th" onClick={() => toggleSort('last_seen')}>Last seen{sortIndicator('last_seen')}</button></th>
                <th><button className="adm-th" onClick={() => toggleSort('created')}>Signed up{sortIndicator('created')}</button></th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data?.items.map((u) => (
                <tr key={u.id} className="adm-row" onClick={() => setOpenId(u.id)}>
                  <td>
                    <span className="adm-email">{u.email || '(no email)'}</span>
                    {u.provider && <span className="adm-sub-inline">{u.provider}</span>}
                  </td>
                  <td>
                    <StateBadge state={u.state} />
                    {u.cancelAtPeriodEnd && u.state === 'active' && <span className="adm-sub-inline">cancels at period end</span>}
                  </td>
                  <td>{u.orgName ? <span title="Access via team seat">{u.orgName}</span> : u.planName || '—'}</td>
                  <td className="num">{u.monthlyCents ? fmtMoney(u.monthlyCents) : '—'}</td>
                  <td>{u.state === 'trialing' && u.trialEnd ? `trial ends ${fmtUnix(u.trialEnd)}` : fmtUnix(u.currentPeriodEnd)}</td>
                  <td title={u.last_sign_in_at || ''}>{relTime(u.last_sign_in_at)}</td>
                  <td>{fmtDate(u.created_at)}</td>
                  <td className="adm-chev">›</td>
                </tr>
              ))}
              {data && !data.items.length && (
                <tr><td colSpan={8}><p className="adm-note">No users match this search or filter.</p></td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="adm-pager">
          <span className="adm-note">{summary}</span>
          <div className="adm-pager-btns">
            <button className="adm-ghost" disabled={!data || data.page <= 1 || busy} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</button>
            <span className="adm-note">Page {data?.page ?? 1} of {data?.totalPages ?? 1}</span>
            <button className="adm-ghost" disabled={!data || data.page >= data.totalPages || busy} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </div>
      </section>

      {openId && <UserDrawer userId={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}

export { STATE_LABEL };
export type { PaymentState };
