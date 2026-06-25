// Internal admin allowlist. These accounts bypass the paywall and credit limits
// for the internal team's testing. This list is server-side only and cannot be
// self-granted from the client, so it is not publicly accessible.
export const ADMIN_EMAILS = ['wllprbl@gmail.com'];

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}
