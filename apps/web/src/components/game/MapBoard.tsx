'use client';

/** РЕЗЕРВА: старият вид на картата за „Битка“ (трева и море от картинки). Играта ползва BattleStage.tsx. */

import { useEffect, useId, useRef, useState } from 'react';
import type { GameMap, GameState } from '@belmaster/shared';
import { cn } from '@/lib/cn';
import { UserAvatar } from '@/components/avatar/UserAvatar';

interface Props {
  map: GameMap;
  state: GameState;
  selectable: string[];
  onSelect?: (regionId: string) => void;
  onBlocked?: (regionId: string) => void;
  highlight?: string | null;
  className?: string;
  attackColor?: string;
  bubbles?: MapBubble[];
}

function shorten(s: string, n = 14) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

export interface MapBubble {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
}

export function MapBoard({ map, state, selectable, onSelect, onBlocked, highlight, className, attackColor, bubbles = [] }: Props) {
  const colors = new Map(state.players.map((p) => [p.uid, p.color]));
  const sel = new Set(selectable);
  const works = state.mode === 'WORKS';
  // класическата битка — рисувана карта (море и трева), битката на произведенията — стара карта (пергамент)
  const uid = useId().replace(/:/g, '');
  const id = (n: string) => `${n}-${uid}`;

  // кои области току-що смениха собственик / коя столица беше ударена → кратка анимация
  const prev = useRef<Record<string, { owner: string | null; hp: number }>>({});
  const [flash, setFlash] = useState<{ captured: Set<string>; hit: Set<string>; at: number }>({ captured: new Set(), hit: new Set(), at: 0 });
  useEffect(() => {
    const captured = new Set<string>();
    const hit = new Set<string>();
    for (const [id, r] of Object.entries(state.regions)) {
      const old = prev.current[id];
      if (old) {
        if (old.owner !== r.owner && r.owner) captured.add(id);
        if (r.capital && r.hp < old.hp) hit.add(id);
      }
      prev.current[id] = { owner: r.owner, hp: r.hp };
    }
    if (captured.size || hit.size) {
      setFlash({ captured, hit, at: Date.now() });
      const t = setTimeout(() => setFlash({ captured: new Set(), hit: new Set(), at: 0 }), 1400);
      return () => clearTimeout(t);
    }
  }, [state.regions]);

  const target = highlight ? map.regions.find((r) => r.id === highlight) : null;

  return (
    <svg viewBox={`0 0 ${map.width} ${map.height}`} className={cn('h-auto w-full select-none', className)} role="img" aria-label={map.name}>
      <defs>
        <pattern id={id('sea')} width="1024" height="1024" patternUnits="userSpaceOnUse">
          <image href="/map/sea.webp" width="1024" height="1024" />
        </pattern>
        <pattern id={id('grass')} width="840" height="840" patternUnits="userSpaceOnUse">
          <image href="/map/grass.webp" width="840" height="840" />
        </pattern>
        <pattern id={id('parch')} width={map.width} height={map.height} patternUnits="userSpaceOnUse">
          <image href="/map/parchment.webp" width={map.width} height={map.height} preserveAspectRatio="none" />
        </pattern>
        <pattern id={id('waves')} width="60" height="30" patternUnits="userSpaceOnUse">
          <path d="M5 18 q8 -8 16 0 t16 0" fill="none" stroke="#5b7f8f" strokeWidth="2" opacity=".45" />
        </pattern>
        <filter id={id('glow')}>
          <feGaussianBlur stdDeviation="10" />
        </filter>
        <filter id={id('shadow')}>
          <feDropShadow dx="0" dy="10" stdDeviation="8" floodColor="#06324a" floodOpacity=".5" />
        </filter>
        <filter id={id('rough')}>
          <feTurbulence baseFrequency=".04" numOctaves="2" seed="3" />
          <feDisplacementMap in="SourceGraphic" scale="6" />
        </filter>
      </defs>
      {works ? (
        <>
          <rect width={map.width} height={map.height} rx="36" fill={`url(#${id('parch')})`} />
          <rect width={map.width} height={map.height} rx="36" fill="#7fb3c4" opacity=".28" />
          <rect width={map.width} height={map.height} rx="36" fill={`url(#${id('waves')})`} />
          <path d={map.outline} fillRule="evenodd" fill={`url(#${id('parch')})`} stroke="#4a3426" strokeWidth="7" strokeLinejoin="round" filter={`url(#${id('rough')})`} />
        </>
      ) : (
        <>
          <rect width={map.width} height={map.height} rx="36" fill={`url(#${id('sea')})`} />
          <path d={map.outline} fillRule="evenodd" fill="none" stroke="#bff3ff" strokeWidth="46" strokeLinejoin="round" opacity=".55" filter={`url(#${id('glow')})`} />
          <path d={map.outline} fillRule="evenodd" fill="#e9d9a6" stroke="#e9d9a6" strokeWidth="22" strokeLinejoin="round" filter={`url(#${id('shadow')})`} />
          <path d={map.outline} fillRule="evenodd" fill={`url(#${id('grass')})`} />
        </>
      )}
      {map.regions.map((r) => {
        const reg = state.regions[r.id];
        const owner = reg?.owner;
        const color = owner ? colors.get(owner) ?? '#999' : null;
        const canSelect = sel.has(r.id);
        return (
          <g key={r.id} onClick={canSelect && onSelect ? () => onSelect(r.id) : onBlocked ? () => onBlocked(r.id) : undefined} className={cn(canSelect && 'cursor-pointer')}>
            {works ? (
              <path
                d={r.path}
                fill={color ?? 'transparent'}
                fillOpacity={color ? 0.55 : 1}
                stroke="#5a3f2c"
                strokeWidth={3}
                strokeDasharray={color ? undefined : '8 6'}
                strokeLinejoin="round"
                className={cn('transition-[fill] duration-700', canSelect && 'hover:brightness-110', flash.captured.has(r.id) && 'animate-capture')}
              />
            ) : (
              <path
                d={r.path}
                fill={color ?? 'transparent'}
                fillOpacity={color ? 0.62 : 1}
                stroke="#fff"
                strokeOpacity={color ? 1 : 0.7}
                strokeWidth={color ? 4 : 3}
                strokeLinejoin="round"
                className={cn('transition-[fill] duration-700', canSelect && 'hover:brightness-110', flash.captured.has(r.id) && 'animate-capture')}
              />
            )}
            {canSelect && (
              <path d={r.path} fill="#fff" fillOpacity={0.25} stroke="#fff" strokeWidth={5} strokeDasharray="10 8" className="pointer-events-none animate-pulse-ring" />
            )}
          </g>
        );
      })}
      {/* атакуваната област — в цвета на нападателя, вижда се от всички */}
      {target && (
        <g className="pointer-events-none">
          <path d={target.path} fill={attackColor ?? '#1f1f1f'} fillOpacity={0.18} stroke={attackColor ?? '#1f1f1f'} strokeWidth={10} strokeDasharray="18 10" strokeLinejoin="round" className="animate-pulse-ring" />
          <g transform={`translate(${target.center[0]} ${target.center[1] + 30})`}>
            <circle r="22" fill={attackColor ?? '#1f1f1f'} stroke="#fff" strokeWidth="4" />
            <text textAnchor="middle" dominantBaseline="central" fontSize="22">⚔️</text>
          </g>
        </g>
      )}
      {map.regions.map((r) => {
        const reg = state.regions[r.id];
        const [x, y] = r.center;
        const label = works && reg?.workTitle ? shorten(reg.workTitle) : r.name;
        const owner = reg?.capital && reg.owner ? state.players.find((p) => p.uid === reg.owner) : undefined;
        return (
          <g key={`l-${r.id}`} className="pointer-events-none">
            {reg?.capital && (
              <g className={cn(flash.hit.has(r.id) && 'animate-capital-hit')} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
                {/* аватарът на собственика до замъка — да се вижда чия е столицата */}
                {owner && (
                  <g transform={`translate(${x - 58}, ${y - 72})`}>
                    <rect x="-3" y="-3" width="54" height="54" rx="14" fill={owner.color} stroke="#fff" strokeWidth="2.5" />
                    <foreignObject x="0" y="0" width="48" height="48">
                      <UserAvatar avatar={owner.avatar} name={owner.uid} size={48} />
                    </foreignObject>
                  </g>
                )}
                <g transform={`translate(${owner ? x + 2 : x - 24}, ${y - 66}) scale(1.4)`}>
                  <path d="M2 30V10h6v5h5V8h8v7h5v-5h6v20z" fill="#fff" stroke="#1f1f1f" strokeWidth="2.5" strokeLinejoin="round" />
                  {Array.from({ length: 3 }).map((_, i) => (
                    <circle key={i} cx={8 + i * 9} cy={38} r={3.6} fill={i < reg.hp ? '#ff4b4b' : 'rgba(0,0,0,.25)'} stroke="#fff" strokeWidth="1.5" />
                  ))}
                </g>
              </g>
            )}
            <text
              x={x}
              y={reg?.capital ? y + 16 : y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={works ? 19 : 24}
              fontWeight={800}
              fill="#fff"
              style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,.45)', strokeWidth: 3.5 }}
            >
              {label}
            </text>
            {!works && r.sub && (
              <text
                x={x}
                y={(reg?.capital ? y + 16 : y) + 24}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={16}
                fontWeight={700}
                fill="#fff"
                fillOpacity={0.9}
                style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,.45)', strokeWidth: 3 }}
              >
                {r.sub}
              </text>
            )}
          </g>
        );
      })}
      {/* реакции от чата над областите на играча */}
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
    </svg>
  );
}
