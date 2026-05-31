'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const NAV = [
  { key: 'ai', label: 'Align360 AI', href: '/', icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 7a3 3 0 1 1 0 6 3 3 0 0 1 0-6z' },
  { key: 'assessments', label: 'Assessments', href: '/assessments', icon: 'M9 11l3 3 8-8M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' },
  { key: 'library', label: 'Resource Library', soon: true, icon: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z' },
  { key: 'tools', label: 'Tools', soon: true, icon: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z' },
  { key: 'gallery', label: 'User Resource Gallery', soon: true, icon: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z' },
];

const TOOLS = [
  { slug: 'wiring', name: 'Wiring for Impact', badge: 'CORE' },
  { slug: 'orientation', name: 'Orientation for Impact' },
  { slug: 'rejection-gift', name: 'Rejection Gift Finder' },
  { slug: null, name: 'Decision Simulation Lab', soon: true },
  { slug: null, name: 'Impact Pathways & Skill Builder', soon: true },
  { slug: null, name: 'Job & Market Trends Intelligence', soon: true },
  { slug: null, name: 'Family Mechanics Simulator', soon: true },
];

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

/** The ALIGN celestial mark — facing arcs, central node, axis points, side ticks. */
function AlignMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 50" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="20" y1="3" x2="20" y2="47" />
      <path d="M12 13 A 11 12 0 0 0 12 37" />
      <path d="M28 13 A 11 12 0 0 1 28 37" />
      <line x1="3" y1="25" x2="8" y2="25" />
      <line x1="32" y1="25" x2="37" y2="25" />
      <circle cx="20" cy="25" r="4.2" fill="currentColor" stroke="none" />
      <circle cx="20" cy="14" r="2" fill="currentColor" stroke="none" />
      <circle cx="20" cy="36" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const year = new Date().getFullYear();

  useEffect(() => {
    try {
      setLeftCollapsed(localStorage.getItem('align360:leftCollapsed') === '1');
      setRightCollapsed(localStorage.getItem('align360:rightCollapsed') === '1');
      const t = localStorage.getItem('align360:theme');
      if (t) document.documentElement.setAttribute('data-theme', t);
    } catch {}
  }, []);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  const toggleLeft = () => setLeftCollapsed((v) => { const n = !v; try { localStorage.setItem('align360:leftCollapsed', n ? '1' : '0'); } catch {} return n; });
  const toggleRight = () => setRightCollapsed((v) => { const n = !v; try { localStorage.setItem('align360:rightCollapsed', n ? '1' : '0'); } catch {} return n; });
  const toggleTheme = () => {
    const cur = document.documentElement.getAttribute('data-theme') || 'light';
    const next = cur === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('align360:theme', next); } catch {}
  };
  const launchTool = (slug: string | null) => { if (slug) router.push(`/assessment/${slug}`); };

  return (
    <div className={`app-layout${leftCollapsed ? ' left-collapsed' : ''}${rightCollapsed ? ' right-collapsed' : ''}${drawerOpen ? ' drawer-open' : ''}`}>
      <div className="drawer-scrim" onClick={() => setDrawerOpen(false)} />

      {/* LEFT SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <AlignMark className="align-mark" />
          <span className="logo-text">Align</span>
          <button className="icon-btn collapse-left" onClick={toggleLeft} aria-label="Collapse sidebar">
            <Icon d="M15 18l-6-6 6-6" />
          </button>
        </div>

        <nav className="sidebar-section">
          {NAV.map((item) => {
            const active = item.href ? pathname === item.href : false;
            const inner = (
              <>
                <span className="nav-icon"><Icon d={item.icon} /></span>
                <span className="nav-label">{item.label}</span>
                {item.soon && <span className="nav-soon">soon</span>}
              </>
            );
            return item.href && !item.soon ? (
              <Link key={item.key} href={item.href} className={`sidebar-nav-item${active ? ' active' : ''}`} title={item.label}>
                {inner}
              </Link>
            ) : (
              <button key={item.key} className="sidebar-nav-item" title={`${item.label} — coming soon`} disabled>
                {inner}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-section history">
          <div className="sidebar-label">Chat History</div>
          <div className="history-empty">Your conversations will appear here once accounts are wired.</div>
        </div>

        <div className="sidebar-foot">
          <div className="foot-controls">
            <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle theme" title="Toggle light / dark">
              <Icon d="M12 3v2M12 19v2M5 5l1.5 1.5M17.5 17.5L19 19M3 12h2M19 12h2M5 19l1.5-1.5M17.5 6.5L19 5M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
            </button>
            <button className="icon-btn" aria-label="Settings" title="Settings (soon)" disabled>
              <Icon d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
            </button>
          </div>
          <div className="sidebar-ip">© {year} Align360. All rights reserved.</div>
        </div>
      </aside>

      {/* CENTER */}
      <main className="center-col">
        <div className="mobile-bar">
          <button className="icon-btn" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
            <Icon d="M3 12h18M3 6h18M3 18h18" />
          </button>
          <AlignMark className="align-mark" />
          <span className="logo-text">Align</span>
        </div>
        {leftCollapsed && (
          <button className="reopen-tab left" onClick={toggleLeft} aria-label="Show sidebar">
            <Icon d="M9 18l6-6-6-6" />
          </button>
        )}
        {rightCollapsed && (
          <button className="reopen-tab right" onClick={toggleRight} aria-label="Show insight engine">
            <Icon d="M15 18l-6-6 6-6" />
          </button>
        )}
        {children}
      </main>

      {/* RIGHT — INSIGHT ENGINE */}
      <aside className="right-panel">
        <div className="rp-header">
          <div>
            <div className="rp-title">Insight Engine</div>
            <div className="rp-sub">Tools that power your analysis.</div>
          </div>
          <button className="icon-btn" onClick={toggleRight} aria-label="Collapse panel">
            <Icon d="M9 18l6-6-6-6" />
          </button>
        </div>
        <div className="rp-scroll">
          <div className="rp-section-label">DesignSuite</div>
          {TOOLS.map((t) => (
            <button
              key={t.name}
              className={`tool-item${t.soon ? ' soon' : ''}`}
              onClick={() => launchTool(t.slug)}
              disabled={t.soon}
              title={t.soon ? `${t.name} — coming soon` : `Start ${t.name}`}
            >
              <span className="tool-dot" />
              <span className="tool-name">{t.name}</span>
              {t.badge && <span className="tool-badge">{t.badge}</span>}
              {t.soon && <span className="tool-soon">soon</span>}
            </button>
          ))}
          <Link href="/result?demo=1" className="rp-preview">Preview a sample profile →</Link>
        </div>
        <div className="global-notes">
          <div className="gn-label">Global Notes</div>
          <div className="gn-placeholder">Start a chat to create notes</div>
        </div>
      </aside>
    </div>
  );
}
