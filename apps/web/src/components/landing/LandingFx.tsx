'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

/** Навигация: става плътна при скрол. */
export function Nav({ children }: { children: ReactNode }) {
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const f = () => setSolid(window.scrollY > 30);
    f();
    window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, []);
  return (
    <header className="ln-nav" data-solid={solid}>
      {children}
    </header>
  );
}

/** Герой: фонът се мести леко с мишката + носещи се искрици. */
export function Hero({ children }: { children: ReactNode }) {
  const root = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = root.current!;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--px', String(((e.clientX - r.left) / r.width - 0.5) * 2));
      el.style.setProperty('--py', String(((e.clientY - r.top) / r.height - 0.5) * 2));
    };
    el.addEventListener('pointermove', move);
    // искрици
    const c = canvas.current!;
    const g = c.getContext('2d')!;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0, h = 0, raf = 0;
    const fit = () => {
      const d = Math.min(2, window.devicePixelRatio);
      w = c.clientWidth;
      h = c.clientHeight;
      c.width = w * d;
      c.height = h * d;
      g.setTransform(d, 0, 0, d, 0, 0);
    };
    fit();
    window.addEventListener('resize', fit);
    const N = Math.min(90, Math.round(window.innerWidth / 16));
    const ps = Array.from({ length: N }, () => ({ x: Math.random(), y: Math.random(), r: 0.6 + Math.random() * 2.2, v: 0.02 + Math.random() * 0.06, p: Math.random() * 6.28, gold: Math.random() < 0.45 }));
    let last = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      g.clearRect(0, 0, w, h);
      for (const p of ps) {
        p.y -= p.v * dt;
        p.x += Math.sin(now / 1800 + p.p) * 0.00025;
        if (p.y < -0.05) {
          p.y = 1.05;
          p.x = Math.random();
        }
        const a = (0.35 + 0.65 * Math.abs(Math.sin(now / 900 + p.p))) * Math.min(1, (1 - p.y) * 3);
        const x = p.x * w, y = p.y * h;
        const grd = g.createRadialGradient(x, y, 0, x, y, p.r * 5);
        grd.addColorStop(0, p.gold ? `rgba(255,220,110,${a})` : `rgba(170,255,110,${a})`);
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grd;
        g.beginPath();
        g.arc(x, y, p.r * 5, 0, 6.28);
        g.fill();
      }
    };
    if (!reduce) raf = requestAnimationFrame(tick);
    return () => {
      el.removeEventListener('pointermove', move);
      window.removeEventListener('resize', fit);
      cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <section ref={root} className="ln-hero">
      <div className="ln-hero-glow" />
      <canvas ref={canvas} className="ln-embers" />
      <div className="ln-grain" />
      {children}
    </section>
  );
}

/** Появява се при скрол. */
export function Reveal({ children, delay = 0, className = '', as: Tag = 'div' }: { children: ReactNode; delay?: number; className?: string; as?: 'div' | 'li' | 'section' }) {
  const ref = useRef<HTMLElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setOn(true), io.disconnect()), { threshold: 0.18 });
    io.observe(ref.current!);
    return () => io.disconnect();
  }, []);
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Tag ref={ref as any} className={`ln-reveal ${className}`} data-on={on} style={{ '--d': `${delay}s` } as CSSProperties}>
      {children}
    </Tag>
  );
}

/** Число, което се „навърта“ при появяване. */
export function CountUp({ to, suffix = '' }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (now: number) => {
        const k = Math.min(1, (now - t0) / 1600);
        setV(Math.round(to * (1 - (1 - k) ** 4)));
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    io.observe(ref.current!);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to]);
  return (
    <span ref={ref}>
      {v.toLocaleString('bg-BG')}
      {suffix}
    </span>
  );
}

/** Карта, която се накланя към мишката (3D) и блести. */
export function Tilt({ children, className = '', style, href }: { children: ReactNode; className?: string; style?: CSSProperties; href: string }) {
  const ref = useRef<HTMLAnchorElement>(null);
  return (
    <a
      ref={ref}
      href={href}
      className={className}
      style={style}
      onPointerMove={(e) => {
        const r = ref.current!.getBoundingClientRect();
        ref.current!.style.setProperty('--rx', String(((e.clientX - r.left) / r.width - 0.5) * 2));
        ref.current!.style.setProperty('--ry', String(((e.clientY - r.top) / r.height - 0.5) * 2));
      }}
      onPointerLeave={() => {
        ref.current!.style.setProperty('--rx', '0');
        ref.current!.style.setProperty('--ry', '0');
      }}
    >
      {children}
    </a>
  );
}
