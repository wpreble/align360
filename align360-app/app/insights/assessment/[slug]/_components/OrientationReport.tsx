'use client';

import type { OrientationScores } from '@/lib/report-scoring';
import type { OrientationNarrative } from '@/lib/report';
import { reportEyebrow } from '@/lib/report';
import { PSRTrio, useMounted } from './report-bits';

const fiColor = (i: number, dim: boolean) =>
  dim ? 'rgba(120,120,120,.35)' : i === 0 ? 'var(--accent)' : i === 1 ? 'var(--blue-bright)' : 'rgba(var(--accent-rgb),.4)';

export default function OrientationReport({ scores, narrative }: { scores: OrientationScores; narrative: OrientationNarrative }) {
  const mounted = useMounted();
  const n = narrative;
  const top = scores.orientations.slice(0, 2);

  return (
    <>
      {/* HERO */}
      <section className="hero">
        <div className="hero-bg" />
        <div className="waves"><span className="wave" /><span className="wave" /><span className="wave" /><span className="wave" /></div>
        <div className="hero-inner">
          <div className="hero-eyebrow">{reportEyebrow(scores)}</div>
          <h1 className="hero-title">{n.hero.prefix} <em>{n.hero.em}</em><span className="line2">{n.hero.line2}</span></h1>
          <div className="hero-rule" />
          <p className="hero-descriptor">{n.hero.descriptor}</p>
          <div className="hero-duo">
            <div className="hd"><div className="hd-val">{scores.primaryPct}%</div><div className="hd-name">{scores.primary}</div><div className="hd-q">{n.hero.primaryQuestion}</div></div>
            <div className="hd alt"><div className="hd-val">{scores.secondaryPct}%</div><div className="hd-name">{scores.secondary}</div><div className="hd-q">{n.hero.secondaryQuestion}</div></div>
          </div>
        </div>
        <div className="scroll-cue"><span className="scroll-cue-text">Descend</span><span className="scroll-cue-line" /></div>
      </section>

      {/* I · DUAL / PRIMARY */}
      <section className="chapter reveal">
        <div className="chapter-kicker">I · {scores.blended ? 'Dual Primary' : 'Primary Orientation'}</div>
        <h2 className="chapter-title">How you naturally see the world</h2>
        <p className="chapter-sub">Orientation is the lens through which you interpret situations, prioritize what matters, and decide what to do.{scores.blended ? ' Yours is genuinely blended: two in near-equal tension, which is itself a signature.' : ''}</p>
        <div className="dual">
          <div className="oc">
            <div className="oc-rank">Orientation A · {scores.blended ? 'Blended Primary' : 'Primary'}</div>
            <div className="oc-name">{scores.primary}</div>
            <div className="oc-q">{n.hero.primaryQuestion}</div>
            <div className="oc-pct">{scores.primaryPct}%</div>
            <div className="oc-bar"><div className="oc-fill" style={{ width: mounted ? `${Math.min(100, scores.primaryPct * 2)}%` : '0%' }} /></div>
          </div>
          <div className="oc alt">
            <div className="oc-rank">Orientation B · {scores.blended ? 'Blended Primary' : 'Secondary'}</div>
            <div className="oc-name">{scores.secondary}</div>
            <div className="oc-q">{n.hero.secondaryQuestion}</div>
            <div className="oc-pct">{scores.secondaryPct}%</div>
            <div className="oc-bar"><div className="oc-fill" style={{ width: mounted ? `${Math.min(100, scores.secondaryPct * 2)}%` : '0%' }} /></div>
          </div>
        </div>
        <div className="blend-hero">
          <span className="bh-badge">Combination Expression</span>
          <div className="bh-name">{n.blend.name}</div>
          <div className="bh-desc">{n.blend.body}</div>
        </div>
      </section>

      <div className="ornament">· · ·</div>

      {/* II · ALL FIVE ORIENTATIONS */}
      <section className="chapter reveal">
        <div className="chapter-kicker">II · All Five Orientations</div>
        <div className="five">
          <div className="five-title">How all five orientations scored</div>
          <div className="five-sub">Across twelve behavioral scenarios</div>
          {scores.orientations.map((o, i) => (
            <div className="fi-row" key={o.tag}>
              <span className={`fi-name${i < 2 ? ' active' : ''}`}>{o.tag}</span>
              <div className="fi-track"><div className="fi-fill" style={{ width: mounted ? `${Math.min(100, o.pct * 2)}%` : '0%', background: fiColor(i, o.dim) }} /></div>
              <span className={`fi-pct${o.dim ? ' dim' : ''}`}>{o.pct}%</span>
            </div>
          ))}
        </div>
      </section>

      <div className="ornament">· · ·</div>

      {/* III · HOW IT SHOWS UP */}
      <section className="chapter reveal">
        <div className="chapter-kicker">III · How This Orientation Shows Up</div>
        <div className="see6">
          {n.shows.map((s) => (
            <div className="see-card" key={s.area}>
              <div className="see-ico">{s.area}</div>
              <div className="see-title">{s.title}</div>
              <div className="see-body">{s.body}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="ornament">· · ·</div>

      {/* IV · RISK & FAITH */}
      <section className="chapter reveal">
        <div className="chapter-kicker">IV · Risk &amp; Faith Posture</div>
        <div className="risk-section">
          <div className="rs-title">Where you sit on the certainty-to-action spectrum</div>
          <div className="rs-track">
            <div className="rs-gradient" />
            <div className="rs-marker" style={{ left: `${n.risk.position}%` }} />
          </div>
          <div className="rs-labels"><span>Protect stability first</span><span>Balanced wisdom</span><span>Move before clarity</span></div>
          <div className="rs-grid">
            <div className="rs-cell"><div className="rs-cell-lbl">Under pressure</div><div className="rs-cell-val">{n.risk.pressure}</div></div>
            <div className="rs-cell"><div className="rs-cell-lbl">Under uncertainty</div><div className="rs-cell-val">{n.risk.uncertainty}</div></div>
            <div className="rs-cell"><div className="rs-cell-lbl">Faith posture</div><div className="rs-cell-val">{n.risk.faith}</div></div>
          </div>
        </div>
      </section>

      {/* V · BEHAVIORAL INTELLIGENCE */}
      <section className="chapter reveal">
        <div className="chapter-kicker">V · Behavioral Intelligence</div>
        <PSRTrio psr={n.psr} />
      </section>

      <div className="ornament">· · ·</div>

      {/* VI · CROSS-SIGNAL */}
      <section className="chapter reveal">
        <div className="chapter-kicker">VI · Cross-Signal</div>
        <div className="matrix">
          <div className="mx-label">{scores.primary} orientation in context</div>
          <div className="mx-title">{scores.blended ? `${scores.primary} + ${scores.secondary} orientation` : `${scores.primary} orientation`}</div>
          <div className="mx-grid">
            {n.matrix.map((m) => (
              <div className="mx-cell" key={m.label}>
                <div className="mx-cell-lbl">{m.label}</div>
                <div className="mx-cell-val">{m.value}</div>
                <div className="mx-cell-desc">{m.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
