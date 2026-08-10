'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Role } from './types';
import OverviewTab from './OverviewTab';
import UsersTab from './UsersTab';
import OrgsTab from './OrgsTab';
import RevenueTab from './RevenueTab';
import FeedbackTab from './FeedbackTab';

type TabKey = 'overview' | 'users' | 'orgs' | 'revenue' | 'feedback';

const TABS: { key: TabKey; label: string; superOnly?: boolean }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'users', label: 'Users' },
  { key: 'orgs', label: 'Teams' },
  { key: 'feedback', label: 'Feedback' },
  { key: 'revenue', label: 'Revenue split', superOnly: true },
];

export default function AdminDashboard({ email, role }: { email: string; role: Role }) {
  const router = useRouter();
  const isSuper = role === 'superadmin';
  const [tab, setTab] = useState<TabKey>('overview');
  // Set when an Overview card is clicked, so "Payment failed → 3" can jump
  // straight to that filtered list instead of making you rebuild the filter.
  const [userFilter, setUserFilter] = useState<string | undefined>(undefined);

  const tabs = TABS.filter((t) => !t.superOnly || isSuper);

  function openUsers(state: string) {
    setUserFilter(state);
    setTab('users');
  }

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' }).catch(() => {});
    router.push('/admin/login'); router.refresh();
  }

  return (
    <div className="adm">
      <header className="adm-top">
        <div className="adm-login-brand">Align360 <span>Admin</span></div>
        <div className="adm-top-right">
          <span className="adm-who">{email} <span className={`adm-pill ${isSuper ? 'live' : 'unknown'}`}>{isSuper ? 'superadmin' : 'admin'}</span></span>
          <button className="adm-ghost" onClick={logout}>Sign out</button>
        </div>
      </header>

      <nav className="adm-tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`adm-tab ${tab === t.key ? 'on' : ''}`}
            onClick={() => { setTab(t.key); if (t.key !== 'users') setUserFilter(undefined); }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'overview' && <OverviewTab onOpenUsers={openUsers} />}
      {tab === 'users' && <UsersTab initialFilter={userFilter} />}
      {tab === 'orgs' && <OrgsTab />}
      {tab === 'feedback' && <FeedbackTab />}
      {tab === 'revenue' && isSuper && <RevenueTab />}
    </div>
  );
}
