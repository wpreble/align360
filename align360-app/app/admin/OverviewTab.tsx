'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Metrics, TimeSeries } from './types';
import { BarChart, DataWarnings, StateBar, fmtMoney, fmtNum, fmtPct, relTime } from './ui';

/**
 * Overview: the answer to "how are we doing" in one screen. Every number is
 * derived from the full paginated snapshot, so nothing here silently truncates
 * the way the old 100-subscription MRR tile did.
 */
export default function OverviewTab({ onOpenUsers }: { onOpenUsers: (state: string) => void }) {
  const [m, setM] = useState<Metrics | null>(null);
  const [ts, setTs] = useState<TimeSeries | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (fresh = false) => {
    setBusy(true); setErr('');
    const qs = fresh ? '?refresh=1' : '';
    try {
      const [mr, tr] = await Promise.all([
        fetch(`/api/admin/metrics${qs}`).then((r) => r.json()),
        fetch(`/api/admin/timeseries${qs}`).then((r) => r.json()),
      ]);
      if (mr.error) throw new Error(mr.error);
      setM(mr);
      if (!tr.error) setTs(tr);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load metrics');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <div className="adm-tabbar-actions">
        <span className="adm-note">
          {m ? `Updated ${relTime(new Date(m.generatedAt).toISOString())}` : 'Loading…'}
          {m && <span className={`adm-pill ${m.stripeMode}`}>{m.stripeMode}</span>}
        </span>
        <button className="adm-btn sm" onClick={() => load(true)} disabled={busy}>{busy ? 'Refreshing…' : 'Refresh'}</button>
      </div>

      {err && <div className="adm-err adm-block">{err}</div>}
      {m && <DataWarnings truncated={m.truncated} available={m.available} connectScoped={m.connectScoped} excluded={m.excluded} brandFilterApplied={m.brandFilterApplied} />}

      <section className="adm-cards">
        <div className="adm-card">
          <div className="adm-card-label">Total users</div>
          <div className="adm-card-value">{fmtNum(m?.users.total)}</div>
          <div className="adm-card-sub">{m ? `+${fmtNum(m.users.signups30)} in 30d` : '—'}</div>
        </div>
        <button className="adm-card adm-card-btn" onClick={() => onOpenUsers('active,past_due,org_seat')}>
          <div className="adm-card-label">Paying</div>
          <div className="adm-card-value">{fmtNum(m?.users.paying)}</div>
          <div className="adm-card-sub">{m ? `${fmtPct(m.rates.paidSharePct)} of users` : '—'}</div>
        </button>
        <div className="adm-card">
          <div className="adm-card-label">MRR</div>
          <div className="adm-card-value">{m ? fmtMoney(m.revenue.mrrCents) : '—'}</div>
          <div className="adm-card-sub">{m ? `${fmtMoney(m.revenue.arpuCents)} per paying user` : '—'}</div>
        </div>
        <div className="adm-card">
          <div className="adm-card-label">ARR (run-rate)</div>
          <div className="adm-card-value">{m ? fmtMoney(m.revenue.arrCents) : '—'}</div>
          <div className="adm-card-sub">MRR × 12</div>
        </div>
      </section>

      <section className="adm-cards">
        <button className="adm-card adm-card-btn" onClick={() => onOpenUsers('trialing')}>
          <div className="adm-card-label">On trial</div>
          <div className="adm-card-value">{fmtNum(m?.subscriptions.trialing)}</div>
          <div className="adm-card-sub">
            {m ? (m.rates.trialConversionPct == null ? 'no resolved trials yet' : `${fmtPct(m.rates.trialConversionPct)} convert (n=${m.rates.trialsResolved})`) : '—'}
          </div>
        </button>
        <button className="adm-card adm-card-btn warn" onClick={() => onOpenUsers('past_due')}>
          <div className="adm-card-label">Payment failed</div>
          <div className="adm-card-value">{fmtNum(m?.subscriptions.pastDue)}</div>
          <div className="adm-card-sub">{m ? `${fmtMoney(m.revenue.atRiskCents)} at risk` : '—'}</div>
        </button>
        <button className="adm-card adm-card-btn warn" onClick={() => onOpenUsers('canceled')}>
          <div className="adm-card-label">Churn (30d)</div>
          <div className="adm-card-value">{m ? fmtPct(m.rates.churn30Pct) : '—'}</div>
          <div className="adm-card-sub">{m ? `${fmtNum(m.subscriptions.canceled30)} cancelled, ${fmtNum(m.subscriptions.pendingCancel)} pending` : '—'}</div>
        </button>
        <div className="adm-card">
          <div className="adm-card-label">Active last 30d</div>
          <div className="adm-card-value">{fmtNum(m?.users.activeLast30)}</div>
          <div className="adm-card-sub">signed in at least once</div>
        </div>
      </section>

      <section className="adm-panel">
        <h2 className="adm-h2">Who our users are</h2>
        {m ? <StateBar counts={m.users.byState} total={m.users.total} /> : <p className="adm-note">Loading…</p>}
      </section>

      <div className="adm-grid2">
        <section className="adm-panel">
          <h2 className="adm-h2">Signups per week <span className="adm-h2-sub">bars = new, line = cumulative</span></h2>
          {ts ? (
            <BarChart
              data={ts.signupsWeekly.map((w) => ({ label: w.week.slice(5), value: w.signups, line: w.cumulative }))}
              valueFormat={(v) => fmtNum(v)}
            />
          ) : <p className="adm-note">Loading…</p>}
        </section>

        <section className="adm-panel">
          <h2 className="adm-h2">Net revenue per month</h2>
          {!ts ? <p className="adm-note">Loading…</p>
            : !ts.revenueAvailable ? <p className="adm-note">{ts.revenueError || 'Stripe is not configured in this environment.'}</p>
            : (
              <>
                <BarChart
                  data={ts.revenueMonthly.map((r) => ({ label: r.month.slice(2), value: Math.max(0, r.netCents) }))}
                  color="var(--team)"
                  valueFormat={(v) => fmtMoney(v, ts.currency)}
                  labelEvery={2}
                />
                {ts.revenueTruncated && <p className="adm-note">Hit the 10,000-transaction cap; earlier months may be understated.</p>}
              </>
            )}
        </section>
      </div>

      <section className="adm-panel">
        <h2 className="adm-h2">Teams</h2>
        {m ? (
          <div className="adm-rev-grid">
            <div><span>Organizations</span><strong>{fmtNum(m.orgs.total)}</strong></div>
            <div><span>Paying teams</span><strong>{fmtNum(m.orgs.paying)}</strong></div>
            <div><span>Seats purchased</span><strong>{fmtNum(m.orgs.seatsPurchased)}</strong></div>
            <div><span>Seats assigned</span><strong>{fmtNum(m.orgs.seatsAssigned)}</strong></div>
            <div><span>Unused seats</span><strong>{fmtNum(Math.max(0, m.orgs.seatsPurchased - m.orgs.seatsAssigned))}</strong></div>
          </div>
        ) : <p className="adm-note">Loading…</p>}
      </section>
    </>
  );
}
