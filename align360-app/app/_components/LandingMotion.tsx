'use client';

import { useEffect } from 'react';

/**
 * Tiny motion island for the marketing landing. The hero ignition is pure CSS
 * (plays on load, gated by prefers-reduced-motion); this only adds:
 *  - below-the-fold fade-ups via one IntersectionObserver (fire once), rooted to
 *    the .lp scroll container (the page scrolls inside .lp, not window)
 *  - a subtle magnetic pull on the primary CTA, desktop pointers only
 * Everything is opt-in: with reduced-motion or no JS, the static page is intact
 * (the .lp-js class is what hides .lp-reveal elements, and we only add it here).
 */
export default function LandingMotion() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const root = document.querySelector('.lp');
    if (!root) return;

    root.classList.add('lp-js');
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) { e.target.classList.add('lp-in'); io.unobserve(e.target); }
        }
      },
      { root, rootMargin: '0px 0px -8% 0px', threshold: 0.1 },
    );
    root.querySelectorAll('.lp-reveal').forEach((el) => io.observe(el));

    const cleanups: Array<() => void> = [];
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      root.querySelectorAll<HTMLElement>('.lp-magnetic').forEach((el) => {
        let raf = 0;
        const move = (ev: MouseEvent) => {
          const r = el.getBoundingClientRect();
          const dx = ev.clientX - (r.left + r.width / 2);
          const dy = ev.clientY - (r.top + r.height / 2);
          cancelAnimationFrame(raf);
          raf = requestAnimationFrame(() => {
            const cl = (n: number) => Math.max(-5, Math.min(5, n * 0.18));
            el.style.transform = `translate(${cl(dx)}px, ${cl(dy)}px)`;
          });
        };
        const leave = () => { cancelAnimationFrame(raf); el.style.transform = ''; };
        el.addEventListener('mousemove', move);
        el.addEventListener('mouseleave', leave);
        cleanups.push(() => { el.removeEventListener('mousemove', move); el.removeEventListener('mouseleave', leave); });
      });
    }

    return () => { io.disconnect(); cleanups.forEach((c) => c()); };
  }, []);

  return null;
}
