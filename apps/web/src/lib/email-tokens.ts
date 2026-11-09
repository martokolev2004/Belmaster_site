import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import type { User } from '@belmaster/db';
import { prisma } from './db';
import { appUrl, sendMail } from './mail';

type Kind = 'verify' | 'reset' | 'parent';
const HOURS: Record<Kind, number> = { verify: 72, reset: 1, parent: 24 * 14 };

const hash = (t: string) => createHash('sha256').update(t).digest('hex');

async function issue(userId: string, kind: Kind, email: string): Promise<string> {
  // старите неизползвани от същия вид стават невалидни
  await prisma.emailToken.updateMany({ where: { userId, kind, usedAt: null }, data: { usedAt: new Date() } });
  const token = randomBytes(32).toString('base64url');
  await prisma.emailToken.create({ data: { id: hash(token), userId, kind, email, expiresAt: new Date(Date.now() + HOURS[kind] * 3600_000) } });
  return token;
}

/** Проверява и „изразходва“ токена; връща потребителя и адреса. */
export async function consumeToken(token: string, kind: Kind, consume = true) {
  const t = await prisma.emailToken.findUnique({ where: { id: hash(String(token)) }, include: { user: true } });
  if (!t || t.kind !== kind || t.usedAt || t.expiresAt < new Date()) return null;
  if (consume) await prisma.emailToken.update({ where: { id: t.id }, data: { usedAt: new Date() } });
  return t;
}

export async function sendVerifyEmail(user: Pick<User, 'id' | 'email' | 'displayName'>) {
  if (!user.email) return;
  const token = await issue(user.id, 'verify', user.email);
  await sendMail(user.email, 'Потвърди имейла си — БЕЛ Мастер', [`Здравей, ${user.displayName}!`, 'Потвърди, че този имейл е твой, за да можеш да възстановиш паролата си, ако я забравиш.'], {
    text: 'Потвърди имейла',
    url: `${appUrl()}/verify?token=${token}`,
  });
}

export async function sendResetEmail(user: Pick<User, 'id' | 'email' | 'displayName'>) {
  if (!user.email) return;
  const token = await issue(user.id, 'reset', user.email);
  await sendMail(user.email, 'Нова парола — БЕЛ Мастер', [`Здравей, ${user.displayName}!`, 'Получихме заявка за нова парола. Линкът важи 1 час.'], {
    text: 'Задай нова парола',
    url: `${appUrl()}/reset?token=${token}`,
  });
}

export async function sendParentEmail(user: Pick<User, 'id' | 'displayName' | 'parentEmail'>) {
  if (!user.parentEmail) return;
  const token = await issue(user.id, 'parent', user.parentEmail);
  await sendMail(user.parentEmail, 'Съгласие на родител — БЕЛ Мастер', [
    'Здравейте!',
    `Вашето дете си е направило профил „${user.displayName}“ в БЕЛ Мастер — безплатен сайт за подготовка за матурите по български език и литература.`,
    'Тъй като детето е под 14 години, по закон е нужно Вашето съгласие за обработка на данните му (име, имейл, дата на раждане, резултати от тестовете). Преди да потвърдите, можете да прочетете политиката за поверителност.',
  ], { text: 'Прегледай и потвърди', url: `${appUrl()}/parent?token=${token}` });
}
