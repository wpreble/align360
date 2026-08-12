'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Payouts } from './types';
import { dateStr, fmtMoney } from './ui';

/**
 * The Ascendance / Align360 revenue split. Superadmin only — this is partnership
 * terms rather than an operating metric, which is the whole reason the role line
 * is drawn here and not around the customer data.
 */
export default function RevenueTab() {
  const today = useMemo(() => new Date(), []);
  const thirtyAgo = useMemo(() => new Date(Date.now() - 30 * 86400_000), []);
  const [start, setStart] = useState(dateStr(thirtyAgo));
  const [end, setEnd] = useState(dateStr(today));
  const [ascPct, setAscPct] = useState(50);
  const [basis, setBasis] = useState<'net' | 'gross'>('net');
  const [payouts, setPayouts] = useState<Payouts | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (fresh = false) => {
    setErr(''); setBusy(true);
    try {
      const r = await fetch(`/api/admin/payouts?start=${start}&end=${end}${fresh ? '&refresh=1' : ''}`);
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setPayouts(d);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setBusy(false);
    }
  }, [start, end]);

  useEffect(() => { load(); }, [load]);

  function preset(kind: 'mtd' | 'lastmonth' | '30d' | 'all') {
    const now = new Date();
    if (kind === 'mtd') { setStart(dateStr(new Date(now.getFullYear(), now.getMonth(), 1))); setEnd(dateStr(now)); }
    else if (kind === 'lastmonth') { setStart(dateStr(new Date(now.getFullYear(), now.getMonth() - 1, 1))); setEnd(dateStr(new Date(now.getFullYear(), now.getMonth(), 0))); }
    else if (kind === '30d') { setStart(dateStr(new Date(Date.now() - 30 * 86400_000))); setEnd(dateStr(now)); }
    else { setStart('2026-01-01'); setEnd(dateStr(now)); }
  }

  const ccy = payouts?.currency || 'usd';
  const baseCents = payouts ? (basis === 'net' ? payouts.netCents : payouts.grossCents) : 0;
  const ascCents = Math.round(baseCents * (ascPct / 100));
  const teamCents = baseCents - ascCents;

  return (
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
        <button className="adm-btn sm" onClick={() => load(true)} disabled={busy}>{busy ? 'Loading…' : 'Refresh'}</button>
      </div>

      {err && <div className="adm-err">{err}</div>}

      {payouts && (
        <>
          <div className="adm-rev-grid">
            <div><span>Gross collected</span><strong>{fmtMoney(payouts.grossCents, ccy)}</strong></div>
            <div><span>Stripe fees</span><strong>−{fmtMoney(payouts.feeCents, ccy)}</strong></div>
            {payouts.refundCents !== 0 && <div><span>Refunds</span><strong>{fmtMoney(payouts.refundCents, ccy)}</strong></div>}
            <div className="adm-rev-net"><span>Net</span><strong>{fmtMoney(payouts.netCents, ccy)}</strong></div>
            <div><span>Charges</span><strong>{payouts.count}{payouts.capped ? '+ (capped)' : ''}</strong></div>
            {payouts.appFeeCents !== 0 && (
              <div><span>Application fee</span><strong>{fmtMoney(payouts.appFeeCents, ccy)}</strong></div>
            )}
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
              <div className="adm-card-value">{fmtMoney(ascCents, ccy)}</div>
            </div>
            <div className="adm-split-card team">
              <div className="adm-card-label">Align360 team ({100 - ascPct}%)</div>
              <div className="adm-card-value">{fmtMoney(teamCents, ccy)}</div>
            </div>
          </div>
          {payouts.other.count > 0 && (
            <div className="adm-warn">
              Align360 only. A further {fmtMoney(payouts.other.grossCents, ccy)} gross across{' '}
              {payouts.other.count} charge{payouts.other.count === 1 ? '' : 's'} on this Stripe account belongs to
              other product lines and is excluded from the split.
            </div>
          )}
          {payouts.applicationFeePercent > 0 && payouts.appFeeCents === 0 && (
            <div className="adm-warn">
              STRIPE_APPLICATION_FEE_PERCENT is {payouts.applicationFeePercent}% but no application fee was
              actually charged in this period, because Stripe Connect is not active
              (STRIPE_CONNECTED_ACCOUNT_ID is unset). The split below is therefore a manual calculation, not
              something Stripe is already doing.
            </div>
          )}
          <p className="adm-note">
            Split applied to <strong>{basis === 'net' ? 'net' : 'gross'}</strong> of {fmtMoney(baseCents, ccy)} over {start} → {end}.
            Mode: <span className={`adm-pill ${payouts.mode}`}>{payouts.mode}</span>
          </p>
        </>
      )}
    </section>
  );
}
