import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { PlayHub } from '@/components/game/PlayHub';

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
      <header className="nx-panel ph-hero animate-rise">
        <div className="ph-hero-art" style={{ backgroundImage: 'url(/landing/battle.webp)' }} />
        <div className="ph-hero-copy">
          <p className="ln-eyebrow">Стратегия · 2–4 играчи</p>
          <h1 className="ln-display nx-h1">
            Битка за <span className="ln-grad">Континента</span>
          </h1>
          <p className="nx-sub">Отговаряй вярно и по-бързо, за да завладяваш области. Пази столицата си — пада след 3 удара. 12 кръга.</p>
        </div>
      </header>
      <PlayHub inviteUid={inviteName ? invite! : null} inviteName={inviteName} hasQuestions={questions >= 5} />
    </div>
  );
}
