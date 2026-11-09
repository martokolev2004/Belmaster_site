'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { isAdmin, requireAdmin } from '@/lib/auth';

/** Блокиране / отблокиране. Блокираният губи всички сесии и изчезва от класациите. */
export async function blockUserAction(form: FormData) {
  await requireAdmin();
  const id = String(form.get('id'));
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u || isAdmin(u)) return;
  if (form.get('unblock')) {
    await prisma.user.update({ where: { id }, data: { blockedAt: null, blockReason: null } });
  } else {
    await prisma.user.update({ where: { id }, data: { blockedAt: new Date(), blockReason: String(form.get('reason') ?? '').trim().slice(0, 200) || null } });
    await prisma.session.deleteMany({ where: { userId: id } });
    await prisma.userReport.updateMany({ where: { targetId: id, status: 'OPEN' }, data: { status: 'RESOLVED' } });
  }
  revalidatePath('/admin/users');
}

/** Сменя неподходящо име с неутрално. */
export async function resetNameAction(form: FormData) {
  await requireAdmin();
  const id = String(form.get('id'));
  await prisma.user.update({ where: { id }, data: { displayName: `Играч ${Math.floor(1000 + Math.random() * 9000)}` } });
  await prisma.userReport.updateMany({ where: { targetId: id, status: 'OPEN', reason: { contains: 'име' } }, data: { status: 'RESOLVED' } });
  revalidatePath('/admin/users');
}

export async function closeUserReportsAction(form: FormData) {
  await requireAdmin();
  await prisma.userReport.updateMany({ where: { targetId: String(form.get('id')), status: 'OPEN' }, data: { status: 'DISMISSED' } });
  revalidatePath('/admin/users');
}
