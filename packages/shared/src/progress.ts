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

export type AchievementIcon =
  | 'star' | 'flame' | 'award' | 'swords' | 'crown' | 'castle' | 'book' | 'users' | 'target' | 'shield'
  | 'mountain' | 'trophy' | 'brain' | 'graduation' | 'zap' | 'medal' | 'scroll' | 'check' | 'gem' | 'rocket';

/** Броячите, по които се отключват постиженията. */
export type AchievementMetric =
  | 'tests' | 'correct' | 'exams' | 'mistakesCleared' | 'bestStreak' | 'level' | 'friends'
  | 'battleGames' | 'battleWins' | 'climbGames' | 'climbWins'
  | 'xp' | 'langCorrect' | 'litCorrect' | 'readCorrect' | 'spellingCorrect' | 'punctCorrect' | 'worksTouched'
  | 'perfectTests' | 'examsDistinct' | 'items' | 'leagueWeeks' | 'leagueTierMax' | 'assignments' | 'classJoined';

export type AchievementCategory = 'learn' | 'topics' | 'streak' | 'battle' | 'climb' | 'league' | 'collect' | 'class' | 'social';
export const ACHIEVEMENT_CATEGORIES: Record<AchievementCategory, string> = {
  learn: 'Учене',
  topics: 'Теми и произведения',
  streak: 'Серии, нива и опит',
  battle: 'Битка за картата',
  climb: 'Към върха',
  league: 'Седмична лига',
  collect: 'Колекция',
  class: 'Моят клас',
  social: 'Приятели',
};

export interface AchievementDef {
  code: string;
  name: string;
  description: string;
  icon: AchievementIcon;
  category: AchievementCategory;
  /** брояч и цел — тогава се показва напредък; без тях е специално събитие */
  metric?: AchievementMetric;
  goal?: number;
}

const A = (code: string, name: string, description: string, icon: AchievementIcon, category: AchievementCategory, metric?: AchievementMetric, goal?: number): AchievementDef => ({
  code, name, description, icon, category, metric, goal,
});

export const ACHIEVEMENTS: AchievementDef[] = [
  // учене
  A('first_test', 'Начинаещ', 'Реши първия си тест', 'star', 'learn', 'tests', 1),
  A('tests_10', 'Усърден', 'Реши 10 теста', 'book', 'learn', 'tests', 10),
  A('tests_50', 'Книжен червей', 'Реши 50 теста', 'book', 'learn', 'tests', 50),
  A('tests_200', 'Неуморим', 'Реши 200 теста', 'book', 'learn', 'tests', 200),
  A('perfect_test', 'Перфектно', 'Реши тест без нито една грешка', 'check', 'learn'),
  A('correct_100', 'Сто верни', '100 верни отговора общо', 'brain', 'learn', 'correct', 100),
  A('correct_500', 'Петстотин', '500 верни отговора общо', 'brain', 'learn', 'correct', 500),
  A('correct_2000', 'Ерудит', '2000 верни отговора общо', 'brain', 'learn', 'correct', 2000),
  A('exam_first', 'Пробна матура', 'Реши първата си цяла матура', 'scroll', 'learn', 'exams', 1),
  A('exam_10', 'Матурист', 'Реши 10 цели матури', 'scroll', 'learn', 'exams', 10),
  A('exam_550', 'Отличник', 'Ориентировъчна оценка 5.50+ на пробна матура', 'graduation', 'learn'),
  A('mistakes_10', 'Поправен', 'Изчисти 10 въпроса от „Моите грешки“', 'check', 'learn', 'mistakesCleared', 10),
  A('mistakes_100', 'Без слабо място', 'Изчисти 100 въпроса от „Моите грешки“', 'check', 'learn', 'mistakesCleared', 100),
  // серии и нива
  A('streak_7', '7 дни серия', 'Учи 7 поредни дни', 'flame', 'streak', 'bestStreak', 7),
  A('streak_30', 'Месец подред', 'Учи 30 поредни дни', 'flame', 'streak', 'bestStreak', 30),
  A('streak_100', 'Сто дни', 'Учи 100 поредни дни', 'flame', 'streak', 'bestStreak', 100),
  A('level_5', 'Майстор', 'Стигни ниво 5', 'award', 'streak', 'level', 5),
  A('level_10', 'Гросмайстор', 'Стигни ниво 10', 'award', 'streak', 'level', 10),
  A('level_15', 'Легенда', 'Стигни ниво 15', 'gem', 'streak', 'level', 15),
  // битка за картата
  A('first_battle', 'Пълководец', 'Изиграй първата си битка', 'swords', 'battle', 'battleGames', 1),
  A('first_win', 'Победител', 'Спечели битка', 'crown', 'battle', 'battleWins', 1),
  A('battle_wins_10', 'Завоевател', 'Спечели 10 битки', 'crown', 'battle', 'battleWins', 10),
  A('battle_wins_25', 'Владетел', 'Спечели 25 битки', 'crown', 'battle', 'battleWins', 25),
  A('battle_wins_50', 'Император', 'Спечели 50 битки', 'trophy', 'battle', 'battleWins', 50),
  A('battle_wins_100', 'Непобедим', 'Спечели 100 битки', 'trophy', 'battle', 'battleWins', 100),
  A('battle_games_100', 'Ветеран', 'Изиграй 100 битки', 'medal', 'battle', 'battleGames', 100),
  A('capital_taker', 'Превземач', 'Превземи вражеска столица', 'castle', 'battle'),
  // към върха
  A('climb_first', 'Първо изкачване', 'Изиграй „Към върха“', 'mountain', 'climb', 'climbGames', 1),
  A('climb_win', 'На върха', 'Спечели „Към върха“', 'mountain', 'climb', 'climbWins', 1),
  A('climb_wins_10', 'Алпинист', 'Спечели 10 пъти „Към върха“', 'mountain', 'climb', 'climbWins', 10),
  A('climb_wins_25', 'Покорител', 'Спечели 25 пъти „Към върха“', 'trophy', 'climb', 'climbWins', 25),
  A('climb_wins_50', 'Еверест', 'Спечели 50 пъти „Към върха“', 'trophy', 'climb', 'climbWins', 50),
  A('climb_wins_100', 'Шерпа', 'Спечели 100 пъти „Към върха“', 'gem', 'climb', 'climbWins', 100),
  A('climb_games_100', 'Планинар', 'Изиграй 100 игри „Към върха“', 'medal', 'climb', 'climbGames', 100),
  A('climb_reflect', 'Огледален щит', 'Отбий удар с щита', 'shield', 'climb'),
  A('climb_sniper', 'Снайперист', 'Уцели 3 пъти в една игра', 'target', 'climb'),
  A('climb_flawless', 'Без драскотина', 'Спечели, без да паднеш нито веднъж', 'zap', 'climb'),
  A('climb_comeback', 'Обрат', 'Спечели, след като си бил с 3 стъпала назад', 'rocket', 'climb'),
  // още за ученето
  A('perfect_5', 'Безгрешен', '5 теста без нито една грешка', 'check', 'learn', 'perfectTests', 5),
  A('perfect_25', 'Перфекционист', '25 теста без нито една грешка', 'check', 'learn', 'perfectTests', 25),
  A('exam_perfect', 'Пълен ключ', 'Всички точки на пробна матура', 'graduation', 'learn'),
  A('exam_all', 'Всички матури', 'Реши 8 различни матури', 'scroll', 'learn', 'examsDistinct', 8),
  A('night_owl', 'Нощна птица', 'Реши тест между 23:00 и 4:00', 'star', 'learn'),
  A('early_bird', 'Ранобудник', 'Реши тест между 5:00 и 7:30', 'star', 'learn'),
  // теми и произведения
  A('lang_100', 'Езиковед', '100 верни по език', 'brain', 'topics', 'langCorrect', 100),
  A('lang_500', 'Граматик', '500 верни по език', 'brain', 'topics', 'langCorrect', 500),
  A('lit_100', 'Литератор', '100 верни по литература', 'book', 'topics', 'litCorrect', 100),
  A('lit_500', 'Литературовед', '500 верни по литература', 'book', 'topics', 'litCorrect', 500),
  A('read_50', 'Внимателен читател', '50 верни на четене с разбиране', 'scroll', 'topics', 'readCorrect', 50),
  A('spelling_100', 'Правописник', '100 верни по правопис', 'check', 'topics', 'spellingCorrect', 100),
  A('punct_50', 'Запетайко', '50 верни по пунктуация', 'check', 'topics', 'punctCorrect', 50),
  A('works_10', 'Начетен', 'Отговори на въпроси за 10 различни произведения', 'book', 'topics', 'worksTouched', 10),
  A('works_20', 'Познавач', 'Отговори на въпроси за 20 различни произведения', 'book', 'topics', 'worksTouched', 20),
  // опит
  A('xp_10k', '10 000 XP', 'Събери 10 000 XP', 'zap', 'streak', 'xp', 10000),
  A('xp_50k', '50 000 XP', 'Събери 50 000 XP', 'zap', 'streak', 'xp', 50000),
  A('xp_100k', '100 000 XP', 'Събери 100 000 XP', 'gem', 'streak', 'xp', 100000),
  // още за битките
  A('battle_4p_win', 'Крал на четирима', 'Спечели битка с 4 играчи', 'crown', 'battle'),
  A('battle_flawless', 'Безупречна битка', 'Всички отговори верни в битка (поне 8)', 'check', 'battle'),
  A('lightning', 'Светкавица', 'Верен отговор за под 3 секунди в игра', 'zap', 'battle'),
  // още за „Към върха“
  A('climb_high_sniper', 'Орлово око', 'Уцели от 8-о стъпало нагоре', 'target', 'climb'),
  A('climb_shield_wasted', 'Напразно', 'Вдигни щит, а другият да се качи', 'shield', 'climb'),
  A('climb_rocket_win', 'Ракетна победа', 'Спечели с ракетата', 'rocket', 'climb'),
  // лига
  A('league_join', 'В лигата', 'Влез в седмичната лига', 'trophy', 'league', 'leagueWeeks', 1),
  A('league_weeks_10', 'Редовен', 'Участвай в лигата 10 седмици', 'medal', 'league', 'leagueWeeks', 10),
  A('league_up', 'Нагоре!', 'Качи се в по-горна лига', 'rocket', 'league'),
  A('league_first', 'Шампион на седмицата', 'Завърши седмица на 1-во място в групата', 'crown', 'league'),
  A('league_gold', 'Златна лига', 'Стигни лига Злато', 'medal', 'league', 'leagueTierMax', 2),
  A('league_ruby', 'Рубинена лига', 'Стигни лига Рубин', 'gem', 'league', 'leagueTierMax', 4),
  A('league_diamond', 'Диамантена лига', 'Стигни най-високата лига', 'gem', 'league', 'leagueTierMax', 9),
  // колекция
  A('avatar_custom', 'Стилист', 'Запази свой аватар', 'star', 'collect'),
  A('items_1', 'Първа покупка', 'Купи нещо с диаманти', 'gem', 'collect', 'items', 1),
  A('items_5', 'Колекционер', 'Купи 5 неща с диаманти', 'gem', 'collect', 'items', 5),
  A('items_15', 'Модна икона', 'Купи 15 неща с диаманти', 'gem', 'collect', 'items', 15),
  A('weapon_change', 'Ново оръжие', 'Смени камъка с друго оръжие', 'target', 'collect'),
  A('rocket_owner', 'Ракетчик', 'Купи ракетата', 'rocket', 'collect'),
  // клас
  A('class_join', 'Съученик', 'Влез в клас при учител', 'users', 'class', 'classJoined', 1),
  A('assign_1', 'Първо контролно', 'Предай тест от учителя', 'scroll', 'class', 'assignments', 1),
  A('assign_10', 'Отговорен ученик', 'Предай 10 теста от учителя', 'scroll', 'class', 'assignments', 10),
  // приятели
  A('friends_3', 'Дружина', 'Имай 3 приятели', 'users', 'social', 'friends', 3),
  A('friends_10', 'Компания', 'Имай 10 приятели', 'users', 'social', 'friends', 10),
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

// ───────────── Седмична лига ─────────────
export const LEAGUE_TIERS = [
  { name: 'Бронз', color: '#cd7f32', emoji: '🥉' },
  { name: 'Сребро', color: '#9ca3af', emoji: '🥈' },
  { name: 'Злато', color: '#f5b400', emoji: '🥇' },
  { name: 'Сапфир', color: '#2563eb', emoji: '🔷' },
  { name: 'Рубин', color: '#dc2626', emoji: '♦️' },
  { name: 'Изумруд', color: '#059669', emoji: '💚' },
  { name: 'Аметист', color: '#7c3aed', emoji: '🔮' },
  { name: 'Перла', color: '#e5e7eb', emoji: '🦪' },
  { name: 'Обсидиан', color: '#111827', emoji: '🖤' },
  { name: 'Диамант', color: '#38bdf8', emoji: '💎' },
] as const;
export const LEAGUE_GROUP_SIZE = 20;
export const LEAGUE_MOVE = 5;

/** Понеделникът на седмицата (YYYY-MM-DD, София). */
export function leagueWeek(d = new Date()): string {
  const day = sofiaDay(d);
  const t = new Date(`${day}T12:00:00Z`);
  const dow = (t.getUTCDay() + 6) % 7; // 0 = понеделник
  t.setUTCDate(t.getUTCDate() - dow);
  return t.toISOString().slice(0, 10);
}

/** Краят на седмицата — неделя 23:59:59 (София), като UTC момент (приблизително, за обратното броене). */
export function leagueWeekEnd(week: string): Date {
  const t = new Date(`${week}T00:00:00+02:00`);
  t.setUTCDate(t.getUTCDate() + 7);
  return t;
}
