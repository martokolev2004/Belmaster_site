'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { unlock } from '@/lib/progress';
import { isRestricted, RESTRICTED_MSG } from '@/lib/age';
import type { FormState } from '@/app/(auth)/actions';

export async function addFriendAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Не си влязъл.' };
  if (isRestricted(user)) return { error: RESTRICTED_MSG };
  const code = String(form.get('code') ?? '').trim().toUpperCase();
  const target = await prisma.user.findUnique({ where: { friendCode: code } });
  if (!target || isRestricted(target)) return { error: 'Няма потребител с такъв код.' };
  if (target.id === user.id) return { error: 'Това е твоят код 🙂' };
  const existing = await prisma.friendship.findFirst({
    where: { OR: [{ requesterId: user.id, addresseeId: target.id }, { requesterId: target.id, addresseeId: user.id }] },
  });
  if (existing?.status === 'ACCEPTED') return { error: `Вече сте приятели с ${target.displayName}.` };
  if (existing && existing.requesterId === target.id) {
    await accept(existing.id, user.id);
    return { ok: `Вече сте приятели с ${target.displayName}!` };
  }
  if (existing) return { error: 'Вече си изпратил покана.' };
  await prisma.friendship.create({ data: { requesterId: user.id, addresseeId: target.id } });
  revalidatePath('/leaderboard');
  return { ok: `Поканата до ${target.displayName} е изпратена.` };
}

async function accept(id: string, userId: string) {
  const f = await prisma.friendship.update({ where: { id }, data: { status: 'ACCEPTED' } });
  for (const uid of [f.requesterId, f.addresseeId]) {
    await unlock(uid);
  }
  void userId;
  revalidatePath('/leaderboard');
}

export async function respondFriendAction(form: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const id = String(form.get('id'));
  const decision = String(form.get('decision'));
  const f = await prisma.friendship.findUnique({ where: { id } });
  if (!f) return;
  if (decision === 'accept' && !isRestricted(user) && f.addresseeId === user.id && f.status === 'PENDING') await accept(id, user.id);
  // изтриване само при изрично „откажи“ — никога по подразбиране
  else if ((decision === 'decline' || decision === 'cancel') && (f.addresseeId === user.id || f.requesterId === user.id)) {
    await prisma.friendship.delete({ where: { id } });
    revalidatePath('/leaderboard');
  }
}
