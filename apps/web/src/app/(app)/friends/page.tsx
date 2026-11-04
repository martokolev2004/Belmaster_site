import { gradeLabel } from '@belmaster/shared';
import { Users } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { Avatar, Card, EmptyState, PageHeader } from '@/components/ui';
import { AddFriendForm, CopyCode, FriendList } from './FriendForms';
import { respondFriendAction } from './actions';

export const metadata = { title: 'Приятели' };

export default async function FriendsPage() {
  const user = await requireUser();
  const all = await prisma.friendship.findMany({
    where: { OR: [{ requesterId: user.id }, { addresseeId: user.id }] },
    include: { requester: true, addressee: true },
    orderBy: { createdAt: 'desc' },
  });
  const friends = all
    .filter((f) => f.status === 'ACCEPTED')
    .map((f) => (f.requesterId === user.id ? f.addressee : f.requester))
    .map((u) => ({ id: u.id, name: u.displayName, color: u.avatarColor, avatar: u.avatar, grade: gradeLabel(u.grade), sameGrade: u.grade === user.grade }));
  const incoming = all.filter((f) => f.status === 'PENDING' && f.addresseeId === user.id);
  const outgoing = all.filter((f) => f.status === 'PENDING' && f.requesterId === user.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Приятели" subtitle="Добавяй приятели с код и ги канѝ на битка." />
      <Card>
        <p className="mb-2 text-sm font-extrabold text-muted">Твоят код — дай го на приятел:</p>
        <CopyCode code={user.friendCode} />
        <div className="mt-5">
          <AddFriendForm />
        </div>
      </Card>

      {incoming.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-black">Покани за приятелство</h2>
          <ul className="space-y-2">
            {incoming.map((f) => (
              <li key={f.id} className="card3d flex items-center gap-3 rounded-2xl bg-surface p-3">
                <Avatar name={f.requester.displayName} avatar={f.requester.avatar} seed={f.requester.id} />
                <span className="flex-1 font-extrabold">{f.requester.displayName}</span>
                <form action={respondFriendAction} className="flex gap-2">
                  <input type="hidden" name="id" value={f.id} />
                  <button name="decision" value="accept" className="btn3d rounded-xl bg-primary px-3 py-2 text-sm font-extrabold uppercase text-white [--btn-shadow:var(--color-primary-dark)]">
                    Приеми
                  </button>
                  <button name="decision" value="decline" className="rounded-xl px-3 py-2 text-sm font-extrabold text-muted hover:bg-surface-2">
                    Откажи
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-black">Приятели ({friends.length})</h2>
        {friends.length === 0 ? (
          <EmptyState title="Още нямаш приятели" icon={<Users className="size-12" />}>
            Сподели кода си или въведи кода на приятел.
          </EmptyState>
        ) : (
          <FriendList friends={friends} />
        )}
      </section>

      {outgoing.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-black">Изпратени покани</h2>
          <ul className="space-y-2">
            {outgoing.map((f) => (
              <li key={f.id} className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
                <Avatar name={f.addressee.displayName} avatar={f.addressee.avatar} seed={f.addressee.id} size={32} />
                <span className="flex-1 font-bold">{f.addressee.displayName}</span>
                <form action={respondFriendAction}>
                  <input type="hidden" name="id" value={f.id} />
                  <button name="decision" value="cancel" className="text-sm font-extrabold text-muted hover:text-error">
                    Откажи
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
