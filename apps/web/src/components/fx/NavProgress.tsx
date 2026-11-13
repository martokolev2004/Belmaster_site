'use client';

/** Тънка лента най-горе, докато се зарежда следващата страница — за да се усеща, че натискането е „хванато“. */
import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export function NavProgress() {
  const path = usePathname();
  const query = useSearchParams().toString();
  const [phase, setPhase] = useState<'idle' | 'run' | 'done'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // тръгва при клик върху вътрешна връзка
  useEffect(() => {
    const on = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.('a');
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const href = a.getAttribute('href');
      if (!href || !href.startsWith('/') || href.startsWith('//')) return;
      const url = new URL(href, window.location.href);
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      setPhase('run');
      // ако нищо не се смени (напр. отказано) — прибираме я
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setPhase('idle'), 8000);
    };
    document.addEventListener('click', on);
    return () => document.removeEventListener('click', on);
  }, []);

  // страницата дойде → довършваме и скриваме
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    setPhase((p) => (p === 'run' ? 'done' : p));
    const t = setTimeout(() => setPhase('idle'), 350);
    return () => clearTimeout(t);
  }, [path, query]);

  if (phase === 'idle') return null;
  return <div className="nav-progress" data-phase={phase} aria-hidden />;
}
