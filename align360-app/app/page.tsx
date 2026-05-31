'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Msg = { role: 'user' | 'assistant'; content: string };

const SUGGESTIONS = [
  'Help me gain clarity on my next step',
  'Start my Wiring for Impact assessment',
  'Explore my career direction',
];

export default function ChatHome() {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ta = taRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
    }
  }, [input]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  async function sendText(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    // Shortcut: "start wiring" → launch the assessment directly.
    if (/start.*wiring/i.test(trimmed)) {
      router.push('/assessment/wiring');
      return;
    }
    const next: Msg[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(next);
    setInput('');
    setSending(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      setMessages([...next, { role: 'assistant', content: data.text || '…' }]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setMessages([...next, { role: 'assistant', content: `Sorry — something went wrong. ${message}` }]);
    } finally {
      setSending(false);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendText(input);
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="chat-area">
      <div className="chat-topbar">
        <div className="chat-title">Align360 AI</div>
        <div className="conn-label"><span className="conn-dot" />Connected</div>
      </div>

      <div className="chat-scroll">
        {empty ? (
          <div className="chat-welcome">
            <div className="welcome-avatar">✦</div>
            <h1 className="welcome-name">Welcome to Align360 AI</h1>
            <p className="welcome-sub">
              I&apos;m here to help you explore ideas, gain perspective, and make aligned decisions. What
              would you like to work on today?
            </p>
            <div className="suggestion-chips">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chip" onClick={() => sendText(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="messages">
            {messages.map((m, i) => (
              <div key={i} className={`bubble ${m.role === 'user' ? 'user' : 'ai'}`}>
                {m.content}
              </div>
            ))}
            {sending && <div className="typing">Align360 is thinking…</div>}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <div className="chat-input-area">
        <div className="input-inner">
          <textarea
            ref={taRef}
            rows={1}
            placeholder="Ask anything"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            disabled={sending}
          />
          <button className="send-btn" onClick={() => sendText(input)} disabled={!input.trim() || sending} aria-label="Send">
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}
