import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

/** „Изтегли данните ми“ — всичко, което пазим за потребителя, като JSON. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const full = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      achievements: true,
      attempts: { select: { kind: true, score: true, total: true, xpEarned: true, createdAt: true } },
      ratings: true,
      climbRatings: true,
      towerBests: true,
      towerRuns: { select: { createdAt: true, xs: true, correct: true, wrong: true, endReason: true } },
      leagues: true,
      mistakes: true,
      topicStats: true,
      membership: true,
      friendsRequested: { select: { status: true, createdAt: true, addressee: { select: { displayName: true } } } },
      friendsReceived: { select: { status: true, createdAt: true, requester: { select: { displayName: true } } } },
    },
  });
  const { passwordHash, googleId, ...data } = full!;
  void passwordHash;
  void googleId;
  return new NextResponse(JSON.stringify({ exportedAt: new Date().toISOString(), ...data }, null, 2), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': 'attachment; filename="belmaster-moite-danni.json"' },
  });
}
