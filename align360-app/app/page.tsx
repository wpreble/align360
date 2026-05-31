'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Attachment = { name: string; dataUrl: string; isImage: boolean };
type Msg = { role: 'user' | 'assistant'; text: string; images?: string[] };

const SUGGESTIONS = [
  'Help me gain clarity on my next step',
  'Start my Wiring for Impact assessment',
  'Explore my career direction',
];

export default function ChatHome() {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [sending, setSending] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ta = taRef.current;
    if (ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 200) + 'px'; }
  }, [input]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, sending]);

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    files.forEach((f) => {
      const reader = new FileReader();
      reader.onload = () => {
        setAttachments((prev) => [...prev, { name: f.name, dataUrl: String(reader.result), isImage: f.type.startsWith('image/') }]);
      };
      reader.readAsDataURL(f);
    });
    if (fileRef.current) fileRef.current.value = '';
  }

  function buildApiMessages(next: Msg[]) {
    return next.map((m) => {
      if (m.role === 'user' && m.images && m.images.length) {
        return { role: m.role, content: [{ type: 'text', text: m.text }, ...m.images.map((url) => ({ type: 'image_url', image_url: { url } }))] };
      }
      return { role: m.role, content: m.text };
    });
  }

  async function sendText(text: string) {
    const trimmed = text.trim();
    if ((!trimmed && attachments.length === 0) || sending) return;
    if (/start.*wiring/i.test(trimmed)) { router.push('/assessment/wiring'); return; }

    const images = attachments.filter((a) => a.isImage).map((a) => a.dataUrl);
    const fileNames = attachments.filter((a) => !a.isImage).map((a) => a.name);
    const bodyText = fileNames.length ? `${trimmed}\n\n[attached files: ${fileNames.join(', ')}]` : trimmed;

    const next: Msg[] = [...messages, { role: 'user', text: bodyText || '(image)', images }];
    setMessages(next);
    setInput('');
    setAttachments([]);
    setSending(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: buildApiMessages(next) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      setMessages([...next, { role: 'assistant', text: data.text || '…' }]);
    } catch (err) {
      setMessages([...next, { role: 'assistant', text: `Sorry — something went wrong. ${err instanceof Error ? err.message : 'Unknown error'}` }]);
    } finally {
      setSending(false);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(input); }
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
            <svg className="welcome-avatar" width="52" height="64" viewBox="0 0 40 50" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
              <line x1="20" y1="3" x2="20" y2="47" /><path d="M12 13 A 11 12 0 0 0 12 37" /><path d="M28 13 A 11 12 0 0 1 28 37" />
              <line x1="3" y1="25" x2="8" y2="25" /><line x1="32" y1="25" x2="37" y2="25" />
              <circle cx="20" cy="25" r="4.2" fill="currentColor" stroke="none" /><circle cx="20" cy="14" r="2" fill="currentColor" stroke="none" /><circle cx="20" cy="36" r="2" fill="currentColor" stroke="none" />
            </svg>
            <h1 className="welcome-name">Welcome to Align360 AI</h1>
            <p className="welcome-sub">I&apos;m here to help you explore ideas, gain perspective, and make aligned decisions. What would you like to work on today?</p>
            <div className="suggestion-chips">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chip" onClick={() => sendText(s)}>{s}</button>
              ))}
            </div>
          </div>
        ) : (
          <div className="messages">
            {messages.map((m, i) => (
              <div key={i} className={`bubble ${m.role === 'user' ? 'user' : 'ai'}`}>
                {m.images?.map((src, j) => <img key={j} className="attach-thumb" src={src} alt="attachment" />)}
                {m.text}
              </div>
            ))}
            {sending && <div className="typing">Align360 is thinking…</div>}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <div className="chat-input-area">
        {attachments.length > 0 && (
          <div className="attach-row">
            {attachments.map((a, i) => (
              <span className="attach-pill" key={i}>
                {a.isImage ? <img src={a.dataUrl} alt={a.name} /> : <span>📄</span>}
                <span>{a.name.length > 18 ? a.name.slice(0, 16) + '…' : a.name}</span>
                <span className="x" onClick={() => setAttachments((p) => p.filter((_, k) => k !== i))}>✕</span>
              </span>
            ))}
          </div>
        )}
        <div className="input-inner">
          <input ref={fileRef} type="file" accept="image/*,.pdf,.txt,.md,.docx" multiple hidden onChange={onPickFiles} />
          <button className="attach-btn" onClick={() => fileRef.current?.click()} aria-label="Attach image or file" title="Attach image or file">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
          </button>
          <textarea ref={taRef} rows={1} placeholder="Ask anything" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKey} disabled={sending} />
          <button className="send-btn" onClick={() => sendText(input)} disabled={(!input.trim() && attachments.length === 0) || sending} aria-label="Send">↑</button>
        </div>
      </div>
    </div>
  );
}
