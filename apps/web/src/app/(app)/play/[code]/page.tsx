import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { GameRoom } from '@/components/game/GameRoom';

export const metadata = { title: 'Битка' };

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const user = await requireUser();
  const friendships = await prisma.friendship.findMany({
    where: { status: 'ACCEPTED', OR: [{ requesterId: user.id }, { addresseeId: user.id }] },
    include: { requester: true, addressee: true },
  });
  const friends = friendships
    .map((f) => (f.requesterId === user.id ? f.addressee : f.requester))
    .filter((u) => u.grade === user.grade)
    .map((u) => ({ id: u.id, name: u.displayName, color: u.avatarColor, avatar: u.avatar }));
  const upper = code.toUpperCase();
  return <GameRoom key={upper} code={upper} me={user.id} friends={friends} />;
}
