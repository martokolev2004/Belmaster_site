import { frameForRating, sanitizeAvatar } from '@belmaster/shared';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { unlockProgress } from '@/lib/avatar';
import { AvatarEditor } from './AvatarEditor';

export const metadata = { title: 'Аватар' };

export default async function AvatarPage() {
  const user = await requireUser();
  const progress = await unlockProgress(user);
  const rating = await prisma.playerRating.findUnique({ where: { userId_grade_season: { userId: user.id, grade: user.grade!, season: 'all' } } });
  return (
    <AvatarEditor
      initial={sanitizeAvatar(user.avatar, null, user.id)}
      progress={progress}
      frame={rating && rating.games > 0 ? frameForRating(rating.rating) : 'none'}
      rating={rating?.games ? rating.rating : null}
    />
  );
}
