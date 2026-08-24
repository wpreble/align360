import './landing.css';
import Link from 'next/link';
import AlignMark from '@/app/_components/AlignMark';
import FounderAvatar from '@/app/_components/FounderAvatar';
import LandingMotion from '@/app/_components/LandingMotion';

export const metadata = {
  title: 'ALIGN · Put out the fires. Then become one.',
  description:
    'ALIGN is an AI system that knows how you are wired. It solves what is urgent, then builds the clarity to align your career, decisions, and life for the AI era.',
};

// Login is intentionally skipped for the alpha. Every CTA enters the app at
// /chat, which routes new users through onboarding ("discover your wiring").
const ENTER = '/chat';

export default function Landing() {
  return (
    <div className="lp">
      <LandingMotion />
      {/* NAV */}
      <header className="lp-nav">
        <div className="wrap">
          <Link href="/" className="lp-brand">
            <AlignMark />
            <span className="lp-word">Align</span>
          </Link>
          <div className="lp-nav-login" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Link href="/pricing" className="lp-btn ghost small">Pricing</Link>
            <Link href="/enterprise" className="lp-btn ghost small">Enterprise</Link>
            <Link href="/faq" className="lp-btn ghost small">FAQ</Link>
            <Link href={ENTER} className="lp-btn primary small">Log In</Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="lp-hero">
        <div className="lp-hero-bg" />
        <div className="lp-hero-grain" aria-hidden="true" />
        <div className="wrap">
          <div className="lp-hero-mark"><AlignMark /></div>
          <h1 className="lp-h1"><span className="lp-l1">Put out the fires.</span><br /><em className="lp-l2">Then become one.<span className="lp-ember" aria-hidden="true" /></em></h1>
          <p className="lp-sub">ALIGN solves what&apos;s urgent, then builds the clarity to ignite everything else.<br />A personal operating system that helps you live in alignment with who you are and what matters most.</p>
          <div className="lp-hero-cta">
            <Link href={ENTER} className="lp-btn primary lp-magnetic">Discover Your Wiring <span className="lp-arrow" aria-hidden="true">→</span><span className="lp-spk s1" aria-hidden="true" /><span className="lp-spk s2" aria-hidden="true" /></Link>
            <Link href="/enterprise" className="lp-btn ghost">For Organizations</Link>
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="lp-section dark">
        <div className="wrap">
          <div className="lp-sec-head lp-reveal">
            <div className="lp-rule" />
            <h2 className="lp-h2"><em>You</em>&apos;re navigating life without a system that knows you.</h2>
            <p className="lp-lead">Life doesn&apos;t come with a roadmap. You&apos;re expected to make decisions about your career, finances, relationships, and future with generic advice that was never built for you.</p>
          </div>
          <div className="lp-domains lp-reveal">
            <span className="lp-domain">Education</span>
            <span className="lp-domain">Career</span>
            <span className="lp-domain">AI Disruption</span>
            <span className="lp-domain">Money</span>
            <span className="lp-domain">Relationships</span>
          </div>
        </div>
      </section>

      {/* TWO PILLARS */}
      <section className="lp-section">
        <div className="wrap">
          <div className="lp-sec-head lp-reveal">
            <h2 className="lp-h2">Two questions everything else is built on:</h2>
            <p className="lp-lead">Optimize these first. Then your finances, relationships, health, and legacy have a clear direction.</p>
          </div>
          <div className="lp-pillars lp-reveal">
            <div className="lp-pillar">
              <div className="lp-pillar-n">01</div>
              <h3>Who are you?</h3>
              <p>With ALIGN discover your wiring, your gifts, the way you read situations and recover from setbacks. Not a label, but a clear picture of who you are that becomes more refined over time.</p>
            </div>
            <div className="lp-pillar">
              <div className="lp-pillar-n">02</div>
              <h3>Where do you thrive?</h3>
              <p>Find the places where your strengths, passions, and purpose intersect—and where your best work happens.</p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="lp-section dark">
        <div className="wrap">
          <div className="lp-sec-head lp-reveal">
            <h2 className="lp-h2">Urgent matters <span className="lp-strong-em">first</span>. Then aligned for what&apos;s <span className="lp-strong-em">next</span>.</h2>
          </div>
          <div className="lp-steps lp-reveal">
            <div className="lp-step">
              <div className="lp-step-time">In Minutes</div>
              <h3>Solve what&apos;s urgent</h3>
              <p>Bring the fire you&apos;re fighting right now. Get a clear, grounded next step.</p>
            </div>
            <div className="lp-step">
              <div className="lp-step-time">In 30 Days</div>
              <h3>Discover your wiring</h3>
              <p>Uncover your strengths, motivations, and patterns that help you thrive.</p>
            </div>
            <div className="lp-step">
              <div className="lp-step-time">In 30 Days</div>
              <h3>Align for what&apos;s next</h3>
              <p>Build a life shaped by your purpose, ready for what&apos;s ahead.</p>
            </div>
          </div>
        </div>
      </section>

      {/* WHAT'S INCLUDED */}
      <section id="included" className="lp-section">
        <div className="wrap">
          <div className="lp-sec-head lp-reveal">
            <h2 className="lp-h2">One model that grows with you</h2>
            <p className="lp-lead">Your assessments lay the foundation, creating a working model of how you are wired to thrive. Everything after — every chat, every framework — draws on that model and helps it grow.</p>
          </div>
          <div className="lp-frames lp-reveal">
            <div className="lp-frame fw-design">
              <span className="lp-frame-tag">DesignSuite · Live</span>
              <h3>Understand how you&apos;re wired</h3>
              <p>Gain clarity on your identity, judgment, and resilience — so your decisions are built on giftings, not guesswork.</p>
              <ul>
                <li>Wiring for Impact</li>
                <li>Orientation for Impact</li>
                <li>Rejection Gift Finder</li>
                <li>Impact Readiness</li>
                <li>Value Spectrum</li>
              </ul>
            </div>
            <div className="lp-frame fw-career">
              <span className="lp-frame-tag">Career Navigator</span>
              <h3>Move forward without losing yourself</h3>
              <p>Turn clarity into action through better decisions, meaningful work, and a future aligned with who you are.</p>
              <ul>
                <li>Career Alignment Assessment</li>
                <li>Resume Builder and Analyzer</li>
                <li>Job Opportunity Finder</li>
                <li>Interview Preparation</li>
                <li>Salary Negotiation &amp; LinkedIn <span className="soon">+ more</span></li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* FOUNDER */}
      <section id="founder" className="lp-section dark">
        <div className="wrap">
          <div className="lp-founder lp-reveal">
            <div className="lp-founder-badge"><FounderAvatar /></div>
            <div>
              <div className="lp-founder-name">Samuel Ngu</div>
              <div className="lp-founder-role">Founder · ALIGN</div>
              <p>&ldquo;Smart, capable people were stalling, not because they lacked talent, but because their identity, decisions, and execution weren&apos;t aligned. ALIGN is the system I wish they&apos;d had.&rdquo;</p>
              <div className="lp-stats">
                <div className="lp-stat"><b>$200M+</b><span>Deals Executed</span></div>
                <div className="lp-stat"><b>Fortune 500</b><span>Operating Experience</span></div>
                <div className="lp-stat"><b>AI-Era Informed</b><span>Built For What&apos;s Next</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRIVACY & SECURITY
          Added 2026-08-21 (Samuel: "HTML needs a few edits (privacy, security, add CTAs)").
          Every claim here is deliberately one the codebase actually supports:
          chat/profiles/reports run on open-weights models, attached images use an
          open-weights vision model, and documents are extracted to text server-side
          (app/api/upload) so no file is handed to a frontier lab. What is NOT claimed,
          because it is not true today: certifications, data residency on the standard
          tier, and named hosting. Those belong to the sovereign conversation. */}
      <section id="privacy" className="lp-section">
        <div className="wrap">
          <div className="lp-sec-head lp-reveal">
            <div className="lp-rule" />
            <h2 className="lp-h2">Built so your <em>thinking</em> stays yours.</h2>
            <p className="lp-lead">The more honest you are with ALIGN, the more useful it gets. That only works if you trust where your words go.</p>
          </div>
          <div className="lp-pillars lp-reveal">
            <div className="lp-pillar">
              <div className="lp-pillar-n">01</div>
              <h3>Not sent to a frontier lab</h3>
              <p>ALIGN runs on open weights models, not the frontier models from OpenAI or Anthropic. Documents you upload are read on our side and never handed to an outside model.</p>
            </div>
            <div className="lp-pillar">
              <div className="lp-pillar-n">02</div>
              <h3>Never sold, never training data</h3>
              <p>Your answers are not sold and are not used to train our models or anyone else&apos;s. Encrypted in transit and at rest, and scoped so you reach your own data and nobody else&apos;s.</p>
            </div>
            <div className="lp-pillar">
              <div className="lp-pillar-n">03</div>
              <h3>Sovereign, for organizations</h3>
              <p>Firms that need more can run ALIGN as a fully private, encrypted, US based deployment, so sensitive work never leaves their boundary. Priced above a standard implementation.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA
          Two paths now. `/contact` already existed and posts to HubSpot with
          align360_source=enterprise_contact, but nothing on this page linked to it,
          so the only route in was the individual assessment funnel. That is Samuel's
          "get CTA from info they give us to follow up with them". */}
      <section className="lp-final">
        <div className="lp-final-bg" />
        <div className="wrap">
          <div className="lp-rule" />
          <h2 className="lp-h2">Become who you&apos;re wired to be.</h2>
          <p className="lp-sub">What begins with putting out today&apos;s fires becomes a life marked by confidence, purpose, and meaningful impact.</p>
          <div className="lp-hero-cta">
            <Link href={ENTER} className="lp-btn primary">Discover Your Wiring →</Link>
            <Link href="/contact" className="lp-btn ghost">Talk to us about your organization</Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="lp-foot">
        <div className="wrap">
          <AlignMark white />
          <span className="lp-foot-word">ALIGN</span>
          <Link href="/#privacy" className="lp-foot-link">Privacy &amp; Security</Link>
          <Link href="/enterprise" className="lp-foot-link">Enterprise</Link>
          <span className="lp-foot-copy">© 2026 ALIGN. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
