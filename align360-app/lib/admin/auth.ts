import { createHmac, scryptSync, timingSafeEqual, randomBytes } from 'crypto';
import { cookies } from 'next/headers';

// Dedicated admin auth, intentionally SEPARATE from the app's Supabase user auth.
// Credentials live only as scrypt hashes in the ADMIN_USERS env var (never in the
// repo); sessions are short-lived HMAC-signed cookies. No third-party deps — all
// Node crypto. This gates /admin and /api/admin/* independently of who has a
// regular Align360 account.

export const ADMIN_COOKIE = 'a360_admin';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h

type AdminUser = { email: string; salt: string; hash: string };

/** Parse ADMIN_USERS (JSON array of {email,salt,hash}); never throws. */
function adminUsers(): AdminUser[] {
  try {
    const raw = process.env.ADMIN_USERS;
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((u) => u?.email && u?.salt && u?.hash) : [];
  } catch {
    return [];
  }
}

function sessionSecret(): string {
  return process.env.ADMIN_SESSION_SECRET || '';
}

/** Verify an email+password against the stored scrypt hashes (constant-time). */
export function verifyCredentials(email: string, password: string): boolean {
  const addr = (email || '').trim().toLowerCase();
  const users = adminUsers();
  // Always do the scrypt work (even for an unknown email) to avoid user enumeration
  // via timing. Compare against a dummy salt/hash when the email isn't found.
  const user = users.find((u) => u.email.trim().toLowerCase() === addr);
  const salt = user ? user.salt : '0'.repeat(32);
  const expected = user ? Buffer.from(user.hash, 'hex') : Buffer.alloc(64);
  let derived: Buffer;
  try {
    derived = scryptSync(password || '', Buffer.from(salt, 'hex'), expected.length || 64);
  } catch {
    return false;
  }
  const ok = expected.length === derived.length && timingSafeEqual(expected, derived);
  return !!user && ok;
}

/** Compact HMAC-signed session token: base64url(payload).base64url(sig). */
export function createSessionToken(email: string): string {
  const secret = sessionSecret();
  const payload = Buffer.from(
    JSON.stringify({ e: email.trim().toLowerCase(), x: Date.now() + SESSION_TTL_MS }),
  ).toString('base64url');
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

/** Return the admin email if the token is valid and unexpired, else null. */
export function verifySessionToken(token: string | undefined | null): string | null {
  const secret = sessionSecret();
  if (!token || !secret) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const { e, x } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (typeof x !== 'number' || Date.now() > x) return null;
    return typeof e === 'string' ? e : null;
  } catch {
    return null;
  }
}

/** Read + verify the admin session from request cookies (RSC / route handlers). */
export function getAdminEmail(): string | null {
  return verifySessionToken(cookies().get(ADMIN_COOKIE)?.value);
}

/** True once admin auth is provisioned (both env vars present). */
export function adminConfigured(): boolean {
  return adminUsers().length > 0 && !!sessionSecret();
}

/** Helper for provisioning: hash a password with a fresh random salt. */
export function hashPassword(password: string): { salt: string; hash: string } {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return { salt: salt.toString('hex'), hash: hash.toString('hex') };
}
