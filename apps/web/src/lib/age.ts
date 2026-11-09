/** Възраст и родителско съгласие (България: под 14 г. — нужно е съгласие на родител). */
export const CONSENT_AGE = 14;
export const MIN_AGE = 9;

export function ageOn(birth: Date, now = new Date()): number {
  let a = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) a--;
  return a;
}

export function needsParent(user: { isGuest: boolean; birthDate: Date | null; parentConsentAt: Date | null }): boolean {
  return !user.isGuest && !!user.birthDate && ageOn(user.birthDate) < CONSENT_AGE && !user.parentConsentAt;
}

/** Профил с ограничения: дете без потвърдено родителско съгласие. */
export const isRestricted = needsParent;

/** Проверка на дата от формуляр (ден, месец, година). */
export function parseBirth(d: unknown, m: unknown, y: unknown): Date | string {
  const day = Number(d), month = Number(m), year = Number(y);
  if (!day || !month || !year) return 'Попълни датата на раждане.';
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCDate() !== day || date.getUTCMonth() !== month - 1) return 'Невалидна дата.';
  const age = ageOn(date);
  if (age < MIN_AGE || age > 100) return 'Провери годината на раждане.';
  return date;
}

/** Prisma филтър: скрива от публични списъци блокираните и децата без съгласие на родител. */
export function publicUserWhere(now = new Date()) {
  const cutoff = new Date(now.getFullYear() - CONSENT_AGE, now.getMonth(), now.getDate());
  return { blockedAt: null, NOT: { birthDate: { gt: cutoff }, parentConsentAt: null } };
}

export const RESTRICTED_MSG = 'Докато родител не потвърди профила ти, тази функция е заключена. Виж „Профил → Поверителност“.';
