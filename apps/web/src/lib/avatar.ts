import 'server-only';
import type { User } from '@belmaster/db';
import { diamondsEarned, lockedItems, nextLevel, type UnlockProgress } from '@belmaster/shared';
import { isAdmin } from './auth';

/** Налични диаманти (спечелени − похарчени). */
export function diamondsOf(user: Pick<User, 'xp' | 'diamondsSpent'>): number {
  return Math.max(0, diamondsEarned(user.xp) - user.diamondsSpent);
}

/** Какво е постигнал потребителят — за отключване на части от аватара. */
export function unlockProgress(user: User): UnlockProgress {
  // админът има всичко отключено (за да пробва частите)
  if (isAdmin(user)) return { level: 999, diamonds: 9999, owned: lockedItems().map((i) => i.key) };
  return { level: nextLevel(user.level, user.xp), diamonds: diamondsOf(user), owned: user.ownedItems };
}
