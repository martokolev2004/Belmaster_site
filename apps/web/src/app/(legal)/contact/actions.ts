'use server';

import { headers } from 'next/headers';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { hit } from '@/lib/rate-limit';
import { appUrl, sendMail } from '@/lib/mail';

export async function contactAction(_: { ok?: string; error?: string }, form: FormData): Promise<{ ok?: string; error?: string }> {
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0].trim() ?? 'local';
  if (String(form.get('website') ?? '')) return { ok: 'Благодарим! Съобщението е изпратено.' }; // капан за ботове
  if (!hit(`contact:${ip}`, 5, 3600_000)) return { error: 'Твърде много съобщения. Опитай пак след час.' };
  const name = String(form.get('name') ?? '').trim().slice(0, 80);
  const email = String(form.get('email') ?? '').trim().toLowerCase().slice(0, 120);
  const subject = String(form.get('subject') ?? '').trim().slice(0, 120) || 'Без тема';
  const message = String(form.get('message') ?? '').trim().slice(0, 4000);
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Попълни име и валиден имейл.' };
  if (message.length < 10) return { error: 'Съобщението е твърде кратко.' };
  const user = await getCurrentUser();
  await prisma.contactMessage.create({ data: { userId: user?.id ?? null, name, email, subject, message } });
  const admin = process.env.ADMIN_EMAIL;
  if (admin) await sendMail(admin, `Ново съобщение: ${subject}`, [`От: ${name} <${email}>`, message], { text: 'Виж в админ панела', url: `${appUrl()}/admin/messages` }).catch(() => {});
  return { ok: 'Благодарим! Съобщението е изпратено. Ще ти отговорим на посочения имейл.' };
}
