import 'server-only';
import type { User } from '@belmaster/db';
import { lockedItems, nextLevel, unlockedKeys } from '@belmaster/shared';
import { prisma } from './db';
import { isAdmin } from './auth';
import { unlockProgress } from './avatar';

export interface Celebration {
  fromLevel: number;
  toLevel: number;
  items: { part: string; value: string; key: string }[];
  /** нови постижения (кодове) */
  achievements: string[];
}

/** Има ли ново ниво / нови части, за които още не е показана анимацията. */
export async function pendingCelebration(user: User): Promise<Celebration | null> {
  if (user.isGuest || isAdmin(user)) return null;
  const level = nextLevel(user.level, user.xp);
  const unlocked = unlockedKeys(unlockProgress(user, { includeWorn: false }));
  // първи път (стари профили): само запомняме, без анимация
  if (user.announcedLevel === 0) {
    await prisma.user.update({ where: { id: user.id }, data: { announcedLevel: level, announcedItems: unlocked } });
    return null;
  }
  const announced = new Set(user.announcedItems);
  const fresh = unlocked.filter((k) => !announced.has(k));
  const ach = await prisma.userAchievement.findMany({ where: { userId: user.id, seen: false }, orderBy: { unlockedAt: 'asc' }, select: { code: true } });
  if (level <= user.announcedLevel && !fresh.length && !ach.length) return null;
  const byKey = new Map(lockedItems().map((i) => [i.key, i]));
  return {
    fromLevel: user.announcedLevel,
    toLevel: Math.max(level, user.announcedLevel),
    items: fresh.map((k) => byKey.get(k)!).filter(Boolean).map(({ part, value, key }) => ({ part, value, key })),
    achievements: ach.map((a) => a.code),
  };
}

export async function ackCelebration(user: User) {
  await prisma.userAchievement.updateMany({ where: { userId: user.id, seen: false }, data: { seen: true } });
  const level = nextLevel(user.level, user.xp);
  const unlocked = unlockedKeys(unlockProgress(user, { includeWorn: false }));
  await prisma.user.update({
    where: { id: user.id },
    data: { announcedLevel: Math.max(level, user.announcedLevel), announcedItems: [...new Set([...user.announcedItems, ...unlocked])] },
  });
}

/** Отключени, но още невидени части (червена точка). */
export function newItemKeys(user: User): string[] {
  if (user.isGuest || isAdmin(user)) return [];
  const seen = new Set(user.seenItems);
  return unlockedKeys(unlockProgress(user, { includeWorn: false })).filter((k) => !seen.has(k));
}
