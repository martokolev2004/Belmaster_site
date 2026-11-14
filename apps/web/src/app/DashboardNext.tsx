import type { CSSProperties } from 'react';
import Link from 'next/link';
import type { User } from '@belmaster/db';
import { gradeLabel, levelProgress } from '@belmaster/shared';
import { BookOpen, ChevronRight, FileText, Languages, Library, ScrollText } from 'lucide-react';
import '@/components/landing/landing-next.css';
import { prisma } from '@/lib/db';
import { UserAvatar } from '@/components/avatar/UserAvatar';
import { Tilt } from '@/components/landing/LandingFx';
import { newItemKeys } from '@/lib/unlocks';

const GAMES = [
  { no: '01', c: '#ff5a5a', img: '/landing/battle.webp', tag: 'Стратегия · 2–4 играчи', title: 'Битка за Континента', text: 'Завладявай области с верни и бързи отговори.', href: '/play' },
  { no: '02', c: '#35b8ff', img: '/landing/climb-hero.webp', tag: 'Дуел · 1 на 1', title: 'Към върха', text: 'Строй стъпала или събори съперника с точен изстрел.', href: '/climb' },
  { no: '03', c: '#ffd84d', img: '/landing/tower.webp', tag: 'Аркада · сам', title: 'Кула на Словото', text: 'Верен отговор = нов етаж. Пусни го точно.', href: '/tower' },
];

/** „Начало“ за влезли потребители — новият вид. Старият е в app/Dashboard.tsx. */
export async function DashboardNext({ user }: { user: User }) {
  const recent = await prisma.matchPlayer.findMany({ where: { userId: user.id }, orderBy: { match: { endedAt: 'desc' } }, take: 3, include: { match: true } });
  const lp = levelProgress(user.xp, user.level);
  const firstName = user.displayName.split(' ')[0];
  const hasNew = newItemKeys(user).length > 0;

  return (
    <div className="nx-dash">
      <section className="animate-rise">
        <div className="nx-hello">
          <div className="min-w-0">
            <p className="ln-eyebrow">{gradeLabel(user.grade!)}</p>
            <h1 className="ln-display nx-h1">
              Здравей, <span className="ln-grad">{firstName}.</span>
            </h1>
          </div>
          <Link href="/profile/avatar" className="nx-avatar" aria-label="Промени аватара" title="Промени аватара">
            <div>
              <UserAvatar avatar={user.avatar} name={user.id} size={92} />
            </div>
            {hasNew && <span className="absolute right-1 top-1 size-3.5 rounded-full bg-error" />}
          </Link>
        </div>
        <div className="nx-panel nx-level">
          <span className="ln-display nx-level-n">{lp.level}</span>
          <div className="min-w-0">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <span className="ln-display text-[0.8rem] text-white">Ниво {lp.level}</span>
              <span className="text-sm font-extrabold text-muted">
                {lp.inLevel} / {lp.needed} XP
              </span>
            </div>
            <div className="nx-bar">
              <i style={{ width: `${Math.max(2, Math.min(100, (lp.inLevel / lp.needed) * 100))}%` }} />
            </div>
          </div>
        </div>
      </section>

      <section>
        <p className="ln-eyebrow">Избери арена</p>
        <h2 className="ln-display nx-h2">
          Какво ще <span className="ln-grad">играем?</span>
        </h2>
        <div className="nx-games">
          {GAMES.map((g) => (
            <Tilt key={g.no} href={g.href} className="ln-card" style={{ '--c': g.c } as CSSProperties}>
              <div className="ln-card-img" style={{ backgroundImage: `url(${g.img})` }} />
              <div className="ln-card-edge" />
              <span className="ln-display ln-card-no">{g.no}</span>
              <div className="ln-card-body">
                <span className="ln-chip">{g.tag}</span>
                <h3 className="ln-display ln-card-title">{g.title}</h3>
                <p className="ln-card-text">{g.text}</p>
                <span className="ln-card-go">
                  Играй <span aria-hidden>→</span>
                </span>
              </div>
            </Tilt>
          ))}
        </div>
      </section>

      <section>
        <p className="ln-eyebrow">Тренировка</p>
        <h2 className="ln-display nx-h2">Мини тестове</h2>
        <div className="nx-tiles">
          <Tile href="/tests/language" c="#6ea2ff" icon={<Languages className="size-6" />} title="Език" text="Граматика, лексика, правопис, пунктуация" />
          <Tile href="/tests/literature" c="#ffd166" icon={<BookOpen className="size-6" />} title="Литература" text="Случайни въпроси по литература" />
          <Tile href="/tests/reading" c="#5fe0d0" icon={<FileText className="size-6" />} title="Четене с разбиране" text="Текст и въпроси към него" />
          <Tile href="/exams" c="#c59bff" icon={<ScrollText className="size-6" />} title="Цели изпити" text="Минали изпити без есето" />
        </div>
      </section>

      <section className="nx-tiles" style={{ marginTop: 0, alignItems: 'start' }}>
        <Tile href="/library" c="#6ea2ff" icon={<Library className="size-6" />} title="Библиотека" text="Произведенията, които учиш" />
        <div className="nx-panel nx-recent">
          <h3 className="ln-display mb-2 text-[0.8rem] text-white">Последни битки</h3>
          {recent.length === 0 ? (
            <p className="text-sm font-semibold text-muted">Още нямаш изиграни битки.</p>
          ) : (
            recent.map((mp) => (
              <Link key={mp.id} href={`/match/${mp.matchId}`}>
                <span>
                  {mp.place === 1 ? '🏆 Победа' : `${mp.place}. място`} · {mp.territories} {mp.match.mode === 'CLIMB' ? 'стъпала' : 'области'}
                </span>
                <ChevronRight className="size-4 text-muted" />
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function Tile({ href, icon, c, title, text }: { href: string; icon: React.ReactNode; c: string; title: string; text: string }) {
  return (
    <Link href={href} className="nx-panel nx-tile" style={{ '--c': c } as CSSProperties}>
      <span className="nx-tile-ic">{icon}</span>
      <span className="min-w-0">
        <span className="ln-display nx-tile-t block">{title}</span>
        <p>{text}</p>
      </span>
      <ChevronRight className="nx-tile-go size-5" />
    </Link>
  );
}
