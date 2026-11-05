import type { PrismaClient } from '@prisma/client';
import { ACHIEVEMENTS, levelForXp, type AchievementMetric } from '@belmaster/shared';

/** Всички броячи за постиженията на един потребител. */
export async function achievementMetrics(prisma: PrismaClient, userId: string): Promise<Record<AchievementMetric, number>> {
  const [user, tests, exams, topic, battleGames, battleWins, climbGames, climbWins, friends, stats, attempts, examGroups, leagues, assignments, member] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { xp: true, level: true, bestStreak: true, mistakesCleared: true, ownedItems: true } }),
    prisma.quizAttempt.count({ where: { userId } }),
    prisma.quizAttempt.count({ where: { userId, kind: 'EXAM' } }),
    prisma.userTopicStat.aggregate({ where: { userId, key: { startsWith: 'S:' } }, _sum: { score: true } }),
    prisma.matchPlayer.count({ where: { userId, match: { mode: { not: 'CLIMB' } } } }),
    prisma.matchPlayer.count({ where: { userId, place: 1, match: { mode: { not: 'CLIMB' } } } }),
    prisma.matchPlayer.count({ where: { userId, match: { mode: 'CLIMB' } } }),
    prisma.matchPlayer.count({ where: { userId, match: { mode: 'CLIMB', winnerUid: userId } } }),
    prisma.friendship.count({ where: { status: 'ACCEPTED', OR: [{ requesterId: userId }, { addresseeId: userId }] } }),
    prisma.userTopicStat.findMany({ where: { userId }, select: { key: true, score: true, answered: true } }),
    prisma.quizAttempt.findMany({ where: { userId, kind: { not: 'EXAM' }, total: { gte: 5 } }, select: { score: true, total: true } }),
    prisma.quizAttempt.groupBy({ by: ['examId'], where: { userId, kind: 'EXAM', examId: { not: null } } }),
    prisma.leagueMember.findMany({ where: { userId }, select: { tier: true } }),
    prisma.submission.count({ where: { userId, status: 'SUBMITTED' } }),
    prisma.classMember.findFirst({ where: { userId, status: 'APPROVED' }, select: { id: true } }),
  ]);
  const st = (key: string) => Math.floor(stats.find((x) => x.key === key)?.score ?? 0);
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
    xp: user?.xp ?? 0,
    langCorrect: st('S:LANGUAGE'),
    litCorrect: st('S:LITERATURE'),
    readCorrect: st('S:READING'),
    spellingCorrect: st('T:SPELLING'),
    punctCorrect: st('T:PUNCTUATION'),
    worksTouched: stats.filter((x) => x.key.startsWith('W:') && x.answered > 0).length,
    perfectTests: attempts.filter((a) => a.score >= a.total - 1e-6).length,
    examsDistinct: examGroups.length,
    items: (user?.ownedItems ?? []).length,
    leagueWeeks: leagues.length,
    leagueTierMax: leagues.reduce((m, l) => Math.max(m, l.tier), 0),
    assignments,
    classJoined: member ? 1 : 0,
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
