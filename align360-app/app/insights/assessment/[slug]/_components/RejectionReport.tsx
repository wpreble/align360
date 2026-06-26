'use client';

import { useMemo } from 'react';
import type { RejectionScores } from '@/lib/report-scoring';
import type { RejectionNarrative } from '@/lib/report';
import { reportEyebrow, FLOW_LABELS } from '@/lib/report';
import { ROMANS, PSRTrio, useMounted } from './report-bits';

const catColor = (i: number, dim: boolean) =>
  dim ? 'rgba(120,120,120,.35)' : i === 0 ? 'var(--accent-bright)' : i === 1 ? 'var(--accent)' : 'rgba(var(--accent-rgb),.4)';

export default function RejectionReport({ scores, narrative }: { scores: RejectionScores; narrative: RejectionNarrative }) {
  const mounted = useMounted();
  const n = narrative;
  const leader = Math.max(1, scores.categories[0]?.pct || 1);

  // Deterministic-ish starfield (client-only; varies per mount, which is fine here).
  const stars = useMemo(
    () => Array.from({ length: 70 }, (_, i) => ({
      left: (i * 53) % 100,
      top: (i * 29) % 100,
      size: i % 11 === 0 ? 2.5 : 1,
      d: 2 + ((i * 7) % 5),
      delay: (i % 8) * 0.5,
    })),
    [],
  );

  // Radar pentagon from the five category scores (scaled to the leader).
  const R = 82, cx = 100, cy = 100;
  const verts = scores.categories.map((c, i) => {
    const ang = ((-90 + i * 72) * Math.PI) / 180;
    const r = R * Math.max(0.1, c.pct / leader);
    return {
      x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang),
      lx: cx + (R + 12) * Math.cos(ang), ly: cy + (R + 12) * Math.sin(ang),
      ax: cx + R * Math.cos(ang), ay: cy + R * Math.sin(ang),
      tag: c.tag,
    };
  });
  const poly = verts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return (
    <>
      {/* HERO */}
      <section className="hero">
        <div className="hero-bg" />
        <div className="stars">
          {stars.map((s, i) => (
            <span key={`${s.left}-${s.top}-${i}`} className="star" style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, ['--d' as string]: `${s.d}s`, ['--delay' as string]: `${s.delay}s` }} />
          ))}
        </div>
        <div className="hero-inner">
          <div className="hero-eyebrow">{reportEyebrow(scores)}</div>
          <h1 className="hero-title">{n.hero.prefix} <em>{n.hero.em}</em><span className="line2">{n.hero.line2}</span></h1>
          <div className="hero-rule" />
          <p className="hero-descriptor">{n.hero.descriptor}</p>
          <div className="hero-reveal">
            <div className="hr-item"><div className="hr-label">Primary Gift</div><div className="hr-val">{scores.primary}</div></div>
            <div className="hr-item"><div className="hr-label">Signature Trait</div><div className="hr-val">{scores.signatureTrait}</div></div>
            <div className="hr-item"><div className="hr-label">Story Archetype</div><div className="hr-val">{n.archetype.name}</div></div>
            <div className="hr-item"><div className="hr-label">Confidence</div><div className="hr-val">{scores.confidence}</div></div>
          </div>
        </div>
        <div className="scroll-cue"><span className="scroll-cue-text">Descend</span><span className="scroll-cue-line" /></div>
      </section>

      {/* I · GIFT CATEGORY SCORES */}
      <section className="chapter reveal">
        <div className="chapter-kicker">I · Gift Category Scores</div>
        <div className="radar-wrap">
          <svg viewBox="-34 -18 268 236" width="100%" style={{ maxWidth: 240, overflow: 'visible' }}>
            <defs><radialGradient id="repRg" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="rgba(var(--accent-rgb),.22)" /><stop offset="100%" stopColor="rgba(var(--accent-rgb),.02)" /></radialGradient></defs>
            <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(var(--accent-rgb),.08)" />
            <circle cx={cx} cy={cy} r={R * 0.66} fill="none" stroke="rgba(var(--accent-rgb),.07)" />
            <circle cx={cx} cy={cy} r={R * 0.33} fill="none" stroke="rgba(var(--accent-rgb),.05)" />
            {verts.map((p, i) => <line key={i} x1={cx} y1={cy} x2={p.ax.toFixed(1)} y2={p.ay.toFixed(1)} stroke="rgba(var(--accent-rgb),.06)" />)}
            <polygon points={poly} fill="url(#repRg)" stroke="var(--accent-bright)" strokeWidth="1.5" strokeLinejoin="round" />
            {verts.map((p, i) => <circle key={i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r={i === 0 ? 4.5 : 3} fill={i === 0 ? 'var(--accent-bright)' : 'var(--accent)'} />)}
            {verts.map((p, i) => (
              <text key={i} x={p.lx.toFixed(1)} y={p.ly.toFixed(1)} textAnchor="middle" dominantBaseline="middle" fontFamily="Cinzel,serif" fontSize="6.5" fill="var(--accent)" opacity="0.8">{p.tag}</text>
            ))}
          </svg>
          <div>
            <div className="rb-title">Gift category breakdown</div>
            <div className="rb-sub">How your rejection experiences map to the five gift categories</div>
            {scores.categories.map((c, i) => (
              <div className="rb-row" key={c.tag}>
                <span className={`rb-name${i === 0 ? ' primary' : i === 1 ? ' secondary' : ''}`}>{c.tag}</span>
                <div className="rb-track"><div className="rb-fill" style={{ width: mounted ? `${Math.round((c.pct / leader) * 100)}%` : '0%', background: catColor(i, c.dim) }} /></div>
                <span className="rb-pct" style={{ color: catColor(i, c.dim) }}>{c.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* II · STORY ARCHETYPE */}
      <section className="chapter reveal">
        <div className="chapter-kicker">II · Story Archetype</div>
        <div className="archetype">
          <span className="arch-badge">Archetype Detected</span>
          <div className="arch-archetype">{n.archetype.name}</div>
          <div className="arch-title">{n.archetype.titlePrefix} <em>{n.archetype.titleEm}</em></div>
          <div className="arch-body">{n.archetype.body}</div>
          <div className="arch-quote">{n.archetype.quote}</div>
        </div>
        <div className="sig">
          <div className="sig-ico">{(scores.primary || 'P').charAt(0)}</div>
          <div>
            <div className="sig-rank">Signature Trait · Within the {scores.primary} Gift</div>
            <div className="sig-name">{n.signature.name}</div>
            <div className="sig-desc">{n.signature.body}</div>
          </div>
        </div>
      </section>

      <div className="ornament">· · ·</div>

      {/* III · PARALLELS */}
      <section className="chapter reveal">
        <div className="chapter-kicker">III · This Pattern Has Appeared Before</div>
        <h2 className="chapter-title">People who carried this gift</h2>
        <div className="parallels">
          {n.parallels.map((p, i) => (
            <div className="par" key={i}>
              <div className="par-name">{p.name}</div>
              <div className="par-rejected">{p.rejected}</div>
              <div className="par-gift">{p.gift}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="ornament">· · ·</div>

      {/* IV · FOUR-LAYER EMERGENCE */}
      <section className="chapter reveal">
        <div className="chapter-kicker">IV · The Four-Layer Emergence</div>
        <h2 className="chapter-title">How your gift emerged</h2>
        <div className="flow">
          {n.flow.map((f, i) => (
            <div className={`flow-item${i === n.flow.length - 1 ? ' last' : ''}`} key={i}>
              <div className="flow-left"><div className="flow-num">{ROMANS[i]}</div><div className="flow-line" /></div>
              <div className="flow-content">
                <div className="fc-label">{FLOW_LABELS[i]}</div>
                <div className="fc-title">{f.title}</div>
                <div className="fc-body">{f.body}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* V · BEHAVIORAL INTELLIGENCE */}
      <section className="chapter reveal">
        <div className="chapter-kicker">V · Behavioral Intelligence</div>
        <PSRTrio psr={n.psr} labels={['Under Pressure', 'Under Stress', 'Risk Posture']} />
        <div className="advantage" style={{ marginTop: '1.25rem' }}>
          <div className="adv-label">Your Competitive Advantage</div>
          <div className="adv-title">{n.advantage.title}</div>
          <div className="adv-body">{n.advantage.body}</div>
          <div className="adv-envs">{n.advantage.envs.map((e, i) => <span className="adv-env" key={`${e}-${i}`}>{e}</span>)}</div>
        </div>
      </section>
    </>
  );
}
