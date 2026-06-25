'use client';

import { useEffect, useState } from 'react';

/**
 * Report-generation loader: an orbiting fig-toned animation plus status lines
 * that cycle so a 20-40s GLM wait feels alive and intentional. Self-contained;
 * the interval cleans up on unmount, and prefers-reduced-motion is honored in CSS.
 */
export default function GenLoader({ messages }: { messages: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (messages.length <= 1) return;
    const t = setInterval(() => setI((n) => (n + 1) % messages.length), 2600);
    return () => clearInterval(t);
  }, [messages.length]);

  return (
    <div className="genx">
      <div className="genx-orbit" aria-hidden="true">
        <span className="genx-ring r1" />
        <span className="genx-ring r2" />
        <span className="genx-core" />
        <span className="genx-dot d1" />
        <span className="genx-dot d2" />
        <span className="genx-dot d3" />
      </div>
      <p className="genx-msg" key={i}>{messages[i]}&hellip;</p>
    </div>
  );
}
