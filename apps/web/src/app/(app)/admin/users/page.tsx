import { prisma } from '@/lib/db';
import { Avatar, Badge, EmptyState } from '@/components/ui';
import { gradeLabel } from '@belmaster/shared';
import { blockUserAction, closeUserReportsAction, resetNameAction } from './actions';

export const metadata = { title: 'Потребители' };

type U = { id: string; displayName: string; email: string | null; avatar: unknown; grade: string | null; isGuest: boolean; blockedAt: Date | null; blockReason: string | null; createdAt: Date };

function UserRow({ u, children }: { u: U; children?: React.ReactNode }) {
  return (
    <li className="card3d space-y-2 rounded-2xl bg-surface p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={u.displayName} avatar={u.avatar} seed={u.id} size={40} />
        <div className="min-w-0 flex-1">
          <p className="font-extrabold text-ink-strong">
            {u.displayName} {u.blockedAt && <Badge tone="red">блокиран</Badge>} {u.isGuest && <Badge>гост</Badge>}
          </p>
          <p className="text-xs text-muted">
            {u.email ?? '—'} · {gradeLabel(u.grade as never)} · от {u.createdAt.toLocaleDateString('bg-BG')}
            {u.blockReason && ` · причина: ${u.blockReason}`}
          </p>
        </div>
        <Actions u={u} />
      </div>
      {children}
    </li>
  );
}

function Actions({ u }: { u: U }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <form action={resetNameAction}>
        <input type="hidden" name="id" value={u.id} />
        <button className="rounded-xl bg-surface-2 px-3 py-1.5 font-bold hover:bg-line">Смени името</button>
      </form>
      {u.blockedAt ? (
        <form action={blockUserAction}>
          <input type="hidden" name="id" value={u.id} />
          <input type="hidden" name="unblock" value="1" />
          <button className="rounded-xl bg-primary/15 px-3 py-1.5 font-bold text-primary-dark">Отблокирай</button>
        </form>
      ) : (
        <form action={blockUserAction} className="flex gap-1">
          <input type="hidden" name="id" value={u.id} />
          <input name="reason" placeholder="причина" className="w-28 rounded-xl border-2 border-line bg-bg px-2 py-1" />
          <button className="rounded-xl bg-error px-3 py-1.5 font-bold text-white">Блокирай</button>
        </form>
      )}
    </div>
  );
}

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams;
  const term = q.trim();
  const reports = await prisma.userReport.findMany({ where: { status: 'OPEN' }, include: { target: true, reporter: { select: { displayName: true } } }, orderBy: { createdAt: 'desc' }, take: 200 });
  const byTarget = new Map<string, typeof reports>();
  for (const r of reports) byTarget.set(r.targetId, [...(byTarget.get(r.targetId) ?? []), r]);
  const found = term
    ? await prisma.user.findMany({
        where: { OR: [{ displayName: { contains: term, mode: 'insensitive' } }, { email: { contains: term, mode: 'insensitive' } }, { friendCode: term.toUpperCase() }] },
        orderBy: { createdAt: 'desc' },
        take: 30,
      })
    : await prisma.user.findMany({ where: { blockedAt: { not: null } }, orderBy: { blockedAt: 'desc' }, take: 30 });

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-lg font-black">Доклади за потребители ({byTarget.size})</h2>
        {byTarget.size === 0 ? (
          <EmptyState title="Няма отворени доклади 🎉" />
        ) : (
          <ul className="space-y-3">
            {[...byTarget.values()].map((rs) => (
              <UserRow key={rs[0].targetId} u={rs[0].target}>
                <ul className="space-y-1 text-sm">
                  {rs.map((r) => (
                    <li key={r.id}>
                      <Badge tone="yellow">{r.reason}</Badge> <span className="text-muted">от {r.reporter?.displayName ?? '—'} · {r.createdAt.toLocaleString('bg-BG', { timeZone: 'Europe/Sofia' })}</span>
                      {r.message && <span className="ml-1">„{r.message}“</span>}
                    </li>
                  ))}
                </ul>
                <form action={closeUserReportsAction}>
                  <input type="hidden" name="id" value={rs[0].targetId} />
                  <button className="text-sm font-bold text-muted underline">Няма нарушение — затвори докладите</button>
                </form>
              </UserRow>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-black">{term ? `Търсене: „${term}“` : 'Блокирани потребители'}</h2>
        <form className="mb-3 flex gap-2">
          <input name="q" defaultValue={term} placeholder="Име, имейл или код за приятели" className="flex-1 rounded-xl border-2 border-line bg-bg px-3 py-2" />
          <button className="rounded-xl bg-secondary px-4 py-2 font-extrabold text-white">Търси</button>
        </form>
        {found.length === 0 ? <p className="text-muted">Няма намерени.</p> : <ul className="space-y-3">{found.map((u) => <UserRow key={u.id} u={u} />)}</ul>}
      </section>
    </div>
  );
}
