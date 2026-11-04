import Link from 'next/link';
import { gradeLabel } from '@belmaster/shared';
import { prisma } from '@/lib/db';
import { Badge, EmptyState } from '@/components/ui';
import { deleteExamAction } from '../actions';

export default async function AdminExams() {
  const exams = await prisma.exam.findMany({
    orderBy: [{ grade: 'desc' }, { year: 'desc' }],
    include: { _count: { select: { questions: true, passages: true } }, passages: { select: { id: true, title: true } } },
  });
  if (!exams.length) return <EmptyState title="Още няма импортирани матури">Импортирай JSON от раздел „Импорт“.</EmptyState>;
  return (
    <ul className="space-y-3">
      {exams.map((e) => (
        <li key={e.id} className="card3d rounded-2xl bg-surface p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex-1">
              <span className="block font-extrabold text-ink-strong">{e.title}</span>
              <span className="text-sm text-muted">
                {gradeLabel(e.grade)} · {e._count.questions} въпроса · {e._count.passages} текста
              </span>
            </span>
            <Link href={`/admin/questions?exam=${e.id}`} className="font-bold text-secondary">
              Въпроси →
            </Link>
            <form action={deleteExamAction}>
              <input type="hidden" name="id" value={e.id} />
              <button className="text-sm font-extrabold text-error">Изтрий</button>
            </form>
          </div>
          {e.passages.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {e.passages.map((p) => (
                <Link key={p.id} href={`/admin/passages/${p.id}`}>
                  <Badge tone="blue">Текст: {p.title ?? 'без заглавие'}</Badge>
                </Link>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
