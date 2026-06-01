'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { OB_STEPS, synthesize, type Answers } from '@/lib/onboarding';
import { setOnboarding, setName } from '@/lib/storage';

function AlignMark() {
  return (
    <svg className="ob-mark" viewBox="0 0 40 50" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="20" y1="3" x2="20" y2="47" /><path d="M12 13 A 11 12 0 0 0 12 37" /><path d="M28 13 A 11 12 0 0 1 28 37" />
      <line x1="3" y1="25" x2="8" y2="25" /><line x1="32" y1="25" x2="37" y2="25" />
      <circle cx="20" cy="25" r="4.2" fill="currentColor" stroke="none" /><circle cx="20" cy="14" r="2" fill="currentColor" stroke="none" /><circle cx="20" cy="36" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});

  const s = OB_STEPS[step];
  const total = OB_STEPS.length;

  const setAnswer = (key: string, val: string) => setAnswers((a) => ({ ...a, [key]: val }));
  const toggleMulti = (key: string, opt: string) =>
    setAnswers((a) => {
      const arr = Array.isArray(a[key]) ? (a[key] as string[]) : [];
      return { ...a, [key]: arr.includes(opt) ? arr.filter((x) => x !== opt) : [...arr, opt] };
    });

  function answered(): boolean {
    if (s.type === 'summary') return true;
    if (s.type === 'inputs') return typeof answers.name === 'string' && answers.name.trim().length > 0;
    if ('optional' in s && s.optional) return true;
    if (s.type === 'multi') return Array.isArray(answers[s.key]) && (answers[s.key] as string[]).length > 0;
    return !!answers[s.key];
  }

  function next() { if (step < total - 1) setStep(step + 1); }
  function back() { if (step > 0) setStep(step - 1); }

  function finish() {
    const name = (typeof answers.name === 'string' && answers.name.trim()) || '';
    const callName = (typeof answers.callName === 'string' && answers.callName.trim()) || '';
    setOnboarding(answers);
    if (callName || name) setName((callName || name).split(' ')[0]);
    router.push('/');
  }

  const dots = OB_STEPS.map((_, i) => (
    <span key={i} className={`prog-dot${i === step ? ' active' : i < step ? ' done' : ''}`} />
  ));

  return (
    <div className="ob">
      <header className="ob-header">
        <div className="ob-logo"><AlignMark /><span className="ob-word">Align</span></div>
        <div className="ob-progress">{dots}</div>
      </header>

      <div className="ob-body">
        <div className="ob-card" key={step}>
          {s.type === 'summary' ? (
            <Summary answers={answers} onEnter={finish} onBack={back} />
          ) : (
            <>
              <div className="ob-eyebrow">{s.eyebrow}</div>
              <h1 className="ob-question">{s.question}</h1>
              {s.sub && <p className="ob-sub">{s.sub}</p>}

              {s.type === 'inputs' && (
                <div className="ob-inputs">
                  {s.inputs.map((inp) => (
                    <input
                      key={inp.key}
                      className="ob-input"
                      placeholder={inp.placeholder}
                      value={(answers[inp.key] as string) || ''}
                      onChange={(e) => setAnswer(inp.key, e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && answered()) next(); }}
                      autoFocus={inp.key === 'name'}
                    />
                  ))}
                </div>
              )}

              {(s.type === 'single' || s.type === 'multi') && (
                <>
                  {s.type === 'multi' && <div className="ob-multi-hint">Select all that apply</div>}
                  <div className={`ob-options${s.compact ? ' compact' : ''}`}>
                    {s.options.map((opt) => {
                      const selected = s.type === 'multi'
                        ? Array.isArray(answers[s.key]) && (answers[s.key] as string[]).includes(opt)
                        : answers[s.key] === opt;
                      return (
                        <button
                          key={opt}
                          className={`ob-option${selected ? ' selected' : ''}`}
                          onClick={() => (s.type === 'multi' ? toggleMulti(s.key, opt) : setAnswer(s.key, opt))}
                        >
                          <span className="opt-label">{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              <div className="ob-actions">
                {step > 0 && <button className="ob-btn-ghost" onClick={back}>Back</button>}
                <button className="ob-btn" onClick={next} disabled={!answered()}>
                  Continue
                </button>
                {'optional' in s && s.optional && !answered() && <button className="ob-btn-ghost" onClick={next}>Skip</button>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Summary({ answers, onEnter, onBack }: { answers: Answers; onEnter: () => void; onBack: () => void }) {
  const synth = synthesize(answers);
  return (
    <>
      <div className="ob-eyebrow">Your first read</div>
      <h1 className="ob-question">Here&apos;s what I&apos;m sensing, {synth.name}.</h1>

      <div className="synth-block">
        <p className="synth-lead">
          You came in wanting to <strong>{synth.intentPhrase}</strong>. From how you described your best
          work, your wiring leans toward someone who can <strong>{synth.primaryBlurb}</strong>
          {synth.secondaryBlurb && synth.primaryGift !== synth.secondaryGift ? <> , with a strong undercurrent of how you <strong>{synth.secondaryBlurb}</strong></> : null}.
        </p>
        <p className="synth-body">{synth.growthRead} — and it&apos;s already shaping how you show up. {synth.commsRead}</p>
      </div>

      <div className="pg-card">
        <div className="pg-label">Likely primary wiring</div>
        <div className="pg-name">The {synth.primaryGift}</div>
        <div className="pg-note">A working read, not a verdict. The <strong>Wiring for Impact</strong> assessment confirms your full profile.</div>
      </div>

      <div className="ob-actions">
        <button className="ob-btn-ghost" onClick={onBack}>Back</button>
        <button className="ob-btn" onClick={onEnter}>Enter Align360 →</button>
      </div>
    </>
  );
}
