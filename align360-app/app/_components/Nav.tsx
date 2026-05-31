'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/align', label: 'Align' },
  { href: '/chat', label: 'AI Chat' },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <header className="nav">
      <Link href="/align" className="nav-wordmark">
        Align360
      </Link>
      <nav className="nav-tabs">
        {TABS.map((t) => {
          const active = pathname === t.href || pathname.startsWith(t.href + '/');
          return (
            <Link key={t.href} href={t.href} className={`nav-tab${active ? ' active' : ''}`}>
              {t.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
