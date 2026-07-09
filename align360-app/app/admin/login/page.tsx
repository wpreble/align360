'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import '../admin.css';

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Login failed');
      router.push('/admin');
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="adm-login-wrap">
      <form className="adm-login" onSubmit={submit}>
        <div className="adm-login-brand">Align360 <span>Admin</span></div>
        <p className="adm-login-sub">Internal dashboard. Authorized accounts only.</p>
        <label className="adm-label">Email
          <input className="adm-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" placeholder="you@align360.io" />
        </label>
        <label className="adm-label">Password
          <input className="adm-input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="••••••••••••" />
        </label>
        {err && <div className="adm-err">{err}</div>}
        <button className="adm-btn" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}
