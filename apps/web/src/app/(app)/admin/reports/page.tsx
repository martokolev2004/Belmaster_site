import Link from 'next/link';
import { prisma } from '@/lib/db';
import { Badge, EmptyState } from '@/components/ui';
import { setReportStatusAction } from '../actions';

export default async function ReportsPage() {
  const reports = await prisma.questionReport.findMany({
    where: { status: 'OPEN' },
    include: { question: true, user: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  if (!reports.length) return <EmptyState title="Няма отворени доклади 🎉" />;
  return (
    <ul className="space-y-3">
      {reports.map((r) => (
        <li key={r.id} className="card3d rounded-2xl bg-surface p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="red">{r.reason}</Badge>
            <span className="text-sm text-muted">
              {r.user?.displayName ?? 'анонимен'} · {r.createdAt.toLocaleString('bg-BG', { timeZone: 'Europe/Sofia' })}
            </span>
          </div>
          <p className="mt-2 font-bold text-ink-strong">{r.question.prompt}</p>
          {r.message && <p className="mt-1 rounded-xl bg-surface-2 p-2 text-sm">„{r.message}“</p>}
          <div className="mt-3 flex flex-wrap gap-3">
            <Link href={`/admin/questions/${r.questionId}?back=/admin/reports`} className="font-extrabold text-secondary">
              Редактирай въпроса
            </Link>
            <form action={setReportStatusAction}>
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="status" value="RESOLVED" />
              <button className="font-extrabold text-primary">Оправено</button>
            </form>
            <form action={setReportStatusAction}>
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="status" value="DISMISSED" />
              <button className="font-extrabold text-muted">Отхвърли</button>
            </form>
          </div>
        </li>
      ))}
    </ul>
  );
}
