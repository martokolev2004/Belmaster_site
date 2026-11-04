import Link from 'next/link';
import { ChevronRight, ScrollText } from 'lucide-react';
import { gradeLabel } from '@belmaster/shared';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { EmptyState, PageHeader } from '@/components/ui';

export const metadata = { title: 'Матури' };

export default async function ExamsPage() {
  const user = await requireUser();
  const exams = await prisma.exam.findMany({
    where: { grade: user.grade! },
    orderBy: [{ year: 'desc' }, { session: 'asc' }],
  });
  const best = await prisma.quizAttempt.groupBy({
    by: ['examId'],
    where: { userId: user.id, kind: 'EXAM' },
    _max: { score: true },
  });
  return (
    <div>
      <PageHeader title="Цели матури" subtitle={`Минали изпити за ${gradeLabel(user.grade)} — без есето и задачите със свободен текст.`} />
      {exams.length === 0 ? (
        <EmptyState title="Още няма качени матури" icon={<ScrollText className="size-12" />}>
          Скоро ще добавим минали изпити.
        </EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {exams.map((e) => {
            const b = best.find((x) => x.examId === e.id)?._max.score;
            return (
              <Link key={e.id} href={`/exams/${e.id}`} className="card3d group flex items-center gap-4 rounded-2xl bg-surface p-4 hover:bg-surface-2">
                <span className="rounded-2xl bg-purple/20 p-3 text-purple-dark">
                  <ScrollText className="size-7" />
                </span>
                <span className="flex-1">
                  <span className="block font-extrabold text-ink-strong">{e.title}</span>
                  <span className="block text-sm text-muted">
                    {b != null ? `Най-добро: ${b} точки` : 'Пробна матура с таймер'}
                  </span>
                </span>
                <ChevronRight className="size-5 text-muted" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
