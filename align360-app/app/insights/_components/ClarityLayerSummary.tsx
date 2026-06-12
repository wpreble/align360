'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getClarityAnswers, getClarityReport, STORE_EVENT } from '@/lib/storage';

// The two Clarity Layer assessments. They append to the full profile as each is
// completed, so the identity document and the behavioral layer live together.
const CLARITY = [
  { slug: 'impact-readiness', name: 'Impact Readiness' },
  { slug: 'value-spectrum', name: 'Value Spectrum' },
];

type Row = {
  slug: string;
  name: string;
  hasReport: boolean;
  scoreName?: string;
  overall?: number;
  level?: string;
  domains?: { name: string; score: number }[];
};

/** 0-100 score → fig-palette accent. */
function scoreColor(s: number): string {
  if (s >= 81) return 'var(--green)';
  if (s >= 61) return 'var(--blue)';
  if (s >= 41) return 'var(--amber)';
  return 'var(--crimson)';
}

export default function ClarityLayerSummary() {
  const [rows, setRows] = useState<Row[]>([]);

  const refresh = useCallback(() => {
    const answers = getClarityAnswers();
    const out: Row[] = [];
    for (const c of CLARITY) {
      if (!answers[c.slug]) continue; // only completed assessments appear
      const rep = getClarityReport(c.slug);
      const sc = rep?.scores;
      out.push({
        slug: c.slug,
        name: c.name,
        hasReport: !!sc,
        scoreName: sc?.scoreName,
        overall: sc?.overall,
        level: sc?.level?.label,
        domains: Array.isArray(sc?.domains) ? sc.domains.map((d: { name: string; score: number }) => ({ name: d.name, score: d.score })) : undefined,
      });
    }
    setRows(out);
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(STORE_EVENT, refresh);
    return () => window.removeEventListener(STORE_EVENT, refresh);
  }, [refresh]);

  if (rows.length === 0) return null;

  return (
    <section className="clr-sum">
      <div className="clr-sum-inner">
        <div className="clr-sum-eyebrow">Clarity Layer · Behavioral readiness</div>
        <h2 className="clr-sum-title">Your readiness scores</h2>
        <p className="clr-sum-sub">
          These behavioral assessments sit alongside your identity profile, scored 0 to 100. Each appears here as you complete it.
        </p>
        <div className="clr-sum-grid">
          {rows.map((r) => (
            <Link key={r.slug} href={`/insights/clarity/${r.slug}`} className="clr-sum-card">
              <div className="clr-sum-name">{r.name}</div>
              {r.hasReport ? (
                <>
                  <div className="clr-sum-score" style={{ color: scoreColor(r.overall ?? 0) }}>
                    {r.overall}<span>/100</span>
                  </div>
                  <div className="clr-sum-level">{r.scoreName} · {r.level}</div>
                  {r.domains && (
                    <div className="clr-sum-minis">
                      {r.domains.map((d) => (
                        <div className="clr-sum-mini" key={d.name}>
                          <span className="clr-sum-mini-v">{d.score}</span>
                          <span className="clr-sum-mini-l">{d.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="clr-sum-link">View full result →</div>
                </>
              ) : (
                <>
                  <div className="clr-sum-pending">Completed · result ready</div>
                  <div className="clr-sum-link">View result →</div>
                </>
              )}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
