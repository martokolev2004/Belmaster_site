// Аватар: стил „Adventurer“ (DiceBear, Lisa Wischofsky, CC BY 4.0) + наши аксесоари отгоре.

const range = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}${String(i + 1).padStart(2, '0')}`);

export const AVATAR_OPTIONS = {
  hair: [...range('short', 19), ...range('long', 26)],
  hairColor: ['0e0e0e', '562306', '6a4e35', '796a45', 'ac6511', 'cb6820', 'ab2a18', 'b9a05f', 'e5d7a3', 'afafaf', '3eac2c', '85c2c6', 'dba3be', '592454'],
  skinColor: ['f2d3b1', 'ecad80', '9e5622', '763900'],
  eyes: range('variant', 26),
  eyebrows: range('variant', 15),
  mouth: range('variant', 30),
  glasses: ['none', ...range('variant', 5)],
  earrings: ['none', ...range('variant', 6)],
  features: ['none', 'freckles', 'birthmark', 'blush', 'mustache'],
  bg: ['b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf', 'c1f0c1', 'fff1a8', '1f2a44', '203a2b', '3a1f2e', '2a2a2a', '4a2a14'],
  extra: ['none', 'quill', 'laurel', 'helmet', 'crown'],
} as const;

export type AvatarPart = keyof typeof AVATAR_OPTIONS;
export type AvatarConfig = { [K in AvatarPart]: string };

export const AVATAR_PART_LABELS: Record<AvatarPart, string> = {
  hair: 'Прическа',
  hairColor: 'Цвят на косата',
  skinColor: 'Кожа',
  eyes: 'Очи',
  eyebrows: 'Вежди',
  mouth: 'Уста',
  glasses: 'Очила',
  earrings: 'Обици',
  features: 'Особености',
  bg: 'Фон',
  extra: 'Аксесоар',
};

export const EXTRA_LABELS: Record<string, string> = {
  none: 'Без',
  quill: 'Перо зад ухото',
  laurel: 'Златен лавров венец',
  helmet: 'Рицарски шлем',
  crown: 'Корона',
};

/** Какво е нужно за отключване. */
export type UnlockRule =
  | { kind: 'level'; n: number }
  | { kind: 'wins'; n: number }
  | { kind: 'streak'; n: number }
  | { kind: 'achievement'; code: string };

export interface UnlockProgress {
  level: number;
  wins: number;
  bestStreak: number;
  achievements: string[];
}

/** Заключените части; всичко останало е свободно. */
export const AVATAR_LOCKS: Partial<Record<AvatarPart, Record<string, UnlockRule>>> = {
  hairColor: {
    '3eac2c': { kind: 'level', n: 3 },
    '85c2c6': { kind: 'level', n: 3 },
    dba3be: { kind: 'level', n: 3 },
    '592454': { kind: 'level', n: 3 },
  },
  hair: {
    long03: { kind: 'achievement', code: 'perfect_test' },
    long08: { kind: 'achievement', code: 'perfect_test' },
    long18: { kind: 'achievement', code: 'perfect_test' },
  },
  glasses: { variant01: { kind: 'wins', n: 5 } },
  bg: {
    '1f2a44': { kind: 'level', n: 2 },
    '203a2b': { kind: 'level', n: 2 },
    '3a1f2e': { kind: 'level', n: 2 },
    '2a2a2a': { kind: 'streak', n: 7 },
    '4a2a14': { kind: 'streak', n: 7 },
  },
  extra: {
    quill: { kind: 'level', n: 3 },
    laurel: { kind: 'level', n: 5 },
    helmet: { kind: 'achievement', code: 'capital_taker' },
    crown: { kind: 'wins', n: 10 },
  },
};

const ACH_NAMES: Record<string, string> = {
  perfect_test: 'тест без грешка',
  capital_taker: 'превземи столица',
  first_win: 'първа победа',
};

export function ruleText(r: UnlockRule): string {
  switch (r.kind) {
    case 'level':
      return `ниво ${r.n}`;
    case 'wins':
      return `${r.n} победи в битки`;
    case 'streak':
      return `серия ${r.n} дни`;
    case 'achievement':
      return ACH_NAMES[r.code] ?? r.code;
  }
}

export function isUnlocked(r: UnlockRule | undefined, p: UnlockProgress): boolean {
  if (!r) return true;
  switch (r.kind) {
    case 'level':
      return p.level >= r.n;
    case 'wins':
      return p.wins >= r.n;
    case 'streak':
      return p.bestStreak >= r.n;
    case 'achievement':
      return p.achievements.includes(r.code);
  }
}

export function lockOf(part: AvatarPart, value: string): UnlockRule | undefined {
  return AVATAR_LOCKS[part]?.[value];
}

/** Случаен (но стабилен по семе) начален аватар — само от свободните части. */
export function defaultAvatar(seed: string): AvatarConfig {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const rnd = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0;
    return (h >>> 0) / 4294967296;
  };
  const pick = (part: AvatarPart) => {
    const free = AVATAR_OPTIONS[part].filter((v) => !lockOf(part, v));
    return free[Math.floor(rnd() * free.length)];
  };
  return {
    hair: pick('hair'),
    hairColor: pick('hairColor'),
    skinColor: pick('skinColor'),
    eyes: pick('eyes'),
    eyebrows: pick('eyebrows'),
    mouth: pick('mouth'),
    glasses: rnd() < 0.2 ? pick('glasses') : 'none',
    earrings: 'none',
    features: 'none',
    bg: pick('bg'),
    extra: 'none',
  };
}

/** Проверява и чисти конфигурация; заключените части, които не са отключени, се махат. */
export function sanitizeAvatar(input: unknown, p: UnlockProgress | null, seed = 'x'): AvatarConfig {
  const base = defaultAvatar(seed);
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const out = { ...base };
  for (const part of Object.keys(AVATAR_OPTIONS) as AvatarPart[]) {
    const v = src[part];
    if (typeof v !== 'string' || !(AVATAR_OPTIONS[part] as readonly string[]).includes(v)) continue;
    if (p && !isUnlocked(lockOf(part, v), p)) continue;
    out[part] = v;
  }
  return out;
}

/** Рамка според рейтинга. */
export type FrameTier = 'none' | 'bronze' | 'silver' | 'gold' | 'legend';
export function frameForRating(rating: number | null | undefined, top10 = false): FrameTier {
  if (top10 && (rating ?? 0) >= 1000) return 'legend';
  if (rating == null) return 'none';
  if (rating >= 1300) return 'gold';
  if (rating >= 1150) return 'silver';
  if (rating >= 1050) return 'bronze';
  return 'none';
}

export const FRAME_LABELS: Record<FrameTier, string> = {
  none: 'Без рамка',
  bronze: 'Бронз (рейтинг 1050+)',
  silver: 'Сребро (рейтинг 1150+)',
  gold: 'Злато (рейтинг 1300+)',
  legend: 'Легенда (топ 10 в класа)',
};

export const AVATAR_CREDIT = '„Adventurer“ от Lisa Wischofsky (CC BY 4.0), чрез DiceBear';

/** Аватарът на бота. */
export const BOT_AVATAR: AvatarConfig = {
  hair: 'short15', hairColor: 'afafaf', skinColor: 'f2d3b1', eyes: 'variant09', eyebrows: 'variant04', mouth: 'variant23',
  glasses: 'variant03', earrings: 'none', features: 'none', bg: '1f2a44', extra: 'none',
};
