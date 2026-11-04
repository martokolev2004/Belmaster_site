import Link from 'next/link';
import { TOPIC_LABELS } from '@belmaster/shared';
import { BookOpen, ChevronRight, FileText, Languages, ScrollText } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { PageHeader } from '@/components/ui';

export const metadata = { title: 'Тестове' };

export default async function TestsPage() {
  const user = await requireUser();
  const grade = user.grade!;
  const [byTopic, lit, reading, exams] = await Promise.all([
    prisma.question.groupBy({ by: ['topic'], where: { grade, section: 'LANGUAGE', status: 'ACTIVE' }, _count: true }),
    prisma.question.count({ where: { grade, section: 'LITERATURE', status: 'ACTIVE' } }),
    prisma.passage.count({ where: { grade, questions: { some: { status: 'ACTIVE' } } } }),
    prisma.exam.count({ where: { grade } }),
  ]);
  const langTotal = byTopic.reduce((s, t) => s + t._count, 0);
  const topicCount = (t: string) => byTopic.find((b) => b.topic === t)?._count ?? 0;

  return (
    <div>
      <PageHeader title="Мини тестове" subtitle="По 10 случайни въпроса от минали матури. Всеки верен отговор носи 20 XP." />
      <div className="space-y-4">
        <Section href="/tests/language" icon={<Languages className="size-8" />} tone="bg-primary/15 text-primary" title="Език" text="Граматика, лексика, правопис и пунктуация" count={langTotal}>
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(TOPIC_LABELS).map(([key, label]) => (
              <Link
                key={key}
                href={`/tests/language?topic=${key}`}
                className="card3d rounded-xl bg-surface px-3 py-1.5 text-sm font-extrabold hover:bg-surface-2"
              >
                {label} <span className="text-muted">· {topicCount(key)}</span>
              </Link>
            ))}
          </div>
        </Section>
        <Section href="/tests/literature" icon={<BookOpen className="size-8" />} tone="bg-accent/20 text-[#b88600]" title="Литература" text="Случайни въпроси по всички произведения" count={lit} />
        <Section href="/tests/reading" icon={<FileText className="size-8" />} tone="bg-secondary/15 text-secondary" title="Четене с разбиране" text="Случаен текст с въпросите към него" count={reading} unit="текста" />
        <Section href="/exams" icon={<ScrollText className="size-8" />} tone="bg-purple/20 text-purple-dark" title="Цели матури" text="Реши минала матура (без есето) и виж резултата накрая" count={exams} unit="матури" />
      </div>
    </div>
  );
}

function Section({ href, icon, tone, title, text, count, unit = 'въпроса', children }: { href: string; icon: React.ReactNode; tone: string; title: string; text: string; count: number; unit?: string; children?: React.ReactNode }) {
  return (
    <div className="card3d rounded-2xl bg-surface p-5">
      <Link href={href} className="group flex items-center gap-4">
        <span className={`rounded-2xl p-3 ${tone}`}>{icon}</span>
        <span className="flex-1">
          <span className="block text-xl font-extrabold text-ink-strong">{title}</span>
          <span className="block text-muted">{text}</span>
          <span className="block text-xs font-extrabold text-muted">
            {count} {unit}
          </span>
        </span>
        <ChevronRight className="size-6 text-muted transition group-hover:translate-x-0.5" />
      </Link>
      {children}
    </div>
  );
}
