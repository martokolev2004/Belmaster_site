import Link from 'next/link';
import { BookOpen, Search } from 'lucide-react';
import '@fontsource-variable/playfair-display';
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

/** платът на корицата: [основен цвят, тъмен ръб] — един автор винаги е в един цвят */
const CLOTH: [string, string][] = [
  ['#23508f', '#16335e'],
  ['#8a2a3c', '#5a1826'],
  ['#1f6b5c', '#12443a'],
  ['#a8741f', '#6e4a10'],
  ['#5b3a8c', '#3a235e'],
  ['#2a6f8f', '#18465c'],
  ['#8a4a26', '#5a2e14'],
];
const clothOf = (author: string) => CLOTH[[...author].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 9973, 7) % CLOTH.length];

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
    omit: { text: true },
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
        <div className="lb-shelf">
          {works.map((w) => {
            const [c, d] = clothOf(w.author);
            const title = w.title.replace(/\.\.\.$/, '…');
            return (
              <Link key={w.id} href={`/library/${slugify(w.title)}`} className="lb-book" data-long={title.length > 26} style={{ '--c': c, '--d': d } as React.CSSProperties}>
                {w._count.questions > 0 && <span className="lb-mark" title={`${w._count.questions} ${w._count.questions === 1 ? 'въпрос' : 'въпроса'} по произведението`}>{w._count.questions}</span>}
                <span className="lb-author">{w.author}</span>
                <span className="lb-rule" />
                <span className="lb-title">{title}</span>
                <span className="lb-orn">❦</span>
                {w.period && <span className="lb-period">{w.period}</span>}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
