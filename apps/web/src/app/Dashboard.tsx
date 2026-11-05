import Link from 'next/link';
import type { User } from '@belmaster/db';
import { gradeLabel, levelProgress } from '@belmaster/shared';
import { Pencil, BookOpen, ChevronRight, FileText, Languages, Library, ScrollText, Swords } from 'lucide-react';
import { prisma } from '@/lib/db';
import { Card, ProgressBar, Badge } from '@/components/ui';
import { UserAvatar } from '@/components/avatar/UserAvatar';
import { newItemKeys } from '@/lib/unlocks';

export async function Dashboard({ user }: { user: User }) {
  const grade = user.grade!;
  const [recent] = await Promise.all([
    prisma.matchPlayer.findMany({
      where: { userId: user.id },
      orderBy: { match: { endedAt: 'desc' } },
      take: 3,
      include: { match: true },
    }),
  ]);
  const lp = levelProgress(user.xp, user.level);
  const firstName = user.displayName.split(' ')[0];
  const hasNew = newItemKeys(user).length > 0;

  return (
    <div className="space-y-8">
      <section className="animate-rise">
        <div className="flex items-center gap-4">
          <Link href="/profile/avatar" className="group relative shrink-0" aria-label="Промени аватара" title="Промени аватара">
            <UserAvatar avatar={user.avatar} name={user.id} size={88} className="transition group-hover:scale-105" />
            <span className="absolute -bottom-1 -right-1 flex size-8 items-center justify-center rounded-full border-2 border-bg bg-secondary text-white shadow">
              <Pencil className="size-4" />
            </span>
            {hasNew && <span className="absolute -right-1 -top-1 size-4 rounded-full border-2 border-bg bg-error" />}
          </Link>
          <div className="min-w-0">
            <h1 className="text-3xl font-black">Здравей, {firstName}! 👋</h1>
            <p className="mt-1 text-muted">Готвиш се за {gradeLabel(grade)}.</p>
            <Link href="/profile/avatar" className="mt-1.5 inline-flex items-center gap-1 text-sm font-extrabold text-secondary hover:underline">
              {hasNew ? '🎁 Имаш нови неща за аватара' : '✏️ Промени аватара'}
            </Link>
          </div>
        </div>
        <Card className="mt-5 flex items-center gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-accent text-2xl font-black text-[#4b3b00]">
            {lp.level}
          </span>
          <div className="flex-1">
            <div className="mb-2 flex justify-between text-sm font-extrabold">
              <span>Ниво {lp.level}</span>
              <span className="text-muted">
                {lp.inLevel} / {lp.needed} XP
              </span>
            </div>
            <ProgressBar value={(lp.inLevel / lp.needed) * 100} color="bg-accent" />
          </div>
        </Card>
      </section>

      <section>
        <Link href="/play" className="group block">
          <div className="relative overflow-hidden rounded-3xl bg-secondary p-6 text-white shadow-[0_6px_0_var(--color-secondary-dark)] transition group-active:translate-y-1 group-active:shadow-none md:p-8">
            <div className="relative z-10 max-w-md">
              <Badge className="bg-white/20! text-white!">Мултиплейър</Badge>
              <h2 className="mt-3 text-2xl font-black text-white md:text-3xl">Битка за Континента на Словото</h2>
              <p className="mt-2 text-white/85">Отговаряй вярно и по-бързо от съперника, за да завладяваш области. 2–4 играчи.</p>
              <span className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 font-extrabold uppercase text-secondary">
                <Swords className="size-5" /> Към битката
              </span>
            </div>
            <Swords className="absolute -bottom-6 -right-6 size-48 text-white/10" strokeWidth={1.5} />
          </div>
        </Link>
      </section>

      <section>
        <Link href="/climb" className="group flex items-center gap-4 rounded-3xl bg-gradient-to-r from-[#58cc02] to-[#1cb0f6] p-5 text-white shadow-[0_6px_0_#3f8f04] transition group-active:translate-y-1">
          <span className="text-5xl">⛰️</span>
          <span className="flex-1">
            <span className="block text-xl font-black text-white">Към върха</span>
            <span className="block text-sm text-white/90">Игра за двама: качвай се, хвърляй по стъпалата на другия и пази се с щит.</span>
          </span>
          <ChevronRight className="size-6" />
        </Link>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-black">Мини тестове</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Tile href="/tests/language" icon={<Languages className="size-7" />} tone="primary" title="Език" text="Граматика, лексика, правопис, пунктуация" />
          <Tile href="/tests/literature" icon={<BookOpen className="size-7" />} tone="accent" title="Литература" text="Случайни въпроси по литература" />
          <Tile href="/tests/reading" icon={<FileText className="size-7" />} tone="secondary" title="Четене с разбиране" text="Текст и въпроси към него" />
          <Tile href="/exams" icon={<ScrollText className="size-7" />} tone="purple" title="Цели матури" text="Минали матури без есето" />
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <Tile href="/library" icon={<Library className="size-7" />} tone="secondary" title="Библиотека" text="Произведенията от програмата" />
        <Card>
          <h3 className="mb-3 font-extrabold">Последни битки</h3>
          {recent.length === 0 ? (
            <p className="text-sm text-muted">Още нямаш изиграни битки.</p>
          ) : (
            <ul className="space-y-2">
              {recent.map((mp) => (
                <li key={mp.id}>
                  <Link href={`/match/${mp.matchId}`} className="flex items-center justify-between rounded-xl px-2 py-1.5 hover:bg-surface-2">
                    <span className="font-bold">
                      {mp.place === 1 ? '🏆 Победа' : `${mp.place}. място`} · {mp.territories} области
                    </span>
                    <ChevronRight className="size-4 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}

const TONES = {
  primary: 'bg-primary/15 text-primary',
  secondary: 'bg-secondary/15 text-secondary',
  accent: 'bg-accent/20 text-[#b88600]',
  purple: 'bg-purple/20 text-purple-dark',
};

function Tile({ href, icon, tone, title, text }: { href: string; icon: React.ReactNode; tone: keyof typeof TONES; title: string; text: string }) {
  return (
    <Link href={href} className="card3d group flex items-center gap-4 rounded-2xl bg-surface p-4 transition hover:bg-surface-2">
      <span className={`rounded-2xl p-3 ${TONES[tone]}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-extrabold text-ink-strong">{title}</span>
        <span className="block text-sm text-muted">{text}</span>
      </span>
      <ChevronRight className="size-5 text-muted transition group-hover:translate-x-0.5" />
    </Link>
  );
}
