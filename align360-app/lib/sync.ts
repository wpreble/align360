'use client';

// Sync layer: mirrors the localStorage app state to the signed-in user's
// Supabase rows so data follows the account across devices. Best-effort by
// design: every call is wrapped so a network/RLS failure never breaks the
// localStorage-backed app. localStorage stays the working store; the cloud is
// the durable copy (pulled on login, pushed on change).

import type { createClient } from '@/lib/supabase/client';
import {
  ASSESSMENT_SLUGS, CLARITY_SLUGS,
  ONBOARDING_KEY, NAME_KEY, PROFILE_KEY, CHATS_KEY,
  ANSWER_PREFIX, CLARITY_REPORT_PREFIX, STORE_EVENT,
} from '@/lib/storage';

export type SupaClient = ReturnType<typeof createClient>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lsGet(key: string): any | null {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; } catch { return null; }
}
function lsGetRaw(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lsSet(key: string, val: any) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* quota */ }
}

/** Pull the user's cloud rows into localStorage. Returns true if the cloud had any data. */
export async function pullToLocal(supabase: SupaClient, userId: string): Promise<boolean> {
  let had = false;
  try {
    const [onb, ans, reps, chats, prof] = await Promise.all([
      supabase.from('onboarding').select('answers').eq('user_id', userId).maybeSingle(),
      supabase.from('assessment_answers').select('slug, answers, completed_at').eq('user_id', userId),
      supabase.from('reports').select('kind, slug, scores, narrative, generated_at').eq('user_id', userId),
      supabase.from('chats').select('id, title, messages, updated_at').eq('user_id', userId),
      supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle(),
    ]);
    if (onb.data?.answers) { lsSet(ONBOARDING_KEY, onb.data.answers); had = true; }
    if (prof.data?.full_name) { try { localStorage.setItem(NAME_KEY, prof.data.full_name); } catch {} }
    for (const row of ans.data || []) {
      lsSet(ANSWER_PREFIX + row.slug, { answers: row.answers, completedAt: row.completed_at });
      had = true;
    }
    for (const row of reps.data || []) {
      if (row.kind === 'combined') lsSet(PROFILE_KEY, { profile: row.narrative, scores: row.scores, generatedAt: row.generated_at });
      else if (row.kind === 'clarity' && row.slug) lsSet(CLARITY_REPORT_PREFIX + row.slug, { narrative: row.narrative, scores: row.scores, generated: true });
      had = true;
    }
    if (chats.data?.length) {
      lsSet(CHATS_KEY, chats.data.map((c) => ({ id: c.id, title: c.title, messages: c.messages, updatedAt: new Date(c.updated_at).getTime() })));
      had = true;
    }
    if (had) window.dispatchEvent(new Event(STORE_EVENT));
  } catch { /* best-effort */ }
  return had;
}

/** Upsert the current localStorage state into the user's cloud rows. */
export async function pushToCloud(supabase: SupaClient, userId: string): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ops: PromiseLike<any>[] = [];
    const onb = lsGet(ONBOARDING_KEY);
    if (onb) ops.push(supabase.from('onboarding').upsert({ user_id: userId, answers: onb, updated_at: new Date().toISOString() }));
    const name = lsGetRaw(NAME_KEY);
    if (name) ops.push(supabase.from('profiles').update({ full_name: name }).eq('id', userId));
    for (const slug of [...ASSESSMENT_SLUGS, ...CLARITY_SLUGS]) {
      const a = lsGet(ANSWER_PREFIX + slug);
      if (a?.answers) ops.push(supabase.from('assessment_answers').upsert({ user_id: userId, slug, answers: a.answers }));
    }
    for (const slug of CLARITY_SLUGS) {
      const r = lsGet(CLARITY_REPORT_PREFIX + slug);
      if (r) ops.push(supabase.from('reports').upsert({ user_id: userId, kind: 'clarity', slug, scores: r.scores ?? null, narrative: r.narrative ?? null }));
    }
    const prof = lsGet(PROFILE_KEY);
    if (prof) ops.push(supabase.from('reports').upsert({ user_id: userId, kind: 'combined', slug: '', scores: prof.scores ?? null, narrative: prof.profile ?? null }));
    const chats = lsGet(CHATS_KEY);
    if (Array.isArray(chats)) {
      for (const c of chats) ops.push(supabase.from('chats').upsert({ user_id: userId, id: c.id, title: c.title ?? null, messages: c.messages ?? [], updated_at: new Date(c.updatedAt || Date.now()).toISOString() }));
    }
    await Promise.allSettled(ops);
  } catch { /* best-effort */ }
}

/** Delete all of the user's cloud rows (paired with the "Reset my data" control). */
export async function wipeCloud(supabase: SupaClient, userId: string): Promise<void> {
  try {
    await Promise.allSettled([
      supabase.from('onboarding').delete().eq('user_id', userId),
      supabase.from('assessment_answers').delete().eq('user_id', userId),
      supabase.from('reports').delete().eq('user_id', userId),
      supabase.from('chats').delete().eq('user_id', userId),
    ]);
  } catch { /* best-effort */ }
}
