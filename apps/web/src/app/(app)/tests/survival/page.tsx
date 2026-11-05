import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { survivalBest } from '@/lib/quiz';
import { SurvivalRunner } from '@/components/quiz/SurvivalRunner';

export const metadata = { title: 'До първа грешка' };
export const dynamic = 'force-dynamic';

export default async function SurvivalPage() {
  const user = await requireUser();
  const grade = user.grade!;
  const best = await survivalBest(user.id);

  // класация: най-добрата серия на всеки ученик от същия клас (випуск)
  const rows = await prisma.quizAttempt.groupBy({
    by: ['userId'],
    where: { kind: 'SURVIVAL', grade, score: { gt: 0 } },
    _max: { score: true },
    orderBy: { _max: { score: 'desc' } },
    take: 10,
  });
  const users = await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } }, select: { id: true, displayName: true, avatar: true } });
  const byId = new Map(users.map((u) => [u.id, u]));
  const top = rows
    .map((r) => ({ userId: r.userId, name: byId.get(r.userId)?.displayName ?? '—', avatar: byId.get(r.userId)?.avatar ?? null, score: Math.round(r._max.score ?? 0) }))
    .filter((r) => r.score > 0);

  return <SurvivalRunner best={best} top={top} meId={user.id} />;
}
