import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const appUrl = process.env.APP_URL ?? req.nextUrl.origin;
  if (!clientId) return NextResponse.redirect(new URL('/login?error=google', appUrl));
  const state = randomBytes(16).toString('base64url');
  const next = req.nextUrl.searchParams.get('next') ?? '/';
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${appUrl}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });
  const res = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  const opts = { httpOnly: true, sameSite: 'lax' as const, path: '/', maxAge: 600, secure: appUrl.startsWith('https') };
  res.cookies.set('bm_oauth_state', state, opts);
  res.cookies.set('bm_oauth_next', next.startsWith('/') && !next.startsWith('//') ? next : '/', opts);
  return res;
}
