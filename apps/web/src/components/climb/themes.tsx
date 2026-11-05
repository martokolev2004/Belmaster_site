import type { ClimbTheme } from '@belmaster/shared';

/** Цветове на камъка и земята за всеки фон. */
export const THEME_PALETTE: Record<ClimbTheme, { stone: string; mortar: string; ghost: string; ground: string; label: string }> = {
  dusk: { stone: '#8a8f99', mortar: '#4a4f59', ghost: 'rgba(255,255,255,.38)', ground: '#2a1e2a', label: 'rgba(255,255,255,.8)' },
  night: { stone: '#6f7a8c', mortar: '#39404d', ghost: 'rgba(255,255,255,.32)', ground: '#0b1222', label: 'rgba(255,255,255,.75)' },
  canyon: { stone: '#b8aa96', mortar: '#7a6a55', ghost: 'rgba(60,40,20,.38)', ground: '#5d4634', label: 'rgba(255,255,255,.85)' },
};

// стабилни „случайни“ звезди
const STARS = Array.from({ length: 70 }, (_, i) => {
  const r = (n: number) => {
    const x = Math.sin(i * 97.13 + n * 13.7) * 43758.5453;
    return x - Math.floor(x);
  };
  return { x: r(1) * 800, y: -150 + r(2) * 380, r: r(3) * 1.4 + 0.3, o: r(4) * 0.7 + 0.2 };
});

/** Небето и планините зад кулите (viewBox: 0 -150 800 670, земята е на y=482). */
export function ClimbBackground({ theme, top, ground }: { theme: ClimbTheme; top: number; ground: number }) {
  const h = ground + top + 60;
  if (theme === 'night')
    return (
      <g>
        <defs>
          <linearGradient id="skyN" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#070d1f" />
            <stop offset=".7" stopColor="#16274a" />
            <stop offset="1" stopColor="#2a4470" />
          </linearGradient>
          <radialGradient id="moonGlow">
            <stop offset="0" stopColor="#fffbe6" />
            <stop offset="1" stopColor="#fffbe6" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="mistN" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#9fb6d8" stopOpacity="0" />
            <stop offset="1" stopColor="#9fb6d8" stopOpacity=".35" />
          </linearGradient>
        </defs>
        <rect y={-top} width="800" height={h} fill="url(#skyN)" />
        {STARS.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity={s.o} className={i % 7 === 0 ? 'climb-twinkle' : undefined} />
        ))}
        <circle cx="660" cy="-60" r="70" fill="url(#moonGlow)" opacity=".5" />
        <circle cx="660" cy="-60" r="26" fill="#fffbe6" />
        <path d={`M0 ${ground} L110 280 L200 360 L300 220 L390 330 L470 250 L560 340 L660 230 L740 320 L800 290 L800 ${ground}Z`} fill="#1c2c4c" />
        <rect y="330" width="800" height={ground - 330} fill="url(#mistN)" />
        <path d={`M0 ${ground} L80 400 L170 430 L260 380 L350 420 L450 370 L540 425 L640 385 L720 420 L800 400 L800 ${ground}Z`} fill="#111c33" />
      </g>
    );
  if (theme === 'canyon')
    return (
      <g>
        <defs>
          <linearGradient id="skyC" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#5b8fb0" />
            <stop offset=".7" stopColor="#b9d3df" />
            <stop offset="1" stopColor="#e9e2d0" />
          </linearGradient>
          <linearGradient id="hazeC" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e9e2d0" stopOpacity="0" />
            <stop offset="1" stopColor="#e9e2d0" stopOpacity=".7" />
          </linearGradient>
        </defs>
        <rect y={-top} width="800" height={h} fill="url(#skyC)" />
        <path d={`M0 ${ground} L0 300 L70 290 L120 230 L200 240 L240 300 L320 310 L380 250 L470 245 L520 300 L600 290 L650 220 L740 230 L800 280 L800 ${ground}Z`} fill="#a9876a" opacity=".55" />
        <rect y="260" width="800" height={ground - 260} fill="url(#hazeC)" />
        <path d={`M0 ${ground} L0 380 L90 370 L140 330 L230 340 L280 390 L380 395 L430 350 L520 345 L570 390 L680 385 L730 340 L800 350 L800 ${ground}Z`} fill="#7d5d45" />
      </g>
    );
  return (
    <g>
      <defs>
        <linearGradient id="skyD" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b2a4a" />
          <stop offset=".55" stopColor="#c0566b" />
          <stop offset=".8" stopColor="#f2a65a" />
          <stop offset="1" stopColor="#f7d08a" />
        </linearGradient>
      </defs>
      <rect y={-top} width="800" height={h} fill="url(#skyD)" />
      <circle cx="560" cy="300" r="70" fill="#ffd9a0" opacity=".55" />
      <path d={`M0 ${ground} L90 300 L170 360 L260 230 L350 330 L430 260 L520 350 L620 240 L700 330 L800 280 L800 ${ground}Z`} fill="#6b3a5a" opacity=".55" />
      <path d={`M0 ${ground} L60 390 L150 420 L240 350 L330 410 L420 360 L520 420 L610 370 L700 410 L800 380 L800 ${ground}Z`} fill="#3d2440" opacity=".8" />
    </g>
  );
}
