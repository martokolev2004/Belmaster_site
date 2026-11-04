import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { signGameToken } from '@/lib/game-token';

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.grade) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const token = await signGameToken({ uid: user.id, name: user.displayName, grade: user.grade, isGuest: user.isGuest });
  return NextResponse.json({ token, url: process.env.NEXT_PUBLIC_GAME_URL ?? 'http://localhost:4000' });
}
