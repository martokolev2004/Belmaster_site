export const XP_PER_CORRECT = 20;
export const XP_PER_LEVEL = 1000;
export const XP_MATCH_WIN = 100;
export const XP_MATCH_PLAY = 30;

export function levelForXp(xp: number): number {
  return Math.floor(xp / XP_PER_LEVEL) + 1;
}

export function levelProgress(xp: number): { level: number; inLevel: number; needed: number } {
  return { level: levelForXp(xp), inLevel: xp % XP_PER_LEVEL, needed: XP_PER_LEVEL };
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
