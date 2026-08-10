'use client';

import { useEffect, useState } from 'react';
import type { UserDetail } from './types';
import { StateBadge, fmtDate, fmtDateTime, fmtMoney, fmtNum, fmtUnix, relTime } from './ui';

/**
 * Per-user drilldown. Billing on the left, product engagement on the right,
 * because "they pay us $25" and "they have never finished onboarding" are the
 * two halves of the same conversation.
 */
export default function UserDrawer({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [d, setD] = useState<UserDetail | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    setD(null); setErr('');
    fetch(`/api/admin/users/${userId}`)
      .then((r) => r.json())
      .then((j) => { if (!alive) return; if (j.error) setErr(j.error); else setD(j); })
      .catch((e) => alive && setErr(String(e)));
    return () => { alive = false; };
  }, [userId]);

  // Escape closes, matching the click-outside affordance.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const eng = d?.engagement;
  const usage = eng ? Object.entries(eng.usageByFeature).sort((a, b) => b[1].credits - a[1].credits) : [];

  return (
    <div className="adm-drawer-wrap" onClick={onClose}>
      <aside className="adm-drawer" onClick={(e) => e.stopPropagation()}>
        <header className="adm-drawer-top">
          <div>
            <div className="adm-drawer-title">{d?.profile?.full_name || d?.user.email || 'User'}</div>
            {d && <div className="adm-drawer-sub">{d.user.email} · joined {fmtDate(d.user.created_at)} · last seen {relTime(d.user.last_sign_in_at)}</div>}
          </div>
          <button className="adm-ghost" onClick={onClose}>Close</button>
        </header>

        {err && <div className="adm-err">{err}</div>}
        {!d && !err && <p className="adm-note">Loading…</p>}

        {d && (
          <div className="adm-drawer-body">
            <section className="adm-dsec">
              <h3 className="adm-h3">Billing</h3>
              <div className="adm-kv">
                <div><span>Status</span><StateBadge state={d.billing.state} /></div>
                <div><span>Plan</span><strong>{d.billing.planName || '—'}</strong></div>
                <div><span>Monthly</span><strong>{d.billing.monthlyCents ? fmtMoney(d.billing.monthlyCents) : '—'}</strong></div>
                <div><span>Seats</span><strong>{d.billing.quantity || '—'}</strong></div>
                <div><span>Renews</span><strong>{fmtUnix(d.billing.currentPeriodEnd)}</strong></div>
                <div><span>Trial ends</span><strong>{fmtUnix(d.billing.trialEnd)}</strong></div>
                {d.billing.cancelAtPeriodEnd && <div><span>Cancelling</span><strong className="adm-danger">at period end</strong></div>}
                {d.billing.orgName && <div><span>Team</span><strong>{d.billing.orgName}</strong></div>}
              </div>

              <h4 className="adm-h4">Payment history</h4>
              {d.billing.paymentsError && <p className="adm-note">{d.billing.paymentsError}</p>}
              {d.billing.payments.length ? (
                <table className="adm-table compact">
                  <thead><tr><th>Date</th><th>Amount</th><th>Status</th></tr></thead>
                  <tbody>
                    {d.billing.payments.map((p) => (
                      <tr key={p.id}>
                        <td>{fmtUnix(p.created)}</td>
                        <td>{fmtMoney(p.amountCents, p.currency)}{p.refunded && <span className="adm-sub-inline">refunded</span>}</td>
                        <td>{p.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : !d.billing.paymentsError && <p className="adm-note">No charges on record.</p>}
            </section>

            <section className="adm-dsec">
              <h3 className="adm-h3">Engagement</h3>
              <div className="adm-kv">
                <div><span>Onboarding</span><strong>{eng!.onboardingComplete ? `${eng!.onboardingAnswered} answers` : 'not started'}</strong></div>
                <div><span>Assessments</span><strong>{fmtNum(eng!.assessments.length)}</strong></div>
                <div><span>Reports</span><strong>{fmtNum(eng!.reports.length)}</strong></div>
                <div><span>Chats</span><strong>{fmtNum(eng!.chats.length)}</strong></div>
                {eng!.credits && (
                  <div><span>Credits</span><strong>{fmtNum(eng!.credits.credits_used)} / {fmtNum(eng!.credits.credits_granted)}</strong></div>
                )}
              </div>

              {eng!.assessments.length > 0 && (
                <>
                  <h4 className="adm-h4">Assessments completed</h4>
                  <table className="adm-table compact">
                    <thead><tr><th>Assessment</th><th>Completed</th></tr></thead>
                    <tbody>
                      {eng!.assessments.map((a) => (
                        <tr key={a.slug}><td>{a.slug}</td><td>{fmtDate(a.completed_at)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              {eng!.reports.length > 0 && (
                <>
                  <h4 className="adm-h4">Reports generated</h4>
                  <table className="adm-table compact">
                    <thead><tr><th>Kind</th><th>Slug</th><th>Generated</th></tr></thead>
                    <tbody>
                      {eng!.reports.map((r) => (
                        <tr key={`${r.kind}-${r.slug}`}><td>{r.kind}</td><td>{r.slug || '—'}</td><td>{fmtDate(r.generated_at)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              {usage.length > 0 && (
                <>
                  <h4 className="adm-h4">Usage by feature <span className="adm-h2-sub">last {fmtNum(eng!.usageEventsSampled)} events</span></h4>
                  <table className="adm-table compact">
                    <thead><tr><th>Feature</th><th className="num">Events</th><th className="num">Credits</th></tr></thead>
                    <tbody>
                      {usage.map(([feature, v]) => (
                        <tr key={feature}><td>{feature}</td><td className="num">{fmtNum(v.events)}</td><td className="num">{fmtNum(v.credits)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </section>

            {(d.referrals.code || d.referrals.made.length > 0 || d.referrals.referredBy) && (
              <section className="adm-dsec">
                <h3 className="adm-h3">Referrals</h3>
                <div className="adm-kv">
                  <div><span>Their code</span><strong>{d.referrals.code || '—'}</strong></div>
                  <div><span>Referred in</span><strong>{fmtNum(d.referrals.made.length)}</strong></div>
                  <div><span>Came from</span><strong>{d.referrals.referredBy?.code_used || '—'}</strong></div>
                </div>
              </section>
            )}

            {d.feedback.length > 0 && (
              <section className="adm-dsec">
                <h3 className="adm-h3">Their feedback</h3>
                {d.feedback.map((f) => (
                  <div key={f.id} className="adm-quote">
                    <div className="adm-quote-meta">{fmtDateTime(f.created_at)}{f.path ? ` · ${f.path}` : ''}</div>
                    {f.message}
                  </div>
                ))}
              </section>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
