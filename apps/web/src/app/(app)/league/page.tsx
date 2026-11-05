import Link from 'next/link';
import { LEAGUE_GROUP_SIZE, LEAGUE_MOVE, LEAGUE_TIERS, leagueWeek, leagueWeekEnd } from '@belmaster/shared';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { Avatar, ButtonLink, Card, PageHeader } from '@/components/ui';
import { cn } from '@/lib/cn';

export const metadata = { title: 'Седмична лига' };
export const dynamic = 'force-dynamic';

export default async function LeaguePage() {
  const user = await requireUser();
  const week = leagueWeek();
  const me = await prisma.leagueMember.findUnique({ where: { userId_week: { userId: user.id, week } } });
  const last = me ? null : await prisma.leagueMember.findFirst({ where: { userId: user.id }, orderBy: { week: 'desc' } });
  const tier = LEAGUE_TIERS[me?.tier ?? last?.tier ?? 0];
  const end = leagueWeekEnd(week);
  const days = Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86_400_000));

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="Седмична лига" subtitle={`Групи до ${LEAGUE_GROUP_SIZE} ученици. Първите ${LEAGUE_MOVE} се качват в по-горна лига, последните ${LEAGUE_MOVE} — падат.`} />

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {LEAGUE_TIERS.map((t, i) => (
          <span
            key={t.name}
            title={t.name}
            className={cn('flex size-11 shrink-0 items-center justify-center rounded-2xl border-2 text-xl', i === (me?.tier ?? last?.tier ?? 0) ? 'scale-110 border-secondary bg-secondary/10' : 'border-line opacity-60')}
          >
            {t.emoji}
          </span>
        ))}
      </div>

      <Card className="flex items-center gap-4">
        <span className="flex size-16 items-center justify-center rounded-2xl text-4xl" style={{ background: `${tier.color}22` }}>
          {tier.emoji}
        </span>
        <div className="flex-1">
          <p className="text-2xl font-black">Лига {tier.name}</p>
          <p className="text-sm text-muted">
            {days > 1 ? `Остават ${days} дни` : days === 1 ? 'Последен ден!' : 'Седмицата свършва довечера'} · XP от тестове и игри тази седмица
          </p>
        </div>
      </Card>

      {user.isGuest ? (
        <Card>
          <p className="font-bold">Гостите не участват в лигата.</p>
          <ButtonLink href="/login?tab=register" className="mt-3">
            Направи профил
          </ButtonLink>
        </Card>
      ) : !me ? (
        <Card className="text-center">
          <p className="text-lg font-black">Влез в лигата тази седмица</p>
          <p className="mt-1 text-muted">Реши тест или изиграй игра — с първия XP влизаш в група.</p>
          <div className="mt-4 flex justify-center gap-2">
            <ButtonLink href="/tests">Тестове</ButtonLink>
            <ButtonLink href="/climb" variant="outline">
              Към върха
            </ButtonLink>
          </div>
        </Card>
      ) : (
        <Group group={me.group} meId={user.id} />
      )}
    </div>
  );
}

async function Group({ group, meId }: { group: string; meId: string }) {
  const rows = await prisma.leagueMember.findMany({
    where: { group },
    orderBy: [{ xp: 'desc' }, { createdAt: 'asc' }],
    include: { user: { select: { displayName: true, avatar: true, avatarColor: true } } },
  });
  const n = rows.length;
  return (
    <ol className="card3d overflow-hidden rounded-2xl bg-surface">
      {rows.map((r, i) => {
        const rank = i + 1;
        const up = rank <= LEAGUE_MOVE && r.xp > 0 && r.tier < LEAGUE_TIERS.length - 1;
        const down = n > LEAGUE_MOVE * 2 && rank > n - LEAGUE_MOVE && r.tier > 0;
        return (
          <li key={r.id}>
            {rank === LEAGUE_MOVE + 1 && <p className="bg-primary/10 py-1 text-center text-[11px] font-extrabold uppercase text-primary-dark">▲ зона за качване</p>}
            {down && rank === n - LEAGUE_MOVE + 1 && <p className="bg-error/10 py-1 text-center text-[11px] font-extrabold uppercase text-error-dark">▼ зона за падане</p>}
            <div className={cn('flex items-center gap-3 px-4 py-2.5', r.userId === meId && 'bg-secondary/10')}>
              <span className={cn('w-7 text-center font-black', up ? 'text-primary-dark' : down ? 'text-error' : 'text-muted')}>{rank}</span>
              <Avatar name={r.user.displayName} avatar={r.user.avatar} seed={r.userId} size={34} />
              <span className="flex-1 truncate font-extrabold text-ink-strong">
                {r.user.displayName}
                {r.userId === meId && ' (ти)'}
              </span>
              <span className="font-black">{r.xp} XP</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
