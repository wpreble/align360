'use client';

import type { ClarityScores } from '@/lib/clarity-scoring';
import type { ClarityNarrative } from '@/lib/clarity';

/** Color for a 0-10 sub-score. */
function subColor(p: number): string {
  if (p >= 10) return 'var(--green)';
  if (p >= 7) return 'var(--blue)';
  if (p >= 3) return 'var(--amber)';
  return 'var(--red)';
}
/** Color for a 0-100 score. */
function bigColor(s: number): string {
  if (s >= 81) return 'var(--green)';
  if (s >= 61) return 'var(--blue)';
  if (s >= 41) return 'var(--amber)';
  return 'var(--red)';
}
/** Short qualitative word for a 0-100 domain score. */
function scoreWord(s: number): string {
  if (s >= 85) return 'Maxed';
  if (s >= 70) return 'Strong';
  if (s >= 55) return 'Emerging';
  if (s >= 40) return 'Developing';
  return 'Focus';
}
/** The headline is rendered as HTML (for <em>). Strip every tag except <em>/</em>. */
function sanitizeEm(s: string): string {
  return (s || '').replace(/<(?!\/?em>)[^>]*>/gi, '');
}

export default function ClarityReport({ scores, narrative }: { scores: ClarityScores; narrative: ClarityNarrative }) {
  const domainBlurb = (name: string) => narrative.domains.find((d) => d.name === name)?.body || '';
  const subBody = (label: string) => narrative.subs.find((s) => s.label === label)?.body || '';

  return (
    <div className="clr-root">
      {/* Hero */}
      <div className="clr-hero">
        <div className="clr-hero-eye">{scores.scoreName} · {scores.title}</div>
        <div className="clr-score">{scores.overall}<span className="clr-score-denom">/100</span></div>
        <div className="clr-score-lbl">{scores.scoreName}</div>
        <div className="clr-level">{scores.level.label}</div>
        <p className="clr-headline" dangerouslySetInnerHTML={{ __html: sanitizeEm(narrative.headline) }} />
        <div className="clr-mini-row">
          {scores.domains.map((d) => (
            <div className="clr-mini" key={d.name}>
              <div className="clr-mini-val">{d.score}</div>
              <div className="clr-mini-lbl">{d.name}</div>
            </div>
          ))}
          {scores.aiEra && (
            <div className="clr-mini">
              <div className="clr-mini-val">{scores.aiEra.score}</div>
              <div className="clr-mini-lbl">AI-Era</div>
            </div>
          )}
        </div>
      </div>

      <div className="clr-page">
        {scores.answered < scores.total && (
          <div className="clr-partial">
            This result reflects {scores.answered} of {scores.total} answers. Unanswered questions are scored as 0.
          </div>
        )}

        {/* Summary + progression */}
        <div className="clr-sec">
          <div className="clr-sec-lbl">Where you are</div>
          <h2 className="clr-sec-title">Your position in the progression</h2>
          <p className="clr-summary">{narrative.summary}</p>
          <div className="clr-ladder">
            {scores.ladder.map((b, i) => {
              const cls = i < scores.level.index ? 'past' : i === scores.level.index ? 'now' : 'future';
              return (
                <span key={b.key} style={{ display: 'contents' }}>
                  <span className={`clr-step ${cls}`}>{b.label}</span>
                  {i < scores.ladder.length - 1 && <span className="clr-arrow">→</span>}
                </span>
              );
            })}
          </div>
        </div>

        {/* Domains */}
        <div className="clr-sec">
          <div className="clr-sec-lbl">{scores.domains.length} domains · complete picture</div>
          <h2 className="clr-sec-title">Your readiness by domain</h2>
          <div className="clr-dom-grid">
            {scores.domains.map((d) => {
              const c = bigColor(d.score);
              return (
                <div className="clr-dc" key={d.name} style={{ ['--accent' as string]: c }}>
                  <div className="clr-dc-name">{d.name}</div>
                  <div className="clr-bar-wrap"><div className="clr-bar" style={{ width: `${d.score}%`, background: c }} /></div>
                  <div className="clr-dc-row">
                    <span className="clr-dc-score">{d.score}<small>/100</small></span>
                    <span className="clr-dc-level" style={{ color: c }}>{scoreWord(d.score)}</span>
                  </div>
                  <div className="clr-subs">
                    {d.subs.map((s) => {
                      const sc = subColor(s.points);
                      return (
                        <div className="clr-sub" key={s.label}>
                          <span className="clr-sub-name">{s.label}</span>
                          <span className="clr-sub-bar"><span className="clr-sub-fill" style={{ width: `${s.points * 10}%`, background: sc }} /></span>
                          <span className="clr-sub-val" style={{ color: sc }}>{s.points}</span>
                        </div>
                      );
                    })}
                  </div>
                  {domainBlurb(d.name) && <div className="clr-dc-blurb">{domainBlurb(d.name)}</div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Granular signals */}
        <div className="clr-sec">
          <div className="clr-sec-lbl">{scores.subs.length} signals · granular view</div>
          <h2 className="clr-sec-title">What each signal revealed</h2>
          {scores.subs.map((s) => {
            const sc = subColor(s.points);
            return (
              <div className="clr-sig" key={`${s.domain}-${s.label}`}>
                <div className="clr-sig-head">
                  <div>
                    <div className="clr-sig-domain">{s.domain}</div>
                    <div className="clr-sig-name">{s.label}</div>
                  </div>
                  <div className="clr-sig-badge" style={{ color: sc }}>{s.points}<span style={{ fontSize: '0.5em', color: 'var(--muted)' }}>/10</span></div>
                </div>
                <div className="clr-sig-bar"><div className="clr-sig-fill" style={{ width: `${s.points * 10}%`, background: sc }} /></div>
                {subBody(s.label) && <div className="clr-sig-body">{subBody(s.label)}</div>}
              </div>
            );
          })}
        </div>

        {/* Primary gap */}
        {scores.primaryGap && narrative.primaryGap && (
          <div className="clr-sec">
            <div className="clr-sec-lbl">Primary gap · precise and actionable</div>
            <h2 className="clr-sec-title">The one pattern worth your full attention</h2>
            <div className="clr-gap">
              <div className="clr-gap-lbl">Primary gap · {scores.primaryGap.label} · {scores.primaryGap.domain} · {scores.primaryGap.points}/10</div>
              <div className="clr-gap-title">{narrative.primaryGap.title}</div>
              <div className="clr-gap-body">{narrative.primaryGap.body}</div>
              {narrative.primaryGap.tool && <div className="clr-gap-tool">Closes with: {narrative.primaryGap.tool}</div>}
            </div>
          </div>
        )}

        {/* Strengths */}
        {narrative.strengths.length > 0 && (
          <div className="clr-sec">
            <div className="clr-sec-lbl">Highest signals · operating at maximum</div>
            <h2 className="clr-sec-title">What is fully developed</h2>
            {narrative.strengths.map((s, i) => (
              <div className="clr-str" key={i}>
                <div className="clr-str-lbl">Strength</div>
                <div className="clr-str-title">{s.title}</div>
                <div className="clr-str-body">{s.body}</div>
              </div>
            ))}
          </div>
        )}

        {/* AI-era */}
        {scores.aiEra && narrative.aiEra && (
          <div className="clr-sec">
            <div className="clr-sec-lbl">AI-era readiness · separate signal</div>
            <h2 className="clr-sec-title">How you are positioned for the current era</h2>
            <div className="clr-ai">
              <div className="clr-ai-lbl">AI-Era Readiness</div>
              <div className="clr-ai-score">{scores.aiEra.score}<small>/100</small></div>
              <div className="clr-ai-title">{narrative.aiEra.title}</div>
              <div className="clr-ai-body">{narrative.aiEra.body}</div>
              <div className="clr-ai-subs">
                {scores.aiEra.subs.map((s) => (
                  <div className="clr-ai-sub" key={s.label}>
                    <div className="clr-ai-sub-val" style={{ color: subColor(s.points) }}>{s.points}</div>
                    <div className="clr-ai-sub-lbl">{s.label.replace(/^AI[\s-]*Era\s*/i, '')}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Diagnostic */}
        <div className="clr-sec">
          <div className="clr-sec-lbl">Severity · source · velocity</div>
          <h2 className="clr-sec-title">The full diagnostic picture</h2>
          {([['Severity', narrative.diagnostic.severity], ['Source', narrative.diagnostic.source], ['Velocity', narrative.diagnostic.velocity]] as const).map(([k, v]) => (
            <div className="clr-diag-card" key={k}>
              <div className="clr-diag-lbl">{k}</div>
              <div className="clr-diag-title">{v.label}</div>
              <div className="clr-diag-body">{v.body}</div>
            </div>
          ))}
        </div>

        {/* Closing */}
        <div className="clr-cta">
          <div className="clr-cta-lbl">What comes next</div>
          <div className="clr-cta-title">{narrative.closing.title}</div>
          <div className="clr-cta-body">{narrative.closing.body}</div>
        </div>
      </div>

      <div className="clr-footer">Align360 · {scores.title} · {scores.scoreName}</div>
    </div>
  );
}
