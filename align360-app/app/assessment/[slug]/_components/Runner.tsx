'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Option = { letter: string; text: string; giftTag?: string };
type Q = { id: string; number: number; label: string; prompt: string; options: Option[]; section: string };

export default function Runner({ title, slug, questions }: { title: string; slug: string; questions: Q[] }) {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [dir, setDir] = useState<'fwd' | 'back'>('fwd');
  const [animKey, setAnimKey] = useState(0);

  const total = questions.length;
  const q = questions[idx];
  const done = idx >= total;

  useEffect(() => {
    setAnimKey((k) => k + 1);
  }, [idx]);

  function choose(letter: string) {
    const next = { ...answers, [q.id]: letter };
    setAnswers(next);
    // brief delay so the selection state is visible before advancing
    setDir('fwd');
    window.setTimeout(() => {
      if (idx + 1 >= total) {
        finish(next);
      } else {
        setIdx(idx + 1);
      }
    }, 240);
  }

  function back() {
    if (idx === 0) {
      router.push('/align');
      return;
    }
    setDir('back');
    setIdx(idx - 1);
  }

  function finish(finalAnswers: Record<string, string>) {
    // No persistence yet (Supabase pending). Stash locally so the result step
    // can pick it up, then route to the result placeholder.
    try {
      localStorage.setItem(
        `align360:answers:${slug}`,
        JSON.stringify({ slug, answers: finalAnswers, completedAt: new Date().toISOString() }),
      );
    } catch {
      /* ignore */
    }
    router.push(`/result?from=${slug}`);
  }

  if (done) return null;

  const answered = idx + (answers[q.id] ? 1 : 0);
  const pct = Math.round((idx / total) * 100);

  return (
    <div className="runner">
      <div className="runner-progress">
        <div className="runner-progress-bar" style={{ width: `${pct}%` }} />
      </div>

      <div className="runner-head">
        <button className="runner-back" onClick={back} aria-label="Back">
          ←
        </button>
        <span className="runner-count">
          {idx + 1} <span className="muted">of {total}</span>
        </span>
        <span className="runner-title">{title}</span>
      </div>

      <div className="runner-body" key={animKey} data-dir={dir}>
        {q.section && <div className="runner-section">{q.section}</div>}
        <h1 className="runner-q">{q.prompt || q.label}</h1>

        <div className="runner-options">
          {q.options.map((o) => (
            <button
              key={o.letter}
              className={`runner-option${answers[q.id] === o.letter ? ' selected' : ''}`}
              onClick={() => choose(o.letter)}
            >
              <span className="runner-option-letter">{o.letter}</span>
              <span className="runner-option-text">{o.text}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="runner-dots">
        {questions.map((qq, i) => (
          <span
            key={qq.id}
            className={`runner-dot${i === idx ? ' current' : ''}${answers[qq.id] ? ' filled' : ''}`}
          />
        ))}
      </div>
    </div>
  );
}
