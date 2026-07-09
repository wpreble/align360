'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

const fmt = (cents: number, ccy = 'usd') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: (ccy || 'usd').toUpperCase() }).format((cents || 0) / 100);

const dateStr = (d: Date) => d.toISOString().slice(0, 10);

type Metrics = {
  signups: { total: number | null; recent: { email: string; created_at: string; provider?: string }[] };
  subscriptions: { activeCount: number; mrrCents: number; live: boolean | null; list: { email: string | null; monthlyCents: number; quantity: number; interval: string | null; created: number }[] };
  stripeMode: string;
};
type Payouts = { range: { start: number; end: number }; currency: string; mode: string; count: number; capped: boolean; grossCents: number; feeCents: number; refundCents: number; netCents: number };

export default function AdminDashboard({ email }: { email: string }) {
  const router = useRouter();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [mErr, setMErr] = useState('');

  const today = useMemo(() => new Date(), []);
  const thirtyAgo = useMemo(() => new Date(Date.now() - 30 * 86400_000), []);
  const [start, setStart] = useState(dateStr(thirtyAgo));
  const [end, setEnd] = useState(dateStr(today));
  const [ascPct, setAscPct] = useState(50);
  const [basis, setBasis] = useState<'net' | 'gross'>('net');
  const [payouts, setPayouts] = useState<Payouts | null>(null);
  const [pErr, setPErr] = useState('');
  const [pBusy, setPBusy] = useState(false);

  useEffect(() => {
    fetch('/api/admin/metrics')
      .then((r) => r.json())
      .then((d) => (d.error ? setMErr(d.error) : setMetrics(d)))
      .catch((e) => setMErr(String(e)));
  }, []);

  const loadPayouts = useCallback(async () => {
    setPErr(''); setPBusy(true);
    try {
      const r = await fetch(`/api/admin/payouts?start=${start}&end=${end}`);
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setPayouts(d);
    } catch (e) {
      setPErr(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setPBusy(false);
    }
  }, [start, end]);

  useEffect(() => { loadPayouts(); }, [loadPayouts]);

  function preset(kind: 'mtd' | 'lastmonth' | '30d' | 'all') {
    const now = new Date();
    if (kind === 'mtd') { setStart(dateStr(new Date(now.getFullYear(), now.getMonth(), 1))); setEnd(dateStr(now)); }
    else if (kind === 'lastmonth') { setStart(dateStr(new Date(now.getFullYear(), now.getMonth() - 1, 1))); setEnd(dateStr(new Date(now.getFullYear(), now.getMonth(), 0))); }
    else if (kind === '30d') { setStart(dateStr(new Date(Date.now() - 30 * 86400_000))); setEnd(dateStr(now)); }
    else { setStart('2026-01-01'); setEnd(dateStr(now)); }
  }

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' }).catch(() => {});
    router.push('/admin/login'); router.refresh();
  }

  const ccy = payouts?.currency || 'usd';
  const baseCents = payouts ? (basis === 'net' ? payouts.netCents : payouts.grossCents) : 0;
  const ascCents = Math.round(baseCents * (ascPct / 100));
  const teamCents = baseCents - ascCents;

  return (
    <div className="adm">
      <header className="adm-top">
        <div className="adm-login-brand">Align360 <span>Admin</span></div>
        <div className="adm-top-right">
          <span className="adm-who">{email}</span>
          <button className="adm-ghost" onClick={logout}>Sign out</button>
        </div>
      </header>

      {mErr && <div className="adm-err adm-block">{mErr}</div>}

      <section className="adm-cards">
        <div className="adm-card">
          <div className="adm-card-label">Signups</div>
          <div className="adm-card-value">{metrics?.signups.total ?? '—'}</div>
          <div className="adm-card-sub">total accounts</div>
        </div>
        <div className="adm-card">
          <div className="adm-card-label">Paying customers</div>
          <div className="adm-card-value">{metrics?.subscriptions.activeCount ?? '—'}</div>
          <div className="adm-card-sub">active subscriptions {metrics && <span className={`adm-pill ${metrics.stripeMode}`}>{metrics.stripeMode}</span>}</div>
        </div>
        <div className="adm-card">
          <div className="adm-card-label">MRR</div>
          <div className="adm-card-value">{metrics ? fmt(metrics.subscriptions.mrrCents) : '—'}</div>
          <div className="adm-card-sub">monthly recurring</div>
        </div>
        <div className="adm-card">
          <div className="adm-card-label">ARR (run-rate)</div>
          <div className="adm-card-value">{metrics ? fmt(metrics.subscriptions.mrrCents * 12) : '—'}</div>
          <div className="adm-card-sub">MRR × 12</div>
        </div>
      </section>

      <section className="adm-panel">
        <h2 className="adm-h2">Revenue split</h2>
        <div className="adm-controls">
          <label>From <input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
          <label>To <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
          <div className="adm-presets">
            <button onClick={() => preset('mtd')}>This month</button>
            <button onClick={() => preset('lastmonth')}>Last month</button>
            <button onClick={() => preset('30d')}>Last 30d</button>
            <button onClick={() => preset('all')}>All time</button>
          </div>
          <button className="adm-btn sm" onClick={loadPayouts} disabled={pBusy}>{pBusy ? 'Loading…' : 'Refresh'}</button>
        </div>

        {pErr && <div className="adm-err">{pErr}</div>}

        {payouts && (
          <>
            <div className="adm-rev-grid">
              <div><span>Gross collected</span><strong>{fmt(payouts.grossCents, ccy)}</strong></div>
              <div><span>Stripe fees</span><strong>−{fmt(payouts.feeCents, ccy)}</strong></div>
              {payouts.refundCents !== 0 && <div><span>Refunds</span><strong>{fmt(payouts.refundCents, ccy)}</strong></div>}
              <div className="adm-rev-net"><span>Net</span><strong>{fmt(payouts.netCents, ccy)}</strong></div>
              <div><span>Charges</span><strong>{payouts.count}{payouts.capped ? '+ (capped)' : ''}</strong></div>
            </div>

            <div className="adm-split-controls">
              <label>Split basis
                <select value={basis} onChange={(e) => setBasis(e.target.value as 'net' | 'gross')}>
                  <option value="net">Net (after fees)</option>
                  <option value="gross">Gross</option>
                </select>
              </label>
              <label>Ascendance %
                <input type="number" min={0} max={100} value={ascPct} onChange={(e) => setAscPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} />
              </label>
              <span className="adm-split-hint">Align360 gets {100 - ascPct}%</span>
            </div>

            <div className="adm-split-out">
              <div className="adm-split-card asc">
                <div className="adm-card-label">Ascendance ({ascPct}%)</div>
                <div className="adm-card-value">{fmt(ascCents, ccy)}</div>
              </div>
              <div className="adm-split-card team">
                <div className="adm-card-label">Align360 team ({100 - ascPct}%)</div>
                <div className="adm-card-value">{fmt(teamCents, ccy)}</div>
              </div>
            </div>
            <p className="adm-note">Split applied to <strong>{basis === 'net' ? 'net' : 'gross'}</strong> of {fmt(baseCents, ccy)} over {start} → {end}. Mode: <span className={`adm-pill ${payouts.mode}`}>{payouts.mode}</span></p>
          </>
        )}
      </section>

      <section className="adm-panel">
        <h2 className="adm-h2">Active paying customers</h2>
        {metrics?.subscriptions.list.length ? (
          <table className="adm-table">
            <thead><tr><th>Email</th><th>Plan</th><th>Qty</th><th>Monthly</th></tr></thead>
            <tbody>
              {metrics.subscriptions.list.map((s, i) => (
                <tr key={i}><td>{s.email || '—'}</td><td>{s.interval || '—'}</td><td>{s.quantity}</td><td>{fmt(s.monthlyCents)}</td></tr>
              ))}
            </tbody>
          </table>
        ) : <p className="adm-note">No active subscriptions.</p>}
      </section>

      <section className="adm-panel">
        <h2 className="adm-h2">Recent signups</h2>
        {metrics?.signups.recent.length ? (
          <table className="adm-table">
            <thead><tr><th>Email</th><th>Provider</th><th>Signed up</th></tr></thead>
            <tbody>
              {metrics.signups.recent.map((u, i) => (
                <tr key={i}><td>{u.email}</td><td>{u.provider || '—'}</td><td>{new Date(u.created_at).toLocaleString()}</td></tr>
              ))}
            </tbody>
          </table>
        ) : <p className="adm-note">No signups yet.</p>}
      </section>
    </div>
  );
}
