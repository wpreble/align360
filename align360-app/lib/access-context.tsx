'use client';

import { createContext, useContext } from 'react';

// Access/paywall state, provided by Shell (which already owns the billing-gate
// fetch + hydration timing) and consumed anywhere in the app: chat send,
// assessment/report pages, the insights hub's CTAs. Pages call requireAccess()
// before an AI-gated action; the server routes are the authoritative block
// (lib/billing-access.ts) — this is UX only (instant popup, no wasted request).
export type AccessCtx = {
  loading: boolean;
  enforce: boolean;
  access: boolean;
  plan: string;
  paywallOpen: boolean;
  paywallReason: string;
  openPaywall: (reason?: string) => void;
  closePaywall: () => void;
  /** true (and a no-op) when access is fine; else opens the paywall and returns false. */
  requireAccess: (reason?: string) => boolean;
};

const DEFAULT: AccessCtx = {
  loading: false,
  enforce: false,
  access: true,
  plan: 'none',
  paywallOpen: false,
  paywallReason: '',
  openPaywall: () => {},
  closePaywall: () => {},
  requireAccess: () => true,
};

export const AccessContext = createContext<AccessCtx>(DEFAULT);

export function useAccess(): AccessCtx {
  return useContext(AccessContext);
}
