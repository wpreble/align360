import '../landing.css';
import './pricing.css';
import Link from 'next/link';
import AlignMark from '@/app/_components/AlignMark';

export const metadata = {
  title: 'ALIGN · Pricing',
  description:
    'ALIGN pricing for individuals, groups of 5 to 25, and enterprises. Start free, then choose the plan that fits you or your organization.',
};

export default function Pricing() {
  return (
    <div className="pr">
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

      <main className="pr-main">
        <div className="pr-head">
          <div className="pr-eyebrow">Alpha Pricing</div>
          <h1 className="pr-title">Start free. <em>Grow when you&apos;re ready.</em></h1>
          <p className="pr-lead">Discover how you&apos;re wired at no cost. Subscribe when you want the full picture — for yourself, your group, or your whole organization.</p>
          <p className="pr-alpha-line"><b>These are alpha pilot prices</b> — they won&apos;t be this low forever.</p>
        </div>

        <div className="pr-grid">
          {/* INDIVIDUAL */}
          <div className="pr-card">
            <div className="pr-tier">Individual</div>
            <div className="pr-for">For your personal journey.</div>
            <div className="pr-alpha">Alpha price</div>
            <div className="pr-price"><b>$25</b><span>/month</span></div>
            <div className="pr-pricenote">Free to start &middot; no card needed</div>
            <ul className="pr-feats">
              <li>Your complete profile, built from every assessment.</li>
              <li>An AI guide that understands how you&apos;re uniquely wired.</li>
              <li>Clarity reports and practical frameworks for every stage.</li>
              <li>Insights that grow with you over time.</li>
            </ul>
            <Link href="/chat" className="pr-cta ghost">Start free &rarr;</Link>
          </div>

          {/* GROUP — featured */}
          <div className="pr-card feat">
            <div className="pr-badge">Most popular</div>
            <div className="pr-tier">Group</div>
            <div className="pr-for">For families, teams, and organizations.</div>
            <div className="pr-alpha">Alpha price</div>
            <div className="pr-price"><b>$19</b><span>/seat / month</span></div>
            <div className="pr-pricenote">Minimum 5 seats</div>
            <ul className="pr-feats">
              <li>Everything in Individual, for every group member.</li>
              <li>Invite your group and get everyone started in minutes.</li>
              <li>Manage seats, billing, and access from one dashboard.</li>
              <li>See group-wide trends while keeping every individual&apos;s data private.</li>
            </ul>
            <Link href="/signup/team" className="pr-cta primary">Set up your group &rarr;</Link>
          </div>

          {/* ENTERPRISE */}
          <div className="pr-card">
            <div className="pr-tier">Enterprise</div>
            <div className="pr-for">For organizations needing a customized ALIGN experience.</div>
            <div className="pr-alpha">Alpha pilot</div>
            <div className="pr-price custom"><b>Custom</b></div>
            <div className="pr-pricenote">Annual &middot; tailored to your organization</div>
            <ul className="pr-feats">
              <li>Everything in Group, for your entire organization.</li>
              <li>White-glove onboarding and dedicated success support.</li>
              <li>Organization-wide insights to strengthen your people and culture.</li>
              <li>Custom features, integrations, and solutions tailored to your organization.</li>
            </ul>
            <Link href="/contact" className="pr-cta ghost">Contact us &rarr;</Link>
          </div>
        </div>

        <p className="pr-foot-note">Whether you&apos;re investing in yourself, your group, or your organization, there&apos;s an ALIGN plan designed to grow with you.</p>
      </main>

      {/* FOOTER — mirrors the landing */}
      <footer className="lp-foot">
        <div className="wrap">
          <AlignMark white />
          <span className="lp-foot-word">ALIGN</span>
          <span className="lp-foot-copy">&copy; 2026 ALIGN. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
