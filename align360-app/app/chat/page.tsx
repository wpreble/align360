'use client';

import { useEffect, useRef, useState } from 'react';

type Msg = { role: 'user' | 'assistant'; content: string };

const OPENING: Msg = {
  role: 'assistant',
  content:
    "Welcome to Align360. I'm here to help you explore how you're wired, find clarity, and make aligned decisions. What's on your mind?",
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([OPENING]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }, [input]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    const next: Msg[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setSending(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.filter((m) => m !== OPENING) }),
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
      send();
    }
  }

  return (
    <>
      <main className="messages" aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role === 'user' ? 'user' : 'ai'}`}>
            {m.content}
          </div>
        ))}
        {sending && <div className="typing">Align360 is thinking…</div>}
      </main>

      <div className="input-wrap">
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
          <button className="send-btn" onClick={send} disabled={!input.trim() || sending} aria-label="Send">
            ↑
          </button>
        </div>
      </div>
    </>
  );
}
