import type { PrismaClient } from '@prisma/client';
import { ACHIEVEMENTS, levelForXp, type AchievementMetric } from '@belmaster/shared';

/** Всички броячи за постиженията на един потребител. */
export async function achievementMetrics(prisma: PrismaClient, userId: string): Promise<Record<AchievementMetric, number>> {
  const [user, tests, exams, topic, battleGames, battleWins, climbGames, climbWins, friends] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { xp: true, level: true, bestStreak: true, mistakesCleared: true } }),
    prisma.quizAttempt.count({ where: { userId } }),
    prisma.quizAttempt.count({ where: { userId, kind: 'EXAM' } }),
    prisma.userTopicStat.aggregate({ where: { userId, key: { startsWith: 'S:' } }, _sum: { score: true } }),
    prisma.matchPlayer.count({ where: { userId, match: { mode: { not: 'CLIMB' } } } }),
    prisma.matchPlayer.count({ where: { userId, place: 1, match: { mode: { not: 'CLIMB' } } } }),
    prisma.matchPlayer.count({ where: { userId, match: { mode: 'CLIMB' } } }),
    prisma.matchPlayer.count({ where: { userId, match: { mode: 'CLIMB', winnerUid: userId } } }),
    prisma.friendship.count({ where: { status: 'ACCEPTED', OR: [{ requesterId: userId }, { addresseeId: userId }] } }),
  ]);
  return {
    tests,
    exams,
    correct: Math.floor(topic._sum.score ?? 0),
    mistakesCleared: user?.mistakesCleared ?? 0,
    bestStreak: user?.bestStreak ?? 0,
    level: Math.max(user?.level ?? 1, levelForXp(user?.xp ?? 0)),
    friends,
    battleGames,
    battleWins,
    climbGames,
    climbWins,
  };
}

/** Проверява всички постижения (по броячите + подадените събития) и отключва новите. */
export async function syncAchievements(prisma: PrismaClient, userId: string, events: string[] = []): Promise<string[]> {
  const [m, have] = await Promise.all([
    achievementMetrics(prisma, userId),
    prisma.userAchievement.findMany({ where: { userId }, select: { code: true } }),
  ]);
  const owned = new Set(have.map((h) => h.code));
  const fresh = ACHIEVEMENTS.filter(
    (a) => !owned.has(a.code) && ((a.metric && a.goal != null && m[a.metric] >= a.goal) || (!a.metric && events.includes(a.code))),
  ).map((a) => a.code);
  if (fresh.length) await prisma.userAchievement.createMany({ data: fresh.map((code) => ({ userId, code, seen: false })), skipDuplicates: true });
  return fresh;
}
