export const XP_PER_CORRECT = 20;
export const XP_MATCH_WIN = 100;
export const XP_MATCH_PLAY = 30;
/** 1 диамант за всеки 1000 спечелени XP (XP не се харчи). */
export const XP_PER_DIAMOND = 1000;

/** Общо XP, нужно за да стигнеш ниво 2, 3, 4… (ниво 1 е от 0). */
export const LEVEL_THRESHOLDS = [1000, 2500, 6000, 12000, 20000, 32000, 48000, 70000, 100000, 140000];
const LEVEL_STEP_AFTER = 50000;

/** XP, при което започва дадено ниво. */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  const i = level - 2;
  if (i < LEVEL_THRESHOLDS.length) return LEVEL_THRESHOLDS[i];
  return LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] + (i - LEVEL_THRESHOLDS.length + 1) * LEVEL_STEP_AFTER;
}

export function levelForXp(xp: number): number {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  return level;
}

/** Нивото никога не пада: пазим по-голямото от запазеното и изчисленото. */
export function nextLevel(storedLevel: number, xp: number): number {
  return Math.max(storedLevel, levelForXp(xp));
}

export function levelProgress(xp: number, storedLevel?: number): { level: number; inLevel: number; needed: number; nextAt: number } {
  const level = Math.max(storedLevel ?? 1, levelForXp(xp));
  const start = xpForLevel(level);
  const nextAt = xpForLevel(level + 1);
  return { level, inLevel: Math.max(0, xp - start), needed: nextAt - start, nextAt };
}

/** Спечелени диаманти общо (преди харчене). */
export function diamondsEarned(xp: number): number {
  return Math.floor(xp / XP_PER_DIAMOND);
}

export interface AchievementDef {
  code: string;
  name: string;
  description: string;
  icon: 'star' | 'flame' | 'award' | 'swords' | 'crown' | 'castle' | 'book' | 'users';
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { code: 'first_test', name: 'Начинаещ', description: 'Реши първия си тест', icon: 'star' },
  { code: 'streak_7', name: '7 дни серия', description: 'Учи 7 поредни дни', icon: 'flame' },
  { code: 'level_5', name: 'Майстор', description: 'Стигни ниво 5', icon: 'award' },
  { code: 'perfect_test', name: 'Перфектно', description: 'Реши тест без грешка', icon: 'book' },
  { code: 'first_battle', name: 'Пълководец', description: 'Изиграй първата си битка', icon: 'swords' },
  { code: 'first_win', name: 'Победител', description: 'Спечели битка', icon: 'crown' },
  { code: 'capital_taker', name: 'Превземач', description: 'Превземи вражеска столица', icon: 'castle' },
  { code: 'friends_3', name: 'Дружина', description: 'Имай 3 приятели', icon: 'users' },
];

/** Текущият сезон за рейтинга, напр. "2026-11" (по часа в София). */
export function currentSeason(d = new Date()): string {
  const s = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Sofia', year: 'numeric', month: '2-digit' }).format(d);
  return s.slice(0, 7);
}

/** Днешна дата YYYY-MM-DD в София (за серията). */
export function sofiaDay(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Sofia', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export function seasonLabel(season: string): string {
  if (season === 'all') return 'За всички времена';
  const [y, m] = season.split('-');
  const months = ['януари', 'февруари', 'март', 'април', 'май', 'юни', 'юли', 'август', 'септември', 'октомври', 'ноември', 'декември'];
  return `${months[Number(m) - 1]} ${y}`;
}
