/** Рисунки на етажите — три стила: възрожденска къща, каменна крепост, градска кооперация.
 *  Етажите са с различна ширина и височина — прозорците се подреждат според размера. */

export type FloorStyle = 'revival' | 'fortress' | 'city';
const CITY = ['#f2b5a0', '#a8d5c8', '#f5d58a', '#b9c4ef', '#e8b6d6'];

function lit(i: number, k: number) {
  const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return v - Math.floor(v) < 0.28;
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Колко прозореца и къде (центрове по x) за дадена ширина. */
function slots(x: number, w: number) {
  const n = w >= 150 ? 3 : 2;
  return Array.from({ length: n }, (_, k) => x + (w * (k + 0.5)) / n);
}

function Win({ cx, y, w, h, frame, glass, shutter }: { cx: number; y: number; w: number; h: number; frame: string; glass: string; shutter?: string }) {
  const x = cx - w / 2;
  return (
    <g>
      {shutter && (
        <>
          <rect x={x - 6} y={y} width="6" height={h} fill={shutter} stroke="#2b1d14" strokeWidth="1.1" />
          <rect x={x + w} y={y} width="6" height={h} fill={shutter} stroke="#2b1d14" strokeWidth="1.1" />
        </>
      )}
      <rect x={x} y={y} width={w} height={h} rx="2" fill={glass} stroke={frame} strokeWidth="2" />
      <line x1={cx} y1={y} x2={cx} y2={y + h} stroke={frame} strokeWidth="1.6" />
      {h >= 16 && <line x1={x} y1={y + h * 0.45} x2={x + w} y2={y + h * 0.45} stroke={frame} strokeWidth="1.6" />}
      <rect x={x + 2.5} y={y + 2.5} width={w / 2 - 4} height={Math.max(2, h * 0.45 - 4)} fill="#fff" opacity=".35" />
    </g>
  );
}

/** Етаж; (x, y) = горен ляв ъгъл, (w, h) = размер. */
export function Floor({ style, x, y, w, h, i, ground = false }: { style: FloorStyle; x: number; y: number; w: number; h: number; i: number; ground?: boolean }) {
  if (style === 'revival') {
    if (ground)
      return (
        <g>
          <rect x={x} y={y} width={w} height={h} fill="#a39886" stroke="#3a2618" strokeWidth="2.4" />
          {Array.from({ length: Math.ceil(w / 29) }, (_, k) => (
            <rect key={k} x={x + 3 + k * 29} y={y + 4} width={Math.min(27, x + w - 3 - (x + 3 + k * 29))} height={h / 2 - 4} fill="#b8ad9a" stroke="#7d7363" strokeWidth="1" />
          ))}
          <path d={`M${x + w / 2 - 13} ${y + h} v-24 a13 13 0 0 1 26 0 v24 z`} fill="#5a3a22" stroke="#2b1d14" strokeWidth="2" />
          <Win cx={x + 24} y={y + 12} w={20} h={20} frame="#3a2618" glass="#9fd3ef" />
          <Win cx={x + w - 24} y={y + 12} w={20} h={20} frame="#3a2618" glass="#9fd3ef" />
        </g>
      );
    // между гредите: отгоре 4, отдолу 6
    const wh = clamp(h - 18, 12, 30);
    const wy = y + 4 + (h - 10 - wh) / 2;
    return (
      <g>
        <rect x={x} y={y} width={w} height={h} fill="#f4ecdc" stroke="#3a2618" strokeWidth="2.4" />
        <rect x={x} y={y + h - 6} width={w} height="6" fill="#6b4226" />
        <rect x={x} y={y} width={w} height="4" fill="#6b4226" />
        {slots(x, w).map((cx, k) => (
          <Win key={k} cx={cx} y={wy} w={w >= 150 ? 20 : 18} h={wh} frame="#3a2618" glass={lit(i, k) ? '#ffe9a8' : '#9fd3ef'} shutter="#2f6b4f" />
        ))}
      </g>
    );
  }

  if (style === 'fortress') {
    const id = `fc${i}-${Math.round(x)}-${Math.round(y)}`;
    const rows = Math.ceil(h / 14.5);
    const cols = Math.ceil(w / 22) + 2;
    const n = w >= 170 ? 3 : w >= 120 ? 2 : 1;
    const ah = clamp(h - 20, 12, 30);
    return (
      <g>
        <clipPath id={id}>
          <rect x={x} y={y} width={w} height={h} />
        </clipPath>
        <g clipPath={`url(#${id})`}>
          <rect x={x} y={y} width={w} height={h} fill="#9a9488" />
          {Array.from({ length: rows }, (_, r) =>
            Array.from({ length: cols }, (_, k) => (
              <rect key={`${r}-${k}`} x={x - 11 + k * 22 + (r % 2) * 11} y={y + 1 + r * 14.5} width="21" height="13.5" fill={(k + r + i) % 3 ? '#aaa498' : '#8e887c'} stroke="#6f6a60" strokeWidth="1" />
            )),
          )}
        </g>
        <rect x={x} y={y} width={w} height={h} fill="none" stroke="#3b3833" strokeWidth="2.4" />
        {ground ? (
          <path d={`M${x + w / 2 - 14} ${y + h} v-23 a14 14 0 0 1 28 0 v23 z`} fill="#4a3424" stroke="#2b1d14" strokeWidth="2" />
        ) : (
          Array.from({ length: n }, (_, k) => {
            const cx = x + (w * (k + 0.5)) / n;
            const top = y + (h - ah) / 2;
            return <path key={k} d={`M${cx - 7} ${top + ah} v-${ah - 7} a7 7 0 0 1 14 0 v${ah - 7} z`} fill={lit(i, k) ? '#ffd36b' : '#2b2622'} stroke="#3b3833" strokeWidth="2" />;
          })
        )}
      </g>
    );
  }

  const c = CITY[i % CITY.length];
  if (ground)
    return (
      <g>
        <rect x={x} y={y} width={w} height={h} fill={c} stroke="#3a3340" strokeWidth="2.4" />
        <rect x={x + 8} y={y + 6} width={w - 16} height="6" fill="#d9534f" />
        <rect x={x + w / 2 - 13} y={y + 13} width="26" height={h - 13} fill="#6b4c3b" stroke="#2b1d14" strokeWidth="2" />
        <Win cx={x + 28} y={y + 18} w={26} h={19} frame="#3a3340" glass="#bfe6ff" />
        <Win cx={x + w - 28} y={y + 18} w={26} h={19} frame="#3a3340" glass="#bfe6ff" />
      </g>
    );
  const pos = slots(x, w);
  const wh = clamp(h - (h >= 44 ? 22 : 14), 12, 30);
  const wy = y + 5;
  const mid = pos[Math.floor(pos.length / 2)];
  const balcony = h >= 44 && pos.length === 3;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={c} stroke="#3a3340" strokeWidth="2.4" />
      <rect x={x} y={y} width={w} height="4" fill="#fff" opacity=".35" />
      {pos.map((cx, k) => (
        <Win key={k} cx={cx} y={wy} w={w >= 150 ? 24 : 22} h={wh} frame="#3a3340" glass={lit(i, k) ? '#ffe9a8' : '#bfe6ff'} />
      ))}
      {balcony ? (
        <g>
          <rect x={mid - 16} y={wy + wh + 1} width="32" height="3" fill="#3a3340" />
          {[0, 1, 2, 3, 4].map((k) => (
            <line key={k} x1={mid - 13 + k * 6.5} y1={wy + wh + 4} x2={mid - 13 + k * 6.5} y2={y + h - 4} stroke="#3a3340" strokeWidth="1.4" />
          ))}
          <rect x={mid - 18} y={y + h - 5} width="36" height="4" fill="#3a3340" />
        </g>
      ) : null}
      {h >= 40 &&
        pos
          .filter((cx) => !balcony || cx !== mid)
          .map((cx, k) => <circle key={k} cx={cx} cy={Math.min(y + h - 5, wy + wh + 5)} r="3.4" fill="#e74c3c" />)}
    </g>
  );
}

/** Покрив над най-горния етаж; (x, y, w) = горният етаж. */
export function Roof({ style, x, y, w }: { style: FloorStyle; x: number; y: number; w: number }) {
  if (style === 'revival')
    return (
      <g>
        <path d={`M${x - 12} ${y} L${x + w / 2} ${y - Math.max(28, w * 0.24)} L${x + w + 12} ${y} Z`} fill="#c4502f" stroke="#5a2414" strokeWidth="2.4" />
        {Array.from({ length: Math.round((w + 24) / 15) }, (_, k) => (
          <path key={k} d={`M${x - 8 + k * 15} ${y - 2} q7 -6 15 0`} fill="none" stroke="#8e3720" strokeWidth="1.8" />
        ))}
        <rect x={x + w * 0.68} y={y - Math.max(28, w * 0.24) * 0.95} width="10" height={Math.max(14, w * 0.12)} fill="#7a6a5a" stroke="#3a2618" strokeWidth="2" />
      </g>
    );
  if (style === 'fortress') {
    const n = Math.max(3, Math.round(w / 26));
    const step = w / n;
    return (
      <g>
        {Array.from({ length: n }, (_, k) => (
          <rect key={k} x={x + k * step + step * 0.18} y={y - 15} width={step * 0.64} height="15" fill="#9a9488" stroke="#3b3833" strokeWidth="2.4" />
        ))}
        <line x1={x + w / 2} y1={y - 15} x2={x + w / 2} y2={y - 56} stroke="#4a3424" strokeWidth="3" />
        <path d={`M${x + w / 2} ${y - 56} l28 8 l-28 8z`} fill="#c0392b" className="tower-flag" />
      </g>
    );
  }
  return (
    <g>
      <rect x={x - 5} y={y - 7} width={w + 10} height="7" fill="#3a3340" />
      <rect x={x + 14} y={y - 25} width={Math.min(36, w * 0.3)} height="18" fill="#d9d9d9" stroke="#3a3340" strokeWidth="2" />
      <line x1={x + w - 28} y1={y - 7} x2={x + w - 28} y2={y - 36} stroke="#3a3340" strokeWidth="2" />
    </g>
  );
}
