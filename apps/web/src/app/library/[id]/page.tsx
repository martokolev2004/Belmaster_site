import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BookOpen, Pencil } from 'lucide-react';
import { prisma } from '@/lib/db';
import type { Metadata } from 'next';
import { isAdmin, getCurrentUser } from '@/lib/auth';
import { slugify } from '@/lib/slug';
import type { Work } from '@belmaster/db';
import { ButtonLink, EmptyState } from '@/components/ui';
import '@fontsource-variable/playfair-display';
import '@/components/landing/landing-next.css';

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
  const all = await prisma.work.findMany({ where, select: { id: true, title: true }, orderBy: { grade: 'desc' } });
  const hit = all.find((w) => slugify(w.title) === param);
  return hit ? prisma.work.findUnique({ where: { id: hit.id }, include }) : null;
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
    isPartOf: { '@type': 'WebSite', name: 'БЕЛ Мастър', url: process.env.APP_URL ?? 'https://belmaster.eu' },
  };
}

export default async function WorkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const admin = isAdmin(user);
  const work = await findWork(decodeURIComponent(id), admin);
  if (!work) notFound();
  const filled = FIELDS.filter((f) => work[f.key]);

  const ICON: Record<string, string> = { summary: '📖', themes: '💡', characters: '🎭', authorInfo: '✍️', quotes: '❝', extra: '📝' };
  return (
    <article className="mx-auto max-w-4xl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(work)) }} />
      <Link href="/library" className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-secondary">
        <ArrowLeft className="size-4" /> Библиотека
      </Link>
      <header className="nx-panel wk-hero animate-rise">
        <p className="ln-eyebrow">{work.author}</p>
        <h1 className="ln-display wk-title">{work.title.replace(/\.\.\.$/, '…')}</h1>
        <div className="mt-4 flex flex-wrap gap-2">
          {[work.period, work.genre, work.year].filter(Boolean).map((t) => (
            <span key={t} className="lb-chip">
              {t}
            </span>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {work.text && (
            <ButtonLink href="#text" icon={<BookOpen className="size-4" />}>
              Прочети произведението
            </ButtonLink>
          )}
          {admin && (
            <ButtonLink href={`/admin/works/${work.id}`} variant="outline" icon={<Pencil className="size-4" />}>
              Редактирай
            </ButtonLink>
          )}
        </div>
        {filled.length > 1 && (
          <nav className="wk-nav">
            {filled.map((f) => (
              <a key={f.key} href={`#${f.key}`}>
                {f.title}
              </a>
            ))}
            {work.text && <a href="#text">Текст</a>}
          </nav>
        )}
      </header>
      {filled.length === 0 && work.text ? null : filled.length === 0 ? (
        <EmptyState title="Информацията за произведението се подготвя" icon={<span className="text-5xl">✍️</span>}>
          Скоро тук ще има резюме, анализ, герои и цитати.
        </EmptyState>
      ) : (
        <div className="nx-stack mt-4">
          {filled.map((f) => (
            <section key={f.key} id={f.key} className="nx-panel wk-sec">
              <h2 className="ln-display">
                <span aria-hidden>{ICON[f.key]}</span> {f.title}
              </h2>
              {f.key === 'quotes' ? (
                <ul className="space-y-2">
                  {work.quotes!.split('\n').filter(Boolean).map((line, i) => (
                    <li key={i} className="wk-quote">
                      {line}
                    </li>
                  ))}
                </ul>
              ) : work[f.key]!.includes('•') ? (
                <ul className="wk-list">
                  {work[f.key]!.split('\n').map((l) => l.replace(/^\s*•\s*/, '').trim()).filter(Boolean).map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              ) : (
                <div className="wk-text">
                  {work[f.key]!.split(/\n\s*\n/).map((par, i) => (
                    <p key={i}>{par}</p>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
      {work.text && <Reader title={work.title} author={work.author} text={work.text} source={work.textSource} />}
    </article>
  );
}

/** Самото произведение — като страница от книга. Празен ред = нов абзац/строфа; „# “ = заглавие на част. */
function Reader({ title, author, text, source }: { title: string; author: string; text: string; source: string | null }) {
  const blocks = text.replace(/\r/g, '').trim().split(/\n\s*\n/);
  const lines = text.split('\n').filter((l) => l.trim());
  // стихове: повечето редове са къси → пазим редовете и подравняваме в средата на листа
  const verse = lines.filter((l) => l.length < 60).length / Math.max(1, lines.length) > 0.8;
  return (
    <section id="text" className="wk-book mt-4" data-verse={verse}>
      <header>
        <p>{author}</p>
        <h2>{title.replace(/\.\.\.$/, '…')}</h2>
        <span aria-hidden>❦</span>
      </header>
      <div className="wk-page">
        {blocks.map((b, i) => (b.startsWith('# ') ? <h3 key={i}>{b.slice(2)}</h3> : <p key={i}>{b}</p>))}
      </div>
      {source && <footer>Източник: {source}</footer>}
    </section>
  );
}
