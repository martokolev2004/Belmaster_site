/**
 * „Кула на Словото“ — обща (детерминирана) симулация.
 * Използва се и от сървъра (истината), и от браузъра (анимацията) — един и същ вход дава един и същ резултат.
 * Няма истинска физика: само числа за отместване/люлеене + правила за падане.
 * Координати: 0 = центърът на основата; единици = пиксели в сцена с ширина 450.
 */

export const TOWER = {
  LIVES: 3,
  /** време за отговор на въпрос */
  QUESTION_MS: 30_000,
  /** време да пуснеш етажа; после пада сам */
  DROP_MS: 4_000,
  /** колко закъснение на мрежата приемаме при пускане */
  DROP_GRACE_MS: 2_500,
  FLOOR_W: 150,
  FLOOR_H: 44,
  /** под този дял опора етажът пада */
  MIN_OVERLAP: 0.5,
  /** |dx| ≤ това = перфектно пускане (етажът „щраква“ на място) */
  PERFECT_PX: 5,
  /** 3 перфектни поред намаляват натрупаното отместване наполовина */
  PERFECT_STREAK: 3,
  /** над това натрупано отместване кулата се срутва */
  COLLAPSE_PX: 90,
  CRANE_AMP: 115,
  /** максимум въпроси на ден, които носят XP */
  XP_DAILY_QUESTIONS: 30,
  XP_PER_CORRECT: 5,
} as const;

/** Размери на етажите — на случаен принцип (от seed-а), за да е по-трудно нагласянето. */
export const FLOOR_WIDTHS = [100, 120, 150, 170, 190] as const;
export const FLOOR_HEIGHTS = [34, 44, 56] as const;
/** ширина на основата (за първия етаж) */
export const TOWER_BASE_W = 186;

export interface FloorSize {
  w: number;
  h: number;
}

/** Размерът на етаж № i — детерминиран; първият е стандартен. */
export function floorSize(seed: number, i: number): FloorSize {
  if (i === 0) return { w: 150, h: 44 };
  const r = (k: number) => {
    const v = Math.sin(seed * 9301 + i * 49.297 + k * 233.11) * 43758.5453;
    return v - Math.floor(v);
  };
  return { w: FLOOR_WIDTHS[Math.floor(r(1) * FLOOR_WIDTHS.length)], h: FLOOR_HEIGHTS[Math.floor(r(2) * FLOOR_HEIGHTS.length)] };
}

/** Височина на кулата до горния ръб на етаж № n-1 (сбор от височините). */
export function towerHeight(seed: number, n: number): number {
  let h = 0;
  for (let i = 0; i < n; i++) h += floorSize(seed, i).h;
  return h;
}

export type TowerTheme = 'town' | 'mountain' | 'library';
export const TOWER_THEMES: TowerTheme[] = ['town', 'mountain', 'library'];
/** фон → вид на етажите */
export const TOWER_STYLE: Record<TowerTheme, 'revival' | 'fortress' | 'city'> = { town: 'revival', mountain: 'fortress', library: 'city' };

export interface TowerSim {
  /** x на центъра на всеки етаж (отдолу нагоре) */
  xs: number[];
  /** натрупано отместване — от него зависят люлеенето и срутването */
  lean: number;
  /** поредни перфектни пускания */
  streak: number;
  lives: number;
}

export type DropKind = 'perfect' | 'ok' | 'fall' | 'collapse';

export interface DropResult {
  kind: DropKind;
  /** къде е бил кранът в момента на пускането */
  craneX: number;
  /** къде е бил върхът на кулата (с люлеенето) */
  targetX: number;
  dx: number;
  /** къде е стъпил етажът (за падналите — откъде пада) */
  landX: number;
  /** намалено ли е отместването (3 перфектни поред) */
  steadied: boolean;
  next: TowerSim;
}

/** Ниво на трудност: на всеки 10 етажа. */
export function towerLevel(floors: number): number {
  return Math.floor(floors / 10);
}

/** Период на крана (ms) — по-бърз с всяко ниво. */
export function cranePeriod(floors: number): number {
  return Math.max(950, 2400 - towerLevel(floors) * 260);
}

/** Начална фаза на крана за даден етаж — от seed-а на играта, за да не е еднаква всеки път. */
export function cranePhase(seed: number, floors: number): number {
  const v = Math.sin(seed * 12.9898 + floors * 78.233) * 43758.5453;
  return (v - Math.floor(v)) * Math.PI * 2;
}

/** x на крана в момент t (ms от началото на пускането). */
export function craneX(t: number, floors: number, seed: number): number {
  return TOWER.CRANE_AMP * Math.sin((2 * Math.PI * t) / cranePeriod(floors) + cranePhase(seed, floors));
}

/** Амплитуда на люлеенето на върха — расте с натрупаното отместване и височината. */
export function swayAmp(sim: Pick<TowerSim, 'lean' | 'xs'>): number {
  if (!sim.xs.length) return 0;
  return Math.min(38, Math.abs(sim.lean) * 0.45 + Math.min(10, sim.xs.length * 0.25));
}

/** Отместване на върха от люлеенето в момент t. */
export function swayX(t: number, sim: Pick<TowerSim, 'lean' | 'xs'>): number {
  return swayAmp(sim) * Math.sin((2 * Math.PI * t) / 1900);
}

export function topX(sim: Pick<TowerSim, 'xs'>): number {
  return sim.xs.length ? sim.xs[sim.xs.length - 1] : 0;
}

export function newTowerSim(): TowerSim {
  return { xs: [], lean: 0, streak: 0, lives: TOWER.LIVES };
}

/** Пускане на етаж в момент t (ограничен до DROP_MS). */
export function simulateDrop(sim: TowerSim, tRaw: number, seed: number): DropResult {
  const t = Math.max(0, Math.min(TOWER.DROP_MS, tRaw));
  const floors = sim.xs.length;
  const cx = craneX(t, floors, seed);
  const tx = topX(sim) + swayX(t, sim);
  const dx = cx - tx;
  // опората се мери спрямо по-тесния от двата етажа
  const w = floorSize(seed, floors).w;
  const tw = floors ? floorSize(seed, floors - 1).w : TOWER_BASE_W;
  const overlapLen = Math.min(cx + w / 2, tx + tw / 2) - Math.max(cx - w / 2, tx - tw / 2);
  const overlap = overlapLen / Math.min(w, tw);
  if (overlap < TOWER.MIN_OVERLAP) {
    return { kind: 'fall', craneX: cx, targetX: tx, dx, landX: cx, steadied: false, next: { ...sim, xs: [...sim.xs], streak: 0, lives: sim.lives - 1 } };
  }
  const perfect = Math.abs(dx) <= TOWER.PERFECT_PX;
  const landX = perfect ? topX(sim) : topX(sim) + dx;
  let lean = sim.lean + (perfect ? 0 : dx);
  let streak = perfect ? sim.streak + 1 : 0;
  let steadied = false;
  if (streak >= TOWER.PERFECT_STREAK) {
    lean /= 2;
    streak = 0;
    steadied = true;
  }
  const next: TowerSim = { xs: [...sim.xs, landX], lean, streak, lives: sim.lives };
  if (Math.abs(lean) > TOWER.COLLAPSE_PX) return { kind: 'collapse', craneX: cx, targetX: tx, dx, landX, steadied, next: { ...next, lives: 0 } };
  return { kind: perfect ? 'perfect' : 'ok', craneX: cx, targetX: tx, dx, landX, steadied, next };
}
