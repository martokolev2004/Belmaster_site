import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Check, X } from 'lucide-react';
import { BOT_AVATAR, MODE_LABELS } from '@belmaster/shared';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { Avatar, Badge, Card } from '@/components/ui';
import { cn } from '@/lib/cn';

interface ReviewItem {
  prompt: string;
  type: 'SINGLE_CHOICE' | 'SHORT_ANSWER';
  options: string[];
  correctIndex: number | null;
  correctText: string | null;
  explanation: string | null;
  workTitle: string | null;
  results: { uid: string; name: string; correct: boolean; timeMs: number | null; answer: string | null }[];
}
const LETTERS = ['А', 'Б', 'В', 'Г', 'Д', 'Е'];

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser();
  const match = await prisma.match.findUnique({ where: { id }, include: { players: { orderBy: { place: 'asc' }, include: { user: { select: { avatar: true } } } } } });
  if (!match) notFound();
  const review = (match.review ?? []) as unknown as ReviewItem[];

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/play" className="mb-4 inline-flex items-center gap-1 font-bold text-secondary">
        <ArrowLeft className="size-4" /> Битки
      </Link>
      <h1 className="text-3xl font-black">Разбор на битката</h1>
      <p className="mt-1 text-muted">
        {MODE_LABELS[match.mode].name} · {match.endedAt.toLocaleString('bg-BG', { timeZone: 'Europe/Sofia' })}
        {match.rated ? ' · с рейтинг' : ''}
      </p>
      <Card className="mt-5">
        <ol className="space-y-2">
          {match.players.map((p) => (
            <li key={p.id} className="flex items-center gap-3">
              <span className="w-6 text-center font-black text-muted">{p.place}</span>
              <Avatar name={p.name} color={p.color} avatar={p.isBot ? BOT_AVATAR : p.user?.avatar} seed={p.userId ?? p.name} size={34} />
              <span className="flex-1 font-extrabold text-ink-strong">
                {p.name} {p.isBot && <Badge>бот</Badge>}
              </span>
              <span className="text-sm text-muted">
                {p.territories} обл. · {p.correct}/{p.answered} верни
              </span>
              {p.ratingDelta != null && <span className={cn('w-12 text-right font-black', p.ratingDelta >= 0 ? 'text-primary' : 'text-error')}>{p.ratingDelta >= 0 ? '+' : ''}{p.ratingDelta}</span>}
            </li>
          ))}
        </ol>
      </Card>
      <h2 className="mb-3 mt-8 text-xl font-black">Въпросите ({review.length})</h2>
      <ol className="space-y-3">
        {review.map((r, i) => (
          <li key={i} className="card3d rounded-2xl bg-surface p-4">
            {r.workTitle && <Badge tone="yellow" className="mb-2">{r.workTitle}</Badge>}
            <p className="font-bold text-ink-strong">
              {i + 1}. {r.prompt}
            </p>
            <p className="mt-1 text-sm font-bold text-primary-dark">
              Верен: {r.type === 'SINGLE_CHOICE' && r.correctIndex != null ? `${LETTERS[r.correctIndex]}) ${r.options[r.correctIndex]}` : r.correctText}
            </p>
            {r.explanation && <p className="mt-1 text-sm text-muted">{r.explanation}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              {r.results.map((res) => (
                <span key={res.uid} className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold', res.correct ? 'bg-primary/15 text-primary-dark' : 'bg-error/15 text-error-dark')}>
                  {res.correct ? <Check className="size-3" /> : <X className="size-3" />} {res.name}
                  {res.answer ? `: ${res.answer}` : ''}
                  {res.timeMs != null ? ` · ${(res.timeMs / 1000).toFixed(1)} с` : ''}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
