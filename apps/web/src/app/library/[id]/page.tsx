import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Pencil } from 'lucide-react';
import { prisma } from '@/lib/db';
import type { Metadata } from 'next';
import { isAdmin, getCurrentUser } from '@/lib/auth';
import { slugify } from '@/lib/slug';
import type { Work } from '@belmaster/db';
import { ButtonLink, Card, EmptyState } from '@/components/ui';

const FIELDS = [
  { key: 'summary', title: 'Резюме' },
  { key: 'themes', title: 'Теми, идеи и послания' },
  { key: 'characters', title: 'Герои' },
  { key: 'authorInfo', title: 'За автора' },
  { key: 'quotes', title: 'Ключови цитати' },
  { key: 'extra', title: 'Бележки' },
] as const;

/** Намира произведение по адрес (slug от заглавието) или по стария id. */
async function findWork(param: string, admin = false) {
  const include = { _count: { select: { questions: { where: { status: 'ACTIVE' as const } } } } };
  const where = admin ? {} : { published: true };
  const byId = await prisma.work.findFirst({ where: { id: param, ...where }, include });
  if (byId) return byId;
  const all = await prisma.work.findMany({ where, include, orderBy: { grade: 'desc' } });
  return all.find((w) => slugify(w.title) === param) ?? null;
}

const short = (s: string | null, n = 155) => (s ? (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s) : '');

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const work = await findWork((await params).id);
  if (!work) return {};
  const title = `${work.title} — ${work.author}: резюме, герои, теми и анализ`;
  return {
    title,
    description: short(`„${work.title}“ (${work.author}) — ${(work.genre ?? 'произведение').replace(/\.$/, '')}. ${work.summary ?? ''}`.replace(/\n+/g, ' ')),
    alternates: { canonical: `/library/${slugify(work.title)}` },
    openGraph: { title, type: 'article', url: `/library/${slugify(work.title)}` },
  };
}

function jsonLd(work: Work) {
  return {
    '@context': 'https://schema.org',
    '@type': 'LearningResource',
    name: `${work.title} — ${work.author}`,
    description: short(work.summary, 300),
    inLanguage: 'bg',
    educationalLevel: '12. клас',
    learningResourceType: 'Анализ на литературно произведение',
    about: { '@type': 'CreativeWork', name: work.title, author: { '@type': 'Person', name: work.author }, genre: work.genre ?? undefined },
    isPartOf: { '@type': 'WebSite', name: 'БЕЛ Мастер', url: process.env.APP_URL ?? 'https://belmaster.eu' },
  };
}

export default async function WorkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const admin = isAdmin(user);
  const work = await findWork(decodeURIComponent(id), admin);
  if (!work) notFound();
  const filled = FIELDS.filter((f) => work[f.key]);

  return (
    <article className="mx-auto max-w-3xl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(work)) }} />
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
          {work._count.questions > 0 && (
            <ButtonLink href={user ? `/tests/literature?work=${work.id}` : '/login?tab=register'}>Тествай се ({work._count.questions} {work._count.questions === 1 ? 'въпрос' : 'въпроса'} от матури)</ButtonLink>
          )}
          {admin && (
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
