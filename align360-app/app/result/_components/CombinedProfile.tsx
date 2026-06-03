import type { Profile } from '@/lib/profile';
import type { Scores } from '@/lib/scoring';
import AlignMark from '@/app/_components/AlignMark';

function H({ html, className }: { html: string; className?: string }) {
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

const GIFT_COLOR = ['var(--gold)', 'var(--crimson)', 'var(--teal)', 'var(--plum)', 'var(--amber)'];

export default function CombinedProfile({ profile: p, scores }: { profile: Profile; scores: Scores }) {
  const year = new Date().getFullYear();
  return (
    <div className="profile-doc">
      {/* HERO */}
      <div className="hero">
        <div className="hero-bg" />
        <div className="hero-inner">
          <AlignMark white className="profile-hero-mark" />
          <div className="hero-eye">{p.hero.eyebrow}</div>
          <h1 className="hero-title">
            <H html={p.hero.title} />
            <span className="sub">{p.hero.subtitle}</span>
          </h1>
          <div className="gold-rule" />
          <p className="hero-desc">{p.hero.description}</p>
          <div className="hero-pills">
            {p.hero.pills.map((pill, i) => (
              <span className="pill" key={i}>
                {pill.label} · {pill.value}
              </span>
            ))}
          </div>
          <div className="hero-latin">{p.hero.latin}</div>
        </div>
      </div>

      <div className="page">
        {/* I · THREE SIGNALS */}
        <div className="chapter">
          <div className="ck">I · The Three Signals</div>
          <h2 className="ct">How the picture was formed</h2>
          <p className="cs">{p.signals.intro}</p>
          <div className="signal-trio">
            {p.signals.items.map((s, i) => (
              <div className="sig" key={i}>
                <div className="sig-n">{s.n}</div>
                <div className="sig-cat">{s.category}</div>
                <div className="sig-name">{s.name}</div>
                <div className="sig-pct">
                  {s.pct}
                  <sup>%</sup>
                </div>
                <div className="sig-desc">{s.desc}</div>
              </div>
            ))}
          </div>
          <div className="edge">
            <div className="edge-label">{p.signals.edge.label}</div>
            <div className="gold-rule" />
            <div className="edge-title">
              <H html={p.signals.edge.title} />
            </div>
            <div className="gold-rule" />
            <p className="edge-body">{p.signals.edge.body}</p>
          </div>
        </div>

        <div className="ornament">· · ·</div>

        {/* II · WIRING — ALL NINE */}
        <div className="chapter">
          <div className="ck">II · Wiring Profile — All Nine Gifts</div>
          <h2 className="ct">Where your contribution concentrates</h2>
          <div className="gifts">
            {scores.wiring.allNine.map((gtally, i) => (
              <div className="gift-row" key={gtally.tag}>
                <span className="gift-name">{gtally.tag}</span>
                <span className="gift-track">
                  <span
                    className="gift-fill"
                    style={{ width: `${gtally.pct}%`, background: i < 5 ? undefined : 'rgba(120,120,120,.3)' }}
                  />
                </span>
                <span className="gift-pct" style={{ color: i < 5 ? GIFT_COLOR[i] : 'var(--silverd)' }}>
                  {gtally.pct}%
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="ornament">· · ·</div>

        {/* III · PSR */}
        <div className="chapter">
          <div className="ck">III · Behavioral Intelligence</div>
          <h2 className="ct">How you operate when it&apos;s hard</h2>
          <div className="psr-trio">
            {p.psr.map((x, i) => (
              <div className={`psr ${x.kind}`} key={i}>
                <div className="psr-l">{x.label}</div>
                <div className="psr-h">{x.heading}</div>
                <div className="psr-b">{x.body}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="ornament">· · ·</div>

        {/* IV · CURRENCY */}
        <div className="chapter">
          <div className="ck">IV · True Riches Currency Map</div>
          <h2 className="ct">How opportunity flows to you</h2>
          <div className="currency">
            <div className="cur-title">{p.currency.title}</div>
            <div className="cur-sub">{p.currency.sub}</div>
            <div className="cur-rows">
              {p.currency.rows.map((r, i) => (
                <div className="cr" key={i}>
                  <span className="cr-name">{r.name}</span>
                  <span className="cr-track">
                    <span className="cr-fill" style={{ width: `${r.pct}%` }} />
                  </span>
                  <span className="cr-pct">{r.pct}%</span>
                  <span className="cr-ctx">{r.ctx}</span>
                </div>
              ))}
            </div>
            <div className="cur-note">{p.currency.note}</div>
          </div>
        </div>

        <div className="ornament">· · ·</div>

        {/* V · OPPORTUNITY — LEGACY + AI */}
        <div className="chapter">
          <div className="ck">V · Opportunity Signals — Two Calibrations</div>
          <h2 className="ct">The market has changed. Your signals should too.</h2>
          <p className="cs">{p.opportunity.intro}</p>

          <div className="legacy-header">
            <div className="lh-badge">2022 Job Market</div>
            <div className="lh-text">{p.opportunity.legacy.note}</div>
          </div>
          <div className="opp-legacy">
            {p.opportunity.legacy.items.map((o, i) => (
              <div className="opp" key={i}>
                <div className="opp-s">
                  <div className="opp-sv">{o.score}</div>
                  <div className="opp-sl">Alignment</div>
                </div>
                <div className="opp-b">
                  <div className="opp-t">{o.title}</div>
                  <div className="opp-tag">{o.tag}</div>
                  <div className="job-chips">
                    {o.chips.map((c, j) => (
                      <span className="jc pivot" key={j}>
                        {c}
                      </span>
                    ))}
                  </div>
                  <div className="opp-risk">{o.risk}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="ai-header">
            <div className="ai-badge">AI-Era Calibration</div>
            <div>
              <div className="ai-header-title">{p.opportunity.ai.title}</div>
              <div className="ai-header-text">{p.opportunity.ai.note}</div>
            </div>
          </div>
          <div className="opp-ai">
            {p.opportunity.ai.items.map((o, i) => (
              <div className="opp" key={i}>
                <div className="opp-s">
                  <div className="opp-sv">{o.score}</div>
                  <div className="opp-sl">AI-era</div>
                </div>
                <div className="opp-b">
                  <div className="opp-t">{o.title}</div>
                  <div className="job-chips">
                    {o.chips.map((c, j) => (
                      <span className="jc" key={j}>
                        {c}
                      </span>
                    ))}
                  </div>
                  <div className="opp-why">{o.why}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="ornament">· · ·</div>

        {/* VI · AI-ERA INTELLIGENCE */}
        <div className="chapter">
          <div className="ck">VI · AI-Era Intelligence — What This Means for You</div>
          <h2 className="ct">The reframe, the pivot, the work ahead</h2>
          <div className="ai-reframe">
            <div className="air-label">{p.aiEra.reframeLabel}</div>
            <div className="air-title">
              <H html={p.aiEra.reframeTitle} />
            </div>
            <p className="air-body">
              <H html={p.aiEra.reframeBody} />
            </p>
            <div className="ai-cards">
              {p.aiEra.cards.map((c, i) => (
                <div className={`ai-card ${c.status}`} key={i}>
                  <div className="ac-status">{c.statusLabel}</div>
                  <div className="ac-title">{c.title}</div>
                  <div className="ac-body">{c.body}</div>
                  {c.chips?.length > 0 && (
                    <div className="job-chips" style={{ marginTop: '.875rem' }}>
                      {c.chips.map((ch, j) => (
                        <span className="jc pivot" key={j}>
                          {ch}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="ai-moves">
            {p.aiEra.moves.map((m, i) => (
              <div className="ai-move" key={i}>
                <div className="am-num">{m.num}</div>
                <div>
                  <div className="am-label">{m.label}</div>
                  <div className="am-title">{m.title}</div>
                  <div className="am-body">{m.body}</div>
                  {m.chips?.length > 0 && (
                    <div className="job-chips" style={{ marginTop: '1rem' }}>
                      {m.chips.map((ch, j) => (
                        <span className="jc" key={j}>
                          {ch}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="irreplaceable">
            <div className="irr-title">{p.aiEra.irreplaceable.title}</div>
            <div className="irr-grid">
              {p.aiEra.irreplaceable.cells.map((c, i) => (
                <div className="irr-cell" key={i}>
                  <div className="irr-cell-lbl">{c.lbl}</div>
                  <div className="irr-cell-cap">{c.cap}</div>
                  <div className="irr-cell-body">{c.body}</div>
                  <div className="irr-cell-ai">{c.aiNote}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="ornament">· · ·</div>

        {/* VII · LIFE POSITIONING */}
        <div className="chapter">
          <div className="ck">VII · Life Positioning Map</div>
          <h2 className="ct">The five layers — calibrated for where the world is going</h2>
          <div className="stack">
            {p.positioning.map((row, i) => (
              <div className="stack-item" key={i}>
                <div className="stack-n">{row.n}</div>
                <div>
                  <div className="stack-label">{row.label}</div>
                  <div className="stack-val">{row.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CLOSING */}
      <div className="closing">
        <div className="gold-rule" />
        <div className="closing-name">{p.closing.name}</div>
        <div className="closing-title">{p.closing.title}</div>
        <div className="gold-rule" />
        <div className="closing-latin">{p.closing.latin}</div>
        <div className="closing-note">{p.closing.note}</div>
      </div>

      <div className="profile-ip">
        © {year} Align360. All rights reserved. Reproduction or use of these assessments without written
        permission is prohibited.
      </div>
    </div>
  );
}
