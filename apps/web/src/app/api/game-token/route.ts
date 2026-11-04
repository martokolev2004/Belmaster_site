import { NextResponse } from 'next/server';
import { frameForRating, sanitizeAvatar } from '@belmaster/shared';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { signGameToken } from '@/lib/game-token';

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.grade) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  // рамка по ранг: рейтинг „за всички времена“ в класа; топ 10 → „Легенда“
  const rating = await prisma.playerRating.findUnique({ where: { userId_grade_season: { userId: user.id, grade: user.grade, season: 'all' } } });
  const better = rating ? await prisma.playerRating.count({ where: { grade: user.grade, season: 'all', games: { gt: 0 }, rating: { gt: rating.rating } } }) : 99;
  const token = await signGameToken({
    uid: user.id,
    name: user.displayName,
    grade: user.grade,
    isGuest: user.isGuest,
    avatar: sanitizeAvatar(user.avatar, null, user.id),
    frame: rating && rating.games > 0 ? frameForRating(rating.rating, better < 10) : 'none',
  });
  // празен адрес = същият сайт (през /socket.io)
  return NextResponse.json({ token, url: process.env.NEXT_PUBLIC_GAME_URL ?? '' });
}
