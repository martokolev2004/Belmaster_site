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

/** Какво е нужно за отключване: ниво или XP (автоматично) или диаманти (купува се). */
export type UnlockRule = { kind: 'level'; n: number } | { kind: 'xp'; n: number } | { kind: 'shop'; price: number };

export interface UnlockProgress {
  level: number;
  xp: number;
  diamonds: number; // налични (спечелени − похарчени)
  owned: string[]; // купени части, ключ "част:стойност"
}

export const itemKey = (part: AvatarPart, value: string) => `${part}:${value}`;

/** Наградите по ред — от лесни към трудни; заключените части се разпределят по тях. */
const RULE_LADDER: UnlockRule[] = [
  { kind: 'xp', n: 300 },
  { kind: 'shop', price: 1 },
  { kind: 'level', n: 2 },
  { kind: 'xp', n: 1500 },
  { kind: 'shop', price: 2 },
  { kind: 'level', n: 3 },
  { kind: 'xp', n: 4000 },
  { kind: 'shop', price: 3 },
  { kind: 'level', n: 4 },
  { kind: 'shop', price: 5 },
  { kind: 'level', n: 5 },
  { kind: 'xp', n: 9000 },
  { kind: 'shop', price: 8 },
  { kind: 'level', n: 6 },
  { kind: 'level', n: 7 },
  { kind: 'shop', price: 12 },
  { kind: 'level', n: 8 },
  { kind: 'xp', n: 25000 },
  { kind: 'level', n: 9 },
  { kind: 'shop', price: 15 },
  { kind: 'level', n: 10 },
];

/** Ръчно зададени (специалните части). */
const LOCK_OVERRIDES: Partial<Record<AvatarPart, Record<string, UnlockRule>>> = {
  extra: {
    quill: { kind: 'level', n: 3 },
    laurel: { kind: 'level', n: 6 },
    helmet: { kind: 'shop', price: 50 },
    crown: { kind: 'shop', price: 100 },
  },
  hair: {
    long03: { kind: 'shop', price: 10 },
    long08: { kind: 'shop', price: 12 },
    long18: { kind: 'shop', price: 12 },
    short16: { kind: 'shop', price: 15 },
  },
  earrings: {
    variant05: { kind: 'shop', price: 10 },
    variant06: { kind: 'shop', price: 15 },
  },
};

/** Без заключване: цветът на кожата и „без“. */
const NEVER_LOCKED: AvatarPart[] = ['skinColor'];

function buildLocks(): Partial<Record<AvatarPart, Record<string, UnlockRule>>> {
  const out: Partial<Record<AvatarPart, Record<string, UnlockRule>>> = {};
  for (const part of Object.keys(AVATAR_OPTIONS) as AvatarPart[]) {
    if (NEVER_LOCKED.includes(part)) continue;
    const values = AVATAR_OPTIONS[part].filter((v) => v !== 'none');
    const n = values.length;
    // всяка втора + последните ~10% са заключени (≈55%)
    const locked = values.filter((_, i) => i % 2 === 1 || i >= Math.ceil(n * 0.9));
    const rules: Record<string, UnlockRule> = {};
    locked.forEach((v, i) => {
      rules[v] = RULE_LADDER[Math.min(RULE_LADDER.length - 1, Math.floor((i * RULE_LADDER.length) / locked.length))];
    });
    out[part] = { ...rules, ...(LOCK_OVERRIDES[part] ?? {}) };
  }
  return out;
}

/** Заключените части; всичко останало е свободно. */
export const AVATAR_LOCKS = buildLocks();

export function ruleText(r: UnlockRule): string {
  return r.kind === 'level' ? `ниво ${r.n}` : r.kind === 'xp' ? `${r.n} XP` : `${r.price} 💎`;
}

export function isUnlocked(r: UnlockRule | undefined, p: UnlockProgress, key?: string): boolean {
  if (!r) return true;
  if (r.kind === 'level') return p.level >= r.n;
  if (r.kind === 'xp') return p.xp >= r.n;
  return key ? p.owned.includes(key) : false;
}

/** Всички заключени части като списък (за магазина и „новите“ неща). */
export function lockedItems(): { part: AvatarPart; value: string; key: string; rule: UnlockRule }[] {
  const out: { part: AvatarPart; value: string; key: string; rule: UnlockRule }[] = [];
  for (const part of Object.keys(AVATAR_LOCKS) as AvatarPart[])
    for (const [value, rule] of Object.entries(AVATAR_LOCKS[part] ?? {})) out.push({ part, value, key: itemKey(part, value), rule });
  return out;
}

/** Отключените (по ниво или купени) специални части. */
export function unlockedKeys(p: UnlockProgress): string[] {
  return lockedItems().filter((i) => isUnlocked(i.rule, p, i.key)).map((i) => i.key);
}

/** Частите, които се отключват точно на дадено ниво. */
export function itemsForLevel(level: number) {
  return lockedItems().filter((i) => i.rule.kind === 'level' && i.rule.n === level);
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
    if (p && !isUnlocked(lockOf(part, v), p, itemKey(part, v))) continue;
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
