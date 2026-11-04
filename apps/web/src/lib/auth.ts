import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createHash, randomBytes } from 'node:crypto';
import { prisma } from './db';
import type { User } from '@belmaster/db';

const COOKIE = 'bm_session';
const SESSION_DAYS = 60;

function hash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await prisma.session.create({ data: { id: hash(token), userId, expiresAt } });
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && (process.env.APP_URL ?? '').startsWith('https'),
    path: '/',
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { id: hash(token) } });
  jar.delete(COOKIE);
}

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({ where: { id: hash(token) }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
});

export function isAdmin(user: Pick<User, 'email' | 'isGuest'> | null | undefined): boolean {
  const admin = (process.env.ADMIN_EMAIL ?? 'm.kolev@bulinfo.org').toLowerCase();
  return !!user && !user.isGuest && !!user.email && user.email.toLowerCase() === admin;
}

/** Изисква влязъл потребител с избран клас. */
export async function requireUser(opts: { allowNoGrade?: boolean } = {}): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.grade && !opts.allowNoGrade) redirect('/grade');
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser({ allowNoGrade: true });
  if (!isAdmin(user)) redirect('/');
  return user;
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export async function newFriendCode(): Promise<string> {
  for (;;) {
    const bytes = randomBytes(6);
    const code = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
    const exists = await prisma.user.findUnique({ where: { friendCode: code } });
    if (!exists) return code;
  }
}

export const AVATAR_COLORS = ['#58cc02', '#1cb0f6', '#ffc800', '#ff4b4b', '#ce82ff', '#ff9600'];
export function randomAvatarColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}
