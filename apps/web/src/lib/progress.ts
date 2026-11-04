import 'server-only';
import { ACHIEVEMENTS, levelForXp, sofiaDay } from '@belmaster/shared';
import { prisma } from './db';

function previousDay(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Добавя XP, обновява нивото и серията. Връща новите стойности и отключените постижения. */
export async function awardProgress(userId: string, xp: number, extra: { perfect?: boolean } = {}) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const today = sofiaDay();
  let streak = user.streak;
  if (user.lastActiveDay !== today) {
    streak = user.lastActiveDay === previousDay(today) ? user.streak + 1 : 1;
  }
  const newXp = user.xp + xp;
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      xp: newXp,
      level: levelForXp(newXp),
      streak,
      bestStreak: Math.max(user.bestStreak, streak),
      lastActiveDay: today,
    },
  });

  const codes: string[] = ['first_test'];
  if (streak >= 7) codes.push('streak_7');
  if (updated.level >= 5) codes.push('level_5');
  if (extra.perfect) codes.push('perfect_test');
  const unlocked = await unlock(userId, codes);
  return { user: updated, unlocked };
}

export async function unlock(userId: string, codes: string[]): Promise<string[]> {
  if (!codes.length) return [];
  const existing = await prisma.userAchievement.findMany({ where: { userId, code: { in: codes } } });
  const have = new Set(existing.map((e) => e.code));
  const fresh = codes.filter((c) => !have.has(c) && ACHIEVEMENTS.some((a) => a.code === c));
  if (fresh.length) {
    await prisma.userAchievement.createMany({ data: fresh.map((code) => ({ userId, code })), skipDuplicates: true });
  }
  return fresh;
}
