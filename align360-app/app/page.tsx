'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { renderMarkdown } from '@/lib/markdown';
import { buildProfileContext, getProfile, getChat, saveChat, newChatId, type ChatMsg } from '@/lib/storage';

type Attachment = { name: string; kind: 'image' | 'text' | 'file'; dataUrl?: string; text?: string };

const SUGGESTIONS = [
  'Help me gain clarity on my next step',
  'Start my Wiring for Impact assessment',
  'Explore my career direction',
];

function ChatInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const chatParam = sp.get('chat');
  const newParam = sp.get('new');

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [sending, setSending] = useState(false);
  const idRef = useRef<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Load a past session, or start fresh, when the URL query changes.
  useEffect(() => {
    if (chatParam) {
      const s = getChat(chatParam);
      if (s) { idRef.current = s.id; setMessages(s.messages); return; }
    }
    idRef.current = null;
    setMessages([]);
  }, [chatParam, newParam]);

  useEffect(() => {
    const ta = taRef.current;
    if (ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 200) + 'px'; }
  }, [input]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, sending]);

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    files.forEach((f) => {
      const isImage = f.type.startsWith('image/');
      const isText = f.type.startsWith('text/') || /\.(txt|md|markdown|csv|json|log)$/i.test(f.name);
      const reader = new FileReader();
      reader.onload = () => {
        if (isImage) setAttachments((p) => [...p, { name: f.name, kind: 'image', dataUrl: String(reader.result) }]);
        else if (isText) setAttachments((p) => [...p, { name: f.name, kind: 'text', text: String(reader.result).slice(0, 6000) }]);
        else setAttachments((p) => [...p, { name: f.name, kind: 'file' }]);
      };
      if (isImage) reader.readAsDataURL(f);
      else if (isText) reader.readAsText(f);
      else { setAttachments((p) => [...p, { name: f.name, kind: 'file' }]); }
    });
    if (fileRef.current) fileRef.current.value = '';
  }

  const buildApiMessages = useCallback((msgs: ChatMsg[]) => {
    return msgs.map((m) => {
      if (m.role === 'user' && m.images && m.images.length) {
        return { role: m.role, content: [{ type: 'text', text: m.text }, ...m.images.map((url) => ({ type: 'image_url', image_url: { url } }))] };
      }
      return { role: m.role, content: m.text };
    });
  }, []);

  async function sendText(text: string) {
    const trimmed = text.trim();
    if ((!trimmed && attachments.length === 0) || sending) return;
    if (/start.*wiring/i.test(trimmed)) { router.push('/assessment/wiring'); return; }

    const images = attachments.filter((a) => a.kind === 'image' && a.dataUrl).map((a) => a.dataUrl!) as string[];
    const textFiles = attachments.filter((a) => a.kind === 'text');
    const fileNames = attachments.filter((a) => a.kind === 'file').map((a) => a.name);
    let bodyText = trimmed;
    for (const tf of textFiles) bodyText += `\n\n[file: ${tf.name}]\n${tf.text}`;
    if (fileNames.length) bodyText += `\n\n[attached: ${fileNames.join(', ')}]`;

    const userMsg: ChatMsg = { role: 'user', text: bodyText || '(image)', images: images.length ? images : undefined };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setAttachments([]);
    setSending(true);

    if (!idRef.current) idRef.current = newChatId();
    const id = idRef.current; // capture: user may switch chats mid-request
    persist(next, id); // show the session in the sidebar immediately (don't wait for the reply)
    const profileContext = buildProfileContext(getProfile());

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: buildApiMessages(next), profileContext }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      const reply: ChatMsg = { role: 'assistant', text: data.text || '...' };
      const finalMsgs = [...next, reply];
      persist(finalMsgs, id);
      if (idRef.current === id) setMessages(finalMsgs);
    } catch (err) {
      const reply: ChatMsg = { role: 'assistant', text: `Sorry, something went wrong. ${err instanceof Error ? err.message : 'Unknown error'}` };
      const finalMsgs = [...next, reply];
      persist(finalMsgs, id);
      if (idRef.current === id) setMessages(finalMsgs);
    } finally {
      if (idRef.current === id) setSending(false);
    }
  }

  function persist(msgs: ChatMsg[], id: string) {
    const firstUser = msgs.find((m) => m.role === 'user');
    const title = (firstUser?.text || 'New chat').replace(/\n[\s\S]*/, '').slice(0, 42);
    // Don't persist images (data URLs) to localStorage — too large.
    const slim = msgs.map((m) => ({ role: m.role, text: m.text }));
    saveChat({ id, title, messages: slim, updatedAt: Date.now() });
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(input); }
  }

  const empty = messages.length === 0;

  return (
    <div className="chat-area">
      <div className="chat-scroll">
        {empty ? (
          <div className="chat-welcome">
            <svg className="welcome-avatar" width="50" height="62" viewBox="0 0 40 50" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
              <line x1="20" y1="3" x2="20" y2="47" /><path d="M12 13 A 11 12 0 0 0 12 37" /><path d="M28 13 A 11 12 0 0 1 28 37" />
              <line x1="3" y1="25" x2="8" y2="25" /><line x1="32" y1="25" x2="37" y2="25" />
              <circle cx="20" cy="25" r="4.2" fill="currentColor" stroke="none" /><circle cx="20" cy="14" r="2" fill="currentColor" stroke="none" /><circle cx="20" cy="36" r="2" fill="currentColor" stroke="none" />
            </svg>
            <h1 className="welcome-name">How can I help you align?</h1>
            <div className="suggestion-chips">
              {SUGGESTIONS.map((s) => (<button key={s} className="chip" onClick={() => sendText(s)}>{s}</button>))}
            </div>
          </div>
        ) : (
          <div className="messages">
            {messages.map((m, i) =>
              m.role === 'assistant' ? (
                <div key={i} className="bubble ai md" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.text) }} />
              ) : (
                <div key={i} className="bubble user">
                  {m.images?.map((src, j) => <img key={j} className="attach-thumb" src={src} alt="attachment" />)}
                  {m.text}
                </div>
              ),
            )}
            {sending && <div className="typing-bubble"><span className="tdot" /><span className="tdot" /><span className="tdot" /></div>}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <div className="chat-input-area">
        {attachments.length > 0 && (
          <div className="attach-row">
            {attachments.map((a, i) => (
              <span className="attach-pill" key={i}>
                {a.kind === 'image' && a.dataUrl ? <img src={a.dataUrl} alt={a.name} /> : <span>{a.kind === 'text' ? '📄' : '📎'}</span>}
                <span>{a.name.length > 18 ? a.name.slice(0, 16) + '...' : a.name}</span>
                <button className="x" onClick={() => setAttachments((p) => p.filter((_, k) => k !== i))} aria-label={`Remove ${a.name}`}>✕</button>
              </span>
            ))}
          </div>
        )}
        <div className="input-inner">
          <input ref={fileRef} type="file" accept="image/*,.txt,.md,.csv,.json,.log" multiple hidden onChange={onPickFiles} />
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

export default function ChatHome() {
  return (
    <Suspense fallback={null}>
      <ChatInner />
    </Suspense>
  );
}
