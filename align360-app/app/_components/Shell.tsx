'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { getChats, deleteChat, getName, setName, isOnboarded, STORE_EVENT, type ChatSession } from '@/lib/storage';
import AlignMark from './AlignMark';

const NAV = [
  { key: 'chat', label: 'Chat', href: '/chat', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
  { key: 'insights', label: 'Insights', href: '/insights', icon: 'M3 3v18h18M7 14l4-4 3 3 5-6' },
  { key: 'frameworks', label: 'Frameworks', href: '/frameworks', icon: 'M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' },
  { key: 'resources', label: 'Resources', href: '/resources', icon: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z' },
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
  const [name, setNameState] = useState('');
  const year = new Date().getFullYear();

  const refreshChats = useCallback(() => setChats(getChats()), []);

  useEffect(() => {
    try {
      setLeftCollapsed(localStorage.getItem('align360:leftCollapsed') === '1');
      const t = localStorage.getItem('align360:theme');
      if (t) document.documentElement.setAttribute('data-theme', t);
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
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Gate: first-time users go through onboarding before reaching the app.
  // The landing page ('/') and onboarding are public + full-bleed.
  useEffect(() => {
    if (pathname !== '/onboarding' && pathname !== '/' && !isOnboarded()) router.replace('/onboarding');
  }, [pathname, router]);

  // Landing + onboarding render full-bleed — no sidebar/chrome.
  if (pathname === '/onboarding' || pathname === '/') return <>{children}</>;

  const toggleLeft = () => setLeftCollapsed((v) => { const n = !v; try { localStorage.setItem('align360:leftCollapsed', n ? '1' : '0'); } catch {} return n; });
  const toggleTheme = () => {
    const cur = document.documentElement.getAttribute('data-theme') || 'light';
    const next = cur === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('align360:theme', next); } catch {}
  };

  return (
    <div className={`app-layout${leftCollapsed ? ' left-collapsed' : ''}${drawerOpen ? ' drawer-open' : ''}`}>
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
                    <Link href={`/chat?chat=${c.id}`} className="ch-item-link" title={c.title}>{c.title || 'Untitled'}</Link>
                    <button className="ch-del" onClick={() => deleteChat(c.id)} aria-label="Delete chat">✕</button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Account / settings + copyright pinned to the bottom. */}
        <div className="sidebar-foot">
          <input
            className="name-field"
            value={name}
            onChange={(e) => { setNameState(e.target.value); setName(e.target.value); }}
            placeholder="Set your name"
            aria-label="Your name"
            maxLength={40}
          />
          <div className="foot-controls">
            <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle theme" title="Toggle light / dark">
              <Icon d="M12 3v2M12 19v2M5 5l1.5 1.5M17.5 17.5L19 19M3 12h2M19 12h2M5 19l1.5-1.5M17.5 6.5L19 5M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
            </button>
            <button className="icon-btn" aria-label="Account & settings" title="Account & settings (coming soon)" disabled>
              <Icon d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15H4a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 5.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6h.09A1.65 1.65 0 0 0 11 3.09V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 21 9v.09a1.65 1.65 0 0 0 0 4z" />
            </button>
          </div>
          <div className="sidebar-ip">© {year} Align360. All rights reserved.</div>
        </div>
      </aside>

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
