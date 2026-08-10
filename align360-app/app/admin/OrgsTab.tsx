'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import type { OrgsResponse } from './types';
import { StateBadge, fmtDate, fmtMoney, fmtNum, fmtUnix, relTime } from './ui';

/**
 * Teams, with seat utilisation. A team that bought 25 seats and assigned 4 is
 * both a churn risk and an expansion conversation, and neither was visible
 * anywhere before: team revenue appeared only as a bare quantity column on an
 * otherwise anonymous Stripe row.
 */
export default function OrgsTab() {
  const [data, setData] = useState<OrgsResponse | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async (fresh = false) => {
    setBusy(true); setErr('');
    try {
      const r = await fetch(`/api/admin/orgs${fresh ? '?refresh=1' : ''}`);
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setData(d);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load organizations');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <div className="adm-tabbar-actions">
        <span className="adm-note">{data ? `Updated ${relTime(new Date(data.generatedAt).toISOString())}` : 'Loading…'}</span>
        <button className="adm-btn sm" onClick={() => load(true)} disabled={busy}>{busy ? 'Refreshing…' : 'Refresh'}</button>
      </div>

      {err && <div className="adm-err adm-block">{err}</div>}

      {data && (
        <section className="adm-cards">
          <div className="adm-card">
            <div className="adm-card-label">Organizations</div>
            <div className="adm-card-value">{fmtNum(data.totals.orgs)}</div>
            <div className="adm-card-sub">{fmtNum(data.totals.paying)} paying</div>
          </div>
          <div className="adm-card">
            <div className="adm-card-label">Team MRR</div>
            <div className="adm-card-value">{fmtMoney(data.totals.monthlyCents)}</div>
            <div className="adm-card-sub">across all teams</div>
          </div>
          <div className="adm-card">
            <div className="adm-card-label">Seats purchased</div>
            <div className="adm-card-value">{fmtNum(data.totals.seatsPurchased)}</div>
            <div className="adm-card-sub">{fmtNum(data.totals.seatsAssigned)} assigned</div>
          </div>
          <div className="adm-card">
            <div className="adm-card-label">Unused seats</div>
            <div className="adm-card-value">{fmtNum(Math.max(0, data.totals.seatsPurchased - data.totals.seatsAssigned))}</div>
            <div className="adm-card-sub">paid for, not onboarded</div>
          </div>
        </section>
      )}

      <section className="adm-panel">
        <h2 className="adm-h2">Organizations</h2>
        <div className="adm-tablewrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Team</th><th>Status</th><th>Plan</th>
                <th className="num">Monthly</th><th className="num">Seats</th>
                <th>Renews</th><th>Created</th><th />
              </tr>
            </thead>
            <tbody>
              {data?.items.map((o) => (
                <Fragment key={o.id}>
                  <tr className="adm-row" onClick={() => setExpanded(expanded === o.id ? null : o.id)}>
                    <td><span className="adm-email">{o.name}</span>{o.slug && <span className="adm-sub-inline">{o.slug}</span>}</td>
                    <td><StateBadge state={o.state} />{o.cancelAtPeriodEnd && <span className="adm-sub-inline">cancelling</span>}</td>
                    <td>{o.planName || '—'}</td>
                    <td className="num">{o.monthlyCents ? fmtMoney(o.monthlyCents) : '—'}</td>
                    <td className="num">
                      {fmtNum(o.seatsAssigned)} / {fmtNum(o.seatsPurchased)}
                      {o.seatsUnused > 0 && <span className="adm-sub-inline warn">{o.seatsUnused} unused</span>}
                    </td>
                    <td>{fmtUnix(o.currentPeriodEnd)}</td>
                    <td>{fmtDate(o.created_at)}</td>
                    <td className="adm-chev">{expanded === o.id ? '▾' : '›'}</td>
                  </tr>
                  {expanded === o.id && (
                    <tr>
                      <td colSpan={8} className="adm-expand">
                        <div className="adm-grid2">
                          <div>
                            <h4 className="adm-h4">Members ({fmtNum(o.memberCount)})</h4>
                            {o.members.length ? (
                              <table className="adm-table compact">
                                <thead><tr><th>Email</th><th>Role</th><th>Seat</th></tr></thead>
                                <tbody>
                                  {o.members.map((m) => (
                                    <tr key={m.userId}>
                                      <td>{m.email || '(no email)'}</td>
                                      <td>{m.role}</td>
                                      <td>{m.seatAssigned ? 'assigned' : <span className="adm-muted">unassigned</span>}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : <p className="adm-note">No members yet.</p>}
                          </div>
                          <div>
                            <h4 className="adm-h4">Pending invitations ({fmtNum(o.pendingInvites)})</h4>
                            {o.invitations.length ? (
                              <table className="adm-table compact">
                                <thead><tr><th>Email</th><th>Role</th><th>Expires</th></tr></thead>
                                <tbody>
                                  {o.invitations.map((i) => (
                                    <tr key={i.email}><td>{i.email}</td><td>{i.role}</td><td>{fmtDate(i.expires_at)}</td></tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : <p className="adm-note">None outstanding.</p>}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {data && !data.items.length && (
                <tr><td colSpan={8}><p className="adm-note">No organizations yet.</p></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
