import Link from 'next/link';
import { currentSeason, frameForRating, gradeLabel, seasonLabel, type FrameTier } from '@belmaster/shared';
import { Trophy } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { publicUserWhere } from '@/lib/age';
import { Avatar, EmptyState, PageHeader } from '@/components/ui';
import { cn } from '@/lib/cn';

export const metadata = { title: 'Класация' };

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ tab?: string; season?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const tab = sp.tab === 'xp' ? 'xp' : sp.tab === 'climb' ? 'climb' : sp.tab === 'tower' ? 'tower' : 'rating';
  const season = sp.season === 'all' ? 'all' : currentSeason();
  const grade = user.grade!;

  let rows: { id: string; name: string; color: string; avatar: unknown; frame?: FrameTier; value: string; sub?: string }[] = [];
  if (tab === 'rating') {
    const ratings = await prisma.playerRating.findMany({
      where: { grade, season, games: { gt: 0 }, user: publicUserWhere() },
      orderBy: [{ rating: 'desc' }, { wins: 'desc' }],
      take: 50,
      include: { user: true },
    });
    rows = ratings.map((r, i) => ({ id: r.userId, name: r.user.displayName, color: r.user.avatarColor, avatar: r.user.avatar, frame: frameForRating(r.rating, season === 'all' && i < 10), value: String(r.rating), sub: `${r.wins} победи · ${r.games} битки` }));
  } else if (tab === 'climb') {
    const ratings = await prisma.climbRating.findMany({
      where: { grade, season, games: { gt: 0 }, user: publicUserWhere() },
      orderBy: [{ rating: 'desc' }, { wins: 'desc' }],
      take: 50,
      include: { user: true },
    });
    rows = ratings.map((r) => ({ id: r.userId, name: r.user.displayName, color: r.user.avatarColor, avatar: r.user.avatar, value: String(r.rating), sub: `${r.wins} победи · ${r.games} игри` }));
  } else if (tab === 'tower') {
    const bests = await prisma.towerBest.findMany({
      where: { grade, season, best: { gt: 0 }, user: { isGuest: false, ...publicUserWhere() } },
      orderBy: [{ best: 'desc' }, { updatedAt: 'asc' }],
      take: 50,
      include: { user: true },
    });
    rows = bests.map((r) => ({ id: r.userId, name: r.user.displayName, color: r.user.avatarColor, avatar: r.user.avatar, value: `${r.best} ет.`, sub: 'Кула на Словото' }));
  } else {
    const users = await prisma.user.findMany({ where: { grade, isGuest: false, xp: { gt: 0 }, ...publicUserWhere() }, orderBy: { xp: 'desc' }, take: 50 });
    rows = users.map((u) => ({ id: u.id, name: u.displayName, color: u.avatarColor, avatar: u.avatar, value: `${u.xp} XP`, sub: `Ниво ${u.level}` }));
  }

  const tabLink = (t: string, s = sp.season) => `/leaderboard?tab=${t}${s ? `&season=${s}` : ''}`;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Класация" subtitle={gradeLabel(grade)} />
      <Link href="/league" className="card3d mb-4 flex items-center gap-3 rounded-2xl bg-surface p-4 hover:bg-surface-2">
        <span className="text-3xl">🏆</span>
        <span className="flex-1">
          <span className="block font-extrabold text-ink-strong">Седмична лига</span>
          <span className="block text-sm text-muted">Състезавай се с XP срещу 20 ученици — първите 5 се качват.</span>
        </span>
      </Link>
      <div className="mb-4 grid grid-cols-4 rounded-2xl bg-surface-2 p-1">
        {[
          { t: 'rating', label: 'Битки' },
          { t: 'climb', label: 'Към върха' },
          { t: 'tower', label: 'Кула' },
          { t: 'xp', label: 'Опит (XP)' },
        ].map(({ t, label }) => (
          <Link key={t} href={tabLink(t)} className={cn('rounded-xl px-1 py-2.5 text-center text-xs font-extrabold uppercase sm:text-sm', tab === t ? 'bg-surface text-secondary shadow-sm' : 'text-muted')}>
            {label}
          </Link>
        ))}
      </div>
      {tab !== 'xp' && (
        <div className="mb-4 flex gap-2">
          {[
            { s: undefined, label: seasonLabel(currentSeason()) },
            { s: 'all', label: seasonLabel('all') },
          ].map(({ s, label }) => (
            <Link key={label} href={tabLink(tab, s)} className={cn('rounded-full border-2 px-3 py-1 text-sm font-extrabold', (s === 'all') === (season === 'all') ? 'border-secondary bg-secondary/10 text-secondary' : 'border-line text-muted')}>
              {label}
            </Link>
          ))}
        </div>
      )}
      {user.isGuest && <p className="mb-4 rounded-2xl bg-accent/15 p-3 text-sm font-bold">Гостите не влизат в класацията. <Link className="text-secondary underline" href="/login?tab=register">Направи профил</Link>, за да се състезаваш.</p>}
      {rows.length === 0 ? (
        <EmptyState title="Още няма класирани" icon={<Trophy className="size-12" />}>
          {tab === 'tower' ? 'Построй кула, за да се появиш тук.' : tab === 'rating' ? 'Изиграй битка с рейтинг, за да се появиш тук.' : 'Реши тест, за да се появиш тук.'}
        </EmptyState>
      ) : (
        <ol className="card3d divide-y-2 divide-line overflow-hidden rounded-2xl bg-surface">
          {rows.map((r, i) => (
            <li key={r.id} className={cn('flex items-center gap-3 px-4 py-3', r.id === user.id && 'bg-secondary/10')}>
              <span className={cn('w-8 text-center text-lg font-black', i === 0 ? 'text-[#e5a400]' : i === 1 ? 'text-[#9aa5ab]' : i === 2 ? 'text-[#cd7f32]' : 'text-muted')}>{i + 1}</span>
              <Avatar name={r.name} avatar={r.avatar} seed={r.id} frame={r.frame} size={44} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-extrabold text-ink-strong">{r.name}</span>
                {r.sub && <span className="block text-xs text-muted">{r.sub}</span>}
              </span>
              <span className="font-black text-ink-strong">{r.value}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
