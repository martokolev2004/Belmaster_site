'use server';

import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { AVATAR_COLORS, getCurrentUser } from '@/lib/auth';
import type { FormState } from '@/app/(auth)/actions';

export async function updateProfileAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Не си влязъл.' };
  const displayName = String(form.get('displayName') ?? '').trim();
  const color = String(form.get('avatarColor') ?? '');
  if (displayName.length < 2 || displayName.length > 30) return { error: 'Името трябва да е между 2 и 30 знака.' };
  await prisma.user.update({
    where: { id: user.id },
    data: { displayName, avatarColor: AVATAR_COLORS.includes(color) ? color : user.avatarColor },
  });
  revalidatePath('/', 'layout');
  return { ok: 'Запазено.' };
}

export async function changePasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user || user.isGuest) return { error: 'Не си влязъл.' };
  const current = String(form.get('current') ?? '');
  const next = String(form.get('next') ?? '');
  if (next.length < 8) return { error: 'Новата парола трябва да е поне 8 знака.' };
  if (user.passwordHash && !(await bcrypt.compare(current, user.passwordHash))) return { error: 'Текущата парола е грешна.' };
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(next, 11) } });
  return { ok: 'Паролата е сменена.' };
}

export async function setThemeAction(theme: 'light' | 'dark' | 'system') {
  const jar = await cookies();
  if (theme === 'system') jar.delete('bm_theme');
  else jar.set('bm_theme', theme, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  revalidatePath('/', 'layout');
}
