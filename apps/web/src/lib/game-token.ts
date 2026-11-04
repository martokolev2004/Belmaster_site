import 'server-only';
import { SignJWT } from 'jose';
import type { GameTokenClaims } from '@belmaster/shared';

export async function signGameToken(claims: GameTokenClaims): Promise<string> {
  const secret = new TextEncoder().encode(process.env.GAME_JWT_SECRET ?? 'dev-secret');
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('12h')
    .setSubject(claims.uid)
    .sign(secret);
}
