'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CLIMB, sanitizeAvatar, weaponById, type ClimbOutcome, type ClimbPlayer, type ClimbState } from '@belmaster/shared';
import { avatarSvg } from '@/components/avatar/UserAvatar';
import { ClimbBackground, THEME_PALETTE } from './themes';
import { play } from '@/lib/sound';

const W = 800;
const H = 520;
/** място над върха — за победителя с короната */
const TOP = 150;
const GROUND = 482;
const STEP = 36;
const BLOCK_W = 128;
const TOWER_X = [230, 570];

const yOf = (h: number) => GROUND - h * STEP;

/** Тайминг на анимацията (ms). */
const T = { throw: 250, flight: 900, back: 750 };

type Fx =
  | { kind: 'projectile'; id: number; from: [number, number]; to: [number, number]; via?: [number, number]; start: number; dur: number; emoji: string }
  | { kind: 'crumble'; id: number; x: number; y: number; color: string; start: number }
  | { kind: 'dust'; id: number; x: number; y: number; start: number }
  | { kind: 'shield'; id: number; x: number; y: number; start: number; wasted?: boolean }
  | { kind: 'grow'; id: number; side: number; h: number; start: number };

type NewFx = Fx extends infer F ? (F extends { id: number } ? Omit<F, 'id'> : never) : never;

function useAvatarUri(p: ClimbPlayer | undefined) {
  return useMemo(() => {
    if (!p) return '';
    const svg = avatarSvg(sanitizeAvatar(p.avatar, null, p.isBot ? 'bot' : p.uid), 'none', { noBg: true });
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }, [p]);
}

export function ClimbScene({ state }: { state: ClimbState }) {
  const players = state.players;
  const theme = state.theme ?? 'dusk';
  const pal = THEME_PALETTE[theme];
  const heights = players.map((p) => p.height);
  const [disp, setDisp] = useState<number[]>(heights);
  const [fx, setFx] = useState<Fx[]>([]);
  const [throwing, setThrowing] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const lastOutcome = useRef<number | null>(state.outcome?.id ?? null);
  const prevHeights = useRef<number[]>(heights);
  const busy = useRef(false);
  const fxId = useRef(0);

  // кадри за летящия предмет
  useEffect(() => {
    if (!fx.some((f) => f.kind === 'projectile')) return;
    let raf = 0;
    const tick = () => {
      setNow(performance.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fx]);

  // ново действие → анимация
  useEffect(() => {
    const o = state.outcome;
    if (!o || o.id === lastOutcome.current) {
      if (!busy.current) {
        setDisp(heights);
        prevHeights.current = heights;
      }
      return;
    }
    lastOutcome.current = o.id;
    busy.current = true;
    const before = prevHeights.current;
    setDisp(before);
    const t0 = performance.now();
    const add = (f: NewFx) => setFx((list) => [...list, { ...f, id: ++fxId.current } as Fx]);
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    const side = (uid: string) => players.findIndex((p) => p.uid === uid);
    const hand = (s: number, h: number): [number, number] => [TOWER_X[s] + (s === 0 ? 45 : -45), yOf(h) - 78];
    const top = (s: number, h: number): [number, number] => [TOWER_X[s], yOf(h) - 6];

    const run = (out: ClimbOutcome) => {
      if (out.kind === 'climb') {
        const s = side(out.actorUid);
        add({ kind: 'grow', side: s, h: before[s] + 1, start: t0 });
        play('turn');
        at(250, () => setDisp(heights));
        return 900;
      }
      if (out.kind === 'shield_wasted') {
        const s = side(out.targetUid);
        at(700, () => add({ kind: 'shield', x: TOWER_X[s], y: yOf(before[s]) - 82, start: performance.now(), wasted: true }));
        return 1600;
      }
      const a = side(out.actorUid);
      const b = side(out.targetUid);
      const emoji = weaponById(out.weapon).emoji;
      setThrowing(a);
      at(350, () => setThrowing(null));
      play('tick');
      const from = hand(a, before[a]);
      if (out.kind === 'hit') {
        const to = top(b, before[b]);
        const via: [number, number] = [(from[0] + to[0]) / 2, Math.min(from[1], to[1]) - 140];
        add({ kind: 'projectile', from, to, via, start: t0 + T.throw, dur: T.flight, emoji });
        at(T.throw + T.flight, () => {
          if (out.targetAtGround) add({ kind: 'dust', x: to[0], y: GROUND, start: performance.now() });
          else add({ kind: 'crumble', x: TOWER_X[b], y: yOf(before[b]), color: pal.stone, start: performance.now() });
          play('hit');
          setDisp(heights);
        });
        return T.throw + T.flight + 1100;
      }
      if (out.kind === 'miss') {
        // летелият предмет се връща върху собственото стъпало
        const mid: [number, number] = [(from[0] + TOWER_X[b]) / 2, Math.min(from[1], yOf(before[b])) - 170];
        const to = top(a, before[a]);
        add({ kind: 'projectile', from, to, via: mid, start: t0 + T.throw, dur: T.flight + 250, emoji });
        at(T.throw + T.flight + 250, () => {
          if (out.actorAtGround) add({ kind: 'dust', x: to[0], y: GROUND, start: performance.now() });
          else add({ kind: 'crumble', x: TOWER_X[a], y: yOf(before[a]), color: pal.stone, start: performance.now() });
          play('lost');
          setDisp(heights);
        });
        return T.throw + T.flight + 1400;
      }
      // reflect: до щита и обратно
      const shieldAt: [number, number] = [TOWER_X[b] + (a === 0 ? -75 : 75), yOf(before[b]) - 82];
      const via1: [number, number] = [(from[0] + shieldAt[0]) / 2, Math.min(from[1], shieldAt[1]) - 120];
      add({ kind: 'projectile', from, to: shieldAt, via: via1, start: t0 + T.throw, dur: T.flight, emoji });
      at(T.throw + T.flight, () => {
        add({ kind: 'shield', x: TOWER_X[b], y: yOf(before[b]) - 82, start: performance.now() });
        play('capture');
      });
      const to = top(a, before[a]);
      const via2: [number, number] = [(shieldAt[0] + to[0]) / 2, Math.min(shieldAt[1], to[1]) - 110];
      add({ kind: 'projectile', from: shieldAt, to, via: via2, start: t0 + T.throw + T.flight, dur: T.back, emoji });
      at(T.throw + T.flight + T.back, () => {
        if (out.actorAtGround) add({ kind: 'dust', x: to[0], y: GROUND, start: performance.now() });
        else add({ kind: 'crumble', x: TOWER_X[a], y: yOf(before[a]), color: pal.stone, start: performance.now() });
        play('hit');
        setDisp(heights);
      });
      return T.throw + T.flight + T.back + 1100;
    };

    let end = 0;
    for (const out of o.outcomes ?? [o]) end = Math.max(end, run(out));
    at(end, () => {
      busy.current = false;
      prevHeights.current = heights;
      setDisp(heights);
      setFx([]);
    });
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.outcome?.id, heights.join(',')]);

  // победителят се качва на платформата горе
  const finished = state.phase === 'finished';
  const shown = disp.map((h, i) => (finished && state.winnerUid === players[i]?.uid ? CLIMB.STEPS : h));

  return (
    <svg viewBox={`0 ${-TOP} ${W} ${H + TOP}`} className="block h-auto w-full select-none" role="img" aria-label="Кулите">
      <defs>
        <pattern id="stones" width="34" height="34" patternUnits="userSpaceOnUse">
          <path d="M0 17h34M17 0v17M0 17v17" stroke={pal.mortar} strokeWidth="2" opacity=".55" />
        </pattern>
      </defs>
      <ClimbBackground theme={theme} top={TOP} ground={GROUND} />
      <rect x="0" y={GROUND} width={W} height={H - GROUND} fill={pal.ground} />
      <rect x="0" y={GROUND} width={W} height="4" fill="#fff" opacity=".08" />

      {players.map((p, i) => (
        <Tower key={p.uid} p={p} side={i} h={shown[i]} pal={pal} />
      ))}

      {fx.map((f) => {
        if (f.kind === 'grow') return null;
        if (f.kind === 'crumble') return <Crumble key={f.id} x={f.x} y={f.y} color={f.color} />;
        if (f.kind === 'dust') return <Dust key={f.id} x={f.x} y={f.y} />;
        if (f.kind === 'shield') return <ShieldFlash key={f.id} x={f.x} y={f.y} wasted={f.wasted} />;
        // летящ предмет по крива на Безие
        const t = Math.min(1, Math.max(0, (now - f.start) / f.dur));
        if (now < f.start || t >= 1) return null;
        const v = f.via ?? [(f.from[0] + f.to[0]) / 2, Math.min(f.from[1], f.to[1]) - 100];
        const x = (1 - t) ** 2 * f.from[0] + 2 * (1 - t) * t * v[0] + t ** 2 * f.to[0];
        const y = (1 - t) ** 2 * f.from[1] + 2 * (1 - t) * t * v[1] + t ** 2 * f.to[1];
        return (
          <text key={f.id} x={x} y={y} fontSize="30" textAnchor="middle" dominantBaseline="central" transform={`rotate(${t * 540} ${x} ${y})`}>
            {f.emoji}
          </text>
        );
      })}

      {players.map((p, i) => (
        <Climber key={p.uid} p={p} side={i} h={shown[i]} throwing={throwing === i} winner={finished && state.winnerUid === p.uid} you={p.uid === state.you} />
      ))}
    </svg>
  );
}

function Tower({ p, side, h, pal }: { p: ClimbPlayer; side: number; h: number; pal: (typeof THEME_PALETTE)[keyof typeof THEME_PALETTE] }) {
  const x = TOWER_X[side];
  const topY = yOf(CLIMB.STEPS);
  const flagX = x + (BLOCK_W + 34) / 2 - 14;
  return (
    <g>
      {Array.from({ length: CLIMB.STEPS }, (_, k) => {
        const n = k + 1;
        const built = n <= h;
        const top = n === CLIMB.STEPS;
        const y = yOf(n);
        const w = top ? BLOCK_W + 34 : BLOCK_W - k * 3;
        if (!built) return <rect key={n} x={x - w / 2} y={y} width={w} height={STEP - 2} rx="3" fill="none" stroke={pal.ghost} strokeWidth="1.5" strokeDasharray="5 6" />;
        return (
          <g key={n} className="climb-block">
            <rect x={x - w / 2} y={y} width={w} height={STEP - 2} rx="3" fill={pal.stone} />
            <rect x={x - w / 2} y={y} width={w} height={STEP - 2} rx="3" fill="url(#stones)" />
            <rect x={x - w / 2} y={y} width={w} height="4" fill="#fff" opacity=".18" />
            <rect x={x - w / 2} y={y + STEP - 8} width={w} height="6" fill="#000" opacity=".22" />
            {/* ивица в цвета на играча */}
            <rect x={side === 0 ? x - w / 2 : x + w / 2 - 6} y={y} width="6" height={STEP - 2} fill={p.color} opacity=".9" />
          </g>
        );
      })}
      {/* знаме на върха в цвета на играча */}
      <line x1={flagX} y1={topY} x2={flagX} y2={topY - 52} stroke={pal.mortar} strokeWidth="4" strokeLinecap="round" />
      <path d={`M${flagX} ${topY - 52} l34 10 l-34 10 Z`} fill={p.color} className="climb-flag" />
      <text x={x} y={GROUND + 28} textAnchor="middle" fontSize="15" fontWeight="900" fill={pal.label}>
        {h}/{CLIMB.STEPS}
      </text>
    </g>
  );
}

/** Чиби човече: голяма глава (аватарът без фон), кръгло тяло, къси крачета, контур и светлосенки. */
function Climber({ p, side, h, throwing, winner, you }: { p: ClimbPlayer; side: number; h: number; throwing: boolean; winner: boolean; you: boolean }) {
  const uri = useAvatarUri(p);
  const x = TOWER_X[side];
  const flip = side === 1 ? -1 : 1;
  const id = `c${side}`;
  const ink = '#1f1f1f';
  const label = `${p.name.slice(0, 16)}${you ? ' (ти)' : ''}`;
  return (
    <g className="climb-climber" style={{ transform: `translate(${x}px, ${yOf(h)}px)` }} opacity={p.left ? 0.35 : 1}>
      <g transform="scale(1.25)">
      <defs>
        <radialGradient id={`${id}-body`} cx="35%" cy="25%" r="85%">
          <stop offset="0" stopColor="#fff" stopOpacity=".6" />
          <stop offset=".35" stopColor={p.color} />
          <stop offset="1" stopColor={p.color} />
        </radialGradient>
        <linearGradient id={`${id}-limb`} x1="0" x2="1">
          <stop offset="0" stopColor={p.color} />
          <stop offset=".35" stopColor="#fff" stopOpacity=".4" />
          <stop offset=".55" stopColor={p.color} />
          <stop offset="1" stopColor="#000" stopOpacity=".35" />
        </linearGradient>
        <linearGradient id={`${id}-leg`} x1="0" x2="1">
          <stop offset="0" stopColor="#3b4252" />
          <stop offset=".4" stopColor="#5b6478" />
          <stop offset="1" stopColor="#222833" />
        </linearGradient>
        <radialGradient id={`${id}-shade`}>
          <stop offset="0" stopColor="#000" stopOpacity=".35" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="0" cy="1" rx="30" ry="6" fill={`url(#${id}-shade)`} />
      <g transform={`scale(${flip} 1)`}>
        {/* крачета */}
        <ellipse cx="-11" cy="-10" rx="9" ry="12" fill={`url(#${id}-leg)`} stroke={ink} strokeWidth="2.5" />
        <ellipse cx="11" cy="-10" rx="9" ry="12" fill={`url(#${id}-leg)`} stroke={ink} strokeWidth="2.5" />
        {/* задна ръчичка */}
        <ellipse cx="-27" cy="-44" rx="8" ry="15" fill={`url(#${id}-limb)`} stroke={ink} strokeWidth="2.5" transform="rotate(25 -27 -44)" />
        {/* тяло */}
        <ellipse cx="0" cy="-40" rx="24" ry="27" fill={`url(#${id}-body)`} stroke={ink} strokeWidth="2.5" />
        {/* хвърляща ръчичка — върти се от рамото */}
        <g className={throwing ? 'climb-arm-throw' : 'climb-arm'} style={{ transformOrigin: '20px -56px' }}>
          <ellipse cx="27" cy="-44" rx="8" ry="15" fill={`url(#${id}-limb)`} stroke={ink} strokeWidth="2.5" transform="rotate(-25 27 -44)" />
        </g>
      </g>
      {/* глава — аватарът без фон */}
      <image href={uri} x="-48" y="-128" width="96" height="96" />
      {winner && <text x="0" y="-136" textAnchor="middle" fontSize="28" className="climb-crown">👑</text>}
      {p.shieldArmed && <circle cx="0" cy="-66" r="72" fill="#1cb0f6" fillOpacity=".12" stroke="#1cb0f6" strokeWidth="3" strokeDasharray="8 6" className="climb-shield-idle" />}
      <g transform={`translate(0 ${winner ? -168 : -134})`}>
        <rect x={-Math.max(36, label.length * 4.2)} y="-14" width={Math.max(72, label.length * 8.4)} height="22" rx="11" fill="rgba(255,255,255,.92)" stroke={p.color} strokeWidth="2" />
        <text x="0" y="2" textAnchor="middle" fontSize="12" fontWeight="900" fill="#1f1f1f">
          {label}
        </text>
      </g>
      </g>
    </g>
  );
}

function Crumble({ x, y, color }: { x: number; y: number; color: string }) {
  const parts = useMemo(() => Array.from({ length: 9 }, (_, i) => ({ dx: (i - 4) * 14 + (Math.random() - 0.5) * 10, r: (Math.random() - 0.5) * 220, d: 0.6 + Math.random() * 0.5 })), []);
  return (
    <g>
      {parts.map((p, i) => (
        <rect
          key={i}
          x={x + p.dx - 9}
          y={y + 4}
          width="18"
          height="14"
          rx="3"
          fill={color}
          stroke="rgba(0,0,0,.3)"
          className="climb-crumble"
          style={{ ['--r' as string]: `${p.r}deg`, animationDuration: `${p.d}s`, transformOrigin: `${x + p.dx}px ${y + 10}px` }}
        />
      ))}
      <circle cx={x} cy={y} r="34" fill="#ffc800" opacity=".55" className="climb-boom" />
    </g>
  );
}

function Dust({ x, y }: { x: number; y: number }) {
  return (
    <g className="climb-dust">
      <ellipse cx={x - 20} cy={y - 4} rx="16" ry="8" fill="#b9a27a" />
      <ellipse cx={x + 18} cy={y - 6} rx="18" ry="9" fill="#c8b48c" />
      <ellipse cx={x} cy={y - 10} rx="14" ry="7" fill="#d7c6a2" />
    </g>
  );
}

function ShieldFlash({ x, y, wasted }: { x: number; y: number; wasted?: boolean }) {
  return (
    <g>
      <circle cx={x} cy={y} r="94" fill="#1cb0f6" fillOpacity=".22" stroke="#1cb0f6" strokeWidth="5" className={wasted ? 'climb-shield-waste' : 'climb-shield-flash'} />
      <text x={x} y={y - 104} textAnchor="middle" fontSize="15" fontWeight="900" fill="#1899d6" className="climb-pop-text">
        {wasted ? 'Щитът изгоря напразно' : '🛡️ Отбито!'}
      </text>
    </g>
  );
}
