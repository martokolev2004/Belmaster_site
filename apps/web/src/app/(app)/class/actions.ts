'use server';

import { revalidatePath } from 'next/cache';
import type { AnyAnswer } from '@belmaster/shared';
import { prisma } from '@/lib/db';
import { syncAchievements } from '@belmaster/db';
import { getCurrentUser } from '@/lib/auth';
import { isRestricted, RESTRICTED_MSG } from '@/lib/age';
import { assignmentState, computeScores, deadlineOf, notify, questionsOf } from '@/lib/teacher';

export async function joinClassAction(_: unknown, fd: FormData): Promise<{ error?: string; ok?: boolean }> {
  const u = await getCurrentUser();
  if (!u || u.isGuest) return { error: 'Трябва да имаш профил (не гост), за да влезеш в клас.' };
  if (isRestricted(u)) return { error: RESTRICTED_MSG };
  const code = String(fd.get('code') ?? '').trim().toUpperCase().replace(/\s/g, '');
  const realName = String(fd.get('realName') ?? '').trim().replace(/\s+/g, ' ').slice(0, 60);
  if (realName.split(' ').length < 2) return { error: 'Напиши истинското си име и фамилия, за да те познае учителят.' };
  const c = await prisma.schoolClass.findUnique({ where: { code } });
  if (!c) return { error: 'Няма клас с този код.' };
  if (c.teacherId === u.id) return { error: 'Това е твой клас.' };
  const existing = await prisma.classMember.findUnique({ where: { userId: u.id } });
  if (existing) return { error: 'Вече си в клас. Първо излез от него.' };
  const taken = await prisma.classMember.count({ where: { classId: c.id } });
  if (taken >= c.capacity) return { error: 'Класът е пълен. Попитай учителя.' };
  await prisma.classMember.create({ data: { classId: c.id, userId: u.id, realName } });
  await notify(c.teacherId, { title: `Нов ученик чака одобрение — ${c.name}`, body: realName, href: `/teacher/classes/${c.id}` });
  revalidatePath('/class');
  return { ok: true };
}

export async function leaveClassAction() {
  const u = await getCurrentUser();
  if (!u) return;
  await prisma.classMember.deleteMany({ where: { userId: u.id } });
  revalidatePath('/class');
}

async function myAssignment(assignmentId: string) {
  const u = await getCurrentUser();
  if (!u) return null;
  const m = await prisma.classMember.findUnique({ where: { userId: u.id } });
  if (!m || m.status !== 'APPROVED') return null;
  const a = await prisma.assignment.findFirst({ where: { id: assignmentId, classId: m.classId } });
  return a ? { u, a } : null;
}

/** Започва опита (единствен). */
export async function startAssignmentAction(assignmentId: string): Promise<{ error?: string }> {
  const r = await myAssignment(assignmentId);
  if (!r) return { error: 'Нямаш достъп до този тест.' };
  if (assignmentState(r.a) !== 'open') return { error: 'Тестът не е отворен.' };
  await prisma.submission.upsert({
    where: { assignmentId_userId: { assignmentId, userId: r.u.id } },
    update: {},
    create: { assignmentId, userId: r.u.id },
  });
  revalidatePath(`/class/${assignmentId}`);
  return {};
}

/** Запазва отговорите (автоматично, докато ученикът пише). */
export async function saveAnswersAction(assignmentId: string, answers: Record<string, AnyAnswer>): Promise<{ ok: boolean }> {
  const r = await myAssignment(assignmentId);
  if (!r) return { ok: false };
  const s = await prisma.submission.findUnique({ where: { assignmentId_userId: { assignmentId, userId: r.u.id } } });
  if (!s || s.status !== 'STARTED') return { ok: false };
  if (Date.now() > deadlineOf(r.a, s).getTime() + 30_000) return { ok: false };
  const ids = new Set(questionsOf(r.a).map((q) => q.id));
  const clean = Object.fromEntries(Object.entries(answers).filter(([k]) => ids.has(k)));
  if (JSON.stringify(clean).length > 200_000) return { ok: false };
  await prisma.submission.update({ where: { id: s.id }, data: { answers: clean as object } });
  return { ok: true };
}

export async function submitAssignmentAction(assignmentId: string, answers: Record<string, AnyAnswer>): Promise<{ error?: string }> {
  const r = await myAssignment(assignmentId);
  if (!r) return { error: 'Нямаш достъп.' };
  const s = await prisma.submission.findUnique({ where: { assignmentId_userId: { assignmentId, userId: r.u.id } } });
  if (!s) return { error: 'Не си започнал теста.' };
  if (s.status === 'SUBMITTED') return {};
  const qs = questionsOf(r.a);
  const late = Date.now() > deadlineOf(r.a, s).getTime() + 30_000;
  // след срока се пази последното автоматично запазено
  const final = late ? (s.answers as Record<string, AnyAnswer>) : Object.fromEntries(Object.entries(answers).filter(([k]) => qs.some((q) => q.id === k)));
  const { auto, score, max } = computeScores(qs, final, s.manualScores as Record<string, number>);
  await prisma.submission.update({
    where: { id: s.id },
    data: { status: 'SUBMITTED', answers: final as object, autoScores: auto, score, maxScore: max, submittedAt: late ? deadlineOf(r.a, s) : new Date() },
  });
  await syncAchievements(prisma, r.u.id).catch(() => {});
  revalidatePath(`/class/${assignmentId}`);
  revalidatePath('/class');
  return {};
}

export async function markNotificationsReadAction() {
  const u = await getCurrentUser();
  if (!u) return;
  await prisma.notification.updateMany({ where: { userId: u.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath('/', 'layout');
}
