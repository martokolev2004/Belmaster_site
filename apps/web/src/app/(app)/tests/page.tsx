import type { CSSProperties } from 'react';
import Link from 'next/link';
import { TOPIC_LABELS } from '@belmaster/shared';
import { BookOpen, ChevronRight, FileText, Languages, ScrollText } from 'lucide-react';
import '@/components/landing/landing-next.css';
import { requireUser } from '@/lib/auth';
import { mistakesSummary, survivalBest } from '@/lib/quiz';

export const metadata = { title: 'Тестове' };

export default async function TestsPage() {
  const user = await requireUser();
  const grade = user.grade!;
  const ms = await mistakesSummary(user.id, grade);
  const mistakes = ms.due;
  const best = await survivalBest(user.id);
  const mistakesText = mistakes
    ? `${mistakes} въпроса за преговор днес`
    : ms.later
      ? `Следващ преговор: ${ms.nextAt?.toLocaleDateString('bg-BG', { timeZone: 'Europe/Sofia', day: 'numeric', month: 'long' })} (${ms.later} чакат)`
      : 'Няма грешки за преговор';

  return (
    <div data-nx>
      <header className="nx-head animate-rise">
        <p className="ln-eyebrow">Тренировка</p>
        <h1 className="ln-display nx-h1">
          Мини <span className="ln-grad">тестове</span>
        </h1>
        <p className="nx-sub">По 10 случайни въпроса. Всеки верен отговор носи 20 XP.</p>
      </header>

      <div className="nx-stack">
        <Link href="/tests/survival" className="nx-panel nx-feature" style={{ '--c': '#ff9d3c' } as CSSProperties}>
          <span className="nx-emoji">🔥</span>
          <span className="min-w-0">
            <span className="ln-display nx-tile-t block">До първа грешка</span>
            <span className="mt-1 block text-sm font-semibold text-muted">Колко поредни верни ще отговориш?</span>
          </span>
          <span className="nx-record">
            <small>Рекорд</small>
            <b className="ln-display">{best}</b>
          </span>
        </Link>

        <div className="nx-tiles" style={{ marginTop: 0 }}>
          <Link href="/tests/mistakes" className="nx-panel nx-feature" style={{ '--c': mistakes ? '#ff5a6a' : '#6ea2ff' } as CSSProperties}>
            <span className="nx-emoji">🔁</span>
            <span className="min-w-0">
              <span className="ln-display nx-tile-t block">Моите грешки</span>
              <span className="mt-1 block text-sm font-semibold text-muted">{mistakesText}</span>
            </span>
            <ChevronRight className="nx-tile-go size-5" />
          </Link>
          <Link href="/stats" className="nx-panel nx-feature" style={{ '--c': '#5fe0d0' } as CSSProperties}>
            <span className="nx-emoji">📊</span>
            <span className="min-w-0">
              <span className="ln-display nx-tile-t block">Моята статистика</span>
              <span className="mt-1 block text-sm font-semibold text-muted">Силни и слаби теми</span>
            </span>
            <ChevronRight className="nx-tile-go size-5" />
          </Link>
        </div>

        <Block href="/tests/language" c="#6ea2ff" icon={<Languages className="size-6" />} title="Език" text="Граматика, лексика, правопис и пунктуация">
          <div className="nx-chips">
            {Object.entries(TOPIC_LABELS).map(([key, label]) => (
              <Link key={key} href={`/tests/language?topic=${key}`} className="nx-chip">
                {label}
              </Link>
            ))}
          </div>
        </Block>
        <Block href="/tests/literature" c="#ffd166" icon={<BookOpen className="size-6" />} title="Литература" text="Случайни въпроси по всички произведения" />
        <Block href="/tests/reading" c="#5fe0d0" icon={<FileText className="size-6" />} title="Четене с разбиране" text="Случаен текст с въпросите към него" />
        <Block href="/exams" c="#c59bff" icon={<ScrollText className="size-6" />} title="Цели изпити" text="Пробен изпит с таймер, точки по ключа и ориентировъчна оценка" />
      </div>
    </div>
  );
}

function Block({ href, icon, c, title, text, children }: { href: string; icon: React.ReactNode; c: string; title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="nx-panel nx-block" style={{ '--c': c } as CSSProperties}>
      <Link href={href}>
        <span className="nx-tile-ic">{icon}</span>
        <span className="min-w-0">
          <span className="ln-display nx-tile-t block">{title}</span>
          <span className="mt-1 block text-sm font-semibold text-muted">{text}</span>
        </span>
        <ChevronRight className="nx-tile-go size-5" />
      </Link>
      {children}
    </div>
  );
}
