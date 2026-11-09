import 'server-only';
import { isRestricted } from './age';
import { nextLevel, sofiaDay } from '@belmaster/shared';
import { addLeagueXp, syncAchievements } from '@belmaster/db';
import { prisma } from './db';

function previousDay(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Добавя XP, обновява нивото и серията. Връща новите стойности и отключените постижения. */
export async function awardProgress(userId: string, xp: number, extra: { perfect?: boolean; events?: string[] } = {}) {
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
      level: nextLevel(user.level, newXp),
      streak,
      bestStreak: Math.max(user.bestStreak, streak),
      lastActiveDay: today,
    },
  });

  if (!isRestricted(updated)) await addLeagueXp(prisma, userId, xp).catch((e) => console.error('[league]', e));
  const events = [...(extra.events ?? []), ...(extra.perfect ? ['perfect_test'] : [])];
  const unlocked = await syncAchievements(prisma, userId, events);
  return { user: updated, unlocked };
}

/** Проверява постиженията (напр. след нов приятел). */
export async function unlock(userId: string, events: string[] = []): Promise<string[]> {
  return syncAchievements(prisma, userId, events);
}
