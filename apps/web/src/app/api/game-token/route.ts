import { NextResponse } from 'next/server';
import { frameForRating, isUnlocked, sanitizeAvatar, weaponById, weaponKey } from '@belmaster/shared';
import { unlockProgress } from '@/lib/avatar';
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
    weapon: (() => {
      const w = weaponById(user.weapon);
      return !w.rule || isUnlocked(w.rule, unlockProgress(user), weaponKey(w.id)) ? w.id : 'stone';
    })(),
  });
  // празен адрес = същият сайт (през /socket.io)
  return NextResponse.json({ token, url: process.env.NEXT_PUBLIC_GAME_URL ?? '' });
}
