'use client';

import '../org.css';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  getOrg, myMembership, listMembers, listInvites, createInvite, revokeInvite, setSeat, getSeatsPurchased,
  type Org, type Member, type Invite, type Role,
} from '@/lib/orgs';

export default function OrgDashboard() {
  const { id } = useParams() as { id: string };
  const [org, setOrg] = useState<Org | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [seats, setSeats] = useState(0);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member');
  const [seatQty, setSeatQty] = useState(5);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const refresh = useCallback(async () => {
    try {
      const [o, m, mem, inv, s] = await Promise.all([
        getOrg(id), myMembership(id), listMembers(id), listInvites(id).catch(() => []), getSeatsPurchased(id),
      ]);
      setOrg(o); setRole(m?.role || null); setMembers(mem); setInvites(inv); setSeats(s);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => { refresh(); }, [refresh]);

  const isAdmin = role === 'owner' || role === 'admin';
  const assigned = members.filter((m) => m.seat_assigned).length;

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setErr(''); setMsg('');
    try {
      await createInvite(id, inviteEmail, inviteRole);
      setInviteEmail('');
      await refresh();
      setMsg('Invite created — copy or email the link below to send it.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Invite failed');
    }
  }
  async function buySeats() {
    setErr('');
    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'org', orgId: id, seats: seatQty }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Checkout failed');
      window.location.href = data.url;
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Checkout failed');
    }
  }
  async function toggleSeat(m: Member) {
    try { await setSeat(id, m.user_id, !m.seat_assigned); await refresh(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Update failed'); }
  }

  if (loading) return <div className="org-page"><p className="org-muted">Loading…</p></div>;
  if (!org) return <div className="org-page"><p className="org-err">Organization not found, or you don&apos;t have access.</p></div>;

  return (
    <div className="org-page">
      <h1 className="org-h1">{org.name}</h1>

      <div className="org-seats">
        <div><span className="org-stat">{assigned}</span><span className="org-stat-lbl">seats assigned</span></div>
        <div><span className="org-stat">{seats}</span><span className="org-stat-lbl">seats purchased</span></div>
        {isAdmin && (
          <div className="org-buy">
            <input type="number" min={5} className="org-input narrow" value={seatQty} onChange={(e) => setSeatQty(Math.max(5, Number(e.target.value) || 5))} />
            <button className="org-btn" onClick={buySeats}>Buy seats →</button>
          </div>
        )}
      </div>
      {assigned > seats && seats > 0 && <div className="org-warn">You&apos;ve assigned more seats ({assigned}) than purchased ({seats}). Buy more or unassign.</div>}

      <h2 className="org-h2">Members</h2>
      <table className="org-table">
        <thead><tr><th>Member</th><th>Role</th><th>Seat</th></tr></thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.user_id}>
              <td>{m.email || m.user_id.slice(0, 8)}{m.full_name ? ` · ${m.full_name}` : ''}</td>
              <td>{m.role}</td>
              <td>{isAdmin && m.role !== 'owner'
                ? <button className="org-seat-toggle" onClick={() => toggleSeat(m)}>{m.seat_assigned ? '✓ assigned' : 'assign'}</button>
                : (m.seat_assigned ? '✓' : '—')}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {isAdmin && (
        <>
          <h2 className="org-h2">Invite by email</h2>
          <form className="org-row" onSubmit={invite}>
            <input className="org-input" type="email" placeholder="email@company.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required />
            <select className="org-input narrow" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as 'member' | 'admin')}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <button className="org-btn">Invite</button>
          </form>
          {invites.length > 0 && (
            <div className="org-invites">
              {invites.map((i) => (
                <div key={i.id} className="org-invite">
                  <span>{i.email} · {i.role}</span>
                  <button className="org-link" onClick={() => { navigator.clipboard?.writeText(`${location.origin}/invite/${i.token}`); setMsg('Invite link copied.'); }}>Copy link</button>
                  <button className="org-link" onClick={() => {
                    const link = `${location.origin}/invite/${i.token}`;
                    const subject = `You're invited to ${org?.name || 'our team'} on Align360`;
                    const body = `You've been invited to join ${org?.name || 'our team'} on Align360.\n\nAccept your invite:\n${link}\n\nAlign360 helps you understand how you're wired and put it to work.`;
                    window.location.href = `mailto:${encodeURIComponent(i.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                  }}>Email</button>
                  <button className="org-link muted" onClick={async () => { await revokeInvite(i.id); refresh(); }}>Revoke</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {msg && <div className="org-msg">{msg}</div>}
      {err && <div className="org-err">{err}</div>}
    </div>
  );
}
