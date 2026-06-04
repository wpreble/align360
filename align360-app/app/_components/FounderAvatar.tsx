'use client';

import { useState } from 'react';
import AlignMark from './AlignMark';

// Shows Samuel's headshot (public/brand/samuel.jpg). Falls back to the mark if
// the file isn't present yet, so the section never shows a broken image.
export default function FounderAvatar() {
  const [ok, setOk] = useState(true);
  if (!ok) return <AlignMark white />;
  return (
    <img
      src="/brand/samuel.png"
      alt="Samuel Ngu"
      className="lp-founder-photo"
      onError={() => setOk(false)}
    />
  );
}
