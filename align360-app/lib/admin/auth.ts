import { createHmac, scryptSync, timingSafeEqual, randomBytes } from 'crypto';
import { cookies } from 'next/headers';

// Dedicated admin auth, intentionally SEPARATE from the app's Supabase user auth.
// Credentials live only as scrypt hashes in the ADMIN_USERS env var (never in the
// repo); sessions are short-lived HMAC-signed cookies. No third-party deps — all
// Node crypto. This gates /admin and /api/admin/* independently of who has a
// regular Align360 account.

export const ADMIN_COOKIE = 'a360_admin';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h

export type AdminRole = 'superadmin' | 'admin';
type AdminUser = { email: string; salt: string; hash: string; role?: AdminRole };

/** Parse ADMIN_USERS (JSON array of {email,salt,hash,role?}); never throws.
 *  Entries with no `role` default to 'admin' (least privilege) — an operator
 *  must explicitly opt an account INTO 'superadmin', never fall into it by
 *  omission. See scripts/provision-admin.ts to generate entries. */
function adminUsers(): AdminUser[] {
  try {
    const raw = process.env.ADMIN_USERS;
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr)
      ? arr
          .filter((u) => u?.email && u?.salt && u?.hash)
          .map((u) => ({ ...u, role: u.role === 'superadmin' ? 'superadmin' : 'admin' }) as AdminUser)
      : [];
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

/** The provisioned role for an email, or null if unknown. Call ONLY after
 *  verifyCredentials succeeds — this alone is not an auth check. */
export function roleFor(email: string): AdminRole | null {
  const addr = (email || '').trim().toLowerCase();
  const user = adminUsers().find((u) => u.email.trim().toLowerCase() === addr);
  return user ? (user.role as AdminRole) : null;
}

/** Compact HMAC-signed session token: base64url(payload).base64url(sig). The
 *  role is embedded at issuance (login), not re-looked-up per request — same
 *  12h staleness window as the rest of the session, no extra design needed. */
export function createSessionToken(email: string, role: AdminRole): string {
  const secret = sessionSecret();
  const payload = Buffer.from(
    JSON.stringify({ e: email.trim().toLowerCase(), r: role, x: Date.now() + SESSION_TTL_MS }),
  ).toString('base64url');
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export type AdminSession = { email: string; role: AdminRole };

/** Return the admin session if the token is valid and unexpired, else null. */
export function verifySessionToken(token: string | undefined | null): AdminSession | null {
  const secret = sessionSecret();
  if (!token || !secret) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const { e, r, x } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (typeof x !== 'number' || Date.now() > x) return null;
    if (typeof e !== 'string') return null;
    // Tokens issued before roles existed have no `r` — treat as least-privilege
    // 'admin' rather than reject, so an in-flight session isn't force-logged-out
    // by this deploy; it naturally rotates to a role-carrying token on next login.
    return { email: e, role: r === 'superadmin' ? 'superadmin' : 'admin' };
  } catch {
    return null;
  }
}

/** Read + verify the admin session from request cookies (RSC / route handlers). */
export function getAdminSession(): AdminSession | null {
  return verifySessionToken(cookies().get(ADMIN_COOKIE)?.value);
}

/** Convenience accessor for callers that only need the email. */
export function getAdminEmail(): string | null {
  return getAdminSession()?.email ?? null;
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
