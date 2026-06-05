'use client';

// Client-only localStorage layer for the alpha (pre-Supabase). Shared by the
// shell, chat, insights, and runner so assessment results, the generated
// profile, and chat history stay in sync across the app.

export const PROFILE_KEY = 'align360:profile';
export const CHATS_KEY = 'align360:chats';
export const ANSWER_PREFIX = 'align360:answers:';
export const NAME_KEY = 'align360:name';
export const ONBOARDING_KEY = 'align360:onboarding';
export const STORE_EVENT = 'align360:store-changed';

export const ASSESSMENT_SLUGS = ['wiring', 'orientation', 'rejection-gift'] as const;

export type StoredProfile = { profile: any; scores: any; generatedAt: string };
export type ChatImage = string;
export type ChatFileRef = { fileId: string; name: string };
export type ChatMsg = { role: 'user' | 'assistant'; text: string; images?: ChatImage[]; files?: ChatFileRef[] };
export type ChatSession = { id: string; title: string; messages: ChatMsg[]; updatedAt: number };

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event(STORE_EVENT));
  } catch {
    /* ignore quota / serialization errors */
  }
}

/* ── Profile ── */
export function getProfile(): StoredProfile | null {
  return read<StoredProfile | null>(PROFILE_KEY, null);
}
export function setProfile(p: StoredProfile) {
  write(PROFILE_KEY, p);
}
export function clearProfile() {
  if (typeof window !== 'undefined') {
    try { localStorage.removeItem(PROFILE_KEY); window.dispatchEvent(new Event(STORE_EVENT)); } catch {}
  }
}

/** Wipe ALL of this device's Align360 data (onboarding, name, answers, profile,
 *  chats, prefs). Used by the "Reset my data" control so each tester starts fresh. */
export function resetAll() {
  if (typeof window === 'undefined') return;
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('align360:'))
      .forEach((k) => localStorage.removeItem(k));
    window.dispatchEvent(new Event(STORE_EVENT));
  } catch {
    /* ignore */
  }
}

/* ── Name (personalization) ── */
export function getName(): string {
  if (typeof window === 'undefined') return '';
  try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; }
}
export function setName(n: string) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(NAME_KEY, n); window.dispatchEvent(new Event(STORE_EVENT)); } catch {}
}

/* ── Onboarding ── */
export function getOnboarding(): Record<string, string | string[]> | null {
  return read<Record<string, string | string[]> | null>(ONBOARDING_KEY, null);
}
export function setOnboarding(answers: Record<string, string | string[]>) {
  write(ONBOARDING_KEY, answers);
}
export function isOnboarded(): boolean {
  return getOnboarding() !== null;
}

/* ── Answers ── */
export function getAnswers(): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const slug of ASSESSMENT_SLUGS) {
    const r = read<{ answers?: Record<string, string> } | null>(ANSWER_PREFIX + slug, null);
    if (r?.answers && Object.keys(r.answers).length) out[slug] = r.answers;
  }
  return out;
}
export function hasAnyAnswers(): boolean {
  return Object.keys(getAnswers()).length > 0;
}

/* ── Chat sessions ── */
export function getChats(): ChatSession[] {
  return read<ChatSession[]>(CHATS_KEY, []).sort((a, b) => b.updatedAt - a.updatedAt);
}
export function getChat(id: string): ChatSession | null {
  return getChats().find((c) => c.id === id) || null;
}
export function saveChat(session: ChatSession) {
  const all = read<ChatSession[]>(CHATS_KEY, []);
  const i = all.findIndex((c) => c.id === session.id);
  if (i >= 0) all[i] = session;
  else all.push(session);
  write(CHATS_KEY, all);
}
export function deleteChat(id: string) {
  write(CHATS_KEY, read<ChatSession[]>(CHATS_KEY, []).filter((c) => c.id !== id));
}
export function newChatId(): string {
  return 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ── Profile → chat context string ── */
function stripHtml(s: string): string {
  return (s || '').replace(/<[^>]+>/g, '');
}
export function buildProfileContext(stored: StoredProfile | null): string {
  if (!stored?.profile) return '';
  const p = stored.profile;
  const s = stored.scores || {};
  const wiring = s.wiring?.ranked?.slice(0, 4).map((t: any) => `${t.tag} ${t.pct}%`).join(', ');
  const lines = [
    `Archetype: ${stripHtml(p.hero?.title || '')} — ${p.hero?.subtitle || ''}`.trim(),
    wiring ? `Wiring (top): ${wiring}` : '',
    s.orientation?.primary ? `Orientation: ${s.orientation.primary}${s.orientation.secondary ? ' / ' + s.orientation.secondary : ''}` : '',
    s.rejectionGift?.primary ? `Rejection Gift: ${s.rejectionGift.primary}` : '',
    p.signals?.edge ? `Strategic edge: ${stripHtml(p.signals.edge.title)} — ${stripHtml(p.signals.edge.body)}` : '',
  ].filter(Boolean);
  return lines.join('\n');
}
