import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { createSession, getCurrentUser, newFriendCode, randomAvatarColor } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const appUrl = process.env.APP_URL ?? req.nextUrl.origin;
  const fail = (code = 'google') => NextResponse.redirect(new URL(`/login?error=${code}`, appUrl));
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  if (!code || !state || state !== req.cookies.get('bm_oauth_state')?.value) return fail();

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      redirect_uri: `${appUrl}/api/auth/google/callback`,
      grant_type: 'authorization_code',
    }),
  });
  if (!tokenRes.ok) return fail();
  const { access_token } = (await tokenRes.json()) as { access_token?: string };
  if (!access_token) return fail();
  const infoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { authorization: `Bearer ${access_token}` },
  });
  if (!infoRes.ok) return fail();
  const info = (await infoRes.json()) as { sub: string; email?: string; email_verified?: boolean; name?: string };
  const email = info.email_verified ? info.email?.toLowerCase() : undefined;

  let user = await prisma.user.findUnique({ where: { googleId: info.sub } });
  if (!user && email) {
    const byEmail = await prisma.user.findUnique({ where: { email } });
    if (byEmail) {
      // свързваме Google с вече съществуващ профил със същия потвърден имейл
      user = await prisma.user.update({ where: { id: byEmail.id }, data: { googleId: info.sub } });
    }
  }
  if (!user) {
    const current = await getCurrentUser();
    const displayName = (info.name ?? email?.split('@')[0] ?? 'Играч').slice(0, 30);
    if (current?.isGuest) {
      user = await prisma.user.update({
        where: { id: current.id },
        data: { googleId: info.sub, email, displayName, isGuest: false },
      });
    } else {
      user = await prisma.user.create({
        data: { googleId: info.sub, email, displayName, friendCode: await newFriendCode(), avatarColor: randomAvatarColor() },
      });
    }
  }

  await createSession(user.id);
  const next = req.cookies.get('bm_oauth_next')?.value ?? '/';
  const res = NextResponse.redirect(new URL(user.grade ? next : '/grade', appUrl));
  res.cookies.delete('bm_oauth_state');
  res.cookies.delete('bm_oauth_next');
  return res;
}
