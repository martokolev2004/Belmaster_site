'use server';

import { revalidatePath } from 'next/cache';
import { isUnlocked, weaponById, weaponKey, WEAPONS } from '@belmaster/shared';
import { prisma } from '@/lib/db';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { diamondsOf, unlockProgress } from '@/lib/avatar';
import { unlock } from '@/lib/progress';

export async function selectWeaponAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  const w = WEAPONS.find((x) => x.id === id);
  if (!w) return { ok: false, error: 'Няма такова оръжие.' };
  if (w.rule && !isUnlocked(w.rule, unlockProgress(user), weaponKey(w.id))) return { ok: false, error: 'Още е заключено.' };
  await prisma.user.update({ where: { id: user.id }, data: { weapon: w.id } });
  if (!user.isGuest && w.id !== 'stone') await unlock(user.id, ['weapon_change', ...(w.id === 'rocket' ? ['rocket_owner'] : [])]);
  revalidatePath('/climb');
  return { ok: true };
}

export async function buyWeaponAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.isGuest) return { ok: false, error: 'Само за регистрирани.' };
  const w = weaponById(id);
  if (w.id !== id || w.rule?.kind !== 'shop') return { ok: false, error: 'Това оръжие не се продава.' };
  const key = weaponKey(w.id);
  if (isAdmin(user) || user.ownedItems.includes(key)) return selectWeaponAction(id);
  if (diamondsOf(user) < w.rule.price) return { ok: false, error: 'Нямаш достатъчно диаманти.' };
  const res = await prisma.user.updateMany({
    where: { id: user.id, diamondsSpent: user.diamondsSpent },
    data: { diamondsSpent: { increment: w.rule.price }, ownedItems: { push: key }, weapon: w.id },
  });
  if (res.count !== 1) return { ok: false, error: 'Опитай пак.' };
  await unlock(user.id, ['weapon_change', ...(w.id === 'rocket' ? ['rocket_owner'] : [])]);
  revalidatePath('/', 'layout');
  return { ok: true };
}
