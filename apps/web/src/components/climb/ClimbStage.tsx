'use client';

/**
 * ТЕСТ (/test): нов вид на „Към върха“ — герои с тяло и стави, сцена на слоеве, камера и ефекти.
 * Без сървър и без въпроси: играта върви сама или с бутоните. Правилата на истинската игра не са пипани.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { sanitizeAvatar } from '@belmaster/shared';
import { avatarSvg } from '@/components/avatar/UserAvatar';

const W = 1280;
const H = 720;
const GROUND = 650;
const N = 10;
const NS = 'http://www.w3.org/2000/svg';
const INK = '#141a33';
const COLORS = ['#4f8cff', '#ff6b6b'];
const WEAPONS = ['📕', '⚽'];

/** Къде стъпва герой на височина h; side = -1 (ляво) / +1 (дясно). */
function spot(side: number, h: number): [number, number] {
  if (h <= 0) return [640 + side * 545, GROUND];
  if (h >= N) return [640 + side * 36, GROUND - N * 43];
  return [640 + side * (88 + (N - h) * 49), GROUND - h * 43];
}

const ease = {
  out: (k: number) => 1 - (1 - k) ** 3,
  in: (k: number) => k * k * k,
  io: (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2),
  back: (k: number) => 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2,
  elastic: (k: number) => (k === 0 || k === 1 ? k : 2 ** (-10 * k) * Math.sin((k * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
  lin: (k: number) => k,
};

/** Стойностите на една „кукла“ — позиция, сплескване и ъгли на ставите (градуси). */
interface Rig {
  x: number; y: number; by: number; sx: number; sy: number; rot: number; head: number;
  afS: number; afE: number; abS: number; abE: number; lfH: number; lfK: number; lbH: number; lbK: number;
  flash: number; hammer: number; item: number;
}
const REST: Omit<Rig, 'x' | 'y'> = { by: 0, sx: 1, sy: 1, rot: 0, head: 0, afS: 8, afE: -10, abS: -8, abE: -10, lfH: -4, lfK: 4, lbH: 6, lbK: 2, flash: 0, hammer: 0, item: 0 };

interface Hero {
  side: number;
  face: number;
  rig: Rig;
  height: number;
  idle: boolean;
  shield: boolean;
  shieldUsed: boolean;
  steps: SVGGElement[];
  el: Record<string, SVGElement>;
}

export interface StageHud {
  heights: [number, number];
  msg: string | null;
  busy: boolean;
  shieldUsed: boolean;
  winner: number | null;
}

function Doll({ id, color, uri }: { id: string; color: string; uri: string }) {
  const limb = { fill: color, stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' as const };
  const dark = { fill: '#232a55', stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' as const };
  const arm = (k: string) => (
    <g data-j={`${k}S`} transform="translate(0 0)">
      <rect x="-7" y="-4" width="14" height="30" rx="7" {...limb} />
      <g data-j={`${k}E`} transform="translate(0 24)">
        <rect x="-6.5" y="-4" width="13" height="26" rx="6.5" {...limb} />
        <circle cx="0" cy="24" r="7.5" fill="#f4cfa6" stroke={INK} strokeWidth="3" />
        {k === 'af' && (
          <>
            <g data-j="hammer" opacity="0" transform="translate(0 24)">
              <rect x="-3.5" y="-46" width="7" height="54" rx="3" fill="#9a6a3c" stroke={INK} strokeWidth="2.5" />
              <rect x="-17" y="-60" width="34" height="20" rx="5" fill="#c3cae6" stroke={INK} strokeWidth="2.5" />
              <rect x="-14" y="-57" width="28" height="5" rx="2" fill="#fff" opacity=".6" />
            </g>
            <text data-j="item" opacity="0" x="0" y="34" textAnchor="middle" fontSize="30">
              ●
            </text>
          </>
        )}
      </g>
    </g>
  );
  const leg = (k: string) => (
    <g data-j={`${k}H`}>
      <rect x="-8" y="-4" width="16" height="24" rx="8" {...dark} />
      <g data-j={`${k}K`} transform="translate(0 17)">
        <rect x="-7" y="-4" width="14" height="22" rx="7" {...dark} />
        <path d="M-8 15h14q9 0 11 7v3h-25z" fill="#f4f6ff" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        <path d="M-8 23h25v2.5h-25z" fill={color} />
      </g>
    </g>
  );
  return (
    <g data-hero={id}>
      <ellipse data-j="shadow" cx="0" cy="3" rx="34" ry="7" fill="#050818" opacity=".45" />
      <g data-j="root">
        <g transform="translate(-13 -73)">{arm('ab')}</g>
        <g transform="translate(-8 -34)">{leg('lb')}</g>
        <rect x="-27" y="-76" width="16" height="34" rx="7" fill="#f2b84b" stroke={INK} strokeWidth="3" />
        <g transform="translate(8 -34)">{leg('lf')}</g>
        <path d="M-21 -78q0-8 8-8h26q8 0 8 8v40q0 8-8 8h-26q-8 0-8-8z" {...limb} />
        <path d="M-21 -44h42v6q0 8-8 8h-26q-8 0-8-8z" fill="#000" opacity=".16" />
        <path d="M-13 -86q13 12 26 0" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        <path d="M-9 -56h18" stroke="#fff" strokeOpacity=".5" strokeWidth="3" strokeLinecap="round" />
        <g data-j="head">
          <image href={uri} x="-50" y="-178" width="100" height="100" transform="scale(-1 1)" />
        </g>
        <g transform="translate(14 -73)">{arm('af')}</g>
        <path data-j="flash" d="M-34 -176h68v180h-68z" fill="#fff" opacity="0" style={{ mixBlendMode: 'screen' }} />
      </g>
      <g data-j="shield" opacity="0">
        <circle cx="0" cy="-78" r="92" fill="url(#st-shield)" stroke="#9fe8ff" strokeWidth="3" strokeDasharray="14 9" className="st-spin" />
        <circle cx="0" cy="-78" r="92" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="1.5" />
      </g>
    </g>
  );
}

export function ClimbStage({ avatar, seed, onHud, control }: { avatar: unknown; seed: string; onHud: (h: StageHud) => void; control: React.MutableRefObject<{ act: (k: 'climb' | 'throw' | 'shield') => void; setAuto: (v: boolean) => void; reset: () => void } | null> }) {
  const svg = useRef<SVGSVGElement>(null);
  const uris = useMemo(() => {
    const mk = (a: unknown, s: string) => `data:image/svg+xml;utf8,${encodeURIComponent(avatarSvg(sanitizeAvatar(a, null, s), 'none', { noBg: true }))}`;
    return [mk(avatar, seed), mk(null, 'bot')];
  }, [avatar, seed]);
  const hud = useRef(onHud);
  hud.current = onHud;

  useEffect(() => {
    const root = svg.current!;
    const q = <T extends SVGElement>(s: string, from: ParentNode = root) => from.querySelector(s) as T;
    const cam = q<SVGGElement>('#st-cam'), fx = q<SVGGElement>('#st-fx'), stepsG = q<SVGGElement>('#st-steps'), flag = q<SVGPathElement>('#st-flag');
    const far = [q<SVGGElement>('#st-far1'), q<SVGGElement>('#st-far2'), q<SVGGElement>('#st-sky')];
    let alive = true, auto = true, busy = false, turn = 0, wait = 1.2, timeScale = 1, hitstop = 0, shake = 0, raf = 0, last = performance.now(), clock = 0, winner: number | null = null;
    const camS = { y: 360, z: 1, ty: 360, tz: 1 };

    const heroes: Hero[] = [-1, 1].map((side, i) => {
      const g = q<SVGGElement>(`[data-hero="h${i}"]`);
      const el: Record<string, SVGElement> = { g };
      g.querySelectorAll('[data-j]').forEach((n) => (el[(n as SVGElement).dataset.j!] = n as SVGElement));
      (el.item as SVGTextElement).textContent = WEAPONS[i];
      const [x, y] = spot(side, 0);
      return { side, face: -side, rig: { ...REST, x, y }, height: 0, idle: true, shield: false, shieldUsed: false, steps: [], el };
    });

    // ── малки помощници за анимация ──
    type Job = { t: number; d: number; fn: (k: number) => void; res: () => void };
    const jobs: Job[] = [];
    const run = (d: number, fn: (k: number) => void) => new Promise<void>((res) => jobs.push({ t: 0, d: d / 1000, fn, res }));
    const sleep = (ms: number) => run(ms, () => {});
    const to = (r: Rig, props: Partial<Rig>, d: number, e: (k: number) => number = ease.out) => {
      const keys = Object.keys(props) as (keyof Rig)[];
      const from = keys.map((k) => r[k]);
      return run(d, (k) => keys.forEach((key, i) => (r[key] = from[i] + ((props[key] as number) - from[i]) * e(k))));
    };

    // ── частици ──
    interface P { el: SVGElement; x: number; y: number; vx: number; vy: number; g: number; life: number; max: number; rot: number; vr: number; s: number; grow: number }
    const parts: P[] = [];
    const mk = (tag: string, attrs: Record<string, string | number>) => {
      const e = document.createElementNS(NS, tag);
      for (const k in attrs) e.setAttribute(k, String(attrs[k]));
      return e;
    };
    const puff = (x: number, y: number, n: number, color: string, speed = 120, size = 6, life = 0.6, g = 300, up = 1) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random() * 0.6);
        const el = mk('circle', { r: size * (0.5 + Math.random() * 0.7), fill: color });
        fx.appendChild(el);
        parts.push({ el, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - speed * 0.5 * up, g, life, max: life, rot: 0, vr: 0, s: 1, grow: 0.6 });
      }
    };
    const shards = (x: number, y: number, n: number, color: string) => {
      for (let i = 0; i < n; i++) {
        const el = mk('rect', { x: -6, y: -5, width: 8 + Math.random() * 10, height: 7 + Math.random() * 7, rx: 2, fill: color, stroke: INK, 'stroke-width': 2 });
        fx.appendChild(el);
        parts.push({ el, x: x + (Math.random() - 0.5) * 50, y, vx: (Math.random() - 0.5) * 320, vy: -120 - Math.random() * 220, g: 900, life: 0.9, max: 0.9, rot: Math.random() * 360, vr: (Math.random() - 0.5) * 900, s: 1, grow: 0 });
      }
    };
    const burst = (x: number, y: number, color = '#fff6c9') => {
      const star = mk('path', { d: 'M0-60 14-18 58-26 24 4 44 46 0 22-44 46-24 4-58-26-14-18Z', fill: color, stroke: '#fff', 'stroke-width': 3 });
      const ring = mk('circle', { r: 20, fill: 'none', stroke: '#fff', 'stroke-width': 8 });
      fx.append(star, ring);
      run(260, (k) => {
        star.setAttribute('transform', `translate(${x} ${y}) rotate(${k * 40}) scale(${0.3 + ease.out(k) * 1.1})`);
        star.setAttribute('opacity', String(1 - k * k));
        ring.setAttribute('transform', `translate(${x} ${y}) scale(${1 + ease.out(k) * 4})`);
        ring.setAttribute('opacity', String(1 - k));
      }).then(() => (star.remove(), ring.remove()));
    };
    const pop = (x: number, y: number, text: string, color: string, size = 44) => {
      x = Math.max(190, Math.min(W - 190, x));
      y = Math.max(70, y);
      const t = mk('text', { 'text-anchor': 'middle', 'font-size': size, 'font-weight': 900, fill: color, stroke: INK, 'stroke-width': 7, 'paint-order': 'stroke', 'stroke-linejoin': 'round', class: 'st-font' });
      t.textContent = text;
      fx.appendChild(t);
      run(1100, (k) => {
        const s = k < 0.18 ? ease.back(k / 0.18) : 1;
        t.setAttribute('transform', `translate(${x} ${y - 40 * ease.out(k)}) rotate(${-4 + k * 3}) scale(${s})`);
        t.setAttribute('opacity', String(k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1));
      }).then(() => t.remove());
    };
    const confetti = () => {
      for (let i = 0; i < 90; i++) {
        const el = mk('rect', { x: -5, y: -3, width: 10, height: 6, rx: 1.5, fill: ['#ffd84d', '#4f8cff', '#ff6b6b', '#5fe0d0', '#fff'][i % 5] });
        fx.appendChild(el);
        parts.push({ el, x: 640 + (Math.random() - 0.5) * 240, y: 150, vx: (Math.random() - 0.5) * 620, vy: -260 - Math.random() * 380, g: 420, life: 2.6, max: 2.6, rot: Math.random() * 360, vr: (Math.random() - 0.5) * 1000, s: 1, grow: 0 });
      }
    };

    // ── стъпала ──
    const addStep = (h: Hero, n: number) => {
      const [x, y] = spot(h.side, n);
      const g = mk('g', {}) as SVGGElement;
      g.innerHTML = `<path d="M-40 4h80v9q0 7-7 7h-66q-7 0-7-7z" fill="#8f96c4" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M-43 -1q0-5 5-5h76q5 0 5 5v7h-86z" fill="#e6e9fb" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M-34 -2h40" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/><path d="M-12 8v9M18 8v9" stroke="${INK}" stroke-opacity=".35" stroke-width="2"/>`;
      g.dataset.x = String(x);
      g.dataset.y = String(y);
      g.setAttribute('transform', `translate(${x} ${y}) scale(0)`);
      stepsG.appendChild(g);
      h.steps.push(g);
      return g;
    };
    const setStep = (g: SVGGElement, s: number, dy = 0) => g.setAttribute('transform', `translate(${g.dataset.x} ${Number(g.dataset.y) + dy}) scale(${s})`);

    const emit = (msg: string | null = null) => hud.current({ heights: [heroes[0].height, heroes[1].height], msg, busy, shieldUsed: heroes[0].shieldUsed, winner });
    const setShield = (h: Hero, on: boolean) => {
      h.shield = on;
      const s = h.el.shield;
      if (on) run(350, (k) => (s.setAttribute('opacity', String(k)), s.setAttribute('transform', `scale(${ease.back(k)})`)));
      else run(300, (k) => (s.setAttribute('opacity', String(1 - k)), s.setAttribute('transform', `scale(${1 + k * 0.5})`)));
    };

    // ── действия ──
    async function land(h: Hero) {
      const r = h.rig;
      puff(r.x, r.y, 9, '#e8e3f5', 110, 6, 0.5, 200, 0.4);
      shake = Math.max(shake, 0.12);
      await to(r, { sx: 1.22, sy: 0.76, lfH: -32, lfK: 62, lbH: -22, lbK: 58, by: 9 }, 80, ease.out);
      await to(r, { ...REST }, 420, ease.elastic);
    }
    async function hop(h: Hero, n: number, lift: number, dur: number, spin = 0) {
      const r = h.rig, [x0, y0] = [r.x, r.y], [x1, y1] = spot(h.side, n);
      await run(dur, (k) => {
        r.x = x0 + (x1 - x0) * k;
        r.y = y0 + (y1 - y0) * k - Math.sin(k * Math.PI) * lift;
        r.rot = spin * k;
        const v = Math.cos(k * Math.PI);
        r.sy = 1 + Math.abs(v) * 0.14;
        r.sx = 1 - Math.abs(v) * 0.09;
      });
      r.rot = 0;
      h.height = n;
    }
    async function climb(i: number) {
      const h = heroes[i], r = h.rig, n = h.height + 1;
      busy = true;
      h.idle = false;
      emit();
      if (h.shield) setShield(h, false);
      camS.tz = 1.1;
      if (n < N) {
        const step = addStep(h, n);
        const [sx, sy] = spot(h.side, n);
        r.hammer = 1;
        await to(r, { afS: -165, afE: -25, rot: -7, head: -6, by: -3 }, 200, ease.out);
        for (let b = 0; b < 3; b++) {
          await to(r, { afS: -55, afE: -5, rot: 9, by: 4, sy: 0.95 }, 85, ease.in);
          setStep(step, 0.45 + b * 0.28);
          puff(sx - h.side * 26, sy, 6, '#ffe27a', 190, 3.5, 0.35, 500);
          shake = Math.max(shake, 0.1);
          if (b < 2) await to(r, { afS: -165, afE: -25, rot: -7, by: -3, sy: 1 }, 150, ease.out);
        }
        run(260, (k) => setStep(step, 1, -10 * Math.sin(k * Math.PI) * (1 - k)));
        r.hammer = 0;
        await to(r, { ...REST }, 140, ease.out);
      }
      // клякане → скок → кацане
      await to(r, { sx: 1.16, sy: 0.8, by: 11, lfH: -38, lfK: 74, lbH: -30, lbK: 70, afS: 48, abS: 40, head: 5 }, 150, ease.out);
      to(r, { afS: -150, abS: -130, afE: -20, abE: -20, lfH: 16, lfK: 12, lbH: -26, lbK: 46, by: 0, head: -8 }, 160, ease.out);
      await hop(h, n, n >= N ? 96 : 74, 400);
      await land(h);
      pop(r.x, r.y - 190, n >= N ? 'ВРЪХ!' : '+1', '#fff', n >= N ? 54 : 38);
      if (n >= N) return win(i);
      h.idle = true;
      done();
    }
    async function knock(h: Hero, dir: number) {
      const r = h.rig;
      h.idle = false;
      if (h.height <= 0) {
        await to(r, { rot: dir * 16, by: 4, head: dir * 12, afS: -120, abS: -110 }, 110, ease.out);
        await to(r, { ...REST }, 420, ease.elastic);
        h.idle = true;
        return;
      }
      const step = h.steps.pop();
      if (step) {
        shards(Number(step.dataset.x), Number(step.dataset.y), 9, '#c9cdee');
        puff(Number(step.dataset.x), Number(step.dataset.y), 10, '#e8e3f5', 150, 7, 0.7, 200);
        step.remove();
      }
      to(r, { afS: -150, abS: -160, afE: -30, abE: -30, lfH: 30, lfK: 40, lbH: -34, lbK: 50, head: dir * 14 }, 140, ease.out);
      await hop(h, h.height - 1, 58, 520, dir * 360);
      await land(h);
      // „звездички“ над главата
      const stars = mk('text', { 'text-anchor': 'middle', 'font-size': 26 });
      stars.textContent = '💫';
      fx.appendChild(stars);
      run(700, (k) => (stars.setAttribute('transform', `translate(${r.x + Math.sin(k * 12) * 16} ${r.y - 150})`), stars.setAttribute('opacity', String(1 - k * k)))).then(() => stars.remove());
      h.idle = true;
    }
    async function fly(el: SVGElement, a: [number, number], b: [number, number], dur: number, lift: number, trail: string) {
      let acc = 0;
      await run(dur, (k) => {
        const x = a[0] + (b[0] - a[0]) * k, y = a[1] + (b[1] - a[1]) * k - Math.sin(k * Math.PI) * lift;
        el.setAttribute('transform', `translate(${x} ${y}) rotate(${k * 900})`);
        if (++acc % 2 === 0) {
          const t = mk('circle', { r: 9, fill: trail });
          fx.insertBefore(t, el);
          parts.push({ el: t, x, y, vx: 0, vy: 0, g: 0, life: 0.28, max: 0.28, rot: 0, vr: 0, s: 1, grow: -0.9 });
        }
      });
    }
    async function throwAt(i: number) {
      const a = heroes[i], b = heroes[1 - i], r = a.rig;
      busy = true;
      a.idle = false;
      emit();
      const reflect = b.shield, hit = !reflect && Math.random() < 0.62;
      camS.tz = 1.06;
      r.item = 1;
      await to(r, { rot: -16, afS: 150, afE: 40, abS: -50, lfH: -18, lbH: 20, by: 3, head: -8, sx: 0.96, sy: 1.03 }, 300, ease.out);
      await sleep(70);
      to(r, { rot: 14, afS: -95, afE: -8, abS: 60, lfH: 22, lbH: -16, head: 6 }, 95, ease.in);
      await sleep(70);
      r.item = 0;
      const p = mk('text', { 'text-anchor': 'middle', 'font-size': 40, 'dominant-baseline': 'central' });
      p.textContent = WEAPONS[i];
      fx.appendChild(p);
      const from: [number, number] = [r.x + a.face * 40, r.y - 120];
      const target: [number, number] = [b.rig.x, b.rig.y - 95];
      const missTo: [number, number] = [b.rig.x + a.face * 190, b.rig.y + 30];
      to(r, { ...REST }, 380, ease.elastic);
      await fly(p, from, hit || reflect ? target : missTo, 520, 150, COLORS[i]);
      if (reflect) {
        hitstop = 0.09;
        burst(target[0], target[1], '#bdf1ff');
        puff(target[0], target[1], 16, '#9fe8ff', 260, 5, 0.5, 100);
        shake = 0.3;
        setShield(b, false);
        pop(target[0], target[1] - 90, 'ОТБИТО!', '#9fe8ff');
        const back: [number, number] = [r.x, r.y - 95];
        await fly(p, target, back, 380, 110, '#9fe8ff');
        p.remove();
        await impact(a, -a.face);
        return done(i === 0 ? null : '🛡️ Щитът върна удара!');
      }
      if (hit) {
        p.remove();
        pop(target[0], target[1] - 90, 'УЦЕЛИ!', '#ffd84d');
        await impact(b, a.face);
        return done();
      }
      p.remove();
      puff(missTo[0], missTo[1], 6, '#e8e3f5', 90, 5, 0.4, 200);
      pop(b.rig.x, b.rig.y - 170, 'ПРОПУСК', '#c9d0ee', 34);
      if (a.shield) {
        setShield(a, false);
        pop(r.x, r.y - 190, 'ЩИТЪТ ТЕ ОПАЗИ', '#9fe8ff', 28);
        await sleep(500);
      } else {
        // загуба на равновесие
        await to(r, { rot: 14, afS: -140, abS: 130, head: 10 }, 160, ease.out);
        await to(r, { rot: -18, afS: 120, abS: -140, head: -12 }, 170, ease.io);
        await knock(a, -a.face);
      }
      a.idle = true;
      done();
    }
    async function impact(h: Hero, dir: number) {
      const r = h.rig;
      hitstop = 0.11;
      r.flash = 1;
      burst(r.x, r.y - 100);
      puff(r.x, r.y - 100, 14, '#fff3c4', 280, 5, 0.5, 300);
      shake = 0.5;
      camS.tz = 1.14;
      to(r, { flash: 0 }, 260, ease.out);
      await knock(h, dir);
    }
    function shieldUp(i: number) {
      const h = heroes[i];
      if (busy || h.shieldUsed || h.height <= 0) return;
      h.shieldUsed = true;
      setShield(h, true);
      puff(h.rig.x, h.rig.y - 62, 12, '#9fe8ff', 170, 4, 0.5, 0);
      emit(i === 0 ? '🛡️ Щитът е вдигнат (в играта другият не го вижда)' : null);
    }
    async function win(i: number) {
      winner = i;
      const h = heroes[i], r = h.rig;
      camS.tz = 1.28;
      emit(i === 0 ? '🏆 Ти стигна върха!' : '🏆 Бот Перко стигна върха!');
      for (let k = 0; k < 4; k++) {
        confetti();
        await to(r, { by: 8, sy: 0.84, sx: 1.12, afS: -40, abS: -40 }, 130);
        to(r, { afS: -170, abS: -170, afE: -15, abE: -15 }, 120);
        await run(360, (t) => ((r.by = -46 * Math.sin(t * Math.PI)), (r.sy = 1.08), (r.sx = 0.95)));
        await to(r, { ...REST }, 200, ease.elastic);
      }
      await sleep(1200);
      reset();
    }
    function done(msg: string | null = null) {
      busy = false;
      wait = 0.75;
      camS.tz = 1;
      emit(msg);
    }
    function reset() {
      jobs.length = 0;
      for (const p of parts) p.el.remove();
      parts.length = 0;
      fx.replaceChildren();
      stepsG.replaceChildren();
      heroes.forEach((h) => {
        const [x, y] = spot(h.side, 0);
        Object.assign(h.rig, REST, { x, y });
        h.height = 0;
        h.steps = [];
        h.idle = true;
        h.shield = h.shieldUsed = false;
        h.el.shield.setAttribute('opacity', '0');
      });
      busy = false;
      winner = null;
      turn = 0;
      wait = 1;
      camS.tz = 1;
      emit(null);
    }
    function bot(i: number) {
      const h = heroes[i], o = heroes[1 - i];
      if (!h.shieldUsed && h.height > 1 && Math.random() < 0.14) shieldUp(i);
      if (o.height > 0 && Math.random() < (o.height > h.height ? 0.5 : 0.24)) void throwAt(i);
      else void climb(i);
    }
    control.current = {
      act: (k) => {
        if (busy || winner != null) return;
        if (k === 'shield') return shieldUp(0);
        turn = 1;
        if (k === 'climb') void climb(0);
        else void throwAt(0);
      },
      setAuto: (v) => ((auto = v), (turn = 0)),
      reset,
    };

    // ── кадър ──
    const J = (el: SVGElement, t: string) => el.setAttribute('transform', t);
    function draw(h: Hero, t: number) {
      const r = h.rig, e = h.el, w = h.idle ? 1 : 0, ph = t * 2.6 + h.side;
      const sy = r.sy + Math.sin(ph) * 0.016 * w, bob = Math.sin(ph) * 1.2 * w;
      J(e.g, `translate(${r.x.toFixed(1)} ${r.y.toFixed(1)})`);
      J(e.root, `scale(${h.face * 0.98} 0.98) translate(0 ${(r.by + bob).toFixed(2)}) rotate(${r.rot.toFixed(1)} 0 -60) scale(${r.sx.toFixed(3)} ${sy.toFixed(3)})`);
      J(e.head, `rotate(${(r.head + Math.sin(ph * 0.7) * 1.6 * w).toFixed(2)} 0 -84)`);
      J(e.afS, `rotate(${(r.afS + Math.sin(ph) * 3 * w).toFixed(1)})`);
      J(e.afE, `translate(0 24) rotate(${r.afE.toFixed(1)})`);
      J(e.abS, `rotate(${(r.abS - Math.sin(ph) * 3 * w).toFixed(1)})`);
      J(e.abE, `translate(0 24) rotate(${r.abE.toFixed(1)})`);
      J(e.lfH, `rotate(${r.lfH.toFixed(1)})`);
      J(e.lfK, `translate(0 17) rotate(${r.lfK.toFixed(1)})`);
      J(e.lbH, `rotate(${r.lbH.toFixed(1)})`);
      J(e.lbK, `translate(0 17) rotate(${r.lbK.toFixed(1)})`);
      e.flash.setAttribute('opacity', r.flash.toFixed(2));
      e.hammer.setAttribute('opacity', String(r.hammer));
      e.item.setAttribute('opacity', String(r.item));
      const air = Math.max(0, Math.min(1, -r.by / 60));
      J(e.shadow, `scale(${1 - air * 0.4})`);
    }
    function frame(now: number) {
      if (!alive) return;
      raf = requestAnimationFrame(frame);
      const real = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (hitstop > 0) {
        hitstop -= real;
        timeScale = 0.04;
      } else timeScale = 1;
      const dt = real * timeScale;
      clock += real;
      for (const j of [...jobs]) {
        j.t += dt;
        const k = j.d <= 0 ? 1 : Math.min(1, j.t / j.d);
        j.fn(k);
        if (k >= 1) {
          const i = jobs.indexOf(j);
          if (i >= 0) jobs.splice(i, 1);
          j.res();
        }
      }
      for (const p of parts) {
        p.life -= dt;
        p.vy += p.g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        const k = Math.max(0, p.life / p.max);
        p.el.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${p.rot.toFixed(0)}) scale(${Math.max(0.01, 1 + p.grow * (1 - k)).toFixed(2)})`);
        p.el.setAttribute('opacity', (k * (p.grow < 0 ? 0.55 : 1)).toFixed(2));
      }
      for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0) (parts[i].el.remove(), parts.splice(i, 1));
      if (!busy && winner == null) {
        wait -= dt;
        if (wait <= 0 && (auto || turn === 1)) {
          const i = turn;
          turn = auto ? 1 - turn : 0;
          wait = 0.6;
          bot(i);
        }
      }
      heroes.forEach((h) => draw(h, clock));
      // знаме
      let d = 'M0 0';
      const bottom: string[] = [];
      for (let x = 0; x <= 78; x += 13) {
        const wv = Math.sin(clock * 6 - x * 0.09) * 5 * (x / 78);
        d += ` L${x} ${wv.toFixed(1)}`;
        bottom.unshift(`L${x} ${(34 + wv * 0.8 - (x === 78 ? 8 : 0)).toFixed(1)}`);
      }
      flag.setAttribute('d', `${d} L64 ${(17 + Math.sin(clock * 6 - 6) * 4).toFixed(1)} ${bottom.join(' ')} Z`);
      // камера: следи водещия, приближава при действие, тресе при удар
      const lead = Math.min(heroes[0].rig.y, heroes[1].rig.y), low = Math.max(heroes[0].rig.y, heroes[1].rig.y);
      camS.ty = lead * 0.6 + low * 0.4 - 90;
      camS.z += (camS.tz - camS.z) * Math.min(1, real * 3);
      const half = H / 2 / camS.z;
      const cy = Math.max(half, Math.min(H - half, camS.ty));
      camS.y += (cy - camS.y) * Math.min(1, real * 2.4);
      shake = Math.max(0, shake - real * 1.6);
      const sh = shake * shake * 46, ox = (Math.random() - 0.5) * sh, oy = (Math.random() - 0.5) * sh;
      const cyc = Math.max(half, Math.min(H - half, camS.y));
      J(cam, `translate(${(W / 2 + ox).toFixed(1)} ${(H / 2 + oy).toFixed(1)}) scale(${camS.z.toFixed(3)}) translate(${-W / 2} ${(-cyc).toFixed(1)})`);
      const py = cyc - H / 2;
      J(far[0], `translate(0 ${(py * 0.55).toFixed(1)})`);
      J(far[1], `translate(0 ${(py * 0.35).toFixed(1)})`);
      J(far[2], `translate(0 ${(py * 0.8).toFixed(1)})`);
    }
    emit(null);
    raf = requestAnimationFrame(frame);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      control.current = null;
    };
  }, [control]);

  const stars = useMemo(() => Array.from({ length: 46 }, (_, i) => ({ x: (i * 173.3) % W, y: (i * 97.7) % 330, r: 0.8 + ((i * 7) % 5) * 0.35, d: (i % 7) * 0.5 })), []);
  const pines = (xs: number[], y: number, s: number, fill: string) => xs.map((x, i) => <path key={i} d={`M${x} ${y}l${-26 * s} 0 ${14 * s} ${-26 * s}h${-9 * s}l${13 * s} ${-26 * s}h${-7 * s}l${15 * s} ${-34 * s} ${15 * s} ${34 * s}h${-7 * s}l${13 * s} ${26 * s}h${-9 * s}l${14 * s} ${26 * s}z`} fill={fill} />);

  return (
    <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full select-none" role="img" aria-label="Към върха">
      <defs>
        <linearGradient id="st-skyg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#070b25" />
          <stop offset=".42" stopColor="#1c2763" />
          <stop offset=".72" stopColor="#5a4d9c" />
          <stop offset=".9" stopColor="#e58a6b" />
          <stop offset="1" stopColor="#ffc48a" />
        </linearGradient>
        <radialGradient id="st-sun">
          <stop offset="0" stopColor="#fff7df" />
          <stop offset=".18" stopColor="#ffe2a6" />
          <stop offset=".4" stopColor="#ffb27a" stopOpacity=".55" />
          <stop offset="1" stopColor="#ff9a6a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="st-mtL" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4b4f93" />
          <stop offset="1" stopColor="#262a5e" />
        </linearGradient>
        <linearGradient id="st-mtR" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b08fb4" />
          <stop offset=".45" stopColor="#6a639f" />
          <stop offset="1" stopColor="#353a75" />
        </linearGradient>
        <linearGradient id="st-mist" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset=".6" stopColor="#ffd9c2" stopOpacity=".22" />
          <stop offset="1" stopColor="#ffd9c2" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="st-shield">
          <stop offset=".55" stopColor="#9fe8ff" stopOpacity=".05" />
          <stop offset="1" stopColor="#9fe8ff" stopOpacity=".38" />
        </radialGradient>
        <radialGradient id="st-vig">
          <stop offset=".6" stopColor="#060918" stopOpacity="0" />
          <stop offset="1" stopColor="#060918" stopOpacity=".55" />
        </radialGradient>
        <clipPath id="st-clip">
          <rect width={W} height={H} rx="22" />
        </clipPath>
      </defs>
      <style>{`.st-tw{animation:st-tw 3.2s ease-in-out infinite}.st-drift{animation:st-drift 90s linear infinite}.st-drift2{animation:st-drift 140s linear infinite reverse}.st-spin{animation:st-spin 9s linear infinite;transform-box:fill-box;transform-origin:center}.st-font{font-family:'Unbounded Variable','Nunito Variable',sans-serif}.st-ray{animation:st-ray 7s ease-in-out infinite alternate;transform-origin:1010px 520px}@keyframes st-tw{50%{opacity:.25}}@keyframes st-drift{to{transform:translateX(-1280px)}}@keyframes st-spin{to{transform:rotate(360deg)}}@keyframes st-ray{to{transform:rotate(4deg);opacity:.5}}`}</style>
      <g clipPath="url(#st-clip)">
        <g id="st-cam">
          <g id="st-sky">
            <rect x="-200" y="-300" width={W + 400} height={H + 500} fill="url(#st-skyg)" />
            {stars.map((s, i) => (
              <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" className="st-tw" style={{ animationDelay: `${s.d}s` }} />
            ))}
            <circle cx="1010" cy="520" r="330" fill="url(#st-sun)" />
            <g className="st-ray" opacity=".3">
              {[-58, -34, -12, 10, 30].map((a) => (
                <path key={a} d="M1010 520l-40 -900h80z" fill="#ffe2b0" opacity=".16" transform={`rotate(${a} 1010 520)`} />
              ))}
            </g>
            <circle cx="1010" cy="520" r="54" fill="#fff4d6" />
          </g>
          <g id="st-far2">
            <path d="M-80 600 90 380l70 70 120-190 110 150 80-70 150 190 120-150 110 110 130-230 120 170 90-90 170 240V760H-80z" fill="#2b2f70" />
            <path d="M280 260l-34 54 26-10 14 20 18-22 22 8zM1000 330l-36 64 30-12 12 18 16-20 24 10z" fill="#c9cdf2" opacity=".7" />
            <g className="st-drift" opacity=".5">
              {[60, 520, 980, 1340, 1800, 2260].map((x, i) => (
                <path key={i} d={`M${x} ${150 + (i % 3) * 46}q28-30 62-10 30-26 62 2 36-6 44 22h-190q-6-14 22-14z`} fill="#fff" opacity=".5" />
              ))}
            </g>
          </g>
          <g id="st-far1">
            <path d="M-80 660 60 500l90 60 110-150 120 130 90-60 130 180H-80zM700 660l150-190 100 90 120-170 130 150 160 120z" fill="#1d2157" />
            <g className="st-drift2" opacity=".65">
              {[200, 760, 1300, 1860, 2400].map((x, i) => (
                <path key={i} d={`M${x} ${300 + (i % 2) * 70}q34-34 76-12 36-30 74 2 42-6 52 26h-226q-8-16 24-16z`} fill="#ffe6d6" opacity=".55" />
              ))}
            </g>
          </g>
          {/* планината */}
          <path d="M640 206 545 222 10 690H640z" fill="url(#st-mtL)" />
          <path d="M640 206 735 222 1270 690H640z" fill="url(#st-mtR)" />
          <path d="M545 222q14-12 36-12h118q22 0 36 12l68 60-34-10-26 26-34-22-38 30-32-28-34 24-30-26-30 12z" fill="#f4f6ff" />
          <path d="M545 222q14-12 36-12h59v74l-34 24-30-26-30 12-69-12z" fill="#b9c0ee" opacity=".55" />
          <path d="M735 222 1270 690" stroke="#ffd0a8" strokeOpacity=".75" strokeWidth="4" fill="none" />
          <g stroke="#0d1136" strokeOpacity=".22" strokeWidth="3" fill="none" strokeLinecap="round">
            <path d="M420 400l70 30 40-26M300 520l90 34 60-30 70 40M640 330v90l-40 60 30 80M800 420l-60 34 30 70M940 560l-80 20-50-40M520 610l80 20" />
          </g>
          <g fill="#fff" opacity=".07">
            <path d="M640 206 735 222 900 370 760 340 700 420z" />
          </g>
          <rect x="560" y="198" width="160" height="16" rx="7" fill="#e6e9fb" stroke={INK} strokeWidth="3" />
          <rect x="560" y="212" width="160" height="9" fill="#8f96c4" stroke={INK} strokeWidth="3" />
          <path d="M640 198V104" stroke="#3a2a1c" strokeWidth="6" strokeLinecap="round" />
          <circle cx="640" cy="100" r="6" fill="#ffd84d" stroke={INK} strokeWidth="2.5" />
          <g transform="translate(643 108)">
            <path id="st-flag" fill="#ffd84d" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          </g>
          <g id="st-steps" />
          {pines([215, 1065], 668, 1.05, '#141a52')}
          <Doll id="h0" color={COLORS[0]} uri={uris[0]} />
          <Doll id="h1" color={COLORS[1]} uri={uris[1]} />
          <g id="st-fx" />
          <rect x="-200" y="520" width={W + 400} height="180" fill="url(#st-mist)" />
          <path d="M-200 668q340-30 640 4t880-10v200H-200z" fill="#090c2b" />
          {pines([-40, 20, 1262, 1322], 706, 1.7, '#070a24')}
        </g>
        <rect width={W} height={H} fill="url(#st-vig)" pointerEvents="none" />
      </g>
    </svg>
  );
}

export function ClimbStageDemo({ avatar, seed, name }: { avatar: unknown; seed: string; name: string }) {
  const control = useRef<{ act: (k: 'climb' | 'throw' | 'shield') => void; setAuto: (v: boolean) => void; reset: () => void } | null>(null);
  const [hud, setHud] = useState<StageHud>({ heights: [0, 0], msg: null, busy: false, shieldUsed: false, winner: null });
  const [auto, setAuto] = useState(true);
  const plate = (i: number, label: string) => (
    <div className="stg-plate" data-side={i} style={{ '--c': COLORS[i] } as React.CSSProperties}>
      <b className="ln-display">{label}</b>
      <span className="stg-pips">
        {Array.from({ length: N }, (_, k) => (
          <i key={k} data-on={k < hud.heights[i]} />
        ))}
      </span>
      <em className="ln-display">{hud.heights[i]}/{N}</em>
    </div>
  );
  return (
    <div className="stg">
      <div className="stg-top">
        {plate(0, name)}
        <span className="ln-display stg-vs">VS</span>
        {plate(1, 'Бот Перко')}
      </div>
      <div className="stg-frame">
        <ClimbStage avatar={avatar} seed={seed} onHud={setHud} control={control} />
        {hud.msg && <p className="stg-msg ln-display">{hud.msg}</p>}
      </div>
      <div className="stg-bar">
        {auto ? (
          <p className="text-sm font-bold text-muted">Играта върви сама, за да видиш анимациите.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button disabled={hud.busy} onClick={() => control.current?.act('climb')} className="ln-btn ln-btn-primary ln-btn-sm">⛏ Качи се</button>
            <button disabled={hud.busy} onClick={() => control.current?.act('throw')} className="ln-btn ln-btn-ghost ln-btn-sm">🎯 Хвърли</button>
            <button disabled={hud.busy || hud.shieldUsed || hud.heights[0] === 0} onClick={() => control.current?.act('shield')} className="ln-btn ln-btn-ghost ln-btn-sm">🛡 Щит</button>
          </div>
        )}
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => {
              const v = !auto;
              setAuto(v);
              control.current?.setAuto(v);
            }}
            className="ln-btn ln-btn-ghost ln-btn-sm"
          >
            {auto ? 'Играй сам' : 'Пусни автоматично'}
          </button>
          <button onClick={() => control.current?.reset()} className="ln-btn ln-btn-ghost ln-btn-sm">↻</button>
        </div>
      </div>
    </div>
  );
}
