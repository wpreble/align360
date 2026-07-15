'use client';

import { useEffect, useRef } from 'react';
import { createClient, supabaseConfigured } from '@/lib/supabase/client';
import { STORE_EVENT } from '@/lib/storage';
import { pullToLocal, pushToCloud } from '@/lib/sync';

const UID_KEY = 'align360:uid';

/**
 * Invisible. Keeps the signed-in user's data synced between localStorage and
 * Supabase: pull cloud -> local on login (so data follows the account across
 * devices), push local -> cloud (debounced) on every change. If the account on
 * this device changed, the previous user's local data is dropped first so it
 * never leaks into a different account. All best-effort.
 */
export default function AccountSync() {
  const userId = useRef<string | null>(null);
  const ready = useRef(false);

  useEffect(() => {
    if (!supabaseConfigured) return;
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    // Signal that cloud→local hydration is settled (data restored, or no session /
    // nothing to restore). Shell's onboarding gate waits for this before deciding, so
    // a returning user isn't bounced into onboarding just because this device's
    // localStorage was cleared on the previous logout (Drew, 2026-07-14).
    const markHydrated = () => {
      try {
        (window as unknown as { __a360synced?: boolean }).__a360synced = true;
        window.dispatchEvent(new Event('align360:synced'));
      } catch { /* noop */ }
    };

    const onChange = () => {
      if (!ready.current || !userId.current) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { if (userId.current) pushToCloud(supabase, userId.current); }, 1500);
    };
    window.addEventListener(STORE_EVENT, onChange);

    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (cancelled) return;
        const uid = data.user?.id;
        if (!uid) { markHydrated(); return; }
        let lastUid: string | null = null;
        try { lastUid = localStorage.getItem(UID_KEY); } catch {}
        if (lastUid && lastUid !== uid) {
          try { Object.keys(localStorage).filter((k) => k.startsWith('align360:')).forEach((k) => localStorage.removeItem(k)); } catch {}
        }
        try { localStorage.setItem(UID_KEY, uid); } catch {}
        userId.current = uid;
        const hadCloud = await pullToLocal(supabase, uid);
        if (cancelled) return;
        if (!hadCloud) await pushToCloud(supabase, uid); // first-time migration of this device's data
        ready.current = true;
        markHydrated();
      } catch { markHydrated(); /* best-effort: never leave the gate waiting */ }
    })();

    return () => { cancelled = true; if (timer) clearTimeout(timer); window.removeEventListener(STORE_EVENT, onChange); };
  }, []);

  return null;
}
