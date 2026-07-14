'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getChats, deleteChat, renameChat, getName, setName, isOnboarded, resetAll, STORE_EVENT, type ChatSession } from '@/lib/storage';
import { createClient, supabaseConfigured } from '@/lib/supabase/client';
import { wipeCloud } from '@/lib/sync';
import { CREDIT_PACKS, topupPriceCents } from '@/lib/credits';
import AlignMark from './AlignMark';
import AccountSync from './AccountSync';

const NAV = [
  { key: 'chat', label: 'Chat', href: '/chat', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
  { key: 'insights', label: 'Insights', href: '/insights', icon: 'M3 3v18h18M7 14l4-4 3 3 5-6' },
  { key: 'frameworks', label: 'Frameworks', href: '/frameworks', icon: 'M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' },
  { key: 'resources', label: 'Resources', href: '/resources', icon: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z' },
  { key: 'team', label: 'Team', href: '/org', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' },
];

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const renameCancelled = useRef(false);
  const [name, setNameState] = useState('');
  const [accountOpen, setAccountOpen] = useState(false);
  const [theme, setTheme] = useState('light');
  const [email, setEmail] = useState<string | null>(null);
  const [credits, setCredits] = useState<{ remaining: number; granted: number; topup: number; unlimited?: boolean } | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);
  const [buyBusy, setBuyBusy] = useState(false);
  const year = new Date().getFullYear();

  const refreshCredits = useCallback(() => {
    if (!supabaseConfigured) return;
    fetch('/api/credits/status')
      .then((r) => r.json())
      .then((d) => { if (d?.available) setCredits(d.unlimited ? { remaining: 0, granted: 0, topup: 0, unlimited: true } : { remaining: d.remaining, granted: d.granted, topup: d.topup ?? 0 }); })
      .catch(() => {});
  }, []);

  const buyCredits = async (creditAmt: number) => {
    setBuyBusy(true);
    try {
      const r = await fetch('/api/stripe/topup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credits: creditAmt }) });
      const d = await r.json();
      if (d.url) { window.location.href = d.url; return; }
      window.alert(d.error || 'Could not start checkout. Make sure billing is configured.');
    } catch {
      window.alert('Could not start checkout.');
    } finally {
      setBuyBusy(false);
    }
  };

  const refreshChats = useCallback(() => setChats(getChats()), []);

  useEffect(() => {
    try {
      setLeftCollapsed(localStorage.getItem('align360:leftCollapsed') === '1');
      const t = localStorage.getItem('align360:theme');
      if (t) document.documentElement.setAttribute('data-theme', t);
      setTheme(document.documentElement.getAttribute('data-theme') || 'light');
    } catch {}
    // Chat history collapsed by default on mobile.
    setHistoryOpen(typeof window !== 'undefined' ? window.innerWidth > 900 : true);
    setNameState(getName());
    refreshChats();
    window.addEventListener(STORE_EVENT, refreshChats);
    return () => window.removeEventListener(STORE_EVENT, refreshChats);
  }, [refreshChats]);

  useEffect(() => { setDrawerOpen(false); refreshChats(); }, [pathname, refreshChats]);

  // Escape closes the mobile drawer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setDrawerOpen(false); setAccountOpen(false); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Routes that render bare (no app chrome) AND skip the onboarding gate:
  // the landing page, onboarding itself, and every auth/public page. Without
  // this, an un-onboarded visitor on /login or /signup gets bounced to
  // /onboarding → middleware sends them back to /login → infinite loop, and the
  // auth pages wrongly render the full app sidebar.
  const BARE_PREFIXES = ['/login', '/signup', '/auth', '/invite', '/subscribe', '/pricing', '/contact'];
  const isBare =
    pathname === '/' ||
    pathname === '/onboarding' ||
    BARE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));

  // Org management (create/manage a team, seats, invites) is exempt from the
  // personal-onboarding + paywall gates: a team admin is a buyer, not necessarily
  // an individual user, and must reach their org dashboard without being forced
  // through onboarding or their own subscription first.
  const isOrgRoute = pathname.startsWith('/org');

  // Gate: first-time users go through onboarding before reaching the app.
  useEffect(() => {
    if (!isBare && !isOrgRoute && !isOnboarded()) router.replace('/onboarding');
  }, [isBare, isOrgRoute, router]);

  // Billing gate: when enforcement is on (BILLING_ENABLED), users without access
  // (not an internal admin, no active subscription) are sent to /subscribe. Off
  // by default, so this is a no-op until billing is switched on.
  useEffect(() => {
    if (isBare || isOrgRoute || !supabaseConfigured) return;
    let cancelled = false;
    (async () => {
      try {
        const d = await fetch('/api/access/status').then((r) => r.json());
        if (cancelled || !d?.enforce || d.access) return;
        // Self-heal before paywalling: reconcile subscription state straight from
        // Stripe (covers a just-completed checkout whose webhook has not landed).
        const s = await fetch('/api/stripe/sync', { method: 'POST' }).then((r) => r.json()).catch(() => null);
        if (cancelled || s?.access) return;
        router.replace('/subscribe');
      } catch { /* fail open */ }
    })();
    return () => { cancelled = true; };
  }, [isBare, pathname, router]);

  // Who's signed in (for the account panel + sign out).
  useEffect(() => {
    if (!supabaseConfigured) return;
    createClient().auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null)).catch(() => {});
    refreshCredits();
    // Returning from a successful top-up checkout: reconcile the paid session
    // straight from Stripe (no webhook dependency), then refresh the balance.
    try {
      if (new URLSearchParams(window.location.search).get('topup') === 'success') {
        fetch('/api/stripe/sync-credits', { method: 'POST' }).catch(() => {}).finally(refreshCredits);
      }
    } catch {}
  }, [refreshCredits]);

  // Opening the account menu reconciles any paid-but-not-yet-granted top-ups
  // (covers the case where the user closed the tab before returning), then
  // refreshes the displayed balance.
  useEffect(() => {
    if (!accountOpen || !supabaseConfigured) return;
    fetch('/api/stripe/sync-credits', { method: 'POST' }).catch(() => {}).finally(refreshCredits);
  }, [accountOpen, refreshCredits]);

  const signOut = async () => {
    try { if (supabaseConfigured) await createClient().auth.signOut(); } catch {}
    try { Object.keys(localStorage).filter((k) => k.startsWith('align360:')).forEach((k) => localStorage.removeItem(k)); } catch {}
    window.location.href = '/login';
  };

  // Inline rename of a chat-history item.
  const startRename = (c: ChatSession) => { renameCancelled.current = false; setEditTitle(c.title || ''); setEditingId(c.id); };
  const commitRename = () => {
    if (!renameCancelled.current && editingId && editTitle.trim()) { renameChat(editingId, editTitle); refreshChats(); }
    setEditingId(null);
    renameCancelled.current = false;
  };
  const cancelRename = () => { renameCancelled.current = true; setEditingId(null); };

  // Landing, onboarding, and auth pages render full-bleed — no sidebar/chrome.
  if (isBare) return <>{children}</>;

  const toggleLeft = () => setLeftCollapsed((v) => { const n = !v; try { localStorage.setItem('align360:leftCollapsed', n ? '1' : '0'); } catch {} return n; });
  const toggleTheme = () => {
    const cur = document.documentElement.getAttribute('data-theme') || 'light';
    const next = cur === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    setTheme(next);
    try { localStorage.setItem('align360:theme', next); } catch {}
  };

  return (
    <div className={`app-layout${leftCollapsed ? ' left-collapsed' : ''}${drawerOpen ? ' drawer-open' : ''}`}>
      <AccountSync />
      <div className="drawer-scrim" onClick={() => setDrawerOpen(false)} />

      <aside className="sidebar">
        <div className="sidebar-logo">
          <AlignMark />
          <span className="logo-text">Align</span>
          <button className="icon-btn collapse-left" onClick={toggleLeft} aria-label="Collapse sidebar">
            <Icon d="M15 18l-6-6 6-6" />
          </button>
        </div>

        <nav className="sidebar-section">
          {NAV.map((item) => {
            const active = item.href === '/chat' ? pathname === '/chat' : pathname.startsWith(item.href);
            return (
              <Link key={item.key} href={item.href} className={`sidebar-nav-item${active ? ' active' : ''}`} title={item.label}>
                <span className="nav-icon"><Icon d={item.icon} /></span>
                <span className="nav-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Chat History — its own section, scrolls when the list outgrows the view. */}
        <div className="sidebar-history">
          <div className="ch-toggle">
            <button className="ch-toggle-btn" onClick={() => setHistoryOpen((v) => !v)} aria-expanded={historyOpen} aria-controls="ch-list">
              <svg className={`ch-caret${historyOpen ? ' open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
              <span>Chat History</span>
            </button>
            <button className="ch-new" onClick={() => router.push('/chat?new=' + Date.now())} title="New chat" aria-label="New chat">+</button>
          </div>
          {historyOpen && (
            <div className="ch-list" id="ch-list">
              {chats.length === 0 ? (
                <div className="ch-empty">No conversations yet.</div>
              ) : (
                chats.map((c) => (
                  <div key={c.id} className="ch-item">
                    {editingId === c.id ? (
                      <input
                        className="ch-edit"
                        value={editTitle}
                        autoFocus
                        maxLength={80}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitRename(); } else if (e.key === 'Escape') { e.preventDefault(); cancelRename(); } }}
                        onBlur={commitRename}
                        aria-label="Chat name"
                      />
                    ) : (
                      <>
                        <Link href={`/chat?chat=${c.id}`} className="ch-item-link" title={c.title}>{c.title || 'Untitled'}</Link>
                        <button className="ch-rename" onClick={() => startRename(c)} aria-label="Rename chat" title="Rename"><Icon d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></button>
                        <button className="ch-del" onClick={() => deleteChat(c.id)} aria-label="Delete chat" title="Delete">✕</button>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Account + copyright pinned to the bottom. */}
        <div className="sidebar-foot">
          <div className="foot-controls">
            <button className="account-btn" onClick={() => setAccountOpen(true)} aria-label="Account and settings" title="Account & settings">
              <span className="account-avatar">{(name || '?').trim().charAt(0).toUpperCase()}</span>
              <span className="account-name">{name || 'Your account'}</span>
              <span className="account-gear" aria-hidden>
                <Icon d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15H4a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 5.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6h.09A1.65 1.65 0 0 0 11 3.09V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 21 9v.09a1.65 1.65 0 0 0 0 4z" />
              </span>
            </button>
            <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle theme" title="Toggle light / dark">
              <Icon d="M12 3v2M12 19v2M5 5l1.5 1.5M17.5 17.5L19 19M3 12h2M19 12h2M5 19l1.5-1.5M17.5 6.5L19 5M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
            </button>
          </div>
          <div className="sidebar-ip">© {year} Align360. All rights reserved.</div>
        </div>
      </aside>

      {/* Account & Settings panel */}
      {accountOpen && (
        <div className="acct-scrim" onClick={() => setAccountOpen(false)}>
          <div className="acct-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Account and settings">
            <div className="acct-head">
              <span className="account-avatar lg">{(name || '?').trim().charAt(0).toUpperCase()}</span>
              <div>
                <div className="acct-name-display">{name || 'Guest'}</div>
                <div className="acct-sub">Align360 account</div>
              </div>
              <button className="acct-x" onClick={() => setAccountOpen(false)} aria-label="Close">✕</button>
            </div>

            <label className="acct-field">
              <span>Display name</span>
              <input value={name} onChange={(e) => { setNameState(e.target.value); setName(e.target.value); }} placeholder="Your name" maxLength={40} />
            </label>

            <div className="acct-section-label">Account</div>
            {email ? (
              <div className="acct-item" style={{ cursor: 'default' }}><span>Signed in as</span><span className="acct-val">{email}</span></div>
            ) : null}
            {credits ? (
              <div className="acct-item" style={{ cursor: 'default' }}>
                <span>Credits this month</span>
                <span className="acct-val">{credits.unlimited ? 'Unlimited' : `${credits.remaining} / ${credits.granted}${credits.topup > 0 ? ` (+${credits.topup})` : ''}`}</span>
              </div>
            ) : null}
            {email && !credits?.unlimited ? (
              <>
                <button className="acct-item" onClick={() => setBuyOpen((v) => !v)} aria-expanded={buyOpen}>
                  <span>Buy credits</span><span className="acct-val">{buyOpen ? '–' : '+'}</span>
                </button>
                {buyOpen && (
                  <div className="acct-packs">
                    {CREDIT_PACKS.map((c) => (
                      <button key={c} className="acct-pack" disabled={buyBusy} onClick={() => buyCredits(c)}>
                        <span className="acct-pack-c">{c.toLocaleString()} credits</span>
                        <span className="acct-pack-p">${(topupPriceCents(c) / 100).toFixed(0)}</span>
                      </button>
                    ))}
                    <div className="acct-pack-note">Opens Stripe checkout. Credits never expire.</div>
                  </div>
                )}
              </>
            ) : (
              <button className="acct-item" disabled><span>Plan &amp; billing</span><span className="acct-soon">Soon</span></button>
            )}

            <div className="acct-section-label">Team</div>
            <a className="acct-item" href="/org"><span>Your organization</span><span className="acct-val">Manage &rarr;</span></a>
            <a className="acct-item" href="/signup/team"><span>Create or upgrade to a team</span><span className="acct-val">Add seats &rarr;</span></a>

            <div className="acct-section-label">Preferences</div>
            <button className="acct-item" onClick={toggleTheme}><span>Appearance</span><span className="acct-val">{theme === 'dark' ? 'Dark' : 'Light'}</span></button>
            <button className="acct-item" disabled><span>Notifications</span><span className="acct-soon">Soon</span></button>

            <div className="acct-section-label">Data</div>
            <button
              className="acct-item danger"
              onClick={async () => {
                if (!window.confirm('Reset all your Align360 data? Your onboarding, assessments, profile, and chats will be cleared on every device.')) return;
                try {
                  if (supabaseConfigured) {
                    const sb = createClient();
                    const { data } = await sb.auth.getUser();
                    if (data.user?.id) await wipeCloud(sb, data.user.id);
                  }
                } catch {}
                resetAll();
                window.location.href = '/onboarding';
              }}
            >
              <span>Reset my data</span><span className="acct-val danger">Clear</span>
            </button>
            <div className="acct-note">Your data is saved to your account and syncs across your devices.</div>

            <div className="acct-foot">
              {email ? (
                <button className="acct-signout" onClick={signOut}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>
                  Sign out
                </button>
              ) : (
                <a className="acct-signout" href="/login">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /></svg>
                  Sign in
                </a>
              )}
              <button className="acct-done" onClick={() => setAccountOpen(false)}>Done</button>
            </div>
          </div>
        </div>
      )}

      <main className="center-col">
        <div className="mobile-bar">
          <button className="icon-btn" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
            <Icon d="M3 12h18M3 6h18M3 18h18" />
          </button>
          <AlignMark />
          <span className="logo-text">Align</span>
        </div>
        {leftCollapsed && (
          <button className="reopen-tab left" onClick={toggleLeft} aria-label="Show sidebar">
            <Icon d="M9 18l6-6-6-6" />
          </button>
        )}
        {children}
      </main>
    </div>
  );
}
