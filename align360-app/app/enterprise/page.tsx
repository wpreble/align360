import '../landing.css';
import './enterprise.css';
import Link from 'next/link';
import AlignMark from '@/app/_components/AlignMark';

/**
 * Enterprise page. Ported from Samuel's enterprise-first site draft
 * (Drive: "0. A360_Ent First Website.html", 2026-08-20), which was a static
 * mockup: every link an in-page anchor, no auth, no app routes. Here the copy
 * and structure are kept and every CTA is wired to /contact, which already
 * posts to HubSpot with align360_source=enterprise_contact.
 *
 * Deliberately NOT carried over from that draft, and the reasons matter because
 * the same copy is due to be reused for the college and family office pages:
 *   - the capability table naming BetterUp, Lattice and Culture Amp and quoting
 *     their per-seat pricing (comparative advertising against named competitors)
 *   - "6-8x lower cost than BetterUp", which is not derivable when the same page
 *     states every engagement is quoted directly and there is no rate card
 *   - "34% of managers promoted past their wiring" and "67% of turnover preceded
 *     by misalignment signals", both presented as fact with no source
 *   - the internal pipeline labels ("Fast Close", "Beta Partner",
 *     "Distribution Partner") that were showing against individual sectors
 *   - "The Moat", which is investor framing on a customer page
 * The stat row is built from the pilot terms instead, since those are things we
 * actually commit to rather than claims about anyone else.
 */

export const metadata = {
  title: 'ALIGN · For Enterprise',
  description:
    'Align360 is an intelligence layer deployed inside your organization. It turns human signals into organizational intelligence leaders can act on, connected to the systems you already use.',
};

const DOORS = [
  { n: '01', t: 'Retention Intelligence', d: 'Identify why valuable people disengage, before they leave.' },
  { n: '02', t: 'Talent Deployment', d: 'Discover capability you are already paying for but are not using.' },
  { n: '03', t: 'Leadership Dependency', d: 'Find where execution depends too heavily on individual leaders.' },
  { n: '04', t: 'Organizational Alignment', d: 'Find where strategy is breaking between leadership and execution.' },
  { n: '05', t: 'Institutional Intelligence', d: 'Keep organizational knowledge from disappearing when people leave.' },
];

const SECTORS = [
  { s: 'Financial Services', t: 'Workforce Intelligence', d: 'Reads role fit, decision patterns, and where institutional knowledge sits with too few people, before a departure makes it obvious.' },
  { s: 'Wealth Advisory', t: 'Advisor Intelligence', d: 'Reads client readiness and life-stage signals alongside the numbers, so advice lands at the right moment, not just the right calculation.' },
  { s: 'Real Estate', t: 'Team Intelligence', d: 'Reads agent capacity, deal-stage bottlenecks, and where the team is quietly over-reliant on one closer.' },
  { s: 'Healthcare', t: 'Health Intelligence', d: 'Reads adherence, readiness, and risk signals between visits, not just what gets reported at the appointment.' },
  { s: 'Enterprise', t: 'Enterprise Intelligence', d: 'Reads decision patterns and institutional knowledge across leadership, so less depends on any one person remembering.' },
  { s: 'Higher Education', t: 'Student Success Intelligence', d: 'Reads academic performance, engagement, and career-readiness gaps across a full cohort, patterns one advisor alone cannot track.' },
  { s: 'Faith Community', t: 'Ministry Intelligence', d: 'Reads engagement and readiness across a congregation, who is growing and who is drifting, before it shows up in attendance.' },
  { s: 'Coaching', t: 'Coach Intelligence', d: 'Reads what is actually changing between sessions, so every conversation starts from real signal instead of last week’s notes.' },
];

const PILOT = [
  'Nominate a 25 person cohort within 14 days of kickoff',
  'Designate one internal champion with decision authority',
  'Complete a 30 minute kickoff session with our team',
  'Share one honest signal from the org at the 30 day mark',
  'Decide to expand, restructure, or exit with full data export',
];

export default function Enterprise() {
  return (
    <div className="ent">
      <header className="lp-nav">
        <div className="wrap">
          <Link href="/" className="lp-brand"><AlignMark /><span className="lp-word">Align</span></Link>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
            <Link href="/pricing" className="lp-btn ghost small">Pricing</Link>
            <Link href="/faq" className="lp-btn ghost small">FAQ</Link>
            <Link href="/contact" className="lp-btn primary small">Talk to us</Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="ent-hero">
        <div className="ent-hero-bg" />
        <div className="wrap">
          <div className="ent-eyebrow"><span className="ent-rule" />Enterprise · Organizational Intelligence<span className="ent-rule" /></div>
          <h1 className="ent-h1">Your people are already making decisions.<br /><em>Give them the system to make better ones.</em></h1>
          <p className="ent-sub">
            Align360 is an intelligence layer deployed inside your organization. Not another coaching
            subscription, not a dashboard, and not a system you rip anything out to install. It turns human
            signals into organizational intelligence your leaders can act on, connected to the systems you
            already use.
          </p>
          <div className="ent-cta">
            <Link href="/contact" className="lp-btn primary">Request a pilot <span aria-hidden="true">→</span></Link>
            <a href="#doors" className="lp-btn ghost">See the five doors</a>
          </div>
          <div className="ent-stats">
            <div><b>5</b><span>Ways in, one system underneath</span></div>
            <div><b>25</b><span>Person cohort to start</span></div>
            <div><b>30 days</b><span>To your first honest signal</span></div>
            <div><b>Full</b><span>Data export, whenever you leave</span></div>
          </div>
        </div>
      </section>

      {/* FIVE DOORS */}
      <section id="doors" className="ent-section">
        <div className="wrap">
          <div className="ent-head">
            <div className="ent-kicker">Five doors in</div>
            <h2 className="ent-h2">You don&apos;t have to buy the whole system.<br />Just the problem that&apos;s <em>costing you</em>.</h2>
            <p className="ent-lead">
              Five named entry points into the same intelligence layer. Start wherever it is costing you the
              most right now. It is the same infrastructure underneath, so the other four come with it.
            </p>
          </div>
          <div className="ent-doors">
            {DOORS.map((d) => (
              <article key={d.n} className="ent-door">
                <div className="ent-door-n">{d.n}</div>
                <h3>{d.t}</h3>
                <p>{d.d}</p>
              </article>
            ))}
          </div>
          <div className="ent-mid-cta">
            <Link href="/contact" className="lp-btn primary">Start with your door <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </section>

      {/* SECTORS */}
      <section className="ent-section alt">
        <div className="wrap">
          <div className="ent-head">
            <div className="ent-kicker">See it in your world</div>
            <h2 className="ent-h2">Same intelligence layer.<br /><em>Adapted to your context.</em></h2>
            <p className="ent-lead">The same alignment engine, adapted to the language and context of each sector.</p>
          </div>
          <div className="ent-sectors">
            {SECTORS.map((s) => (
              <article key={s.s} className="ent-sector">
                <div className="ent-sector-s">{s.s}</div>
                <h3>{s.t}</h3>
                <p>{s.d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* OFFER */}
      <section className="ent-section">
        <div className="wrap">
          <div className="ent-head">
            <div className="ent-kicker">The enterprise offer</div>
            <h2 className="ent-h2">A custom intelligence layer,<br /><em>implemented for your firm.</em></h2>
            <p className="ent-lead">No self serve tiers. Every enterprise build is scoped to how your organization actually works.</p>
          </div>
          <blockquote className="ent-quote">
            We implement a custom version of the Align intelligence layer for your firm. Custom dashboards,
            custom functionality, connected to your data sources, integrated with the systems you already use,
            so Align can optimize how your people work and live.
          </blockquote>
          <div className="ent-tiers">
            <article className="ent-tier">
              <div className="ent-tier-tag">Tier one</div>
              <h3>Implementation</h3>
              <p>A custom Align build for your organization. Dashboards, workflows and integrations scoped to your systems and how your team actually operates.</p>
              <ul>
                <li>Custom agentic workflows built around how your team operates</li>
                <li>Deeper integration into internal data sources and existing systems</li>
                <li>Executive advisory with Samuel through implementation, as an add on rather than bundled</li>
                <li>SSO, SAML and directory integration, plus DPAs and support through your security review</li>
              </ul>
              <Link href="/contact" className="lp-btn ghost small">Talk to us</Link>
            </article>
            <article className="ent-tier sov">
              <div className="ent-tier-tag">Tier two · Premium</div>
              <h3>Sovereign</h3>
              <p>Fully private, encrypted deployment for firms with hard residency, regulatory, or IP sensitivity requirements. No third party inference provider in the path.</p>
              <ul>
                <li>US based hosting and data residency, guaranteed on this lane</li>
                <li>Encrypted system, context and prompts, with isolated tenancy</li>
                <li>Sensitive IP never leaves your boundary</li>
                <li>Deployed inside your compliance boundary, so our certification status is not the blocker</li>
              </ul>
              <Link href="/contact" className="lp-btn ghost small">Talk to us</Link>
            </article>
          </div>
          <p className="ent-note">Every engagement is scoped and quoted directly. There is no published rate card.</p>
        </div>
      </section>

      {/* PILOT */}
      <section className="ent-section alt">
        <div className="wrap">
          <div className="ent-head">
            <div className="ent-kicker">Start here</div>
            <h2 className="ent-h2">Start with a pilot.<br /><em>Not a commitment.</em></h2>
            <p className="ent-lead">
              Five things we ask of every enterprise pilot partner. That is it. No twelve month contract before
              you have seen what alignment intelligence does to your team.
            </p>
          </div>
          <ol className="ent-pilot">
            {PILOT.map((p, i) => (
              <li key={p}><span>{String(i + 1).padStart(2, '0')}</span>{p}</li>
            ))}
          </ol>
          <p className="ent-note">Scope and terms are set on the call. No cost commitment before that.</p>
        </div>
      </section>

      {/* SECURITY */}
      <section className="ent-security">
        <div className="wrap">
          <div className="ent-kicker gold">Security and privacy</div>
          <h2 className="ent-h2 light">Built so your firm&apos;s <em>thinking</em> stays yours.</h2>
          <div className="ent-sec-grid">
            <div>
              <h3>Models and inference</h3>
              <ul>
                <li>Chat, profiles and reports run on open weights models, not the frontier models from OpenAI or Anthropic</li>
                <li>Images run on an open weights vision model, so nothing in the chat path reaches a frontier lab</li>
                <li>Documents are read on our side rather than handed to an outside model</li>
              </ul>
            </div>
            <div>
              <h3>On certification, the straight answer</h3>
              <p>
                On the sovereign lane, we deploy into infrastructure we do not manage, so your data stays
                inside your own compliance boundary rather than depending on our certification status. We are
                not SOC 2, HIPAA, or ISO 27001 certified today. Third party audits cost real money and we will
                invest in them when revenue supports it, in the meantime the architecture is the answer, not a
                promise to get certified later.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL */}
      <section className="ent-final">
        <div className="wrap">
          <h2 className="ent-h2">Start with the door that&apos;s costing you most.</h2>
          <p className="ent-sub">Tell us what is breaking and we will scope the pilot around it.</p>
          <div className="ent-cta">
            <Link href="/contact" className="lp-btn primary">Request a pilot <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </section>

      <footer className="lp-foot">
        <div className="wrap">
          <AlignMark white />
          <span className="lp-foot-word">ALIGN</span>
          <Link href="/#privacy" className="lp-foot-link">Privacy &amp; Security</Link>
          <Link href="/contact" className="lp-foot-link">Contact</Link>
          <span className="lp-foot-copy">© 2026 ALIGN. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
