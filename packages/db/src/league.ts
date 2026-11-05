import type { Grade, PrismaClient } from '@prisma/client';
import { LEAGUE_GROUP_SIZE, LEAGUE_MOVE, LEAGUE_TIERS, leagueWeek } from '@belmaster/shared';

function previousWeek(week: string): string {
  const t = new Date(`${week}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() - 7);
  return t.toISOString().slice(0, 10);
}

/** Лигата за новата седмица според класирането в предишната. */
async function nextTier(prisma: PrismaClient, userId: string, week: string): Promise<{ tier: number; moved: 'up' | 'down' | null }> {
  const prev = await prisma.leagueMember.findFirst({ where: { userId, week: { lt: week } }, orderBy: { week: 'desc' } });
  if (!prev) return { tier: 0, moved: null };
  // пропусната седмица — оставаш в същата лига
  if (prev.week !== previousWeek(week)) return { tier: prev.tier, moved: null };
  const group = await prisma.leagueMember.findMany({ where: { group: prev.group }, orderBy: [{ xp: 'desc' }, { createdAt: 'asc' }], select: { userId: true, xp: true } });
  const rank = group.findIndex((g) => g.userId === userId) + 1;
  if (rank > 0 && rank <= LEAGUE_MOVE && prev.xp > 0 && prev.tier < LEAGUE_TIERS.length - 1) return { tier: prev.tier + 1, moved: 'up' };
  if (group.length > LEAGUE_MOVE * 2 && rank > group.length - LEAGUE_MOVE && prev.tier > 0) return { tier: prev.tier - 1, moved: 'down' };
  return { tier: prev.tier, moved: null };
}

/** Записва ученика в лигата за тази седмица (ако още не е). */
export async function ensureLeague(prisma: PrismaClient, userId: string, grade: Grade) {
  const week = leagueWeek();
  const existing = await prisma.leagueMember.findUnique({ where: { userId_week: { userId, week } } });
  if (existing) return existing;
  const { tier, moved } = await nextTier(prisma, userId, week);
  // свободна група в тази лига и клас
  const groups = await prisma.leagueMember.groupBy({ by: ['group'], where: { week, grade, tier }, _count: true });
  const free = groups.find((g) => g._count < LEAGUE_GROUP_SIZE);
  const group = free?.group ?? `${week}:${grade}:${tier}:${groups.length + 1}`;
  const m = await prisma.leagueMember.upsert({
    where: { userId_week: { userId, week } },
    update: {},
    create: { userId, week, grade, tier, group },
  });
  if (moved) {
    const t = LEAGUE_TIERS[tier];
    await prisma.notification.create({
      data: {
        userId,
        title: moved === 'up' ? `${t.emoji} Качи се в лига ${t.name}!` : `Слезе в лига ${t.name}`,
        body: moved === 'up' ? 'Браво за миналата седмица!' : 'Тази седмица можеш да се върнеш нагоре.',
        href: '/league',
      },
    });
  }
  return m;
}

/** Добавя XP към седмичната лига (само за регистрирани с избран клас). */
export async function addLeagueXp(prisma: PrismaClient, userId: string, xp: number) {
  if (xp <= 0) return;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isGuest: true, grade: true } });
  if (!user || user.isGuest || !user.grade) return;
  const m = await ensureLeague(prisma, userId, user.grade);
  await prisma.leagueMember.update({ where: { id: m.id }, data: { xp: { increment: xp } } });
}
