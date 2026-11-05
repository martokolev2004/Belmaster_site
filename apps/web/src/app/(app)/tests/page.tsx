import Link from 'next/link';
import { TOPIC_LABELS } from '@belmaster/shared';
import { BookOpen, ChevronRight, FileText, Languages, ScrollText } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { mistakesSummary } from '@/lib/quiz';
import { PageHeader } from '@/components/ui';

export const metadata = { title: 'Тестове' };

export default async function TestsPage() {
  const user = await requireUser();
  const grade = user.grade!;
  const ms = await mistakesSummary(user.id, grade);
  const mistakes = ms.due;

  return (
    <div>
      <PageHeader title="Мини тестове" subtitle="По 10 случайни въпроса от минали матури. Всеки верен отговор носи 20 XP." />
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Link href="/tests/mistakes" className={`card3d flex items-center gap-3 rounded-2xl p-4 ${mistakes ? 'border-error/40! bg-error/8' : 'bg-surface'}`}>
          <span className="text-3xl">🔁</span>
          <span className="flex-1">
            <span className="block font-extrabold text-ink-strong">Моите грешки</span>
            <span className="block text-sm text-muted">{mistakes ? `${mistakes} въпроса за преговор днес` : ms.later ? `Следващ преговор: ${ms.nextAt?.toLocaleDateString('bg-BG', { timeZone: 'Europe/Sofia', day: 'numeric', month: 'long' })} (${ms.later} чакат)` : 'Няма грешки за преговор'}</span>
          </span>
        </Link>
        <Link href="/stats" className="card3d flex items-center gap-3 rounded-2xl bg-surface p-4">
          <span className="text-3xl">📊</span>
          <span className="flex-1">
            <span className="block font-extrabold text-ink-strong">Моята статистика</span>
            <span className="block text-sm text-muted">Силни и слаби теми</span>
          </span>
        </Link>
      </div>
      <div className="space-y-4">
        <Section href="/tests/language" icon={<Languages className="size-8" />} tone="bg-primary/15 text-primary" title="Език" text="Граматика, лексика, правопис и пунктуация">
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(TOPIC_LABELS).map(([key, label]) => (
              <Link
                key={key}
                href={`/tests/language?topic=${key}`}
                className="card3d rounded-xl bg-surface px-3 py-1.5 text-sm font-extrabold hover:bg-surface-2"
              >
                {label}
              </Link>
            ))}
          </div>
        </Section>
        <Section href="/tests/literature" icon={<BookOpen className="size-8" />} tone="bg-accent/20 text-[#b88600]" title="Литература" text="Случайни въпроси по всички произведения" />
        <Section href="/tests/reading" icon={<FileText className="size-8" />} tone="bg-secondary/15 text-secondary" title="Четене с разбиране" text="Случаен текст с въпросите към него" />
        <Section href="/exams" icon={<ScrollText className="size-8" />} tone="bg-purple/20 text-purple-dark" title="Цели матури" text="Пробна матура с таймер, точки по ключа и ориентировъчна оценка" />
      </div>
    </div>
  );
}

function Section({ href, icon, tone, title, text, children }: { href: string; icon: React.ReactNode; tone: string; title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="card3d rounded-2xl bg-surface p-5">
      <Link href={href} className="group flex items-center gap-4">
        <span className={`rounded-2xl p-3 ${tone}`}>{icon}</span>
        <span className="flex-1">
          <span className="block text-xl font-extrabold text-ink-strong">{title}</span>
          <span className="block text-muted">{text}</span>
        </span>
        <ChevronRight className="size-6 text-muted transition group-hover:translate-x-0.5" />
      </Link>
      {children}
    </div>
  );
}
