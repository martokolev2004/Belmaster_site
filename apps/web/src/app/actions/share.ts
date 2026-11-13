'use server';

import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

/** диаманти за първото споделяне на резултат (само веднъж на профил) */
const SHARE_REWARD = 3;

/** Какво да се нарисува на картата и има ли още награда за споделяне. */
export async function shareInfoAction(): Promise<{ id: string; name: string; avatar: unknown; reward: number } | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return { id: user.id, name: user.displayName, avatar: user.avatar, reward: user.isGuest || user.shareRewardAt ? 0 : SHARE_REWARD };
}

/** Наградата за първото споделяне. Връща колко диаманта са дадени (0, ако вече е взета). */
export async function claimShareRewardAction(): Promise<number> {
  const user = await getCurrentUser();
  if (!user || user.isGuest || user.shareRewardAt) return 0;
  // условието в заявката пази от двойно даване при две бързи натискания
  const r = await prisma.user.updateMany({ where: { id: user.id, shareRewardAt: null }, data: { shareRewardAt: new Date(), diamondsBonus: { increment: SHARE_REWARD } } });
  // без презареждане на страницата: крайният екран на теста/играта трябва да остане; броячът горе се обновява при следващото отваряне на страница
  return r.count ? SHARE_REWARD : 0;
}
