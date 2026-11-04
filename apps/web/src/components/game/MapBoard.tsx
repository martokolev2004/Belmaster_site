'use client';

import type { GameMap, GameState } from '@belmaster/shared';
import { cn } from '@/lib/cn';

interface Props {
  map: GameMap;
  state: GameState;
  selectable: string[];
  onSelect?: (regionId: string) => void;
  highlight?: string | null;
}

const NEUTRAL = 'var(--surface-2)';

function shorten(s: string, n = 14) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

export function MapBoard({ map, state, selectable, onSelect, highlight }: Props) {
  const colors = new Map(state.players.map((p) => [p.uid, p.color]));
  const sel = new Set(selectable);
  const works = state.mode === 'WORKS';
  return (
    <svg viewBox={`0 0 ${map.width} ${map.height}`} className="h-auto w-full select-none" role="img" aria-label={map.name}>
      <defs>
        <pattern id="hatch" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="12" height="12" fill={NEUTRAL} />
          <line x1="0" y1="0" x2="0" y2="12" stroke="var(--line)" strokeWidth="5" />
        </pattern>
      </defs>
      <rect width={map.width} height={map.height} rx="36" fill="var(--map-sea)" />
      <path d={map.outline} fill="var(--line)" stroke="var(--map-sea-line)" strokeWidth="20" strokeLinejoin="round" />
      {map.regions.map((r) => {
        const reg = state.regions[r.id];
        const owner = reg?.owner;
        const fill = owner ? colors.get(owner) ?? '#999' : state.phase === 'lobby' ? NEUTRAL : 'url(#hatch)';
        const canSelect = sel.has(r.id);
        const isTarget = highlight === r.id;
        return (
          <g key={r.id} onClick={canSelect && onSelect ? () => onSelect(r.id) : undefined} className={cn(canSelect && 'cursor-pointer')}>
            <path
              d={r.path}
              fill={fill}
              stroke={isTarget ? '#1f1f1f' : 'var(--bg)'}
              strokeWidth={isTarget ? 8 : 4}
              strokeLinejoin="round"
              className={cn('transition-[fill] duration-500', canSelect && 'hover:brightness-110')}
            />
            {canSelect && (
              <path d={r.path} fill="#fff" fillOpacity={0.25} stroke="#fff" strokeWidth={5} strokeDasharray="10 8" className="pointer-events-none animate-pulse-ring" />
            )}
          </g>
        );
      })}
      {map.regions.map((r) => {
        const reg = state.regions[r.id];
        const [x, y] = r.center;
        const label = works && reg?.workTitle ? shorten(reg.workTitle) : r.name;
        return (
          <g key={`l-${r.id}`} className="pointer-events-none">
            {reg?.capital && (
              <g transform={`translate(${x - 24}, ${y - 66}) scale(1.4)`}>
                <path d="M2 30V10h6v5h5V8h8v7h5v-5h6v20z" fill="#fff" stroke="#1f1f1f" strokeWidth="2.5" strokeLinejoin="round" />
                {Array.from({ length: 3 }).map((_, i) => (
                  <circle key={i} cx={8 + i * 9} cy={38} r={3.6} fill={i < reg.hp ? '#ff4b4b' : 'rgba(0,0,0,.25)'} stroke="#fff" strokeWidth="1.5" />
                ))}
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
          </g>
        );
      })}
    </svg>
  );
}
