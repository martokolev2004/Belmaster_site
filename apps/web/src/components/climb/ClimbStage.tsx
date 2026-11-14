'use client';

/**
 * Сцената на „Към върха“: герои с тяло и стави, планина на слоеве, камера и ефекти.
 * Управлява се от състоянието на играта (ClimbState) — правилата са на сървъра, тук са само анимациите.
 * Старата сцена е запазена в ClimbScene.tsx (резервен вариант).
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { CLIMB, CLIMB_CHAT, sanitizeAvatar, weaponById, type ClimbOutcome, type ClimbPlayer, type ClimbState, type ClimbTheme } from '@belmaster/shared';
import { avatarSvg } from '@/components/avatar/UserAvatar';

const W = 1280;
const H = 720;
const GROUND = 650;
const N = CLIMB.STEPS;
const NS = 'http://www.w3.org/2000/svg';
const INK = '#141a33';

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
const REST: Omit<Rig, 'x' | 'y'> = { by: 0, sx: 1, sy: 1, rot: 0, head: 0, afS: -9, afE: -7, abS: 9, abE: 7, lfH: -4, lfK: 4, lbH: 6, lbK: 2, flash: 0, hammer: 0, item: 0 };

interface Hero {
  side: number;
  face: number;
  rig: Rig;
  height: number;
  idle: boolean;
  /** щитът се вижда на екрана (своят — винаги; чуждият — само за миг, когато отбие удар) */
  shield: boolean;
  steps: SVGGElement[];
  el: Record<string, SVGElement>;
}

/** Какво може да прави сцената — вика се от обвивката според състоянието на играта. */
interface StageApi {
  play: (outcomes: ClimbOutcome[], after: number[], sideOf: (uid: string) => number, me: number) => Promise<void>;
  sync: (heights: number[]) => void;
  shield: (side: number, on: boolean) => void;
  finish: (side: number | null) => void;
  busy: () => boolean;
}

type StepKind = 'stone' | 'wood' | 'ice';
interface Look {
  sky: string[]; sun: string; glow: string; sunAt: [number, number]; disc: number; rays: boolean; stars: boolean;
  far2: string; tip: string | null; far1: string; cloud2: string; cloud1: string;
  mtL: [string, string]; mtR: [string, string, string]; rim: string; crack: string; crackW: number; crackO: number;
  cap: string; capShade: string; plat: [string, string]; flag: string;
  flora: 'pine' | 'cactus' | 'dead'; treeMid: string; treeFg: string; ground: string; mist: string; vig: string;
  step: StepKind; shard: string; aurora: boolean; strata: boolean;
}
/** Трите карти: „Снежният връх“ (залез), „Червеният каньон“ и „Леденият връх“ (нощ със северно сияние). */
const LOOKS: Record<ClimbTheme, Look> = {
  dusk: {
    sky: ['#070b25', '#1c2763', '#5a4d9c', '#e58a6b', '#ffc48a'], sun: '#fff4d6', glow: '#ffb27a', sunAt: [1010, 520], disc: 54, rays: true, stars: true,
    far2: '#2b2f70', tip: '#c9cdf2', far1: '#1d2157', cloud2: '#ffffff', cloud1: '#ffe6d6',
    mtL: ['#4b4f93', '#262a5e'], mtR: ['#b08fb4', '#6a639f', '#353a75'], rim: '#ffd0a8', crack: '#0d1136', crackW: 3, crackO: 0.22,
    cap: '#f4f6ff', capShade: '#b9c0ee', plat: ['#e6e9fb', '#8f96c4'], flag: '#ffd84d',
    flora: 'pine', treeMid: '#141a52', treeFg: '#070a24', ground: '#090c2b', mist: '#ffd9c2', vig: '#060918',
    step: 'stone', shard: '#c9cdee', aurora: false, strata: false,
  },
  canyon: {
    sky: ['#3b2a6e', '#8a4a8e', '#e0707a', '#ffa868', '#ffe0a8'], sun: '#fff6d8', glow: '#ffc27a', sunAt: [300, 250], disc: 46, rays: true, stars: false,
    far2: '#b0566a', tip: null, far1: '#7c3655', cloud2: '#ffe9d2', cloud1: '#ffd9bd',
    mtL: ['#c2603f', '#7a3238'], mtR: ['#f3a569', '#cf6c42', '#86383c'], rim: '#ffe2ae', crack: '#4a1620', crackW: 3, crackO: 0.3,
    cap: '#f6c890', capShade: '#d98f58', plat: ['#f6dcae', '#b9814f'], flag: '#4f8cff',
    flora: 'cactus', treeMid: '#5a2440', treeFg: '#2a1026', ground: '#2a1026', mist: '#ffd2a0', vig: '#1a0a1c',
    step: 'wood', shard: '#b9814f', aurora: false, strata: true,
  },
  night: {
    sky: ['#020815', '#062035', '#0b3a52', '#14576a', '#2a8a8a'], sun: '#f2fbff', glow: '#7fe8d0', sunAt: [300, 190], disc: 38, rays: false, stars: true,
    far2: '#0d2c4a', tip: '#d8f4ff', far1: '#081d36', cloud2: '#bfeee8', cloud1: '#9fd8e0',
    mtL: ['#3f7fa8', '#143a5e'], mtR: ['#c4ecf7', '#5fa6c9', '#1d4f78'], rim: '#d6fbff', crack: '#062035', crackW: 3, crackO: 0.22,
    cap: '#ffffff', capShade: '#a9dcf0', plat: ['#eafcff', '#7fc4dc'], flag: '#ff6b6b',
    flora: 'pine', treeMid: '#0a2440', treeFg: '#03101f', ground: '#041426', mist: '#9ff0e0', vig: '#020a14',
    step: 'ice', shard: '#bfeeff', aurora: true, strata: false,
  },
};
const STEP_ART: Record<StepKind, string> = {
  stone: `<path d="M-40 4h80v9q0 7-7 7h-66q-7 0-7-7z" fill="#8f96c4" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M-43 -1q0-5 5-5h76q5 0 5 5v7h-86z" fill="#e6e9fb" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M-34 -2h40" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/><path d="M-12 8v9M18 8v9" stroke="${INK}" stroke-opacity=".35" stroke-width="2"/>`,
  wood: `<path d="M-30 6l-8 22M30 6l8 22" stroke="#5a3520" stroke-width="7" stroke-linecap="round"/><path d="M-30 6l-8 22M30 6l8 22" stroke="#8a5a34" stroke-width="3" stroke-linecap="round"/><rect x="-44" y="-6" width="88" height="15" rx="4" fill="#d9a066" stroke="#2a1420" stroke-width="3"/><path d="M-44 2h88" stroke="#2a1420" stroke-opacity=".3" stroke-width="2"/><path d="M-16 -6v15M14 -6v15" stroke="#2a1420" stroke-opacity=".45" stroke-width="2"/><path d="M-38 -2h18M20 -2h14" stroke="#ffe0b0" stroke-width="2.5" stroke-linecap="round"/><circle cx="-34" cy="5" r="1.8" fill="#2a1420"/><circle cx="34" cy="5" r="1.8" fill="#2a1420"/>`,
  ice: `<path d="M-30 14l5 15 6-15M6 14l5 19 6-19M26 14l4 11 5-11" fill="#c9f3ff" stroke="#0a2a48" stroke-width="2.5" stroke-linejoin="round"/><path d="M-40 4h80v6q0 7-7 7h-66q-7 0-7-7z" fill="#6fc3e6" stroke="#0a2a48" stroke-width="3" stroke-linejoin="round"/><path d="M-43 -1q0-5 5-5h76q5 0 5 5v7h-86z" fill="#e6fbff" stroke="#0a2a48" stroke-width="3" stroke-linejoin="round"/><path d="M-34 -2h26M4 -2h10" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/><path d="M-20 9l10 5M12 8l12 6" stroke="#fff" stroke-opacity=".7" stroke-width="2" stroke-linecap="round"/>`,
};

function Doll({ id, color, uri, label, gid }: { id: string; color: string; uri: string; label: string; gid: string }) {
  const limb = { fill: color, stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' as const };
  const dark = { fill: '#232a55', stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' as const };
  const arm = (k: string) => (
    <g data-j={`${k}S`} transform="translate(0 0)">
      <rect x="-6.5" y="-5" width="13" height="30" rx="6.5" {...limb} />
      <g data-j={`${k}E`} transform="translate(0 24)">
        <rect x="-6" y="-4" width="12" height="24" rx="6" {...limb} />
        <circle cx="0" cy="22" r="7" fill="#f4cfa6" stroke={INK} strokeWidth="3" />
        {k === 'af' && (
          <>
            <g data-j="hammer" opacity="0" transform="translate(0 22) rotate(180)">
              <rect x="-4" y="-30" width="8" height="40" rx="3.5" fill="#9a6a3c" stroke={INK} strokeWidth="2.5" />
              <rect x="-20" y="-50" width="40" height="24" rx="6" fill="#c3cae6" stroke={INK} strokeWidth="3" />
              <rect x="-16" y="-46" width="32" height="5" rx="2.5" fill="#fff" opacity=".6" />
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
        <g transform="translate(-22 -75)">{arm('ab')}</g>
        <g transform="translate(-8 -34)">{leg('lb')}</g>
        <rect x="-16" y="-80" width="32" height="40" rx="9" fill="#f2b84b" stroke={INK} strokeWidth="3" />
        <g transform="translate(8 -34)">{leg('lf')}</g>
        <path d="M-23 -74q0-12 12-12h22q12 0 12 12v36q0 8-8 8h-30q-8 0-8-8z" {...limb} />
        <path d="M-21 -44h42v6q0 8-8 8h-26q-8 0-8-8z" fill="#000" opacity=".16" />
        <path d="M-13 -86q13 12 26 0" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        <path d="M-9 -56h18" stroke="#fff" strokeOpacity=".5" strokeWidth="3" strokeLinecap="round" />
        <g data-j="head">
          <rect x="-6" y="-96" width="12" height="16" rx="5" fill="#e9b98c" stroke={INK} strokeWidth="3" />
          <image href={uri} x="-52" y="-171" width="104" height="104" transform="scale(-1 1)" />
        </g>
        <g transform="translate(22 -75)">{arm('af')}</g>
        <path data-j="flash" d="M-34 -176h68v180h-68z" fill="#fff" opacity="0" style={{ mixBlendMode: 'screen' }} />
      </g>
      <g data-j="tag" transform="translate(0 -196)">
        <rect x={-(label.length * 4.6 + 14)} y="-13" width={label.length * 9.2 + 28} height="26" rx="13" fill="#0b1030" fillOpacity=".78" stroke={color} strokeWidth="2.5" />
        <text x="0" y="5" textAnchor="middle" fontSize="15" fontWeight="800" fill="#fff">
          {label}
        </text>
        <text data-j="crown" x="0" y="-22" textAnchor="middle" fontSize="34" opacity="0">
          👑
        </text>
      </g>
      <g data-j="shield" opacity="0">
        <circle cx="0" cy="-78" r="92" fill={`url(#st-shield-${gid})`} stroke="#9fe8ff" strokeWidth="3" strokeDasharray="14 9" className="st-spin" />
        <circle cx="0" cy="-78" r="92" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="1.5" />
      </g>
    </g>
  );
}

export function ClimbStage({ state, chat = [] }: { state: ClimbState; chat?: { uid: string; key: string; at: number }[] }) {
  const svg = useRef<SVGSVGElement>(null);
  const gid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const api = useRef<StageApi | null>(null);
  const players = state.players;
  const theme = LOOKS[state.theme] ?? LOOKS.dusk;
  const heights = players.map((p) => p.height);
  const me = Math.max(0, players.findIndex((p) => p.uid === state.you));
  const [shown, setShown] = useState<number[]>(heights);
  const uris = useMemo(
    () => players.map((p) => `data:image/svg+xml;utf8,${encodeURIComponent(avatarSvg(sanitizeAvatar(p.avatar, null, p.isBot ? 'bot' : p.uid), 'none', { noBg: true }))}`),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [players.map((p) => `${p.uid}:${JSON.stringify(p.avatar)}`).join('|')],
  );
  const live = useRef({ players, setShown, look: theme });
  live.current = { players, setShown, look: theme };

  useEffect(() => {
    const root = svg.current!;
    const q = <T extends SVGElement>(s: string, from: ParentNode = root) => from.querySelector(s) as T;
    if (!root.querySelector('[data-hero="h1"]')) return;
    const cam = q<SVGGElement>('#st-cam'), fx = q<SVGGElement>('#st-fx'), stepsG = q<SVGGElement>('#st-steps'), flag = q<SVGPathElement>('#st-flag');
    const far = [q<SVGGElement>('#st-far1'), q<SVGGElement>('#st-far2'), q<SVGGElement>('#st-sky')];
    let alive = true, busy = false, timeScale = 1, hitstop = 0, shake = 0, raf = 0, last = performance.now(), clock = 0, me = 0, cheer = 0;
    const camS = { y: 360, z: 1, ty: 360, tz: 1 };

    const heroes: Hero[] = [-1, 1].map((side, i) => {
      const g = q<SVGGElement>(`[data-hero="h${i}"]`);
      const el: Record<string, SVGElement> = { g };
      g.querySelectorAll('[data-j]').forEach((n) => (el[(n as SVGElement).dataset.j!] = n as SVGElement));
      const [x, y] = spot(side, 0);
      return { side, face: -side, rig: { ...REST, x, y }, height: 0, idle: true, shield: false, steps: [], el };
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
    const burst = (x: number, y: number, color = '#fff6c9', size = 1) => {
      const star = mk('path', { d: 'M0-60 14-18 58-26 24 4 44 46 0 22-44 46-24 4-58-26-14-18Z', fill: color, stroke: '#fff', 'stroke-width': 3 });
      const ring = mk('circle', { r: 20, fill: 'none', stroke: '#fff', 'stroke-width': 8 });
      fx.append(star, ring);
      run(260, (k) => {
        star.setAttribute('transform', `translate(${x} ${y}) rotate(${k * 40}) scale(${(0.3 + ease.out(k) * 1.1) * size})`);
        star.setAttribute('opacity', String(1 - k * k));
        ring.setAttribute('transform', `translate(${x} ${y}) scale(${(1 + ease.out(k) * 4) * size})`);
        ring.setAttribute('opacity', String(1 - k));
      }).then(() => (star.remove(), ring.remove()));
    };
    const pop = (x: number, y: number, text: string, color: string, size = 44) => {
      const half = Math.min(W / 2 - 20, text.length * size * 0.5 + 70);
      x = Math.max(half, Math.min(W - half, x));
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
      g.innerHTML = `<g transform="translate(0 8)">${STEP_ART[live.current.look.step]}</g>`; // горният ръб точно под подметките
      g.dataset.x = String(x);
      g.dataset.y = String(y);
      g.setAttribute('transform', `translate(${x} ${y}) scale(0)`);
      stepsG.appendChild(g);
      h.steps.push(g);
      return g;
    };
    const setStep = (g: SVGGElement, s: number, dy = 0) => g.setAttribute('transform', `translate(${g.dataset.x} ${Number(g.dataset.y) + dy}) scale(${s})`);

    const notify = () => live.current.setShown(heroes.map((h) => h.height));
    const color = (i: number) => live.current.players[i]?.color ?? '#fff';
    /**
     * Щитът пази само стъпалото, на което е вдигнат. Своя го виждаш; чуждият е скрит
     * (сървърът изобщо не го праща) и се показва само за миг, когато отбие удар — reveal.
     */
    const setShield = (h: Hero, on: boolean, reveal = false) => {
      const s = h.el.shield, was = h.shield;
      h.shield = on;
      if (on) {
        if (!was) run(350, (k) => (s.setAttribute('opacity', String(k)), s.setAttribute('transform', `scale(${ease.back(k)})`)));
      } else if (was) {
        run(300, (k) => (s.setAttribute('opacity', String(1 - k)), s.setAttribute('transform', `scale(${1 + ease.out(k) * 0.45})`)));
      } else if (reveal) {
        run(520, (k) => {
          s.setAttribute('opacity', String(Math.min(1, k * 5) * (1 - Math.max(0, (k - 0.45) / 0.55))));
          s.setAttribute('transform', `scale(${1 + ease.out(k) * 0.45})`);
        });
      }
    };
    /** Слага героя направо на дадена височина (начало, връщане в играта, нова игра). */
    const place = (h: Hero, n: number) => {
      h.steps.forEach((g) => g.remove());
      h.steps = [];
      for (let k = 1; k <= Math.min(n, N - 1); k++) setStep(addStep(h, k), 1);
      const [x, y] = spot(h.side, n);
      Object.assign(h.rig, REST, { x, y });
      h.height = n;
      h.idle = true;
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
      notify();
    }
    async function climb(i: number) {
      const h = heroes[i], r = h.rig, n = h.height + 1;
      h.idle = false;
      // качва се → щитът остава на старото стъпало (чуждият и без това не се вижда)
      setShield(h, false);
      camS.tz = 1.1;
      if (n < N) {
        const step = addStep(h, n);
        const [sx, sy] = spot(h.side, n);
        r.hammer = 1;
        await to(r, { afS: -170, afE: -30, rot: -9, head: -6, by: -3 }, 240, ease.out);
        for (let b = 0; b < 3; b++) {
          await to(r, { afS: -30, afE: -50, rot: 6, by: 4, sy: 0.95 }, 95, ease.in);
          burst(sx - h.side * 30, sy - 8, '#ffe27a', 0.4);
          await sleep(70);
          setStep(step, 0.45 + b * 0.28);
          puff(sx - h.side * 30, sy - 6, 6, '#ffe27a', 190, 3.5, 0.35, 500);
          shake = Math.max(shake, 0.1);
          if (b < 2) await to(r, { afS: -170, afE: -30, rot: -9, by: -3, sy: 1 }, 200, ease.out);
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
      h.idle = true;
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
        shards(Number(step.dataset.x), Number(step.dataset.y), 9, live.current.look.shard);
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
    /** Хвърляне с резултата от сървъра: уцелен, пропуск или отбит от щит (saved = щитът на хвърлящия го е опазил). */
    async function throwAt(i: number, kind: 'hit' | 'miss' | 'reflect', emoji: string, saved: boolean) {
      const a = heroes[i], b = heroes[1 - i], r = a.rig;
      a.idle = false;
      camS.tz = 1.06;
      (a.el.item as SVGTextElement).textContent = emoji;
      r.item = 1;
      await to(r, { rot: -16, afS: 150, afE: 40, abS: -50, lfH: -18, lbH: 20, by: 3, head: -8, sx: 0.96, sy: 1.03 }, 280, ease.out);
      await sleep(60);
      to(r, { rot: 14, afS: -95, afE: -8, abS: 60, lfH: 22, lbH: -16, head: 6 }, 95, ease.in);
      await sleep(70);
      r.item = 0;
      const p = mk('text', { 'text-anchor': 'middle', 'font-size': 40, 'dominant-baseline': 'central' });
      p.textContent = emoji;
      fx.appendChild(p);
      const from: [number, number] = [r.x + a.face * 40, r.y - 120];
      const target: [number, number] = [b.rig.x, b.rig.y - 95];
      const missTo: [number, number] = [b.rig.x + a.face * 190, b.rig.y + 30];
      to(r, { ...REST }, 380, ease.elastic);
      await fly(p, from, kind === 'miss' ? missTo : target, 500, 150, color(i));
      if (kind === 'reflect') {
        hitstop = 0.09;
        burst(target[0], target[1], '#bdf1ff');
        puff(target[0], target[1], 16, '#9fe8ff', 260, 5, 0.5, 100);
        shake = 0.3;
        setShield(b, false, true);
        pop(target[0], target[1] - 120, i === me ? 'ИМАЛ Е ЩИТ!' : 'ОТБИТО!', '#9fe8ff');
        const back: [number, number] = [r.x, r.y - 95];
        await fly(p, target, back, 360, 110, '#9fe8ff');
        p.remove();
        if (saved) {
          // и хвърлящият е с щит — неговият поема върнатия удар
          setShield(a, false, true);
          burst(back[0], back[1], '#bdf1ff');
          pop(r.x, r.y - 200, 'ЩИТ СРЕЩУ ЩИТ', '#9fe8ff', 28);
          await sleep(450);
        } else await impact(a, -a.face);
      } else if (kind === 'hit') {
        p.remove();
        pop(target[0], target[1] - 90, 'УЦЕЛИ!', '#ffd84d');
        await impact(b, a.face);
      } else {
        p.remove();
        puff(missTo[0], missTo[1], 6, '#e8e3f5', 90, 5, 0.4, 200);
        pop(b.rig.x, b.rig.y - 170, 'ПРОПУСК', '#c9d0ee', 34);
        if (saved) {
          setShield(a, false, true);
          pop(r.x, r.y - 200, i === me ? 'ЩИТЪТ ТЕ ОПАЗИ' : 'ИМАЛ Е ЩИТ', '#9fe8ff', 28);
          await sleep(450);
        } else {
          // загуба на равновесие
          await to(r, { rot: 14, afS: -140, abS: 130, head: 10 }, 150, ease.out);
          await to(r, { rot: -18, afS: 120, abS: -140, head: -12 }, 160, ease.io);
          await knock(a, -a.face);
        }
      }
      a.idle = true;
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
    async function cheerLoop(h: Hero, id: number) {
      const r = h.rig;
      h.idle = false;
      h.el.crown.setAttribute('opacity', '1');
      for (let k = 0; k < 4 && alive && cheer === id; k++) {
        confetti();
        await to(r, { by: 8, sy: 0.84, sx: 1.12, afS: -40, abS: 40 }, 130);
        to(r, { afS: -170, abS: 170, afE: -15, abE: 15 }, 120);
        await run(360, (t) => ((r.by = -46 * Math.sin(t * Math.PI)), (r.sy = 1.08), (r.sx = 0.95)));
        await to(r, { ...REST }, 200, ease.elastic);
        await sleep(350);
      }
      h.idle = true;
    }
    let queue: Promise<void> = Promise.resolve();
    api.current = {
      busy: () => busy,
      sync: (hs) => {
        if (busy) return;
        heroes.forEach((h, i) => {
          if (hs[i] != null && h.height !== hs[i]) place(h, hs[i]);
        });
        notify();
      },
      shield: (side, on) => {
        const h = heroes[side];
        if (!h || h.shield === on) return;
        if (on) puff(h.rig.x, h.rig.y - 78, 12, '#9fe8ff', 170, 4, 0.5, 0);
        // свалянето по време на анимация го прави самата анимация (с правилния ефект)
        if (on || !busy) setShield(h, on);
      },
      finish: (side) => {
        const id = ++cheer;
        heroes.forEach((h) => h.el.crown.setAttribute('opacity', '0'));
        if (side == null) return void (camS.tz = 1);
        queue = queue.then(async () => {
          if (!alive || cheer !== id) return;
          camS.tz = 1.2;
          const w = heroes[side];
          if (w.height < N) {
            // другият се е предал или времето е свършило → победителят изтичва догоре
            w.idle = false;
            setShield(w, false);
            for (let k = w.height + 1; k < N && alive && cheer === id; k++) {
              const st = addStep(w, k);
              run(200, (t) => setStep(st, ease.back(t)));
              await hop(w, k, 44, 150);
            }
            if (!alive || cheer !== id) return;
            await hop(w, N, 110, 420);
            await land(w);
            pop(w.rig.x, w.rig.y - 190, 'ВРЪХ!', '#fff', 54);
          }
          await cheerLoop(w, id);
        });
      },
      play: (outcomes, after, sideOf, meIdx) => {
        queue = queue.then(async () => {
          if (!alive) return;
          me = meIdx;
          busy = true;
          try {
            for (const o of outcomes) {
              const a = sideOf(o.actorUid);
              if (a < 0) continue;
              if (o.kind === 'climb') await climb(a);
              else if (o.kind === 'hit' || o.kind === 'miss' || o.kind === 'reflect') await throwAt(a, o.kind, weaponById(o.weapon).emoji, o.kind !== 'hit' && !!o.saved);
            }
          } finally {
            busy = false;
            camS.tz = 1;
            // за всеки случай — изравняване с истинското състояние
            heroes.forEach((h, i) => {
              const want = !!live.current.players[i]?.shieldArmed;
              if (h.shield !== want) setShield(h, want);
            });
            heroes.forEach((h, i) => {
              if (after[i] != null && h.height !== after[i]) place(h, after[i]);
            });
            notify();
          }
        });
        return queue;
      },
    };

    // ── кадър ──
    const J = (el: SVGElement, t: string) => el.setAttribute('transform', t);
    function draw(h: Hero, t: number) {
      const r = h.rig, e = h.el, w = h.idle ? 1 : 0, ph = t * 2.6 + h.side;
      const sy = r.sy + Math.sin(ph) * 0.016 * w, bob = Math.sin(ph) * 1.2 * w;
      J(e.g, `translate(${r.x.toFixed(1)} ${r.y.toFixed(1)})`);
      J(e.root, `scale(${h.face * 0.98} 0.98) translate(0 ${(r.by + bob - 8).toFixed(2)}) rotate(${r.rot.toFixed(1)} 0 -60) scale(${r.sx.toFixed(3)} ${sy.toFixed(3)})`);
      J(e.head, `rotate(${(r.head + Math.sin(ph * 0.7) * 1.6 * w).toFixed(2)} 0 -88)`);
      J(e.afS, `rotate(${(r.afS + Math.sin(ph) * 3 * w).toFixed(1)})`);
      J(e.afE, `translate(0 24) rotate(${r.afE.toFixed(1)})`);
      J(e.abS, `rotate(${(r.abS - Math.sin(ph) * 3 * w).toFixed(1)})`);
      J(e.abE, `translate(0 24) rotate(${r.abE.toFixed(1)})`);
      J(e.lfH, `rotate(${r.lfH.toFixed(1)})`);
      J(e.lfK, `translate(0 17) rotate(${r.lfK.toFixed(1)})`);
      J(e.lbH, `rotate(${r.lbH.toFixed(1)})`);
      J(e.lbK, `translate(0 17) rotate(${r.lbK.toFixed(1)})`);
      J(e.tag, `translate(0 ${(-196 + r.by * 0.98).toFixed(1)})`);
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
    raf = requestAnimationFrame(frame);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      api.current = null;
    };
  }, []);

  // ── връзка със състоянието на играта ──
  const lastOutcome = useRef<number | null>(state.outcome?.id ?? null);
  useEffect(() => {
    const st = api.current;
    if (!st) return;
    const o = state.outcome;
    if (!o || o.id === lastOutcome.current) return st.sync(heights);
    lastOutcome.current = o.id;
    void st.play(o.outcomes ?? [o], heights, (uid) => players.findIndex((p) => p.uid === uid), me);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.outcome?.id, heights.join(',')]);
  // щитът: сървърът праща shieldArmed само за теб — затова чуждият никога не се рисува предварително
  const armed = players.map((p) => !!p.shieldArmed).join(',');
  useEffect(() => {
    players.forEach((p, i) => api.current?.shield(i, !!p.shieldArmed));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [armed]);
  const finished = state.phase === 'finished';
  useEffect(() => {
    api.current?.finish(finished && state.winnerUid ? players.findIndex((p) => p.uid === state.winnerUid) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, state.winnerUid]);

  const stars = useMemo(() => Array.from({ length: 46 }, (_, i) => ({ x: (i * 173.3) % W, y: (i * 97.7) % 330, r: 0.8 + ((i * 7) % 5) * 0.35, d: (i % 7) * 0.5 })), []);
  const flora = (kind: Look['flora'], xs: number[], y: number, s: number, fill: string) =>
    xs.map((x, i) => {
      if (kind === 'cactus') return <path key={i} d={`M${x - 7 * s} ${y}v${-70 * s}q0${-8 * s} ${7 * s}${-8 * s}t${7 * s} ${8 * s}v${22 * s}h${10 * s}v${-16 * s}q0${-6 * s} ${5 * s}${-6 * s}t${5 * s} ${6 * s}v${22 * s}q0 ${6 * s}${-6 * s} ${6 * s}h${-14 * s}v${14 * s}h${-24 * s}v${-8 * s}h${-12 * s}q${-6 * s} 0${-6 * s}${-6 * s}v${-18 * s}q0${-6 * s} ${5 * s}${-6 * s}t${5 * s} ${6 * s}v${12 * s}h${8 * s}v${50 * s}z`} fill={fill} />;
      if (kind === 'dead') return <path key={i} d={`M${x - 5 * s} ${y}l${3 * s}${-48 * s}${-20 * s}${-22 * s} ${4 * s}${-3 * s} ${17 * s} ${15 * s} ${2 * s}${-34 * s}${-12 * s}${-18 * s} ${4 * s}${-3 * s} ${10 * s} ${13 * s} ${6 * s}${-20 * s} ${5 * s} ${1 * s}${-4 * s} ${30 * s} ${16 * s}${-16 * s} ${4 * s} ${4 * s}${-18 * s} ${22 * s} ${2 * s} ${59 * s}z`} fill={fill} />;
      return <path key={i} d={`M${x} ${y}l${-26 * s} 0 ${14 * s} ${-26 * s}h${-9 * s}l${13 * s} ${-26 * s}h${-7 * s}l${15 * s} ${-34 * s} ${15 * s} ${34 * s}h${-7 * s}l${13 * s} ${26 * s}h${-9 * s}l${14 * s} ${26 * s}z`} fill={fill} />;
    });

  return (
    <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full select-none" role="img" aria-label="Към върха">
      <defs>
        <linearGradient id={`st-skyg-${gid}`} x1="0" y1="0" x2="0" y2="1">
          {[0, 0.42, 0.72, 0.9, 1].map((o, i) => (
            <stop key={o} offset={o} stopColor={theme.sky[i]} />
          ))}
        </linearGradient>
        <radialGradient id={`st-sun-${gid}`}>
          <stop offset="0" stopColor={theme.sun} />
          <stop offset=".18" stopColor={theme.sun} stopOpacity=".85" />
          <stop offset=".4" stopColor={theme.glow} stopOpacity=".5" />
          <stop offset="1" stopColor={theme.glow} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`st-mtL-${gid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={theme.mtL[0]} />
          <stop offset="1" stopColor={theme.mtL[1]} />
        </linearGradient>
        <linearGradient id={`st-mtR-${gid}`} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={theme.mtR[0]} />
          <stop offset=".45" stopColor={theme.mtR[1]} />
          <stop offset="1" stopColor={theme.mtR[2]} />
        </linearGradient>
        <linearGradient id={`st-mist-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset=".6" stopColor={theme.mist} stopOpacity=".22" />
          <stop offset="1" stopColor={theme.mist} stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`st-shield-${gid}`}>
          <stop offset=".55" stopColor="#9fe8ff" stopOpacity=".05" />
          <stop offset="1" stopColor="#9fe8ff" stopOpacity=".38" />
        </radialGradient>
        <radialGradient id={`st-vig-${gid}`}>
          <stop offset=".6" stopColor={theme.vig} stopOpacity="0" />
          <stop offset="1" stopColor={theme.vig} stopOpacity=".55" />
        </radialGradient>
        <clipPath id={`st-mtclip-${gid}`}>
          <path d="M640 206 545 222 10 690H1270L735 222z" />
        </clipPath>
        <clipPath id={`st-clip-${gid}`}>
          <rect width={W} height={H} rx="22" />
        </clipPath>
      </defs>
      <style>{`.st-tw{animation:st-tw 3.2s ease-in-out infinite}.st-drift{animation:st-drift 90s linear infinite}.st-drift2{animation:st-drift 140s linear infinite reverse}.st-spin{animation:st-spin 9s linear infinite;transform-box:fill-box;transform-origin:center}.st-font{font-family:'Unbounded Variable','Nunito Variable',sans-serif}.st-ray{animation:st-ray 7s ease-in-out infinite alternate}.st-aur{animation:st-aur 9s ease-in-out infinite alternate;transform-origin:640px 0}@keyframes st-tw{50%{opacity:.25}}@keyframes st-drift{to{transform:translateX(-1280px)}}@keyframes st-spin{to{transform:rotate(360deg)}}@keyframes st-ray{to{transform:rotate(4deg);opacity:.5}}@keyframes st-aur{0%{transform:translateX(-30px) scaleY(.9)}100%{transform:translateX(40px) scaleY(1.15)}}`}</style>
      <g clipPath={`url(#st-clip-${gid})`}>
        <g id="st-cam">
          <g id="st-sky">
            <rect x="-200" y="-300" width={W + 400} height={H + 500} fill={`url(#st-skyg-${gid})`} />
            {theme.stars && stars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" className="st-tw" style={{ animationDelay: `${s.d}s` }} />)}
            {theme.aurora && (
              <g style={{ mixBlendMode: 'screen' }}>
                {[
                  ['M-120 250q260-150 520-40t470-70 560-30v-190h-1550z', '#4dffb0', 0, 0.5],
                  ['M-120 330q300-110 560-10t520-90 470 10v-150q-240-70-470 0t-520 60-560-30z', '#5fd8ff', -3, 0.38],
                  ['M100 210q240-90 420-20t400-80 480 30v-120h-1300z', '#b48cff', -6, 0.26],
                ].map(([d, c, delay, o]) => (
                  <path key={d as string} d={d as string} fill={c as string} opacity={o as number} className="st-aur" style={{ animationDelay: `${delay}s`, filter: 'blur(14px)' }} />
                ))}
              </g>
            )}
            <circle cx={theme.sunAt[0]} cy={theme.sunAt[1]} r="330" fill={`url(#st-sun-${gid})`} />
            {theme.rays && (
              <g className="st-ray" opacity=".3" style={{ transformOrigin: `${theme.sunAt[0]}px ${theme.sunAt[1]}px` }}>
                {[-58, -34, -12, 10, 30].map((a) => (
                  <path key={a} d={`M${theme.sunAt[0]} ${theme.sunAt[1]}l-40 -900h80z`} fill={theme.sun} opacity=".16" transform={`rotate(${a + (theme.sunAt[0] < 640 ? 150 : 0)} ${theme.sunAt[0]} ${theme.sunAt[1]})`} />
                ))}
              </g>
            )}
            {theme.disc > 0 && <circle cx={theme.sunAt[0]} cy={theme.sunAt[1]} r={theme.disc} fill={theme.sun} />}
          </g>
          <g id="st-far2">
            <path d="M-80 600 90 380l70 70 120-190 110 150 80-70 150 190 120-150 110 110 130-230 120 170 90-90 170 240V760H-80z" fill={theme.far2} />
            {theme.tip && <path d="M280 260l-34 54 26-10 14 20 18-22 22 8zM1000 330l-36 64 30-12 12 18 16-20 24 10z" fill={theme.tip} opacity=".7" />}
            <g className="st-drift" opacity=".5">
              {[60, 520, 980, 1340, 1800, 2260].map((x, i) => (
                <path key={i} d={`M${x} ${150 + (i % 3) * 46}q28-30 62-10 30-26 62 2 36-6 44 22h-190q-6-14 22-14z`} fill={theme.cloud2} opacity=".5" />
              ))}
            </g>
          </g>
          <g id="st-far1">
            <path d="M-80 660 60 500l90 60 110-150 120 130 90-60 130 180H-80zM700 660l150-190 100 90 120-170 130 150 160 120z" fill={theme.far1} />
            <g className="st-drift2" opacity=".65">
              {[200, 760, 1300, 1860, 2400].map((x, i) => (
                <path key={i} d={`M${x} ${300 + (i % 2) * 70}q34-34 76-12 36-30 74 2 42-6 52 26h-226q-8-16 24-16z`} fill={theme.cloud1} opacity=".55" />
              ))}
            </g>
          </g>
          {/* планината */}
          <path d="M640 206 545 222 10 690H640z" fill={`url(#st-mtL-${gid})`} />
          <path d="M640 206 735 222 1270 690H640z" fill={`url(#st-mtR-${gid})`} />
          {theme.strata && (
            <g clipPath={`url(#st-mtclip-${gid})`}>
              {[300, 372, 450, 520, 596].map((y, i) => (
                <path key={y} d={`M0 ${y}q320 ${i % 2 ? 14 : -14} 640 0t640 0v${i % 2 ? 16 : 26}q-320 12-640 0t-640 0z`} fill={i % 2 ? '#fff' : '#3a0f1c'} opacity={i % 2 ? 0.1 : 0.16} />
              ))}
            </g>
          )}
          <path d="M545 222q14-12 36-12h118q22 0 36 12l68 60-34-10-26 26-34-22-38 30-32-28-34 24-30-26-30 12z" fill={theme.cap} />
          <path d="M545 222q14-12 36-12h59v74l-34 24-30-26-30 12-69-12z" fill={theme.capShade} opacity=".55" />
          <path d="M735 222 1270 690" stroke={theme.rim} strokeOpacity=".75" strokeWidth="4" fill="none" />
          <g stroke={theme.crack} strokeOpacity={theme.crackO} strokeWidth={theme.crackW} fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M420 400l70 30 40-26M300 520l90 34 60-30 70 40M640 330v90l-40 60 30 80M800 420l-60 34 30 70M940 560l-80 20-50-40M520 610l80 20" />
          </g>
          <g fill="#fff" opacity=".07">
            <path d="M640 206 735 222 900 370 760 340 700 420z" />
          </g>
          <rect x="560" y="198" width="160" height="16" rx="7" fill={theme.plat[0]} stroke={INK} strokeWidth="3" />
          <rect x="560" y="212" width="160" height="9" fill={theme.plat[1]} stroke={INK} strokeWidth="3" />
          <path d="M640 198V104" stroke="#3a2a1c" strokeWidth="6" strokeLinecap="round" />
          <circle cx="640" cy="100" r="6" fill="#ffd84d" stroke={INK} strokeWidth="2.5" />
          <g transform="translate(643 108)">
            <path id="st-flag" fill={theme.flag} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          </g>
          <g id="st-steps" />
          {flora(theme.flora, [215, 1065], 668, 1.05, theme.treeMid)}
          {players.slice(0, 2).map((p, i) => (
            <Doll key={i} id={`h${i}`} gid={gid} color={p.color} uri={uris[i]} label={`${p.name.slice(0, 16)}${p.uid === state.you ? ' (ти)' : ''}`} />
          ))}
          <g id="st-fx" />
          <Bubbles chat={chat} players={players} shown={shown} />
          <rect x="-200" y="520" width={W + 400} height="180" fill={`url(#st-mist-${gid})`} />
          <path d="M-200 668q340-30 640 4t880-10v200H-200z" fill={theme.ground} />
          {flora(theme.flora, [-40, 20, 1262, 1322], 706, 1.7, theme.treeFg)}
        </g>
        <rect width={W} height={H} fill={`url(#st-vig-${gid})`} pointerEvents="none" />
        {players.slice(0, 2).map((p, i) => (
          <g key={p.uid} transform={`translate(${i === 0 ? 66 : W - 66} 40)`}>
            <rect x="-42" y="-19" width="84" height="38" rx="19" fill="#0b1030" fillOpacity=".72" stroke={p.color} strokeWidth="2.5" />
            <text x="0" y="6" textAnchor="middle" fontSize="19" fontWeight="900" fill="#fff" className="st-font">
              {shown[i] ?? 0}/{N}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}

/** Реплики от чата над главите. */
function Bubbles({ chat, players, shown }: { chat: { uid: string; key: string; at: number }[]; players: ClimbPlayer[]; shown: number[] }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 300);
    return () => clearInterval(t);
  }, []);
  return (
    <g>
      {players.slice(0, 2).map((p, i) => {
        const c = [...chat].reverse().find((m) => m.uid === p.uid && now - m.at < 2600);
        if (!c) return null;
        const text = CLIMB_CHAT.find((m) => m.key === c.key)?.text ?? '';
        const w = Math.max(60, text.length * 10 + 24);
        const [px, py] = spot(i === 0 ? -1 : 1, shown[i] ?? 0);
        const x = Math.max(w / 2 + 10, Math.min(W - w / 2 - 10, px + (i === 0 ? 70 : -70)));
        return (
          <g key={`${c.at}-${p.uid}`} transform={`translate(${x} ${Math.max(40, py - 250)})`}>
            <rect x={-w / 2} y="-22" width={w} height="38" rx="19" fill="#fff" stroke={p.color} strokeWidth="2.5" />
            <text x="0" y="4" textAnchor="middle" fontSize="17" fontWeight="800" fill="#1f1f1f">
              {text}
            </text>
          </g>
        );
      })}
    </g>
  );
}
