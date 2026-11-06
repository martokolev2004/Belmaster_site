import { currentSeason } from '@belmaster/shared';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { towerBest } from '@/lib/tower';
import { TowerGame } from '@/components/tower/TowerGame';

export const metadata = { title: 'Кула на Словото' };
export const dynamic = 'force-dynamic';

export default async function TowerPage() {
  const user = await requireUser();
  const grade = user.grade!;
  const season = currentSeason();
  const [best, monthBest, rows] = await Promise.all([
    towerBest(user.id, grade, 'all'),
    towerBest(user.id, grade, season),
    prisma.towerBest.findMany({
      where: { grade, season, best: { gt: 0 }, user: { isGuest: false } },
      orderBy: [{ best: 'desc' }, { updatedAt: 'asc' }],
      take: 10,
      include: { user: { select: { displayName: true, avatar: true } } },
    }),
  ]);
  const top = rows.map((r) => ({ userId: r.userId, name: r.user.displayName, avatar: r.user.avatar, score: r.best }));
  return <TowerGame best={best} monthBest={monthBest} top={top} meId={user.id} isGuest={user.isGuest} />;
}
