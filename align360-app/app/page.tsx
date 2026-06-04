import './landing.css';
import Link from 'next/link';
import AlignMark from '@/app/_components/AlignMark';
import FounderAvatar from '@/app/_components/FounderAvatar';

export const metadata = {
  title: 'Align360 · Put out the fires. Then become one.',
  description:
    'Align360 is an AI system that knows how you are wired. It solves what is urgent, then builds the clarity to align your career, decisions, and life for the AI era.',
};

// Login is intentionally skipped for the alpha. Every CTA enters the app at
// /chat, which routes new users through onboarding ("discover your wiring").
const ENTER = '/chat';

export default function Landing() {
  return (
    <div className="lp">
      {/* NAV */}
      <header className="lp-nav">
        <div className="wrap">
          <Link href="/" className="lp-brand">
            <AlignMark />
            <span className="lp-word">Align</span>
          </Link>
          <Link href={ENTER} className="lp-btn primary small lp-nav-login">Log In</Link>
        </div>
      </header>

      {/* HERO */}
      <section className="lp-hero">
        <div className="lp-hero-bg" />
        <div className="wrap">
          <div className="lp-hero-mark"><AlignMark /></div>
          <h1 className="lp-h1">Put out the fires.<br /><em>Then become one.</em></h1>
          <p className="lp-sub">Align360 solves what&apos;s urgent, then builds the clarity to ignite everything else. One system that actually knows how you&apos;re wired.</p>
          <div className="lp-hero-cta">
            <Link href={ENTER} className="lp-btn primary">Discover Your Wiring →</Link>
            <Link href={ENTER} className="lp-btn ghost">Log In</Link>
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="lp-section dark">
        <div className="wrap">
          <div className="lp-sec-head">
            <div className="lp-rule" />
            <h2 className="lp-h2">You&apos;re navigating life without a system that <em>knows you</em>.</h2>
            <p className="lp-lead">Education, career, money, relationships, and an AI shift rewriting all of it, while the only tools you have are generic. So you guess. Compare. Chase things that don&apos;t fit.</p>
          </div>
          <div className="lp-domains">
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
          <div className="lp-sec-head">
            <h2 className="lp-h2">Two questions everything else is built on</h2>
            <p className="lp-lead">Optimize these first. Then your finances, relationships, health, and legacy have something true to organize around.</p>
          </div>
          <div className="lp-pillars">
            <div className="lp-pillar">
              <div className="lp-pillar-n">01</div>
              <h3>Who you are</h3>
              <p>Your wiring, your gifts, the way you read situations and recover from setbacks. Not a label, but a working model that sharpens over time.</p>
            </div>
            <div className="lp-pillar">
              <div className="lp-pillar-n">02</div>
              <h3>What you do</h3>
              <p>How that identity converts into direction, decisions, and momentum: career moves, opportunities, and the work that compounds.</p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="lp-section dark">
        <div className="wrap">
          <div className="lp-sec-head">
            <h2 className="lp-h2">Urgent first. Then aligned for what&apos;s next.</h2>
          </div>
          <div className="lp-steps">
            <div className="lp-step">
              <div className="lp-step-time">Minutes</div>
              <div className="lp-step-n">I</div>
              <h3>Solve what&apos;s urgent</h3>
              <p>Bring the fire you&apos;re fighting right now. Get a clear, grounded next step before anything else.</p>
            </div>
            <div className="lp-step">
              <div className="lp-step-time">30 Days</div>
              <div className="lp-step-n">II</div>
              <h3>Discover your wiring</h3>
              <p>Assessments reveal how you create value, decide, and bounce back, and your AI starts knowing you from message one.</p>
            </div>
            <div className="lp-step">
              <div className="lp-step-time">90 Days</div>
              <div className="lp-step-n">III</div>
              <h3>Align for what&apos;s next</h3>
              <p>Turn that clarity into direction across career, money, and relationships, calibrated for where the world is actually going.</p>
            </div>
          </div>
        </div>
      </section>

      {/* WHAT'S INCLUDED */}
      <section id="included" className="lp-section">
        <div className="wrap">
          <div className="lp-sec-head">
            <h2 className="lp-h2">Frameworks that compound</h2>
            <p className="lp-lead">Every assessment you complete is remembered and fed into your AI, so the more you do, the sharper it gets.</p>
          </div>
          <div className="lp-frames">
            <div className="lp-frame">
              <span className="lp-frame-tag">DesignSuite · Live</span>
              <h3>Understand how you&apos;re wired</h3>
              <p>Identity, judgment, resilience, and decision clarity, before you build on guesses.</p>
              <ul>
                <li>Wiring for Impact</li>
                <li>Orientation for Impact</li>
                <li>Rejection Gift Finder</li>
                <li>Decision Simulation Lab <span className="soon">soon</span></li>
                <li>Impact Pathways &amp; Skill Builder <span className="soon">soon</span></li>
              </ul>
            </div>
            <div className="lp-frame">
              <span className="lp-frame-tag">Career Navigator</span>
              <h3>Move forward without losing yourself</h3>
              <p>Career clarity, acceleration, and confidence, without the burnout.</p>
              <ul>
                <li>Career Alignment Assessment</li>
                <li>Resume Analyzer + Builder</li>
                <li>Job Opportunity Finder</li>
                <li>Interview Preparation</li>
                <li>Salary Negotiation &amp; LinkedIn <span className="soon">+ more</span></li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* OUTCOMES */}
      <section className="lp-section dark">
        <div className="wrap">
          <div className="lp-sec-head">
            <h2 className="lp-h2">Clarity you can feel, on a real timeline</h2>
          </div>
          <div className="lp-outcomes">
            <div className="lp-outcome">
              <div className="lp-outcome-lbl">In 45 Minutes</div>
              <div className="lp-outcome-big">1</div>
              <p>Articulate exactly how you create value, in language you&apos;d actually use.</p>
            </div>
            <div className="lp-outcome">
              <div className="lp-outcome-lbl">In 30 Days</div>
              <div className="lp-outcome-big">50-70%</div>
              <p>Less major life and career indecision. Fewer loops, faster moves.</p>
            </div>
            <div className="lp-outcome">
              <div className="lp-outcome-lbl">In 90 Days</div>
              <div className="lp-outcome-big">∞</div>
              <p>A thriving life of peace and simplicity. Aligned, not just busy.</p>
            </div>
          </div>
        </div>
      </section>

      {/* DIFFERENTIATION */}
      <section className="lp-section">
        <div className="wrap">
          <div className="lp-sec-head">
            <h2 className="lp-h2">Not another personality test</h2>
          </div>
          <div className="lp-compare">
            <div className="lp-compare-row">
              <div className="lp-compare-cell them lp-compare-head them">Generic tests</div>
              <div className="lp-compare-cell us lp-compare-head us">Align360</div>
            </div>
            <div className="lp-compare-row">
              <div className="lp-compare-cell them">A static PDF you forget in a week</div>
              <div className="lp-compare-cell us">A system that evolves with you</div>
            </div>
            <div className="lp-compare-row">
              <div className="lp-compare-cell them">A four-letter label</div>
              <div className="lp-compare-cell us">An AI that remembers and adapts to you</div>
            </div>
            <div className="lp-compare-row">
              <div className="lp-compare-cell them">Built for a 2022 job market</div>
              <div className="lp-compare-cell us">Calibrated for the AI era</div>
            </div>
          </div>
        </div>
      </section>

      {/* FOUNDER */}
      <section id="founder" className="lp-section dark">
        <div className="wrap">
          <div className="lp-founder">
            <div className="lp-founder-badge"><FounderAvatar /></div>
            <div>
              <div className="lp-founder-name">Samuel Ngu</div>
              <div className="lp-founder-role">Founder · Align360</div>
              <p>&ldquo;Smart, capable people were stalling, not because they lacked talent, but because their identity, decisions, and execution weren&apos;t aligned. Align360 is the system I wish they&apos;d had.&rdquo;</p>
              <div className="lp-stats">
                <div className="lp-stat"><b>$200M+</b><span>Deals Executed</span></div>
                <div className="lp-stat"><b>Fortune 500</b><span>Operating Experience</span></div>
                <div className="lp-stat"><b>AI-Era</b><span>Built For What&apos;s Next</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="lp-final">
        <div className="lp-final-bg" />
        <div className="wrap">
          <div className="lp-rule" />
          <h2 className="lp-h2">Start with the fire.<br /><em>Leave with the clarity.</em></h2>
          <p className="lp-sub">Your first read takes minutes, and your AI remembers everything after.</p>
          <Link href={ENTER} className="lp-btn primary">Discover Your Wiring →</Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="lp-foot">
        <div className="wrap">
          <AlignMark white />
          <span className="lp-foot-word">Align360</span>
          <span className="lp-foot-copy">© 2026 Align360. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
