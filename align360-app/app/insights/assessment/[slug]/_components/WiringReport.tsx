'use client';

import type { WiringScores } from '@/lib/report-scoring';
import type { WiringNarrative } from '@/lib/report';
import { reportEyebrow } from '@/lib/report';
import { ROMANS, PSRTrio, useMounted } from './report-bits';

// Per-rank colors for the nine-gift heatmap (leader = accent gold, then jewel tones).
const GIFT_COLORS = ['var(--accent)', 'var(--crimson-mid)', 'var(--teal-bright)', 'var(--plum-bright)', 'var(--amber-bright)'];
const giftColor = (i: number, dim: boolean) => (dim ? 'rgba(120,120,120,.4)' : GIFT_COLORS[i] || 'rgba(140,140,140,.5)');

export default function WiringReport({ scores, narrative }: { scores: WiringScores; narrative: WiringNarrative }) {
  const mounted = useMounted();
  const n = narrative;

  return (
    <>
      {/* HERO */}
      <section className="hero">
        <div className="hero-bg" />
        <div className="rings"><span className="ring" /><span className="ring" /><span className="ring" /><span className="ring" /></div>
        <div className="hero-inner">
          <div className="hero-eyebrow">{reportEyebrow(scores)}</div>
          <h1 className="hero-title">{n.hero.prefix} <em>{n.hero.em}</em><span className="line2">{n.hero.line2}</span></h1>
          <div className="hero-rule" />
          <p className="hero-descriptor">{n.hero.descriptor}</p>
          <div className="hero-stats">
            <div className="hstat"><span className="hstat-val">{scores.primaryPct}%</span><span className="hstat-label">{scores.primary} · Primary</span></div>
            <div className="hstat"><span className="hstat-val">{scores.secondaryPct}%</span><span className="hstat-label">{scores.secondary} · Supporting</span></div>
            <div className="hstat"><span className="hstat-val">{scores.confidence.split(' ')[0]}</span><span className="hstat-label">Confidence band</span></div>
          </div>
        </div>
        <div className="scroll-cue"><span className="scroll-cue-text">Descend</span><span className="scroll-cue-line" /></div>
      </section>

      {/* I · PRIMARY GIFT */}
      <section className="chapter reveal">
        <div className="chapter-kicker">I · Primary Gift</div>
        <h2 className="chapter-title">How you are built to create value</h2>
        <p className="chapter-sub">These are not personality labels. They are patterns of contribution: how you naturally create impact when you are at your best.</p>

        <div className="primary-card">
          <div className="pc-rank">Primary Wiring Gift · {scores.confidence}</div>
          <div className="pc-name">The {scores.primary}</div>
          <div className="pc-sub">{n.primary.facets}</div>
          <div className="pc-score-row">
            <div className="pc-big">{scores.primaryPct}<sup>%</sup></div>
            <div className="pc-bars">
              <div className="pc-bar-label">{scores.primary} pattern strength</div>
              <div className="pc-bar-track"><div className="pc-bar-fill primary" style={{ width: mounted ? `${scores.primaryPct}%` : '0%' }} /></div>
              <div className="pc-bar-label">{scores.secondary} supporting strength</div>
              <div className="pc-bar-track"><div className="pc-bar-fill support" style={{ width: mounted ? `${scores.secondaryPct}%` : '0%' }} /></div>
            </div>
          </div>
          <div className="pc-desc">{n.primary.body}</div>
        </div>

        <div className="support-card">
          <div>
            <div className="sc-rank">Supporting Gift · The {scores.secondary}</div>
            <div className="sc-name">{n.supporting.tagline}</div>
            <div className="sc-desc">{n.supporting.body}</div>
          </div>
          <div className="sc-pct">{scores.secondaryPct}%</div>
        </div>

        <div className="blend">
          <span className="blend-badge">Blended Expression</span>
          <div className="blend-name">{n.blend.name}</div>
          <div className="blend-desc">{n.blend.body}</div>
        </div>
      </section>

      <div className="ornament">· · ·</div>

      {/* II · ALL NINE GIFTS */}
      <section className="chapter reveal">
        <div className="chapter-kicker">II · All Nine Gifts</div>
        <div className="heatmap">
          <div className="hm-title">Gift pattern: where your energy concentrates</div>
          <div className="hm-sub">All nine wiring gifts scored across fifteen behavioral scenarios</div>
          <div className="hm-rows">
            {scores.gifts.map((g, i) => {
              const c = giftColor(i, g.dim);
              return (
                <div className="hm-row" key={g.tag}>
                  <span className="hm-rank">{ROMANS[i]}</span>
                  <span className={`hm-name${g.dim ? ' dim' : ''}`}>The {g.tag}</span>
                  <div className="hm-track">
                    <div className="hm-glow" style={{ width: mounted ? `${g.pct}%` : '0%', background: c, boxShadow: g.dim ? 'none' : `0 0 8px ${c}` }}>
                      <span className="hm-dot" style={{ background: c }} />
                    </div>
                  </div>
                  <span className={`hm-pct${g.dim ? ' dim' : ''}`}>{g.pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="ornament">· · ·</div>

      {/* III · LIFE CONTEXTS */}
      <section className="chapter reveal">
        <div className="chapter-kicker">III · Life Contexts</div>
        <h2 className="chapter-title">What this looks like in the real world</h2>
        <p className="chapter-sub">Your wiring does not stay at work. It shapes how you show up in every context where you operate.</p>
        <div className="ctx-grid">
          {n.contexts.map((c) => (
            <div className="ctx" key={c.area}>
              <div className="ctx-ico">{c.area}</div>
              <div className="ctx-title">{c.title}</div>
              <div className="ctx-body">{c.body}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="ornament">· · ·</div>

      {/* IV · BEHAVIORAL INTELLIGENCE */}
      <section className="chapter reveal">
        <div className="chapter-kicker">IV · Behavioral Intelligence</div>
        <h2 className="chapter-title">How your wiring behaves when it is hard</h2>
        <PSRTrio psr={n.psr} />
        <div className="energy-grid">
          <div className="energy thrives">
            <div className="energy-title">Where you thrive</div>
            <div>{n.energy.thrives.map((t, i) => <span className="etag" key={`${t}-${i}`}>{t}</span>)}</div>
          </div>
          <div className="energy drains">
            <div className="energy-title">What drains you</div>
            <div>{n.energy.drains.map((t, i) => <span className="etag" key={`${t}-${i}`}>{t}</span>)}</div>
          </div>
        </div>
        <div className="watchouts">
          <div className="wo-h">Growth edges: what your wiring costs you when overused</div>
          {n.watchouts.map((w, i) => (
            <div className="wo-item" key={i}>
              <div className="wo-num">{String(i + 1).padStart(2, '0')}</div>
              <div className="wo-content"><strong>{w.title}</strong><p>{w.body}</p></div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
