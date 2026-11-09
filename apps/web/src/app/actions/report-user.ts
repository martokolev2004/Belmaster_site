'use server';

import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { hit } from '@/lib/rate-limit';

import { USER_REPORT_REASONS } from '@/lib/report-reasons';

/** Доклад за потребител — отива в Админ → Потребители. */
export async function reportUserAction(targetId: string, reason: string, message: string): Promise<{ ok?: string; error?: string }> {
  const me = await getCurrentUser();
  if (!me) return { error: 'Влез, за да докладваш.' };
  if (targetId === me.id) return { error: 'Не можеш да докладваш себе си.' };
  if (!hit(`ureport:${me.id}`, 10, 3600_000)) return { error: 'Твърде много доклади. Опитай по-късно.' };
  const target = await prisma.user.findUnique({ where: { id: String(targetId) }, select: { id: true } });
  if (!target) return { error: 'Няма такъв потребител.' };
  const r = (USER_REPORT_REASONS as readonly string[]).includes(reason) ? reason : 'Друго';
  const dup = await prisma.userReport.findFirst({ where: { reporterId: me.id, targetId: target.id, status: 'OPEN' } });
  if (dup) return { ok: 'Вече си докладвал този потребител — ще го прегледаме.' };
  await prisma.userReport.create({ data: { reporterId: me.id, targetId: target.id, reason: r, message: String(message ?? '').trim().slice(0, 500) || null } });
  return { ok: 'Благодарим! Ще прегледаме доклада.' };
}
