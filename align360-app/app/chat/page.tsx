'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { renderMarkdown } from '@/lib/markdown';
import { buildProfileContext, getProfile, getChat, getName, getOnboarding, saveChat, newChatId, type ChatMsg } from '@/lib/storage';
import { buildOnboardingContext, synthesize } from '@/lib/onboarding';
import AlignMark from '@/app/_components/AlignMark';

type Attachment = {
  id: string;
  name: string;
  kind: 'image' | 'text' | 'file';
  status: 'ready' | 'uploading' | 'error';
  dataUrl?: string;
  text?: string;
  fileId?: string;
  error?: string;
};

const SUGGESTIONS = [
  'Help me gain clarity on my next step',
  'Start my Wiring for Impact assessment',
  'Explore my career direction',
];

const uid = () => Math.random().toString(36).slice(2, 10);
const isTextName = (n: string) => /\.(txt|md|markdown|csv|json|log)$/i.test(n);

function ChatInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const chatParam = sp.get('chat');
  const newParam = sp.get('new');
  const runParam = sp.get('run');

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [sending, setSending] = useState(false);
  const [name, setName] = useState('');
  const [welcomeLine, setWelcomeLine] = useState('');
  const idRef = useRef<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const runHandledRef = useRef<string | null>(null);

  useEffect(() => {
    if (chatParam) {
      const s = getChat(chatParam);
      if (s) { idRef.current = s.id; setMessages(s.messages); return; }
    }
    // When launching a framework (?run=), the run effect owns the initial
    // state — don't reset here (and don't fight React StrictMode's double-invoke).
    if (runParam) return;
    idRef.current = null;
    setMessages([]);
  }, [chatParam, newParam, runParam]);

  useEffect(() => {
    setName(getName());
    const ob = getOnboarding();
    if (ob) {
      const s = synthesize(ob);
      setWelcomeLine(`You came in wanting to ${s.intentPhrase}. Your wiring leans toward someone who can ${s.primaryBlurb} — let's build on that.`);
    }
  }, []);

  useEffect(() => {
    const ta = taRef.current;
    if (ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 200) + 'px'; }
  }, [input]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, sending]);

  // Launch a framework from Resources: ?run=<Name> starts a fresh chat and
  // auto-sends "Run <Name>" so the AI runs that framework conversationally.
  // Guarded per value so StrictMode's double-invoke (and re-renders) send once.
  useEffect(() => {
    if (!runParam) return;
    if (runHandledRef.current === runParam) return;
    runHandledRef.current = runParam;
    sendText(`Run ${runParam}`, { fresh: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runParam]);

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    for (const f of files) {
      const id = uid();
      const isImage = f.type.startsWith('image/');
      const isText = f.type.startsWith('text/') || isTextName(f.name);
      if (isImage || isText) {
        const r = new FileReader();
        r.onload = () => {
          let text: string | undefined;
          if (isText) {
            const raw = String(r.result);
            text = raw.length > 12000 ? raw.slice(0, 12000) + '\n\n[file truncated]' : raw;
          }
          setAttachments((p) => [
            ...p,
            { id, name: f.name, kind: isImage ? 'image' : 'text', status: 'ready', dataUrl: isImage ? String(r.result) : undefined, text },
          ]);
        };
        isImage ? r.readAsDataURL(f) : r.readAsText(f);
      } else {
        // PDF / DOCX / other → server upload (Files API or docx extraction)
        setAttachments((p) => [...p, { id, name: f.name, kind: 'file', status: 'uploading' }]);
        const fd = new FormData();
        fd.append('file', f);
        fetch('/api/upload', { method: 'POST', body: fd })
          .then(async (r) => { try { return await r.json(); } catch { return { error: `Upload failed (${r.status})` }; } })
          .then((d) =>
            setAttachments((p) =>
              p.map((a) =>
                a.id !== id ? a
                  : d.error ? { ...a, status: 'error', error: d.error }
                  : d.kind === 'file' ? { ...a, kind: 'file', status: 'ready', fileId: d.fileId }
                  : { ...a, kind: 'text', status: 'ready', text: d.text },
              ),
            ),
          )
          .catch((err) => setAttachments((p) => p.map((a) => (a.id === id ? { ...a, status: 'error', error: String(err) } : a))));
      }
    }
    if (fileRef.current) fileRef.current.value = '';
  }

  const buildApiMessages = useCallback((msgs: ChatMsg[]) => {
    return msgs.map((m) => {
      const parts: any[] = [];
      if (m.role === 'user' && ((m.images && m.images.length) || (m.files && m.files.length))) {
        if (m.text) parts.push({ type: 'text', text: m.text });
        for (const url of m.images || []) parts.push({ type: 'image_url', image_url: { url } });
        for (const f of m.files || []) parts.push({ type: 'file', file: { file_id: f.fileId } });
        return { role: m.role, content: parts };
      }
      return { role: m.role, content: m.text };
    });
  }, []);

  const uploading = attachments.some((a) => a.status === 'uploading');

  async function sendText(text: string, opts: { fresh?: boolean } = {}) {
    const trimmed = text.trim();
    const ready = attachments.filter((a) => a.status === 'ready');
    if ((!trimmed && ready.length === 0) || sending || uploading) return;
    if (/start.*wiring/i.test(trimmed)) { router.push('/assessment/wiring'); return; }

    const base = opts.fresh ? [] : messages;
    if (opts.fresh) idRef.current = null;

    const images = ready.filter((a) => a.kind === 'image' && a.dataUrl).map((a) => a.dataUrl!) as string[];
    const fileRefs = ready.filter((a) => a.kind === 'file' && a.fileId).map((a) => ({ fileId: a.fileId!, name: a.name }));
    const textFiles = ready.filter((a) => a.kind === 'text');

    let bodyText = trimmed;
    for (const tf of textFiles) bodyText += `\n\n[file: ${tf.name}]\n${tf.text}`;

    const userMsg: ChatMsg = {
      role: 'user',
      text: bodyText || (images.length || fileRefs.length ? '(see attachment)' : ''),
      images: images.length ? images : undefined,
      files: fileRefs.length ? fileRefs : undefined,
    };
    const next = [...base, userMsg];
    setMessages(next);
    setInput('');
    setAttachments([]);
    setSending(true);

    if (!idRef.current) idRef.current = newChatId();
    const id = idRef.current;
    persist(next, id);
    const nm = getName();
    const profileContext = [
      nm ? `The user's preferred name is ${nm}.` : '',
      buildOnboardingContext(getOnboarding() || {}),
      buildProfileContext(getProfile()),
    ].filter(Boolean).join('\n\n');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: buildApiMessages(next), profileContext }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      const finalMsgs = [...next, { role: 'assistant', text: data.text || '...' } as ChatMsg];
      persist(finalMsgs, id);
      if (idRef.current === id) setMessages(finalMsgs);
    } catch (err) {
      const finalMsgs = [...next, { role: 'assistant', text: `Sorry, something went wrong. ${err instanceof Error ? err.message : 'Unknown error'}` } as ChatMsg];
      persist(finalMsgs, id);
      if (idRef.current === id) setMessages(finalMsgs);
    } finally {
      if (idRef.current === id) setSending(false);
    }
  }

  function persist(msgs: ChatMsg[], id: string) {
    const firstUser = msgs.find((m) => m.role === 'user');
    const title = (firstUser?.text || 'New chat').replace(/\n[\s\S]*/, '').slice(0, 42) || 'New chat';
    // Keep file refs (small) but drop image data URLs (too large for localStorage).
    const slim = msgs.map((m) => ({ role: m.role, text: m.text, files: m.files }));
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
            <AlignMark className="welcome-mark" />
            <h1 className="welcome-name">How can I help you align{name ? `, ${name.split(' ')[0]}` : ''}?</h1>
            {welcomeLine && <p className="welcome-sub">{welcomeLine}</p>}
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
                  {m.files?.map((f, j) => <span key={j} className="msg-file">📄 {f.name}</span>)}
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
            {attachments.map((a) => (
              <span className={`attach-pill${a.status === 'error' ? ' err' : ''}`} key={a.id} title={a.error || a.name}>
                {a.kind === 'image' && a.dataUrl ? <img src={a.dataUrl} alt={a.name} /> : <span>{a.status === 'uploading' ? '⏳' : a.status === 'error' ? '⚠️' : a.kind === 'file' ? '📄' : '📝'}</span>}
                <span>{a.name.length > 18 ? a.name.slice(0, 16) + '...' : a.name}</span>
                <button className="x" onClick={() => setAttachments((p) => p.filter((x) => x.id !== a.id))} aria-label={`Remove ${a.name}`}>✕</button>
              </span>
            ))}
          </div>
        )}
        <div className="composer">
          <input ref={fileRef} type="file" accept="image/*,.pdf,.docx,.txt,.md,.csv,.json,.log" multiple hidden onChange={onPickFiles} />
          <textarea ref={taRef} rows={1} className="composer-input" placeholder="Ask anything" value={input} maxLength={20000} onChange={(e) => setInput(e.target.value)} onKeyDown={onKey} disabled={sending} />
          <div className="composer-bar">
            <div className="composer-left">
              <button className="composer-btn" onClick={() => fileRef.current?.click()} aria-label="Attach image, PDF, DOCX, or text" title="Attach file">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
              </button>
            </div>
            <div className="composer-right">
              {input.length > 0 && <span className="char-count">{input.length.toLocaleString()} / 20,000</span>}
              <button className="composer-btn" aria-label="Voice input (coming soon)" title="Voice input — coming soon" disabled>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" /></svg>
              </button>
              <button className="send-btn" onClick={() => sendText(input)} disabled={(!input.trim() && attachments.filter((a) => a.status === 'ready').length === 0) || sending || uploading} aria-label="Send">↑</button>
            </div>
          </div>
        </div>
        {uploading && <div className="upload-hint">Uploading attachment…</div>}
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
