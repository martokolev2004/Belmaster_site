import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Pencil } from 'lucide-react';
import { prisma } from '@/lib/db';
import { isAdmin, requireUser } from '@/lib/auth';
import { ButtonLink, Card, EmptyState } from '@/components/ui';

const FIELDS = [
  { key: 'summary', title: 'Резюме' },
  { key: 'themes', title: 'Теми, идеи и послания' },
  { key: 'characters', title: 'Герои' },
  { key: 'authorInfo', title: 'За автора' },
  { key: 'quotes', title: 'Ключови цитати' },
  { key: 'extra', title: 'Бележки' },
] as const;

export default async function WorkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const work = await prisma.work.findFirst({
    where: { id, grade: user.grade!, ...(isAdmin(user) ? {} : { published: true }) },
    include: { _count: { select: { questions: { where: { status: 'ACTIVE' } } } } },
  });
  if (!work) notFound();
  const filled = FIELDS.filter((f) => work[f.key]);

  return (
    <article className="mx-auto max-w-3xl">
      <Link href="/library" className="mb-4 inline-flex items-center gap-1 font-bold text-secondary">
        <ArrowLeft className="size-4" /> Библиотека
      </Link>
      <header className="mb-6">
        <h1 className="text-3xl font-black leading-tight">{work.title}</h1>
        <p className="mt-1 text-lg text-muted">{work.author}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm font-extrabold">
          {[work.period, work.genre, work.year].filter(Boolean).map((t) => (
            <span key={t} className="rounded-full bg-surface-2 px-3 py-1 text-muted">
              {t}
            </span>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {work._count.questions > 0 && <ButtonLink href={`/tests/literature?work=${work.id}`}>Тествай се ({work._count.questions})</ButtonLink>}
          {isAdmin(user) && (
            <ButtonLink href={`/admin/works/${work.id}`} variant="outline" icon={<Pencil className="size-4" />}>
              Редактирай
            </ButtonLink>
          )}
        </div>
      </header>
      {filled.length === 0 ? (
        <EmptyState title="Информацията за произведението се подготвя" icon={<span className="text-5xl">✍️</span>}>
          Скоро тук ще има резюме, анализ, герои и цитати.
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {filled.map((f) => (
            <Card key={f.key}>
              <h2 className="mb-2 text-lg font-black">{f.title}</h2>
              {f.key === 'quotes' ? (
                <ul className="space-y-2">
                  {work.quotes!.split('\n').filter(Boolean).map((line, i) => (
                    <li key={i} className="border-l-4 border-accent pl-3 italic">
                      {line}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="whitespace-pre-line leading-relaxed">{work[f.key]}</div>
              )}
            </Card>
          ))}
        </div>
      )}
    </article>
  );
}
