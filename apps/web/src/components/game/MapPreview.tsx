import { CONTINENT_MAP, type GameMap } from '@belmaster/shared';

/** Декоративна (статична) карта — за началната страница. */
export function MapPreview({ map = CONTINENT_MAP, className }: { map?: GameMap; className?: string }) {
  const landColor = new Map(map.lands.map((l) => [l.id, l.color]));
  return (
    <svg viewBox={`0 0 ${map.width} ${map.height}`} className={className} role="img" aria-label={map.name}>
      <rect width={map.width} height={map.height} rx="40" fill="var(--map-sea)" />
      <path d={map.outline} fill="none" stroke="var(--map-sea-line)" strokeWidth="22" strokeLinejoin="round" />
      {map.regions.map((r) => (
        <path key={r.id} d={r.path} fill={landColor.get(r.land)} fillOpacity={0.85} stroke="var(--bg)" strokeWidth="4" strokeLinejoin="round" />
      ))}
      {map.regions.map((r) => (
        <text key={r.id} x={r.center[0]} y={r.center[1]} textAnchor="middle" dominantBaseline="middle" fontSize="17" fontWeight="800" fill="#fff" style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,.25)', strokeWidth: 3 }}>
          {r.name}
        </text>
      ))}
    </svg>
  );
}
