// Internal team allowlist. These accounts are grandfathered: they bypass the
// paywall and are never metered (unlimited credits). Server-side only and cannot
// be self-granted from the client, so it is not publicly accessible.
// Entries must be lowercase (matching lowercases the incoming email).
export const TEAM_EMAILS = [
  'wllprbl@gmail.com',      // Will
  'drewcline168@gmail.com', // Drew
  // Samuel — add his Align360 sign-in email here to grandfather him too.
];

export function isTeamEmail(email?: string | null): boolean {
  if (!email) return false;
  return TEAM_EMAILS.includes(email.trim().toLowerCase());
}
