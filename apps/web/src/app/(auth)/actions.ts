'use server';

import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { isGrade } from '@belmaster/shared';
import { prisma } from '@/lib/db';
import { createSession, destroySession, getCurrentUser, newFriendCode, randomAvatarColor } from '@/lib/auth';

export interface FormState {
  error?: string;
  ok?: string;
}

const registerSchema = z.object({
  displayName: z.string().trim().min(2, 'Името трябва да е поне 2 знака.').max(30, 'Името е твърде дълго.'),
  email: z.string().trim().toLowerCase().email('Невалиден имейл.'),
  password: z.string().min(8, 'Паролата трябва да е поне 8 знака.').max(200),
});

function safeNext(v: FormDataEntryValue | null): string {
  const s = typeof v === 'string' ? v : '';
  return s.startsWith('/') && !s.startsWith('//') ? s : '/';
}

export async function registerAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { displayName, email, password } = parsed.data;
  if (await prisma.user.findUnique({ where: { email } })) return { error: 'Вече има профил с този имейл.' };
  const passwordHash = await bcrypt.hash(password, 11);

  // Ако е гост — превръщаме профила му в истински (запазва прогреса)
  const current = await getCurrentUser();
  if (current?.isGuest) {
    await prisma.user.update({ where: { id: current.id }, data: { email, passwordHash, displayName, isGuest: false } });
    redirect('/profile');
  }

  const user = await prisma.user.create({
    data: { email, passwordHash, displayName, friendCode: await newFriendCode(), avatarColor: randomAvatarColor() },
  });
  await createSession(user.id);
  redirect('/grade');
}

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: 'Грешен имейл или парола.' };
  }
  await createSession(user.id);
  redirect(user.grade ? safeNext(form.get('next')) : '/grade');
}

export async function guestAction(form: FormData): Promise<void> {
  const grade = form.get('grade');
  const n = Math.floor(1000 + Math.random() * 9000);
  const user = await prisma.user.create({
    data: {
      displayName: `Гост ${n}`,
      isGuest: true,
      grade: isGrade(grade) ? grade : null,
      friendCode: await newFriendCode(),
      avatarColor: randomAvatarColor(),
    },
  });
  await createSession(user.id);
  redirect(user.grade ? safeNext(form.get('next')) : '/grade');
}

export async function setGradeAction(form: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const grade = form.get('grade');
  if (!isGrade(grade)) return;
  await prisma.user.update({ where: { id: user.id }, data: { grade } });
  redirect(safeNext(form.get('next')));
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect('/');
}
