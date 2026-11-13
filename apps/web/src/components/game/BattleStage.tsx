'use client';

/**
 * Картата за „Битка“ — релефен остров в море, рисувани замъци, знамена на завладените
 * области, гори и хълмове в свободните, ефекти при превземане и нападение. Старият вид е запазен в MapBoard.tsx (резерва).
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { GameMap, GameState } from '@belmaster/shared';
import { UserAvatar } from '@/components/avatar/UserAvatar';
import { cn } from '@/lib/cn';
import type { MapBubble } from './MapBoard';
import './battle-stage.css';

interface Props {
  map: GameMap;
  state: Pick<GameState, 'players' | 'regions' | 'mode'>;
  selectable: string[];
  onSelect?: (regionId: string) => void;
  onBlocked?: (regionId: string) => void;
  highlight?: string | null;
  attackColor?: string;
  bubbles?: MapBubble[];
  className?: string;
}

const INK = '#141a33';
/** свободната земя е пясъчна — да не се бърка със зеления играч */
const GRASS = ['#ecdcae', '#e4d19c', '#f1e3b8', '#e8d6a4'];
const TOP = 56; // въздух над картата — за знамената на северните замъци
const rnd = (a: number, b: number) => {
  const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return v - Math.floor(v);
};
const shorten = (s: string, n = 14) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

function polys(d: string): [number, number][][] {
  return d
    .split('M')
    .filter(Boolean)
    .map((sub) => {
      const nums = sub.match(/-?\d+(\.\d+)?/g)!.map(Number);
      const pts: [number, number][] = [];
      for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
      return pts;
    });
}
function inside(x: number, y: number, poly: [number, number][]) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
/** разстояние до най-близкия ръб — за да не стърчат дърветата извън областта */
function edgeDist(x: number, y: number, poly: [number, number][]) {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j], [bx, by] = poly[i];
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return best;
}

interface Deco {
  x: number;
  y: number;
  kind: 'tree' | 'pine' | 'hill' | 'rock';
  s: number;
}

function Castle({ color, hp, hit }: { color: string; hp: number; hit: boolean }) {
  return (
    <g className={hit ? 'bs-hit' : undefined}>
      <ellipse cx="0" cy="6" rx="46" ry="11" fill="#0b1030" opacity=".3" />
      {/* странични кули */}
      {[-30, 30].map((x) => (
        <g key={x} transform={`translate(${x} 0)`}>
          <rect x="-11" y="-38" width="22" height="42" fill="#e9ecfb" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          <rect x="4" y="-36" width="6" height="38" fill="#141a33" opacity=".12" />
          <path d="M-15 -38L0 -62L15 -38z" fill={color} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          <path d="M0 -62L15 -38H6z" fill="#000" opacity=".16" />
          <rect x="-3" y="-28" width="6" height="10" rx="3" fill={INK} />
        </g>
      ))}
      {/* стена с порта */}
      <path d="M-22 4V-24h7v6h8v-6h14v6h8v-6h7V4z" fill="#f6f7ff" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M-8 4v-12a8 8 0 0 1 16 0v12z" fill="#7a4a2b" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M0 -15v19" stroke={INK} strokeWidth="2" />
      {/* главна кула със знаме */}
      <rect x="-9" y="-52" width="18" height="30" fill="#e9ecfb" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M-13 -52L0 -72L13 -52z" fill={color} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M0 -72v-22" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <path className="bs-wave" d="M0 -94q9 -5 18 0t16 0v13q-8 5 -16 0t-18 0z" fill={color} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      {/* сърца */}
      {[0, 1, 2].map((i) => (
        <path key={i} transform={`translate(${-22 + i * 22} 12)`} d="M0 6C-9 0 -6 -8 0 -3C6 -8 9 0 0 6Z" fill={i < hp ? '#ff4b5f' : '#3a4168'} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      ))}
    </g>
  );
}

function Flag({ color }: { color: string }) {
  return (
    <g className="bs-plant">
      <ellipse cx="0" cy="2" rx="13" ry="4.5" fill="#0b1030" opacity=".3" />
      <path d="M0 2V-44" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      <path d="M0 2V-44" stroke="#f1e2c0" strokeWidth="1.5" strokeLinecap="round" />
      <path className="bs-wave" d="M1 -44q10 -6 19 0t15 0v17q-7 5 -15 0t-19 0z" fill={color} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="0" cy="-46" r="3.5" fill="#ffd84d" stroke={INK} strokeWidth="2" />
    </g>
  );
}

function DecoArt({ d }: { d: Deco }) {
  const t = `translate(${d.x} ${d.y}) scale(${d.s})`;
  if (d.kind === 'tree')
    return (
      <g transform={t}>
        <ellipse cx="0" cy="1" rx="11" ry="3.5" fill="#0b1030" opacity=".22" />
        <rect x="-2.5" y="-10" width="5" height="11" fill="#7a4a2b" stroke={INK} strokeWidth="2" />
        <circle cx="0" cy="-19" r="12" fill="#3f9a4d" stroke={INK} strokeWidth="2.5" />
        <circle cx="-4" cy="-23" r="4" fill="#6cc46f" />
      </g>
    );
  if (d.kind === 'pine')
    return (
      <g transform={t}>
        <ellipse cx="0" cy="1" rx="10" ry="3.5" fill="#0b1030" opacity=".22" />
        <rect x="-2" y="-6" width="4" height="7" fill="#7a4a2b" stroke={INK} strokeWidth="2" />
        <path d="M0 -36L11 -18H6L13 -5H-13L-6 -18H-11z" fill="#2f7d55" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      </g>
    );
  if (d.kind === 'hill')
    return (
      <g transform={t}>
        <path d="M-22 0Q-8 -30 2 -12Q10 -26 22 0z" fill="#b7c2a0" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M-9 -17q3 -7 7 -1l-3 4z" fill="#fff" />
      </g>
    );
  return (
    <g transform={t}>
      <path d="M-9 0l3 -9 8 -3 7 6 1 6z" fill="#c9cdee" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
    </g>
  );
}

export function BattleStage({ map, state, selectable, onSelect, onBlocked, highlight, attackColor, bubbles = [], className }: Props) {
  const uid = useId().replace(/:/g, '');
  const id = (n: string) => `${n}-${uid}`;
  const colors = new Map(state.players.map((p) => [p.uid, p.color]));
  const sel = new Set(selectable);
  const works = state.mode === 'WORKS';
  const W = map.width, H = map.height;

  // украса: гори, хълмове и камъни в областите — винаги на едни и същи места
  const deco = useMemo(() => {
    const out: Record<string, Deco[]> = {};
    map.regions.forEach((r, ri) => {
      const poly = polys(r.path)[0];
      const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
      const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      const list: Deco[] = [];
      for (let k = 0; k < 60 && list.length < 5; k++) {
        const x = x0 + rnd(ri + 1, k) * (x1 - x0), y = y0 + rnd(ri + 7, k + 3) * (y1 - y0);
        if (!inside(x, y, poly) || edgeDist(x, y, poly) < 24) continue;
        // средата е за името, знамето и замъка
        if (Math.abs(x - r.center[0]) < 96 && y > r.center[1] - 116 && y < r.center[1] + 78) continue;
        if (list.some((d) => Math.hypot(d.x - x, d.y - y) < 34)) continue;
        const v = rnd(ri + 13, k);
        list.push({ x, y, kind: v < 0.4 ? 'tree' : v < 0.72 ? 'pine' : v < 0.9 ? 'hill' : 'rock', s: 0.8 + rnd(ri, k + 9) * 0.35 });
      }
      out[r.id] = list.sort((a, b) => a.y - b.y);
    });
    return out;
  }, [map]);

  // какво се промени току-що → ефекти
  const prev = useRef<Record<string, { owner: string | null; hp: number }>>({});
  const [fx, setFx] = useState<{ key: number; captured: string[]; hit: string[] }>({ key: 0, captured: [], hit: [] });
  const lastMap = useRef(map.id);
  useEffect(() => {
    // нова карта → без ефекти от старата
    if (lastMap.current !== map.id) {
      lastMap.current = map.id;
      prev.current = {};
    }
    const captured: string[] = [], hit: string[] = [];
    for (const [rid, r] of Object.entries(state.regions)) {
      const old = prev.current[rid];
      if (old) {
        if (old.owner !== r.owner && r.owner) captured.push(rid);
        if (r.capital && r.hp < old.hp) hit.push(rid);
      }
      prev.current[rid] = { owner: r.owner, hp: r.hp };
    }
    if (!captured.length && !hit.length) return;
    setFx((f) => ({ key: f.key + 1, captured, hit }));
    const t = setTimeout(() => setFx((f) => ({ ...f, captured: [], hit: [] })), 1500);
    return () => clearTimeout(t);
  }, [state.regions, map.id]);

  const target = highlight ? map.regions.find((r) => r.id === highlight) : null;
  // откъде идва нападението: най-близката съседна област на нападателя
  const from = useMemo(() => {
    if (!target || !attackColor) return null;
    const mine = target.neighbors.map((n) => map.regions.find((r) => r.id === n)!).filter((r) => r && colors.get(state.regions[r.id]?.owner ?? '') === attackColor);
    return mine[0] ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, attackColor, state.regions]);

  // ред на рисуване: отгоре надолу, за да не се застъпват замъци и знамена
  const order = useMemo(() => [...map.regions].sort((a, b) => a.center[1] - b.center[1]), [map]);

  return (
    <svg viewBox={`0 ${-TOP} ${W} ${H + TOP}`} className={cn('bs block h-auto w-full select-none', className)} role="img" aria-label={map.name}>
      <defs>
        <linearGradient id={id('sea')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={works ? '#3a6f8f' : '#2f8fe0'} />
          <stop offset="1" stopColor={works ? '#1f4660' : '#1b55b0'} />
        </linearGradient>
        <pattern id={id('waves')} width="120" height="56" patternUnits="userSpaceOnUse">
          <path d="M8 18q10 -9 20 0t20 0" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".22" />
          <path d="M70 44q9 -8 18 0t18 0" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".14" />
        </pattern>
        <filter id={id('soft')}>
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <clipPath id={id('frame')}>
          <rect y={-TOP} width={W} height={H + TOP} rx="28" />
        </clipPath>
        {map.regions.map((r) => (
          <clipPath key={r.id} id={id(`c-${r.id}`)}>
            <path d={r.path} />
          </clipPath>
        ))}
      </defs>

      <g clipPath={`url(#${id('frame')})`}>
        {/* море */}
        <rect y={-TOP} width={W} height={H + TOP} fill={`url(#${id('sea')})`} />
        <rect className="bs-sea" x="-120" y={-TOP} width={W + 240} height={H + TOP} fill={`url(#${id('waves')})`} />
        {/* плитчина и пяна около брега */}
        <path d={map.outline} fillRule="evenodd" fill="none" stroke="#9fe6ff" strokeWidth="58" strokeLinejoin="round" opacity=".42" filter={`url(#${id('soft')})`} />
        <path className="bs-foam" d={map.outline} fillRule="evenodd" fill="none" stroke="#fff" strokeWidth="5" strokeLinejoin="round" strokeDasharray="26 18" opacity=".7" transform="translate(0 22)" />
        {/* скалата под острова — дава височина */}
        {[20, 15, 10, 5].map((dy) => (
          <path key={dy} d={map.outline} fillRule="evenodd" transform={`translate(0 ${dy})`} fill={dy > 12 ? '#6b4a34' : '#8a6344'} stroke={INK} strokeWidth={dy === 20 ? 6 : 0} strokeLinejoin="round" />
        ))}
        <path d={map.outline} fillRule="evenodd" fill="#f1dfae" stroke={INK} strokeWidth="6" strokeLinejoin="round" />

        {/* области */}
        {map.regions.map((r, i) => {
          const reg = state.regions[r.id];
          const color = reg?.owner ? colors.get(reg.owner) ?? '#999' : null;
          const can = sel.has(r.id);
          return (
            <g key={r.id} onClick={can && onSelect ? () => onSelect(r.id) : onBlocked ? () => onBlocked(r.id) : undefined} className={can ? 'bs-can' : undefined}>
              <path d={r.path} fill={color ?? GRASS[i % GRASS.length]} className="bs-fill" />
              <g clipPath={`url(#${id(`c-${r.id}`)})`} className="pointer-events-none">
                {color && <path d={r.path} fill="#fff" opacity=".1" />}
                {/* фаска: светъл ръб отгоре, тъмен отдолу */}
                <path d={r.path} fill="none" stroke="#fff" strokeOpacity={color ? 0.42 : 0.55} strokeWidth="12" transform="translate(0 5)" />
                <path d={r.path} fill="none" stroke="#06102e" strokeOpacity=".2" strokeWidth="12" transform="translate(0 -5)" />
              </g>
              <path d={r.path} fill="none" stroke={INK} strokeOpacity=".8" strokeWidth="3.5" strokeLinejoin="round" className="pointer-events-none" />
              {can && <path d={r.path} fill="#fff" fillOpacity=".22" stroke="#fff" strokeWidth="6" strokeDasharray="12 9" strokeLinejoin="round" className="bs-pulse pointer-events-none" />}
              {fx.captured.includes(r.id) && <path key={fx.key} d={r.path} fill="#fff" className="bs-flash pointer-events-none" />}
            </g>
          );
        })}

        {/* украса, знамена, замъци и имена */}
        {order.map((r) => {
          const reg = state.regions[r.id];
          const [x, y] = r.center;
          const owner = reg?.owner ? state.players.find((p) => p.uid === reg.owner) : undefined;
          const label = works && reg?.workTitle ? shorten(reg.workTitle) : r.name;
          const ly = reg?.capital ? y + 40 : y + 14;
          return (
            <g key={r.id} className="pointer-events-none">
              {!owner && deco[r.id].map((d, k) => <DecoArt key={k} d={d} />)}
              {owner && deco[r.id].slice(0, 2).map((d, k) => <DecoArt key={k} d={d} />)}
              {reg?.capital ? (
                <g transform={`translate(${x} ${y - 4})`}>
                  <Castle key={`${fx.key}-${fx.hit.includes(r.id)}`} color={owner?.color ?? '#9aa4d0'} hp={reg.hp} hit={fx.hit.includes(r.id)} />
                  {owner && (
                    <g transform="translate(-86 -62)">
                      <rect x="-4" y="-4" width="52" height="52" rx="15" fill={owner.color} stroke={INK} strokeWidth="3" />
                      <foreignObject x="0" y="0" width="44" height="44">
                        <UserAvatar avatar={owner.avatar} name={owner.uid} size={44} />
                      </foreignObject>
                    </g>
                  )}
                </g>
              ) : (
                owner && (
                  <g transform={`translate(${x} ${y - 8})`} key={owner.uid}>
                    <Flag color={owner.color} />
                  </g>
                )
              )}
              <text x={x} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize={works ? 18 : 21} fontWeight={900} fill="#fff" stroke={INK} strokeWidth="5" strokeLinejoin="round" paintOrder="stroke">
                {label}
              </text>
              {!works && r.sub && (
                <text x={x} y={ly + 21} textAnchor="middle" dominantBaseline="middle" fontSize={14} fontWeight={800} fill="#fff7d6" stroke={INK} strokeWidth="4" strokeLinejoin="round" paintOrder="stroke">
                  {r.sub}
                </text>
              )}
            </g>
          );
        })}

        {/* нападение: дъга от областта на нападателя и мечове над целта */}
        {target && (
          <g className="pointer-events-none">
            <path d={target.path} fill={attackColor ?? '#fff'} fillOpacity=".22" stroke={attackColor ?? '#fff'} strokeWidth="9" strokeDasharray="20 12" strokeLinejoin="round" className="bs-march" />
            <path d={target.path} fill="none" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
            {from && (
              <path
                d={`M${from.center[0]} ${from.center[1] - 20}Q${(from.center[0] + target.center[0]) / 2} ${Math.min(from.center[1], target.center[1]) - 120} ${target.center[0]} ${target.center[1] - 30}`}
                fill="none"
                stroke="#fff"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray="4 16"
                className="bs-march"
              />
            )}
            <g transform={`translate(${target.center[0]} ${target.center[1] - 74})`}>
              <g className="bs-bob">
                <circle r="27" fill={attackColor ?? INK} stroke={INK} strokeWidth="4" />
                <circle r="27" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="2" />
                <text textAnchor="middle" dominantBaseline="central" fontSize="26">⚔️</text>
              </g>
            </g>
          </g>
        )}

        {/* превземане: ударна вълна и конфети в цвета на новия собственик */}
        {fx.captured.map((rid) => {
          const r = map.regions.find((q) => q.id === rid);
          if (!r) return null;
          const c = colors.get(state.regions[rid]?.owner ?? '') ?? '#fff';
          return (
            <g key={`${fx.key}-${rid}`} transform={`translate(${r.center[0]} ${r.center[1]})`} className="pointer-events-none">
              <circle r="30" fill="none" stroke="#fff" strokeWidth="8" className="bs-ring" />
              {Array.from({ length: 14 }, (_, k) => {
                const a = (k / 14) * Math.PI * 2 + rnd(k, 3);
                const d = 60 + rnd(k, 5) * 70;
                return <rect key={k} x="-5" y="-5" width="10" height="10" rx="2" fill={k % 3 ? c : '#fff'} stroke={INK} strokeWidth="1.5" className="bs-bit" style={{ '--dx': `${Math.cos(a) * d}px`, '--dy': `${Math.sin(a) * d - 40}px`, '--r': `${(rnd(k, 9) - 0.5) * 720}deg` } as React.CSSProperties} />;
              })}
            </g>
          );
        })}

        {/* реакции от чата */}
        {bubbles.map((b) => (
          <g key={b.id} className="pointer-events-none animate-float-up" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
            <g transform={`translate(${b.x} ${b.y - 40})`}>
              <rect x={-Math.max(40, b.text.length * 9)} y={-26} width={Math.max(80, b.text.length * 18)} height={52} rx={26} fill="#fff" stroke={b.color} strokeWidth={5} />
              <text textAnchor="middle" dominantBaseline="central" fontSize={b.text.length <= 3 ? 32 : 20} fontWeight={800} fill="#1f1f1f">
                {b.text}
              </text>
            </g>
          </g>
        ))}
      </g>
      <rect x="2" y={2 - TOP} width={W - 4} height={H + TOP - 4} rx="27" fill="none" stroke="#0a1030" strokeOpacity=".6" strokeWidth="4" />
    </svg>
  );
}
