import '../landing.css';
import './pricing.css';
import Link from 'next/link';
import AlignMark from '@/app/_components/AlignMark';

export const metadata = {
  title: 'Align360 · Pricing',
  description:
    'Align360 pricing for individuals, teams of 5 to 25, and enterprises. Start free, then choose the plan that fits you or your organization.',
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
            <Link href="/chat" className="lp-btn primary small">Log In</Link>
          </div>
        </div>
      </header>

      <main className="pr-main">
        <div className="pr-head">
          <div className="pr-eyebrow">Alpha Pricing</div>
          <h1 className="pr-title">Start free. <em>Grow when you&apos;re ready.</em></h1>
          <p className="pr-lead">Discover how you&apos;re wired at no cost. Subscribe when you want the full picture — for yourself, your team, or your whole organization.</p>
          <p className="pr-alpha-line"><b>These are alpha pilot prices</b> — they won&apos;t be this low forever.</p>
        </div>

        <div className="pr-grid">
          {/* INDIVIDUAL */}
          <div className="pr-card">
            <div className="pr-tier">Individual</div>
            <div className="pr-for">For one person getting clarity.</div>
            <div className="pr-alpha">Alpha price</div>
            <div className="pr-price"><b>$25</b><span>/month</span></div>
            <div className="pr-pricenote">Free to start &middot; no card needed</div>
            <ul className="pr-feats">
              <li>Your full combined profile and every assessment</li>
              <li>An AI guide that knows how you&apos;re wired</li>
              <li>Clarity Layer reports and frameworks</li>
              <li>Everything remembered, compounding over time</li>
            </ul>
            <Link href="/chat" className="pr-cta ghost">Start free &rarr;</Link>
          </div>

          {/* TEAM — featured */}
          <div className="pr-card feat">
            <div className="pr-badge">Most popular</div>
            <div className="pr-tier">Team</div>
            <div className="pr-for">For teams of 5 to 25 people.</div>
            <div className="pr-alpha">Alpha price</div>
            <div className="pr-price"><b>$19</b><span>/seat / month</span></div>
            <div className="pr-pricenote">Minimum 5 seats</div>
            <ul className="pr-feats">
              <li>Everything in Individual, for every seat</li>
              <li>Sign up your organization first, then invite by email</li>
              <li>Assign seats and manage one bill from your org dashboard</li>
              <li>Team-level patterns &mdash; meaning, never individual data</li>
            </ul>
            <Link href="/signup/team" className="pr-cta primary">Set up your team &rarr;</Link>
          </div>

          {/* ENTERPRISE */}
          <div className="pr-card">
            <div className="pr-tier">Enterprise</div>
            <div className="pr-for">For 25+ and whole organizations.</div>
            <div className="pr-alpha">Alpha pilot</div>
            <div className="pr-price custom"><b>Custom</b></div>
            <div className="pr-pricenote">Annual &middot; tailored to your org</div>
            <ul className="pr-feats">
              <li>Everything in Team, at organizational scale</li>
              <li>Dedicated onboarding and success support</li>
              <li>Organizational intelligence and workforce insights</li>
              <li>SSO, security review, and custom terms</li>
            </ul>
            <Link href="/contact" className="pr-cta ghost">Contact us &rarr;</Link>
          </div>
        </div>

        <p className="pr-foot-note">Teams of 5&ndash;25 set up in minutes. For 25 or more, we&apos;ll build the right plan with you.</p>
      </main>

      {/* FOOTER — mirrors the landing */}
      <footer className="lp-foot">
        <div className="wrap">
          <AlignMark white />
          <span className="lp-foot-word">Align360</span>
          <span className="lp-foot-copy">&copy; 2026 Align360. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
