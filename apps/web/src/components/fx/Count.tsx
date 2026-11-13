'use client';

import { useEffect, useRef, useState } from 'react';

/** Число, което „се навива“ от 0 до стойността, когато се появи на екрана. */
export function Count({ to, ms = 900, prefix = '', suffix = '' }: { to: number; ms?: number; prefix?: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [v, setV] = useState(to);
  useEffect(() => {
    if (!to || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setV(to);
    let raf = 0;
    setV(0);
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (now: number) => {
        const k = Math.min(1, (now - t0) / ms);
        setV(Math.round(to * (1 - (1 - k) ** 3)));
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    if (ref.current) io.observe(ref.current);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to, ms]);
  return (
    <span ref={ref} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {prefix}
      {v.toLocaleString('bg-BG')}
      {suffix}
    </span>
  );
}
