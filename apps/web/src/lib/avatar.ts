import 'server-only';
import type { User } from '@belmaster/db';
import type { UnlockProgress } from '@belmaster/shared';
import { ACHIEVEMENTS } from '@belmaster/shared';
import { prisma } from './db';
import { isAdmin } from './auth';

/** Какво е постигнал потребителят — за отключване на части от аватара. */
export async function unlockProgress(user: User): Promise<UnlockProgress> {
  // админът има всичко отключено (за да пробва частите)
  if (isAdmin(user)) return { level: 999, wins: 9999, bestStreak: 9999, achievements: ACHIEVEMENTS.map((a) => a.code) };
  const [wins, ach] = await Promise.all([
    prisma.matchPlayer.count({ where: { userId: user.id, place: 1, match: { vsBot: false } } }),
    prisma.userAchievement.findMany({ where: { userId: user.id }, select: { code: true } }),
  ]);
  return { level: user.level, wins, bestStreak: user.bestStreak, achievements: ach.map((a) => a.code) };
}
