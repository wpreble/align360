// Referral program v0 — pure helpers (no DB, no side effects; unit-testable).
// The DB writes live in the API routes via the SECURITY DEFINER functions in
// supabase/migrations/0010_referrals.sql. See handoff/…referral-program-research-and-roadmap.md.
import { createHash } from 'node:crypto';

/** Public site origin for share links. Override with NEXT_PUBLIC_SITE_URL. */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://align360.io';

/** Crockford base32 minus ambiguous chars (no I,L,O,U) — readable when spoken/typed. */
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Up-to-3-letter initials from a display name; falls back to 'A360' seeds. */
function initials(name: string): string {
  const words = (name || '').replace(/[^A-Za-z ]/g, ' ').trim().split(/\s+/).filter(Boolean);
  let out = '';
  if (words.length >= 2) out = words.slice(0, 3).map((w) => w[0]).join('');
  else if (words.length === 1) out = words[0].slice(0, 3);
  out = out.toUpperCase();
  return out || 'A36';
}

/** Deterministic 4-char base32 suffix from the user id (stable per user). */
function suffix(userId: string): string {
  const h = createHash('sha256').update(String(userId)).digest();
  let s = '';
  for (let i = 0; i < 4; i++) s += B32[h[i] % 32];
  return s;
}

/**
 * Auto referral code, e.g. "SAM-8F3K". Deterministic from (name, userId) so it
 * needs no UI to set up. Uniqueness is still enforced by the DB unique index; on
 * the rare collision the caller appends `salt` (retry counter) to reshuffle.
 */
export function referralCode(name: string, userId: string, salt = 0): string {
  const seed = salt > 0 ? `${userId}#${salt}` : userId;
  return `${initials(name)}-${suffix(seed)}`;
}

/** Normalize a code for storage/compare (upper, trim; DB lookup is case-insensitive). */
export function normalizeCode(code: string): string {
  return (code || '').trim().toUpperCase();
}

/**
 * Custom-slug rule (alpha): 3–20 chars, letters/digits/hyphen, must start
 * alphanumeric, no leading/trailing/double hyphen. Reserved words blocked so a
 * slug can't shadow a route or look official.
 */
const RESERVED = new Set(['admin', 'api', 'align', 'align360', 'join', 'r', 'invite', 'auth', 'login', 'signup', 'org', 'app', 'support', 'help']);
export function isValidCustomSlug(slug: string): boolean {
  const s = (slug || '').trim();
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9]|-(?!-))*[A-Za-z0-9]$/.test(s)) return false;
  if (s.length < 3 || s.length > 20) return false;
  return !RESERVED.has(s.toLowerCase());
}

/** Public referral URL. Query form fits the existing router (no new dynamic route);
 *  middleware already runs on all paths, so it can capture ?ref on any landing page. */
export function referralUrl(code: string): string {
  return `${SITE_URL}/join?ref=${encodeURIComponent(normalizeCode(code))}`;
}

/** Pre-filled share message for the copy/email/share buttons. */
export function sharePrefill(referrerName: string, code: string): { subject: string; body: string } {
  const url = referralUrl(code);
  const who = (referrerName || '').trim();
  return {
    subject: 'You should try Align360',
    body: `${who ? `${who} thought you'd find this useful. ` : ''}Align360 helps you understand how you're wired and where you do your best work. Start free with my link: ${url}`,
  };
}
