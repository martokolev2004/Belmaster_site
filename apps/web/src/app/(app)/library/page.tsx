import Link from 'next/link';
import { BookOpen, Search } from 'lucide-react';
import { gradeLabel } from '@belmaster/shared';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { EmptyState, Input, PageHeader } from '@/components/ui';

export const metadata = { title: 'Библиотека' };

const SPINE = ['#58cc02', '#1cb0f6', '#ffc800', '#ff4b4b', '#ce82ff', '#ff9600'];

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const { q } = await searchParams;
  const term = q?.trim();
  const works = await prisma.work.findMany({
    where: {
      grade: user.grade!,
      published: true,
      ...(term ? { OR: [{ title: { contains: term, mode: 'insensitive' } }, { author: { contains: term, mode: 'insensitive' } }] } : {}),
    },
    orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    include: { _count: { select: { questions: { where: { status: 'ACTIVE' } } } } },
  });
  const authors = new Map<string, number>();
  works.forEach((w) => authors.set(w.author, (authors.get(w.author) ?? 0) + 1));

  return (
    <div>
      <PageHeader title="Библиотека" subtitle={`Произведенията за ${gradeLabel(user.grade)}`} />
      <form className="relative mb-6">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
        <Input name="q" defaultValue={term} placeholder="Търси заглавие или автор…" className="pl-12" />
      </form>
      {works.length === 0 ? (
        <EmptyState title={term ? 'Нищо не е намерено' : 'Библиотеката още е празна'} icon={<BookOpen className="size-12" />} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {works.map((w, i) => (
            <Link key={w.id} href={`/library/${w.id}`} className="card3d group flex gap-4 rounded-2xl bg-surface p-4 transition hover:-translate-y-0.5 hover:bg-surface-2">
              <span className="w-3 shrink-0 rounded-full" style={{ background: SPINE[i % SPINE.length] }} />
              <span className="min-w-0">
                <span className="block font-extrabold leading-tight text-ink-strong">{w.title}</span>
                <span className="mt-0.5 block text-sm text-muted">{w.author}</span>
                <span className="mt-2 flex flex-wrap gap-1.5 text-xs font-extrabold">
                  {w.period && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-muted">{w.period}</span>}
                  {w._count.questions > 0 && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-primary-dark">{w._count.questions} въпроса</span>}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
