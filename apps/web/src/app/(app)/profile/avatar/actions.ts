'use server';

import { revalidatePath } from 'next/cache';
import { lockedItems, sanitizeAvatar } from '@belmaster/shared';
import { prisma } from '@/lib/db';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { diamondsOf, unlockProgress } from '@/lib/avatar';

export async function saveAvatarAction(config: unknown): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  // заключените части, които не са отключени, се махат на сървъра
  const clean = sanitizeAvatar(config, unlockProgress(user), user.id);
  await prisma.user.update({ where: { id: user.id }, data: { avatar: clean } });
  revalidatePath('/', 'layout');
  return { ok: true };
}

/** Купува част с диаманти. */
export async function buyItemAction(key: string): Promise<{ ok: boolean; error?: string; diamonds?: number }> {
  const user = await getCurrentUser();
  if (!user || user.isGuest) return { ok: false, error: 'Само за регистрирани.' };
  if (isAdmin(user)) return { ok: true, diamonds: 9999 };
  const item = lockedItems().find((i) => i.key === key);
  if (!item || item.rule.kind !== 'shop') return { ok: false, error: 'Тази част не се продава.' };
  if (user.ownedItems.includes(key)) return { ok: true, diamonds: diamondsOf(user) };
  const price = item.rule.price;
  if (diamondsOf(user) < price) return { ok: false, error: 'Нямаш достатъчно диаманти.' };
  // условно обновяване — защита от двойно купуване при два бързи клика
  const res = await prisma.user.updateMany({
    where: { id: user.id, diamondsSpent: user.diamondsSpent },
    data: {
      diamondsSpent: { increment: price },
      ownedItems: { push: key },
      announcedItems: { push: key },
      seenItems: { push: key },
    },
  });
  if (res.count !== 1) return { ok: false, error: 'Опитай пак.' };
  revalidatePath('/', 'layout');
  return { ok: true, diamonds: diamondsOf({ xp: user.xp, diamondsSpent: user.diamondsSpent + price }) };
}

/** Маха червената точка от видени части. */
export async function markSeenAction(keys: string[]): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.isGuest) return;
  const valid = new Set(lockedItems().map((i) => i.key));
  const add = keys.filter((k) => valid.has(k) && !user.seenItems.includes(k));
  if (!add.length) return;
  await prisma.user.update({ where: { id: user.id }, data: { seenItems: { push: add } } });
  revalidatePath('/', 'layout');
}
