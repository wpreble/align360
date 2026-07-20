import '../landing.css';
import './faq.css';
import Link from 'next/link';
import AlignMark from '@/app/_components/AlignMark';
import FaqList from './FaqList';

export const metadata = {
  title: 'ALIGN · FAQ',
  description: 'Answers to common questions about ALIGN: what it is, how it works, privacy, and plans.',
};

export default function Faq() {
  return (
    <div className="faq">
      {/* NAV — mirrors the landing */}
      <header className="lp-nav">
        <div className="wrap">
          <Link href="/" className="lp-brand"><AlignMark /><span className="lp-word">Align</span></Link>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
            <Link href="/pricing" className="lp-btn ghost small">Pricing</Link>
            <Link href="/faq" className="lp-btn ghost small">FAQ</Link>
            <Link href="/chat" className="lp-btn primary small">Log In</Link>
          </div>
        </div>
      </header>

      <main className="faq-main">
        <div className="faq-head">
          <div className="faq-eyebrow">FAQ</div>
          <h1 className="faq-title">Questions, <em>answered.</em></h1>
          <p className="faq-lead">Everything you want to know before you start.</p>
        </div>

        <FaqList />
      </main>

      {/* FOOTER — mirrors the landing */}
      <footer className="lp-foot">
        <div className="wrap">
          <AlignMark white />
          <span className="lp-foot-word">ALIGN</span>
          <span className="lp-foot-copy">© 2026 ALIGN. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
