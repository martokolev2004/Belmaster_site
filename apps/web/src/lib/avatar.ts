import 'server-only';
import type { User } from '@belmaster/db';
import type { UnlockProgress } from '@belmaster/shared';
import { prisma } from './db';

/** Какво е постигнал потребителят — за отключване на части от аватара. */
export async function unlockProgress(user: User): Promise<UnlockProgress> {
  const [wins, ach] = await Promise.all([
    prisma.matchPlayer.count({ where: { userId: user.id, place: 1, match: { vsBot: false } } }),
    prisma.userAchievement.findMany({ where: { userId: user.id }, select: { code: true } }),
  ]);
  return { level: user.level, wins, bestStreak: user.bestStreak, achievements: ach.map((a) => a.code) };
}
