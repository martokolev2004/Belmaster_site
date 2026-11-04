import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { PageHeader } from '@/components/ui';
import { PlayHub } from '@/components/game/PlayHub';
import { MapPreview } from '@/components/game/MapPreview';

export const metadata = { title: 'Битка' };

export default async function PlayPage({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  const user = await requireUser();
  const { invite } = await searchParams;
  let inviteName: string | null = null;
  if (invite) {
    const f = await prisma.user.findUnique({ where: { id: invite } });
    inviteName = f && f.grade === user.grade ? f.displayName : null;
  }
  const questions = await prisma.question.count({
    where: { grade: user.grade!, status: 'ACTIVE', inMultiplayer: true, section: { in: ['LANGUAGE', 'LITERATURE'] } },
  });
  return (
    <div>
      <div className="mb-6 grid items-center gap-6 md:grid-cols-[1fr_320px]">
        <PageHeader
          title="Битка за Континента"
          subtitle="Отговаряй вярно и по-бързо, за да завладяваш области. Пази столицата си — пада след 3 удара. 12 кръга."
        />
        <MapPreview className="hidden w-full md:block" />
      </div>
      <PlayHub inviteUid={inviteName ? invite! : null} inviteName={inviteName} hasQuestions={questions >= 5} />
    </div>
  );
}
