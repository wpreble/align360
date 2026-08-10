'use client';

import type { PaymentState } from './types';

// ── Formatters ──────────────────────────────────────────────────────────────

export const fmtMoney = (cents: number, ccy = 'usd') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: (ccy || 'usd').toUpperCase() }).format((cents || 0) / 100);

export const fmtNum = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('en-US').format(n);

export const fmtPct = (p: number | null | undefined, digits = 1) =>
  p == null ? '—' : `${p.toFixed(digits)}%`;

export const dateStr = (d: Date) => d.toISOString().slice(0, 10);

/** Unix seconds → short local date. */
export const fmtUnix = (s: number | null | undefined) =>
  s == null ? '—' : new Date(s * 1000).toLocaleDateString();

export const fmtDate = (iso: string | null | undefined) =>
  !iso ? '—' : new Date(iso).toLocaleDateString();

export const fmtDateTime = (iso: string | null | undefined) =>
  !iso ? '—' : new Date(iso).toLocaleString();

/** "3d ago" / "2mo ago" — for last-seen columns where exact times are noise. */
export function relTime(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return 'just now';
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const mos = Math.floor(days / 30);
  if (mos < 12) return `${mos}mo ago`;
  return `${Math.floor(mos / 12)}y ago`;
}

// ── Payment state badge ─────────────────────────────────────────────────────

export const STATE_LABEL: Record<PaymentState, string> = {
  active: 'Paying',
  trialing: 'Trial',
  past_due: 'Payment failed',
  org_seat: 'Team seat',
  canceled: 'Churned',
  free: 'Free',
};

export function StateBadge({ state }: { state: PaymentState }) {
  return <span className={`adm-badge s-${state}`}>{STATE_LABEL[state]}</span>;
}

// ── Charts ──────────────────────────────────────────────────────────────────
// Deliberately hand-rolled inline SVG: the app has no charting dependency and
// two chart shapes do not justify adding one.

/** Vertical bar chart with an optional overlaid cumulative line. */
export function BarChart({
  data,
  height = 150,
  color = 'var(--accent)',
  lineColor = 'var(--asc)',
  valueFormat = (v: number) => String(v),
  labelEvery = 4,
}: {
  data: { label: string; value: number; line?: number }[];
  height?: number;
  color?: string;
  lineColor?: string;
  valueFormat?: (v: number) => string;
  labelEvery?: number;
}) {
  if (!data.length) return <p className="adm-note">No data.</p>;

  const W = 720, H = height, PAD_L = 46, PAD_R = 10, PAD_T = 10, PAD_B = 22;
  const innerW = W - PAD_L - PAD_R, innerH = H - PAD_T - PAD_B;
  const maxV = Math.max(1, ...data.map((d) => d.value));
  const hasLine = data.some((d) => typeof d.line === 'number');
  const maxL = hasLine ? Math.max(1, ...data.map((d) => d.line ?? 0)) : 1;

  const bw = innerW / data.length;
  const barW = Math.max(2, bw * 0.62);

  const linePts = hasLine
    ? data.map((d, i) => `${PAD_L + bw * i + bw / 2},${PAD_T + innerH - ((d.line ?? 0) / maxL) * innerH}`).join(' ')
    : '';

  return (
    <svg className="adm-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img">
      {[0, 0.5, 1].map((f) => {
        const y = PAD_T + innerH - f * innerH;
        return (
          <g key={f}>
            <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="var(--line)" strokeWidth={1} />
            <text x={PAD_L - 6} y={y + 3.5} textAnchor="end" className="adm-chart-tick">{valueFormat(Math.round(maxV * f))}</text>
          </g>
        );
      })}

      {data.map((d, i) => {
        const h = (d.value / maxV) * innerH;
        return (
          <rect
            key={d.label}
            x={PAD_L + bw * i + (bw - barW) / 2}
            y={PAD_T + innerH - h}
            width={barW}
            height={Math.max(0, h)}
            rx={2}
            fill={color}
          >
            <title>{`${d.label}: ${valueFormat(d.value)}`}</title>
          </rect>
        );
      })}

      {hasLine && <polyline points={linePts} fill="none" stroke={lineColor} strokeWidth={2} />}

      {data.map((d, i) =>
        i % labelEvery === 0 || i === data.length - 1 ? (
          <text key={`l-${d.label}`} x={PAD_L + bw * i + bw / 2} y={H - 6} textAnchor="middle" className="adm-chart-tick">
            {d.label}
          </text>
        ) : null,
      )}
    </svg>
  );
}

/** Horizontal stacked bar showing the composition of the user base. */
export function StateBar({ counts, total }: { counts: Record<PaymentState, number>; total: number }) {
  const order: PaymentState[] = ['active', 'org_seat', 'trialing', 'past_due', 'canceled', 'free'];
  if (!total) return <p className="adm-note">No users yet.</p>;
  return (
    <>
      <div className="adm-statebar">
        {order.map((s) =>
          counts[s] > 0 ? (
            <div key={s} className={`adm-statebar-seg s-${s}`} style={{ width: `${(counts[s] / total) * 100}%` }} title={`${STATE_LABEL[s]}: ${counts[s]}`} />
          ) : null,
        )}
      </div>
      <div className="adm-legend">
        {order.map((s) =>
          counts[s] > 0 ? (
            <span key={s} className="adm-legend-item">
              <i className={`adm-dot s-${s}`} />
              {STATE_LABEL[s]} <strong>{fmtNum(counts[s])}</strong>
            </span>
          ) : null,
        )}
      </div>
    </>
  );
}

/** Banner for the truncation / availability flags the APIs surface. */
export function DataWarnings({
  truncated,
  available,
}: {
  truncated?: { users: boolean; subs: boolean };
  available?: { supabase: boolean; stripe: boolean };
}) {
  const msgs: string[] = [];
  if (available && !available.supabase) msgs.push('Supabase is not configured in this environment, so signup data is missing.');
  if (available && !available.stripe) msgs.push('Stripe is not configured in this environment, so billing data is missing.');
  if (truncated?.users) msgs.push('User list hit the 20,000-row safety cap. Counts below are incomplete.');
  if (truncated?.subs) msgs.push('Subscription list hit the 10,000-row safety cap. Revenue figures below are incomplete.');
  if (!msgs.length) return null;
  return (
    <div className="adm-warn">
      {msgs.map((m) => (
        <div key={m}>{m}</div>
      ))}
    </div>
  );
}
