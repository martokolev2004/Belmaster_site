'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CLIMB, sanitizeAvatar, weaponById, type ClimbOutcome, type ClimbPlayer, type ClimbState } from '@belmaster/shared';
import { avatarSvg } from '@/components/avatar/UserAvatar';
import { play } from '@/lib/sound';

const W = 800;
const H = 520;
/** място над върха — за победителя с короната */
const TOP = 80;
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
    const svg = avatarSvg(sanitizeAvatar(p.avatar, null, p.isBot ? 'bot' : p.uid), p.frame);
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }, [p]);
}

export function ClimbScene({ state }: { state: ClimbState }) {
  const players = state.players;
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
    const hand = (s: number, h: number): [number, number] => [TOWER_X[s] + (s === 0 ? 26 : -26), yOf(h) - 78];
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
        at(700, () => add({ kind: 'shield', x: TOWER_X[s], y: yOf(before[s]) - 55, start: performance.now(), wasted: true }));
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
          else add({ kind: 'crumble', x: TOWER_X[b], y: yOf(before[b]), color: players[b].color, start: performance.now() });
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
          else add({ kind: 'crumble', x: TOWER_X[a], y: yOf(before[a]), color: players[a].color, start: performance.now() });
          play('lost');
          setDisp(heights);
        });
        return T.throw + T.flight + 1400;
      }
      // reflect: до щита и обратно
      const shieldAt: [number, number] = [TOWER_X[b] + (a === 0 ? -40 : 40), yOf(before[b]) - 55];
      const via1: [number, number] = [(from[0] + shieldAt[0]) / 2, Math.min(from[1], shieldAt[1]) - 120];
      add({ kind: 'projectile', from, to: shieldAt, via: via1, start: t0 + T.throw, dur: T.flight, emoji });
      at(T.throw + T.flight, () => {
        add({ kind: 'shield', x: TOWER_X[b], y: yOf(before[b]) - 55, start: performance.now() });
        play('capture');
      });
      const to = top(a, before[a]);
      const via2: [number, number] = [(shieldAt[0] + to[0]) / 2, Math.min(shieldAt[1], to[1]) - 110];
      add({ kind: 'projectile', from: shieldAt, to, via: via2, start: t0 + T.throw + T.flight, dur: T.back, emoji });
      at(T.throw + T.flight + T.back, () => {
        if (out.actorAtGround) add({ kind: 'dust', x: to[0], y: GROUND, start: performance.now() });
        else add({ kind: 'crumble', x: TOWER_X[a], y: yOf(before[a]), color: players[a].color, start: performance.now() });
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
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--climb-sky-top, #bfe9ff)" />
          <stop offset="1" stopColor="var(--climb-sky-bottom, #f2fbff)" />
        </linearGradient>
        <pattern id="bricks" width="32" height="18" patternUnits="userSpaceOnUse">
          <rect width="32" height="18" fill="none" />
          <path d="M0 9h32M16 0v9M0 9v9M32 9v9" stroke="rgba(0,0,0,.14)" strokeWidth="1.5" />
        </pattern>
      </defs>
      <rect y={-TOP} width={W} height={H + TOP} fill="url(#sky)" />
      {/* планини и облаци */}
      <path d={`M0 ${GROUND} L120 330 L210 410 L330 250 L420 380 L520 270 L640 400 L720 320 L800 380 L800 ${GROUND} Z`} fill="var(--climb-hills, #cde7d8)" opacity=".8" />
      <g opacity=".85" fill="#fff">
        <ellipse cx="120" cy="80" rx="46" ry="16" className="climb-cloud" />
        <ellipse cx="650" cy="60" rx="56" ry="18" className="climb-cloud" style={{ animationDelay: '-6s' }} />
        <ellipse cx="420" cy="120" rx="38" ry="12" className="climb-cloud" style={{ animationDelay: '-12s' }} />
      </g>
      <rect x="0" y={GROUND} width={W} height={H - GROUND} fill="var(--climb-ground, #8bc34a)" />
      <rect x="0" y={GROUND} width={W} height="6" fill="rgba(0,0,0,.12)" />

      {players.map((p, i) => (
        <Tower key={p.uid} p={p} side={i} h={shown[i]} />
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

function Tower({ p, side, h }: { p: ClimbPlayer; side: number; h: number }) {
  const x = TOWER_X[side];
  return (
    <g>
      {Array.from({ length: CLIMB.STEPS }, (_, k) => {
        const n = k + 1;
        const built = n <= h;
        const top = n === CLIMB.STEPS;
        const y = yOf(n);
        const w = top ? BLOCK_W + 34 : BLOCK_W - k * 3;
        return (
          <g key={n} className={built ? 'climb-block' : undefined}>
            <rect
              x={x - w / 2}
              y={y}
              width={w}
              height={STEP - 2}
              rx={top ? 10 : 6}
              fill={built ? p.color : 'transparent'}
              fillOpacity={built ? 0.85 : 0}
              stroke={built ? 'rgba(0,0,0,.25)' : 'rgba(0,0,0,.18)'}
              strokeWidth="2"
              strokeDasharray={built ? undefined : '6 6'}
            />
            {built && <rect x={x - w / 2} y={y} width={w} height={STEP - 2} rx={top ? 10 : 6} fill="url(#bricks)" />}
            {top && (
              <g>
                <line x1={x + w / 2 - 14} y1={y} x2={x + w / 2 - 14} y2={y - 46} stroke="#5b4636" strokeWidth="4" strokeLinecap="round" />
                <path d={`M${x + w / 2 - 14} ${y - 46} l30 9 l-30 9 Z`} fill={built ? p.color : '#ffc800'} className="climb-flag" />
              </g>
            )}
          </g>
        );
      })}
      <text x={x} y={GROUND + 28} textAnchor="middle" fontSize="15" fontWeight="900" fill="rgba(0,0,0,.55)">
        {h}/{CLIMB.STEPS}
      </text>
    </g>
  );
}

function Climber({ p, side, h, throwing, winner, you }: { p: ClimbPlayer; side: number; h: number; throwing: boolean; winner: boolean; you: boolean }) {
  const uri = useAvatarUri(p);
  const x = TOWER_X[side];
  const flip = side === 1 ? -1 : 1;
  return (
    <g className="climb-climber" style={{ transform: `translate(${x}px, ${yOf(h)}px)` }} opacity={p.left ? 0.35 : 1}>
      <g transform={`scale(${flip} 1)`}>
        {/* крака */}
        <rect x="-13" y="-30" width="11" height="30" rx="5" fill="#4b5563" />
        <rect x="2" y="-30" width="11" height="30" rx="5" fill="#374151" />
        {/* тяло */}
        <rect x="-18" y="-70" width="36" height="44" rx="13" fill={p.color} stroke="rgba(0,0,0,.2)" strokeWidth="2" />
        {/* задна ръка */}
        <rect x="-24" y="-66" width="10" height="32" rx="5" fill={p.color} stroke="rgba(0,0,0,.2)" strokeWidth="2" transform="rotate(12 -19 -62)" />
        {/* хвърляща ръка */}
        <g className={throwing ? 'climb-arm-throw' : 'climb-arm'} style={{ transformOrigin: '14px -64px' }}>
          <rect x="9" y="-66" width="10" height="32" rx="5" fill={p.color} stroke="rgba(0,0,0,.2)" strokeWidth="2" />
          <circle cx="14" cy="-34" r="6" fill="#f2c9a0" />
        </g>
      </g>
      {/* глава (аватарът) */}
      <image href={uri} x="-27" y="-124" width="54" height="54" />
      {winner && <text x="0" y="-130" textAnchor="middle" fontSize="30" className="climb-crown">👑</text>}
      {p.shieldArmed && <circle cx="0" cy="-62" r="66" fill="#1cb0f6" fillOpacity=".12" stroke="#1cb0f6" strokeWidth="3" strokeDasharray="8 6" className="climb-shield-idle" />}
      <g transform={`translate(0 ${winner ? -168 : -138})`}>
        <rect x={-Math.max(36, p.name.length * 4.4)} y="-14" width={Math.max(72, p.name.length * 8.8)} height="22" rx="11" fill="rgba(255,255,255,.92)" stroke={p.color} strokeWidth="2" />
        <text x="0" y="2" textAnchor="middle" fontSize="12" fontWeight="900" fill="#1f1f1f">
          {p.name.slice(0, 16)}
          {you ? ' (ти)' : ''}
        </text>
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
      <circle cx={x} cy={y} r="70" fill="#1cb0f6" fillOpacity=".22" stroke="#1cb0f6" strokeWidth="5" className={wasted ? 'climb-shield-waste' : 'climb-shield-flash'} />
      <text x={x} y={y - 80} textAnchor="middle" fontSize="15" fontWeight="900" fill="#1899d6" className="climb-pop-text">
        {wasted ? 'Щитът изгоря напразно' : '🛡️ Отбито!'}
      </text>
    </g>
  );
}
