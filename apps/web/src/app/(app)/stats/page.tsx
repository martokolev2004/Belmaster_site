import Link from 'next/link';
import { SECTION_LABELS, TOPIC_LABELS } from '@belmaster/shared';
import { BarChart3 } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { EmptyState, PageHeader } from '@/components/ui';
import { cn } from '@/lib/cn';

export const metadata = { title: 'Статистика' };

const MIN = 3; // под толкова отговора темата не се оценява

function color(p: number) {
  return p >= 80 ? 'bg-primary' : p >= 55 ? 'bg-accent' : 'bg-error';
}

export default async function StatsPage() {
  const user = await requireUser();
  const [stats, mistakes] = await Promise.all([
    prisma.userTopicStat.findMany({ where: { userId: user.id } }),
    prisma.userMistake.count({ where: { userId: user.id, question: { status: 'ACTIVE', grade: user.grade! } } }),
  ]);
  const get = (key: string) => stats.find((s) => s.key === key);
  const pct = (s?: { answered: number; score: number }) => (s && s.answered ? Math.round((s.score / s.answered) * 100) : null);

  const sections = (Object.keys(SECTION_LABELS) as (keyof typeof SECTION_LABELS)[]).map((k) => ({
    label: SECTION_LABELS[k],
    s: get(`S:${k}`),
    href: k === 'LANGUAGE' ? '/tests/language' : k === 'LITERATURE' ? '/tests/literature' : '/tests/reading',
  }));
  const topics = (Object.keys(TOPIC_LABELS) as (keyof typeof TOPIC_LABELS)[]).map((k) => ({ label: TOPIC_LABELS[k], s: get(`T:${k}`), href: `/tests/language?topic=${k}` }));
  const workStats = stats.filter((s) => s.key.startsWith('W:') && s.answered >= 1);
  const works = await prisma.work.findMany({ where: { id: { in: workStats.map((w) => w.key.slice(2)) } }, select: { id: true, title: true, author: true } });
  const workRows = workStats
    .map((w) => ({ w, work: works.find((x) => x.id === w.key.slice(2)), p: pct(w)! }))
    .filter((r) => r.work)
    .sort((a, b) => a.p - b.p);

  const all = [...topics, ...sections].filter((t) => t.s && t.s.answered >= MIN);
  const weakest = [...topics.filter((t) => t.s && t.s.answered >= MIN)].sort((a, b) => pct(a.s)! - pct(b.s)!)[0];

  if (!stats.length)
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Моята статистика" />
        <EmptyState title="Още няма данни" icon={<BarChart3 className="size-12" />}>
          Реши няколко теста или изиграй битка — тук ще видиш силните и слабите си теми.
        </EmptyState>
      </div>
    );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Моята статистика" subtitle="По всичко, което си решавал — в тестовете и в битките." />

      {(weakest || mistakes > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {weakest && (
            <Link href={weakest.href} className="card3d rounded-2xl border-error/40! bg-error/8 p-4">
              <p className="text-xs font-extrabold uppercase text-error-dark">Най-слаба тема</p>
              <p className="mt-1 text-lg font-black text-ink-strong">
                {weakest.label} · {pct(weakest.s)}%
              </p>
              <p className="text-sm font-bold text-secondary">Упражнявай →</p>
            </Link>
          )}
          {mistakes > 0 && (
            <Link href="/tests/mistakes" className="card3d rounded-2xl bg-surface p-4">
              <p className="text-xs font-extrabold uppercase text-muted">Грешки за преговор</p>
              <p className="mt-1 text-lg font-black text-ink-strong">{mistakes} въпроса</p>
              <p className="text-sm font-bold text-secondary">Упражни ги →</p>
            </Link>
          )}
        </div>
      )}

      <Block title="Раздели" rows={sections} />
      <Block title="Език по теми" rows={topics} />

      <section className="card3d rounded-2xl bg-surface p-5">
        <h2 className="mb-3 text-lg font-black">Произведения</h2>
        {workRows.length === 0 ? (
          <p className="text-sm text-muted">Още не си отговарял на въпроси за конкретни произведения.</p>
        ) : (
          <ul className="space-y-3">
            {workRows.map(({ w, work, p }) => (
              <li key={w.key}>
                <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate font-extrabold text-ink-strong">
                    {work!.title} <span className="font-bold text-muted">· {work!.author}</span>
                  </span>
                  <span className="shrink-0 font-black tabular-nums">
                    {p}% <span className="text-xs font-bold text-muted">({w.answered})</span>
                  </span>
                </div>
                <Bar p={p} />
                <Link href={`/tests/literature?work=${work!.id}`} className="text-xs font-bold text-secondary">
                  Упражнявай
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      {all.length === 0 && <p className="text-center text-sm text-muted">Оценката на тема се показва след поне {MIN} отговора.</p>}
    </div>
  );
}

function Bar({ p }: { p: number }) {
  return (
    <div className="h-3 overflow-hidden rounded-full bg-surface-2">
      <div className={cn('h-full rounded-full', color(p))} style={{ width: `${Math.max(3, p)}%` }} />
    </div>
  );
}

function Block({ title, rows }: { title: string; rows: { label: string; s?: { answered: number; score: number }; href: string }[] }) {
  return (
    <section className="card3d rounded-2xl bg-surface p-5">
      <h2 className="mb-3 text-lg font-black">{title}</h2>
      <ul className="space-y-3">
        {rows.map((r) => {
          const n = r.s?.answered ?? 0;
          const p = n ? Math.round((r.s!.score / n) * 100) : null;
          return (
            <li key={r.label}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <Link href={r.href} className="font-extrabold text-ink-strong hover:text-secondary">
                  {r.label}
                </Link>
                <span className="font-black tabular-nums">
                  {p == null ? <span className="text-muted">—</span> : `${p}%`} <span className="text-xs font-bold text-muted">({n} отг.)</span>
                </span>
              </div>
              {p == null ? <div className="h-3 rounded-full bg-surface-2" /> : <Bar p={p} />}
              {n > 0 && n < MIN && <p className="mt-0.5 text-[11px] text-muted">още малко отговори за точна оценка</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
