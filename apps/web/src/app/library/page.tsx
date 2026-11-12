import Link from 'next/link';
import { BookOpen, ChevronRight, Search } from 'lucide-react';
import '@/components/landing/landing-next.css';
import { gradeLabel } from '@belmaster/shared';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { slugify } from '@/lib/slug';
import { EmptyState } from '@/components/ui';

export const metadata = {
  title: 'Библиотека — резюмета и анализи на произведенията по литература',
  description: 'Резюмета, герои, теми и идеи на всички произведения от програмата по литература — Ботев, Вазов, Яворов, Елин Пелин, Йовков, Смирненски, Вапцаров, Далчев и др.',
  alternates: { canonical: '/library' },
};

const SPINE = ['#6ea2ff', '#5fe0d0', '#ffd166', '#ff7a8a', '#c59bff', '#ff9d3c'];

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await getCurrentUser();
  const grade = user?.grade ?? 'G12';
  const { q } = await searchParams;
  const term = q?.trim();
  const works = await prisma.work.findMany({
    where: {
      grade,
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
      <header className="nx-head animate-rise">
        <p className="ln-eyebrow">{gradeLabel(grade)}</p>
        <h1 className="ln-display nx-h1">
          Библио<span className="ln-grad">тека</span>
        </h1>
        <p className="nx-sub">
          {works.length} {works.length === 1 ? 'произведение' : 'произведения'} от {authors.size} {authors.size === 1 ? 'автор' : 'автори'} — резюме, герои, теми и идеи.
        </p>
      </header>
      <form className="lb-search">
        <Search className="size-5" />
        <input name="q" defaultValue={term} placeholder="Търси заглавие или автор…" aria-label="Търсене" />
        {term && (
          <Link href="/library" className="text-sm font-bold text-muted hover:text-white">
            Изчисти
          </Link>
        )}
      </form>
      {works.length === 0 ? (
        <EmptyState title={term ? 'Нищо не е намерено' : 'Библиотеката още е празна'} icon={<BookOpen className="size-12" />} />
      ) : (
        <div className="lb-grid">
          {works.map((w, i) => (
            <Link key={w.id} href={`/library/${slugify(w.title)}`} className="nx-panel lb-card" style={{ '--c': SPINE[i % SPINE.length] } as React.CSSProperties}>
              <span className="lb-no ln-display">{String(i + 1).padStart(2, '0')}</span>
              <span className="lb-author">{w.author}</span>
              <span className="lb-title">{w.title.replace(/\.\.\.$/, '…')}</span>
              <span className="lb-foot">
                {w.period && <span className="lb-chip">{w.period}</span>}
                <span className="lb-q">
                  {w._count.questions > 0 ? `${w._count.questions} ${w._count.questions === 1 ? 'въпрос' : 'въпроса'}` : 'четиво'} <ChevronRight className="size-4" />
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
