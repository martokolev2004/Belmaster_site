'use server';

import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { isGrade } from '@belmaster/shared';
import { prisma } from '@/lib/db';
import { createSession, destroySession, getCurrentUser, newFriendCode, randomAvatarColor } from '@/lib/auth';
import { ageOn, CONSENT_AGE, parseBirth } from '@/lib/age';
import { checkDisplayName } from '@/lib/names';
import { sendParentEmail, sendResetEmail, sendVerifyEmail, consumeToken } from '@/lib/email-tokens';
import { hit } from '@/lib/rate-limit';
import { headers } from 'next/headers';

export interface FormState {
  error?: string;
  ok?: string;
}

const registerSchema = z.object({
  displayName: z.string().trim(),
  email: z.string().trim().toLowerCase().email('Невалиден имейл.'),
  password: z.string().min(8, 'Паролата трябва да е поне 8 знака.').max(200),
}).passthrough();

function safeNext(v: FormDataEntryValue | null): string {
  const s = typeof v === 'string' ? v : '';
  return s.startsWith('/') && !s.startsWith('//') ? s : '/';
}

/** Дата на раждане, условия и (под 14 г.) имейл на родител — общо за регистрацията и попълването после. */
function readConsent(form: FormData): { birthDate: Date; parentEmail: string | null } | string {
  const birth = parseBirth(form.get('birthDay'), form.get('birthMonth'), form.get('birthYear'));
  if (typeof birth === 'string') return birth;
  if (form.get('terms') !== 'on') return 'Трябва да приемеш общите условия и политиката за поверителност.';
  let parentEmail: string | null = null;
  if (ageOn(birth) < CONSENT_AGE) {
    const pe = z.string().trim().toLowerCase().email().safeParse(form.get('parentEmail'));
    if (!pe.success) return 'Въведи валиден имейл на родител.';
    parentEmail = pe.data;
  }
  return { birthDate: birth, parentEmail };
}

async function ip() {
  const h = await headers();
  return (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'local';
}

export async function registerAction(_: FormState, form: FormData): Promise<FormState> {
  if (!hit(`reg:${await ip()}`, 10, 3600_000)) return { error: 'Твърде много опити. Опитай пак след малко.' };
  const parsed = registerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { displayName, email, password } = parsed.data;
  const nameErr = checkDisplayName(displayName);
  if (nameErr) return { error: nameErr };
  const consent = readConsent(form);
  if (typeof consent === 'string') return { error: consent };
  if (consent.parentEmail === email) return { error: 'Имейлът на родителя трябва да е различен от твоя.' };
  if (await prisma.user.findUnique({ where: { email } })) return { error: 'Вече има профил с този имейл.' };
  const passwordHash = await bcrypt.hash(password, 11);
  const data = { email, passwordHash, displayName, birthDate: consent.birthDate, parentEmail: consent.parentEmail, termsAcceptedAt: new Date() };

  // Ако е гост — превръщаме профила му в истински (запазва прогреса)
  const current = await getCurrentUser();
  const user = current?.isGuest
    ? await prisma.user.update({ where: { id: current.id }, data: { ...data, isGuest: false } })
    : await prisma.user.create({ data: { ...data, friendCode: await newFriendCode(), avatarColor: randomAvatarColor() } });
  if (!current?.isGuest) await createSession(user.id);
  await sendVerifyEmail(user);
  if (user.parentEmail) await sendParentEmail(user);
  redirect(current?.isGuest ? '/profile' : '/grade');
}

/** За стари профили: дата на раждане + условия (+ родител). */
export async function completeProfileAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user || user.isGuest) redirect('/login');
  const consent = readConsent(form);
  if (typeof consent === 'string') return { error: consent };
  if (consent.parentEmail && consent.parentEmail === user.email) return { error: 'Имейлът на родителя трябва да е различен от твоя.' };
  const u = await prisma.user.update({ where: { id: user.id }, data: { birthDate: consent.birthDate, parentEmail: consent.parentEmail, termsAcceptedAt: new Date() } });
  if (u.parentEmail && !u.parentConsentAt) await sendParentEmail(u);
  redirect(u.grade ? '/' : '/grade');
}

export async function resendParentAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user || user.isGuest) return { error: 'Не си влязъл.' };
  if (!hit(`parent:${user.id}`, 5, 3600_000)) return { error: 'Твърде много опити. Опитай пак след час.' };
  const pe = z.string().trim().toLowerCase().email().safeParse(form.get('parentEmail') || user.parentEmail);
  if (!pe.success) return { error: 'Въведи валиден имейл на родител.' };
  if (pe.data === user.email) return { error: 'Имейлът на родителя трябва да е различен от твоя.' };
  const u = await prisma.user.update({ where: { id: user.id }, data: { parentEmail: pe.data } });
  await sendParentEmail(u);
  return { ok: `Изпратихме имейл до ${pe.data}.` };
}

export async function resendVerifyAction(): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user || user.isGuest || !user.email) return { error: 'Не си влязъл.' };
  if (!hit(`verify:${user.id}`, 5, 3600_000)) return { error: 'Твърде много опити. Опитай пак след час.' };
  await sendVerifyEmail(user);
  return { ok: `Изпратихме нов линк до ${user.email}.` };
}

export async function forgotAction(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  if (!hit(`forgot:${await ip()}`, 8, 3600_000)) return { error: 'Твърде много опити. Опитай пак след малко.' };
  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  if (user?.passwordHash) await sendResetEmail(user);
  // не казваме дали има такъв профил
  return { ok: 'Ако има профил с този имейл, ще получиш линк за нова парола до няколко минути.' };
}

export async function resetAction(_: FormState, form: FormData): Promise<FormState> {
  const password = String(form.get('password') ?? '');
  if (password.length < 8) return { error: 'Паролата трябва да е поне 8 знака.' };
  if (password !== String(form.get('password2') ?? '')) return { error: 'Паролите не съвпадат.' };
  const t = await consumeToken(String(form.get('token') ?? ''), 'reset');
  if (!t) return { error: 'Линкът е невалиден или е изтекъл. Поискай нов.' };
  await prisma.user.update({ where: { id: t.userId }, data: { passwordHash: await bcrypt.hash(password, 11), ...(t.email === t.user.email ? { emailVerifiedAt: t.user.emailVerifiedAt ?? new Date() } : {}) } });
  await prisma.session.deleteMany({ where: { userId: t.userId } });
  await createSession(t.userId);
  redirect('/');
}

export async function parentConsentAction(_: FormState, form: FormData): Promise<FormState> {
  if (form.get('agree') !== 'on') return { error: 'Отбележете, че сте родител и сте съгласни.' };
  const t = await consumeToken(String(form.get('token') ?? ''), 'parent');
  if (!t) return { error: 'Линкът е невалиден или е изтекъл.' };
  await prisma.user.update({ where: { id: t.userId }, data: { parentConsentAt: new Date(), parentEmail: t.email } });
  return { ok: 'Благодарим! Съгласието е записано и профилът на детето вече е напълно активен.' };
}

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  if (!hit(`login:${await ip()}`, 20, 15 * 60_000) || !hit(`login:${email}`, 10, 15 * 60_000)) return { error: 'Твърде много опити. Опитай пак след 15 минути.' };
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
