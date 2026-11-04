import Link from 'next/link';
import { GRADES, isGrade } from '@belmaster/shared';
import { prisma } from '@/lib/db';
import { Badge, ButtonLink } from '@/components/ui';
import { cn } from '@/lib/cn';

export default async function AdminWorks({ searchParams }: { searchParams: Promise<{ grade?: string }> }) {
  const { grade: g } = await searchParams;
  const grade = isGrade(g) ? g : 'G12';
  const works = await prisma.work.findMany({
    where: { grade },
    orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    include: { _count: { select: { questions: true } } },
  });
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {GRADES.map((x) => (
            <Link key={x.code} href={`/admin/works?grade=${x.code}`} className={cn('rounded-full border-2 px-3 py-1 text-sm font-extrabold', x.code === grade ? 'border-secondary bg-secondary/10 text-secondary' : 'border-line text-muted')}>
              {x.label}
            </Link>
          ))}
        </div>
        <ButtonLink href={`/admin/works/new?grade=${grade}`} size="sm">
          + Ново произведение
        </ButtonLink>
      </div>
      <ul className="card3d divide-y-2 divide-line rounded-2xl bg-surface">
        {works.map((w) => {
          const filled = [w.summary, w.themes, w.characters, w.authorInfo, w.quotes].filter(Boolean).length;
          return (
            <li key={w.id}>
              <Link href={`/admin/works/${w.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                <span className="flex-1">
                  <span className="block font-extrabold text-ink-strong">{w.title}</span>
                  <span className="block text-sm text-muted">{w.author}</span>
                </span>
                <Badge tone={filled === 5 ? 'green' : filled ? 'yellow' : 'gray'}>{filled}/5 полета</Badge>
                <Badge tone="blue">{w._count.questions} въпроса</Badge>
                {!w.published && <Badge tone="red">скрито</Badge>}
              </Link>
            </li>
          );
        })}
        {works.length === 0 && <li className="px-4 py-8 text-center text-muted">Няма произведения за този клас.</li>}
      </ul>
    </div>
  );
}
