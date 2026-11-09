'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CLIMB, CLIMB_CHAT, sanitizeAvatar, weaponById, type ClimbOutcome, type ClimbPlayer, type ClimbState, type ClimbTheme } from '@belmaster/shared';
import { avatarSvg } from '@/components/avatar/UserAvatar';
import { play } from '@/lib/sound';

/**
 * Сцената: планина ^ отстрани (рисуван фон), двамата играчи тръгват от двата края,
 * строят си стъпалата с чукче и се катерят към общата платформа на върха.
 * Координати: 1280×720 (фонът е 16:9).
 */
/** отгоре има още небе (огледано продължение на фона), за да се вижда победителят на върха */
const VB = { x: 0, y: -120, w: 1280, h: 840 };
/** цветът на небето в горния край на всеки фон — продължава нагоре без шев */
const SKY: Record<ClimbTheme, string> = { dusk: '#9a7ecb', night: '#194169', canyon: '#68b8ef' };
const SH = 50; // височина на стъпало
const SW = 84; // ширина на стъпало
const TOP1 = 650; // горният ръб на първото стъпало

interface ThemeGeo {
  /** ръбът на десния склон: [y, x] */
  edge: [number, number][];
  /** горният ръб на платформата на върха */
  plat: number;
  stone: [string, string, string];
  rim: string;
  moss: string;
  ink: string;
}

const THEMES: Record<ClimbTheme, ThemeGeo> = {
  dusk: {
    edge: [[140, 707], [180, 733], [220, 786], [260, 803], [300, 820], [340, 847], [380, 882], [420, 947], [460, 985], [500, 1030], [540, 1074], [580, 1118], [620, 1164], [660, 1212], [700, 1259]],
    plat: 140,
    stone: ['#b5a28c', '#94826f', '#6b5b52'],
    rim: '#f3d3a6',
    moss: '#6f8d4a',
    ink: '#3d322f',
  },
  night: { edge: [[200, 735], [260, 753], [620, 1108], [720, 1207]], plat: 168, stone: ['#aab3bd', '#7f8a96', '#545e6b'], rim: '#dfeaff', moss: '#4f7a6a', ink: '#252b36' },
  canyon: { edge: [[160, 700], [220, 764], [500, 1005], [720, 1201]], plat: 112, stone: ['#e0905f', '#c46a45', '#8f4630'], rim: '#ffd0a0', moss: '#7d8f3a', ink: '#5a2a1c' },
};

function geometry(theme: ClimbTheme) {
  const g = THEMES[theme];
  const E = g.edge;
  const edgeX = (y: number) => {
    for (let k = 0; k < E.length - 1; k++) {
      const [y0, x0] = E[k];
      const [y1, x1] = E[k + 1];
      if (y >= y0 && y <= y1) return x0 + ((x1 - x0) * (y - y0)) / (y1 - y0);
    }
    const [y0, x0] = E[E.length - 2];
    const [y1, x1] = E[E.length - 1];
    return x1 + ((x1 - x0) * (y - y1)) / (y1 - y0);
  };
  const dy = (TOP1 - (g.plat + 50)) / (CLIMB.STEPS - 2);
  /** Горен ляв ъгъл… по-точно: център отгоре на стъпало n (1..STEPS-1) за страна side. */
  const step = (side: number, n: number): [number, number] => {
    const y = TOP1 - (n - 1) * dy;
    const x = edgeX(y + SH / 2) - 34;
    return [side === 0 ? 1280 - x : x, y];
  };
  /** Къде стои героят при височина h (0 = на земята, STEPS = на върха). */
  const stand = (side: number, h: number): [number, number] => {
    if (h <= 0) {
      const [x] = step(side, 1);
      return [Math.min(1170, Math.max(110, x + (side === 0 ? -60 : 60))), TOP1 + SH];
    }
    if (h >= CLIMB.STEPS) return [622, g.plat + 4];
    return step(side, h);
  };
  return { ...g, step, stand };
}

/** Тайминг на анимациите (ms). */
const T = { build: 760, hop: 480, throw: 260, flight: 950, back: 780 };

type Fx =
  | { kind: 'projectile'; id: number; from: [number, number]; to: [number, number]; via: [number, number]; start: number; dur: number; emoji: string }
  | { kind: 'crumble'; id: number; x: number; y: number; start: number }
  | { kind: 'dust'; id: number; x: number; y: number; start: number }
  | { kind: 'sparks'; id: number; x: number; y: number; start: number }
  | { kind: 'shield'; id: number; x: number; y: number; start: number; wasted?: boolean };

type NewFx = Fx extends infer F ? (F extends { id: number } ? Omit<F, 'id'> : never) : never;

function useAvatarUri(p: ClimbPlayer | undefined) {
  return useMemo(() => {
    if (!p) return '';
    const svg = avatarSvg(sanitizeAvatar(p.avatar, null, p.isBot ? 'bot' : p.uid), 'none', { noBg: true });
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }, [p]);
}

export function ClimbScene({ state, chat = [] }: { state: ClimbState; chat?: { uid: string; key: string; at: number }[] }) {
  const players = state.players;
  const theme: ClimbTheme = state.theme ?? 'dusk';
  const geo = useMemo(() => geometry(theme), [theme]);
  const heights = players.map((p) => p.height);
  const [disp, setDisp] = useState<number[]>(heights);
  const [fx, setFx] = useState<Fx[]>([]);
  const [pose, setPose] = useState<Record<number, 'build' | 'throw' | 'flinch' | undefined>>({});
  /** стъпало, което се строи в момента: [страна, номер] */
  const [building, setBuilding] = useState<[number, number] | null>(null);
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
    const setP = (s: number, v: 'build' | 'throw' | 'flinch' | undefined) => setPose((p) => ({ ...p, [s]: v }));
    const hand = (s: number, h: number): [number, number] => {
      const [x, y] = geo.stand(s, h);
      return [x + (s === 0 ? 34 : -34), y - 92];
    };
    /** мястото, където пада предметът — горе на стъпалото (или земята) */
    const land = (s: number, h: number): [number, number] => {
      const [x, y] = geo.stand(s, h);
      return [x + (s === 0 ? 22 : -22), y + 6];
    };
    const arc = (a: [number, number], b: [number, number], lift = 230): [number, number] => [(a[0] + b[0]) / 2, Math.min(geo.plat - 120, Math.min(a[1], b[1]) - lift)];
    const impact = (s: number, h: number, sound: 'hit' | 'lost') => {
      const [x, y] = geo.stand(s, h);
      if (h <= 0) add({ kind: 'dust', x, y, start: performance.now() });
      else add({ kind: 'crumble', x: x + 0, y, start: performance.now() });
      setP(s, 'flinch');
      at(450, () => setP(s, undefined));
      play(sound);
      setDisp(heights);
    };

    const run = (out: ClimbOutcome) => {
      if (out.kind === 'climb') {
        const s = side(out.actorUid);
        const n = before[s] + 1;
        setP(s, 'build');
        setBuilding([s, n]);
        play('turn');
        // три удара с чукчето → искри
        for (const ms of [180, 430, 680]) {
          at(ms, () => {
            if (n < CLIMB.STEPS) {
              const [x, y] = geo.step(s, n);
              add({ kind: 'sparks', x: x + (s === 0 ? -14 : 14), y: y + 16, start: performance.now() });
            }
            play('tick');
          });
        }
        at(T.build, () => {
          setP(s, undefined);
          setBuilding(null);
          setDisp(heights);
        });
        return T.build + T.hop + 300;
      }
      if (out.kind === 'shield_wasted') {
        const s = side(out.targetUid);
        const [x, y] = geo.stand(s, before[s]);
        at(700, () => add({ kind: 'shield', x, y: y - 70, start: performance.now(), wasted: true }));
        return 1600;
      }
      const a = side(out.actorUid);
      const b = side(out.targetUid);
      const emoji = weaponById(out.weapon).emoji;
      setP(a, 'throw');
      at(420, () => setP(a, undefined));
      play('tick');
      const from = hand(a, before[a]);
      if (out.kind === 'hit') {
        const to = land(b, before[b]);
        add({ kind: 'projectile', from, to, via: arc(from, to), start: t0 + T.throw, dur: T.flight, emoji });
        at(T.throw + T.flight, () => impact(b, before[b], 'hit'));
        return T.throw + T.flight + 1100;
      }
      if (out.kind === 'miss') {
        // предметът не стига — пада обратно върху собственото стъпало
        const to = land(a, before[a]);
        add({ kind: 'projectile', from, to, via: [640 + (a === 0 ? -60 : 60), geo.plat - 170], start: t0 + T.throw, dur: T.flight + 200, emoji });
        at(T.throw + T.flight + 200, () => {
          if (!out.saved) return impact(a, before[a], 'lost');
          // щитът поема падането
          const [x, y] = geo.stand(a, before[a]);
          add({ kind: 'shield', x, y: y - 70, start: performance.now() });
          play('capture');
          setDisp(heights);
        });
        return T.throw + T.flight + 1400;
      }
      // reflect: до щита и обратно
      const [bx, by] = geo.stand(b, before[b]);
      const shieldAt: [number, number] = [bx + (b === 0 ? 60 : -60), by - 80];
      add({ kind: 'projectile', from, to: shieldAt, via: arc(from, shieldAt), start: t0 + T.throw, dur: T.flight, emoji });
      at(T.throw + T.flight, () => {
        add({ kind: 'shield', x: bx, y: by - 70, start: performance.now() });
        play('capture');
      });
      const to = land(a, before[a]);
      add({ kind: 'projectile', from: shieldAt, to, via: arc(shieldAt, to, 200), start: t0 + T.throw + T.flight, dur: T.back, emoji });
      at(T.throw + T.flight + T.back, () => {
        if (!out.saved) return impact(a, before[a], 'hit');
        const [x, y] = geo.stand(a, before[a]);
        add({ kind: 'shield', x, y: y - 70, start: performance.now() });
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
      setPose({});
      setBuilding(null);
    });
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.outcome?.id, heights.join(',')]);

  // победителят стъпва на платформата горе
  const finished = state.phase === 'finished';
  const shown = disp.map((h, i) => (finished && state.winnerUid === players[i]?.uid ? CLIMB.STEPS : h));

  return (
    <svg viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`} className="block h-auto w-full select-none" role="img" aria-label="Планината">
      <defs>
        <linearGradient id="climb-stone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={geo.stone[0]} />
          <stop offset=".5" stopColor={geo.stone[1]} />
          <stop offset="1" stopColor={geo.stone[2]} />
        </linearGradient>
        <radialGradient id="climb-sun">
          <stop offset="0" stopColor="#fff6d6" />
          <stop offset=".35" stopColor="#ffe08a" />
          <stop offset=".5" stopColor="#ffcf7a" stopOpacity=".5" />
          <stop offset="1" stopColor="#ffb070" stopOpacity="0" />
        </radialGradient>
        <filter id="climb-ds" x="-20%" y="-20%" width="140%" height="160%">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#1a1220" floodOpacity=".45" />
        </filter>
      </defs>
      <linearGradient id="climb-skyfade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={SKY[theme]} />
        <stop offset="1" stopColor={SKY[theme]} stopOpacity="0" />
      </linearGradient>
      <rect x="0" y="-130" width="1280" height="140" fill={SKY[theme]} />
      <image href={`/climb/${theme}.webp`} x="0" y="0" width="1280" height="720" preserveAspectRatio="none" />
      <rect x="0" y="0" width="1280" height="40" fill="url(#climb-skyfade)" />
      {theme === 'dusk' && <circle cx="1030" cy="300" r="170" fill="url(#climb-sun)" />}
      {/* знамето на върха */}
      <g transform={`translate(676 ${geo.plat - 100})`}>
        <rect x="0" y="0" width="5" height="100" fill="#5b3b2b" />
        <path d="M5 4 q36 9 70 0 q-9 16 0 32 q-34 9 -70 0 z" fill="#ff7a2f" stroke="#7a2e12" strokeWidth="2" className="climb-flag" />
      </g>

      {players.map((p, i) => (
        <Steps key={p.uid} side={i} h={shown[i]} building={building?.[0] === i ? building[1] : null} geo={geo} />
      ))}

      {fx.map((f) => {
        if (f.kind === 'crumble') return <Crumble key={f.id} x={f.x} y={f.y} color={geo.stone[1]} />;
        if (f.kind === 'dust') return <Dust key={f.id} x={f.x} y={f.y} />;
        if (f.kind === 'sparks') return <Sparks key={f.id} x={f.x} y={f.y} />;
        if (f.kind === 'shield') return <ShieldFlash key={f.id} x={f.x} y={f.y} wasted={f.wasted} />;
        // летящ предмет по крива на Безие
        const t = Math.min(1, Math.max(0, (now - f.start) / f.dur));
        if (now < f.start || t >= 1) return null;
        const v = f.via;
        const x = (1 - t) ** 2 * f.from[0] + 2 * (1 - t) * t * v[0] + t ** 2 * f.to[0];
        const y = (1 - t) ** 2 * f.from[1] + 2 * (1 - t) * t * v[1] + t ** 2 * f.to[1];
        return (
          <g key={f.id}>
            <ellipse cx={x} cy={y + 4} rx="16" ry="6" fill="#000" opacity=".12" />
            <text x={x} y={y} fontSize="40" textAnchor="middle" dominantBaseline="central" transform={`rotate(${t * 540} ${x} ${y})`}>
              {f.emoji}
            </text>
          </g>
        );
      })}

      {players.map((p, i) => (
        <Climber key={p.uid} p={p} side={i} pos={geo.stand(i, shown[i])} pose={pose[i]} winner={finished && state.winnerUid === p.uid} you={p.uid === state.you} />
      ))}
      <ChatBubbles chat={chat} players={players} pos={players.map((_, i) => geo.stand(i, shown[i]))} />
      {players.map((p, i) => {
        return (
          <g key={p.uid} transform={`translate(${i === 0 ? 60 : 1220} -92)`}>
            <rect x="-34" y="-17" width="68" height="30" rx="15" fill="rgba(0,0,0,.45)" />
            <text x="0" y="5" textAnchor="middle" fontSize="18" fontWeight="900" fill="#fff">
              {shown[i]}/{CLIMB.STEPS}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Steps({ side, h, building, geo }: { side: number; h: number; building: number | null; geo: ReturnType<typeof geometry> }) {
  return (
    <g>
      {Array.from({ length: CLIMB.STEPS - 1 }, (_, k) => {
        const n = k + 1;
        const [cx, y] = geo.step(side, n);
        const x = cx - SW / 2;
        if (building === n) {
          return (
            <g key={n}>
              <rect x={x} y={y} width={SW} height={SH} rx="9" fill="none" stroke="#fff" strokeOpacity=".85" strokeWidth="2.5" strokeDasharray="7 6" />
              <g className="climb-build" style={{ transformOrigin: `${cx}px ${y + SH}px` }}>
                <Stone x={x} y={y} geo={geo} />
              </g>
            </g>
          );
        }
        if (n > h) return <rect key={n} x={x} y={y} width={SW} height={SH} rx="9" fill="#fff" fillOpacity=".08" stroke="#fff" strokeOpacity=".4" strokeWidth="2" strokeDasharray="7 7" />;
        return <Stone key={n} x={x} y={y} geo={geo} />;
      })}
    </g>
  );
}

function Stone({ x, y, geo }: { x: number; y: number; geo: ReturnType<typeof geometry> }) {
  return (
    <g filter="url(#climb-ds)">
      <rect x={x} y={y} width={SW} height={SH} rx="9" fill="url(#climb-stone)" stroke={geo.ink} strokeWidth="2" />
      <path d={`M${x + 6} ${y + 6} h${SW - 12}`} stroke={geo.rim} strokeWidth="4" strokeLinecap="round" opacity=".9" />
      <path d={`M${x + 28} ${y + 4} v${SH - 8} M${x + 58} ${y + SH / 2} v${SH / 2 - 4} M${x + 4} ${y + SH / 2} h${SW - 8}`} stroke={geo.ink} strokeOpacity=".35" strokeWidth="2" />
      <path d={`M${x + 8} ${y + SH - 6} q10 4 22 0`} stroke={geo.moss} strokeWidth="4" strokeLinecap="round" opacity=".8" />
    </g>
  );
}

/** Чиби човече: голяма глава (аватарът без фон), кръгло тяло, крачета; чукче при строене. */
function Climber({ p, side, pos, pose, winner, you }: { p: ClimbPlayer; side: number; pos: [number, number]; pose?: 'build' | 'throw' | 'flinch'; winner: boolean; you: boolean }) {
  const uri = useAvatarUri(p);
  const flip = side === 1 ? -1 : 1;
  const id = `c${side}`;
  const ink = '#1f1f1f';
  const label = `${p.name.slice(0, 16)}${you ? ' (ти)' : ''}`;
  const w = Math.max(80, label.length * 8.6 + 20);
  return (
    <g className="climb-climber" style={{ transform: `translate(${pos[0]}px, ${pos[1]}px)` }} opacity={p.left ? 0.35 : 1}>
      <g key={`${pos[0]}-${pos[1]}`} className={pose === 'flinch' ? 'climb-flinch' : 'climb-hop'}>
        <defs>
          <radialGradient id={`${id}-body`} cx="35%" cy="25%" r="85%">
            <stop offset="0" stopColor="#fff" stopOpacity=".55" />
            <stop offset=".35" stopColor={p.color} />
            <stop offset="1" stopColor={p.color} />
          </radialGradient>
          <linearGradient id={`${id}-limb`} x1="0" x2="1">
            <stop offset="0" stopColor={p.color} />
            <stop offset=".35" stopColor="#fff" stopOpacity=".35" />
            <stop offset=".6" stopColor={p.color} />
            <stop offset="1" stopColor="#000" stopOpacity=".3" />
          </linearGradient>
        </defs>
        <ellipse cx="0" cy="2" rx="30" ry="6" fill="#000" opacity=".28" />
        <g transform={`scale(${flip} 1)`}>
          <rect x="-19" y="-24" width="15" height="24" rx="7" fill="#3b4252" stroke={ink} strokeWidth="2.5" />
          <rect x="4" y="-24" width="15" height="24" rx="7" fill="#3b4252" stroke={ink} strokeWidth="2.5" />
          <ellipse cx="-12" cy="-2" rx="11" ry="6" fill="#222" stroke={ink} strokeWidth="2.5" />
          <ellipse cx="12" cy="-2" rx="11" ry="6" fill="#222" stroke={ink} strokeWidth="2.5" />
          <ellipse cx="-26" cy="-40" rx="8" ry="15" fill={`url(#${id}-limb)`} stroke={ink} strokeWidth="2.5" transform="rotate(20 -26 -40)" />
          <ellipse cx="0" cy="-42" rx="24" ry="25" fill={`url(#${id}-body)`} stroke={ink} strokeWidth="2.5" />
          <rect x="-24" y="-30" width="48" height="6" fill="#000" opacity=".18" />
          {pose === 'throw' ? (
            <ellipse cx="28" cy="-58" rx="8" ry="15" fill={`url(#${id}-limb)`} stroke={ink} strokeWidth="2.5" transform="rotate(-110 28 -58)" />
          ) : pose === 'build' ? (
            <ellipse cx="32" cy="-58" rx="8" ry="16" fill={`url(#${id}-limb)`} stroke={ink} strokeWidth="2.5" transform="rotate(-125 32 -58)" />
          ) : (
            <ellipse cx="26" cy="-40" rx="8" ry="15" fill={`url(#${id}-limb)`} stroke={ink} strokeWidth="2.5" transform="rotate(-20 26 -40)" />
          )}
        </g>
        <image href={uri} x="-50" y="-140" width="100" height="100" />
        {pose === 'build' && (
          <g transform={`scale(${flip} 1)`}>
            <g className="climb-hammer" style={{ transformOrigin: '40px -66px' }}>
              <rect x="37" y="-124" width="7" height="60" rx="3" fill="#8b5a2b" stroke={ink} strokeWidth="2.5" />
              <rect x="24" y="-140" width="34" height="20" rx="4" fill="#9aa3ad" stroke={ink} strokeWidth="2.5" />
              <rect x="26" y="-138" width="30" height="5" rx="2" fill="#fff" opacity=".5" />
            </g>
            <circle cx="40" cy="-66" r="8" fill="#f2d3b1" stroke={ink} strokeWidth="2.5" />
          </g>
        )}
        {winner && (
          <text x="0" y="-152" textAnchor="middle" fontSize="34" className="climb-crown">
            👑
          </text>
        )}
        {p.shieldArmed && <circle cx="0" cy="-70" r="80" fill="#1cb0f6" fillOpacity=".12" stroke="#1cb0f6" strokeWidth="3" strokeDasharray="8 6" className="climb-shield-idle" />}
        <g transform={`translate(0 ${winner ? -190 : -152})`}>
          <rect x={-w / 2} y="-14" width={w} height="26" rx="13" fill="rgba(255,255,255,.95)" stroke={p.color} strokeWidth="2.5" />
          <text x="0" y="5" textAnchor="middle" fontSize="14" fontWeight="900" fill="#1f1f1f">
            {label}
          </text>
        </g>
      </g>
    </g>
  );
}

function Sparks({ x, y }: { x: number; y: number }) {
  const star = (cx: number, cy: number, r: number) =>
    Array.from({ length: 8 }, (_, k) => {
      const a = (k * Math.PI) / 4;
      const rr = k % 2 ? r * 0.35 : r;
      return `${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`;
    }).join(' ');
  return (
    <g className="climb-sparks" style={{ transformOrigin: `${x}px ${y}px` }}>
      <polygon points={star(x, y, 16)} fill="#ffd84a" />
      <polygon points={star(x + 22, y - 14, 9)} fill="#fff3a8" />
      <polygon points={star(x - 18, y - 10, 8)} fill="#ffb020" />
      <circle cx={x - 28} cy={y + 8} r="5" fill="#b9a68f" />
      <circle cx={x + 32} cy={y + 6} r="4" fill="#b9a68f" />
    </g>
  );
}

function Crumble({ x, y, color }: { x: number; y: number; color: string }) {
  const parts = useMemo(() => Array.from({ length: 9 }, (_, i) => ({ dx: (i - 4) * 10 + (Math.random() - 0.5) * 8, r: (Math.random() - 0.5) * 220, d: 0.6 + Math.random() * 0.5 })), []);
  return (
    <g>
      {parts.map((p, i) => (
        <rect
          key={i}
          x={x + p.dx - 9}
          y={y + 8}
          width="18"
          height="15"
          rx="3"
          fill={color}
          stroke="rgba(0,0,0,.35)"
          className="climb-crumble"
          style={{ ['--r' as string]: `${p.r}deg`, animationDuration: `${p.d}s`, transformOrigin: `${x + p.dx}px ${y + 14}px` }}
        />
      ))}
      <circle cx={x} cy={y + 10} r="40" fill="#ffc800" opacity=".55" className="climb-boom" />
    </g>
  );
}

function Dust({ x, y }: { x: number; y: number }) {
  return (
    <g className="climb-dust">
      <ellipse cx={x - 22} cy={y - 4} rx="18" ry="9" fill="#b9a27a" />
      <ellipse cx={x + 20} cy={y - 6} rx="20" ry="10" fill="#c8b48c" />
      <ellipse cx={x} cy={y - 12} rx="16" ry="8" fill="#d7c6a2" />
    </g>
  );
}

function ShieldFlash({ x, y, wasted }: { x: number; y: number; wasted?: boolean }) {
  return (
    <g>
      <circle cx={x} cy={y} r="96" fill="#1cb0f6" fillOpacity=".22" stroke="#1cb0f6" strokeWidth="5" className={wasted ? 'climb-shield-waste' : 'climb-shield-flash'} />
      <text x={x} y={y - 108} textAnchor="middle" fontSize="18" fontWeight="900" fill="#fff" stroke="#1899d6" strokeWidth="4" paintOrder="stroke" className="climb-pop-text">
        {wasted ? 'Щитът изгоря напразно' : '🛡️ Отбито!'}
      </text>
    </g>
  );
}

/** Балончета с бързите съобщения над главите (2,6 с). */
function ChatBubbles({ chat, players, pos }: { chat: { uid: string; key: string; at: number }[]; players: ClimbPlayer[]; pos: [number, number][] }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 300);
    return () => clearInterval(t);
  }, []);
  return (
    <g>
      {players.map((p, i) => {
        const c = [...chat].reverse().find((m) => m.uid === p.uid && now - m.at < 2600);
        if (!c) return null;
        const text = CLIMB_CHAT.find((m) => m.key === c.key)?.text ?? '';
        const w = Math.max(60, text.length * 10 + 24);
        const x = pos[i][0] + (i === 0 ? 50 : -50);
        const y = pos[i][1] - 200;
        return (
          <g key={`${c.at}-${p.uid}`} className="climb-bubble" transform={`translate(${x} ${y})`}>
            <rect x={-w / 2} y="-22" width={w} height="38" rx="19" fill="#fff" stroke={p.color} strokeWidth="2.5" />
            <path d={i === 0 ? 'M-30 14 l-14 14 l26 -12z' : 'M30 14 l14 14 l-26 -12z'} fill="#fff" stroke={p.color} strokeWidth="2.5" strokeLinejoin="round" />
            <rect x={-w / 2 + 3} y="-19" width={w - 6} height="32" rx="16" fill="#fff" />
            <text x="0" y="4" textAnchor="middle" fontSize="17" fontWeight="800" fill="#1f1f1f">
              {text}
            </text>
          </g>
        );
      })}
    </g>
  );
}
