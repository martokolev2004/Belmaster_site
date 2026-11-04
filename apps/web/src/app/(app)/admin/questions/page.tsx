import Link from 'next/link';
import { GRADES, SECTION_LABELS, TOPIC_LABELS, gradeLabel, isGrade } from '@belmaster/shared';
import type { Prisma } from '@belmaster/db';
import { prisma } from '@/lib/db';
import { Badge, ButtonLink, Input, Select } from '@/components/ui';

const PAGE = 50;
const STATUS_LABEL = { ACTIVE: 'активен', DRAFT: 'непроверен', HIDDEN: 'скрит' } as const;

export default async function AdminQuestions({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const where: Prisma.QuestionWhereInput = {};
  if (isGrade(sp.grade)) where.grade = sp.grade;
  if (sp.section && sp.section in SECTION_LABELS) where.section = sp.section as keyof typeof SECTION_LABELS;
  if (sp.status && sp.status in STATUS_LABEL) where.status = sp.status as keyof typeof STATUS_LABEL;
  if (sp.work) where.workId = sp.work;
  if (sp.exam) where.examId = sp.exam;
  if (sp.q) where.prompt = { contains: sp.q, mode: 'insensitive' };
  const page = Math.max(1, Number(sp.page) || 1);
  const [total, rows] = await Promise.all([
    prisma.question.count({ where }),
    prisma.question.findMany({
      where,
      include: { work: true, exam: true },
      orderBy: [{ updatedAt: 'desc' }],
      skip: (page - 1) * PAGE,
      take: PAGE,
    }),
  ]);
  const qs = (p: number) => {
    const u = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
    u.set('page', String(p));
    return `?${u}`;
  };

  return (
    <div>
      <form className="mb-4 grid gap-2 md:grid-cols-[1fr_auto_auto_auto_auto]">
        <Input name="q" defaultValue={sp.q} placeholder="Търси в условието…" />
        <Select name="grade" defaultValue={sp.grade ?? ''}>
          <option value="">Всички класове</option>
          {GRADES.map((g) => (
            <option key={g.code} value={g.code}>
              {g.label}
            </option>
          ))}
        </Select>
        <Select name="section" defaultValue={sp.section ?? ''}>
          <option value="">Всички раздели</option>
          {Object.entries(SECTION_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <Select name="status" defaultValue={sp.status ?? ''}>
          <option value="">Всеки статус</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <button className="rounded-2xl bg-secondary px-5 font-extrabold text-white">Филтрирай</button>
      </form>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold text-muted">{total} въпроса</p>
        <ButtonLink href="/admin/questions/new" size="sm">
          + Нов въпрос
        </ButtonLink>
      </div>
      <ul className="card3d divide-y-2 divide-line rounded-2xl bg-surface">
        {rows.map((q) => (
          <li key={q.id}>
            <Link href={`/admin/questions/${q.id}`} className="block px-4 py-3 hover:bg-surface-2">
              <p className="line-clamp-2 font-bold text-ink-strong">{q.prompt}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Badge>{gradeLabel(q.grade)}</Badge>
                <Badge tone="blue">{q.topic ? TOPIC_LABELS[q.topic] : SECTION_LABELS[q.section]}</Badge>
                {q.type !== 'SINGLE_CHOICE' && <Badge tone="purple">{({ SHORT_ANSWER: 'кратък отговор', MATCHING: 'свързване', FILL_BLANKS: 'празни места', PUNCTUATION: 'пунктуация' } as Record<string, string>)[q.type]}</Badge>}
                {q.work && <Badge tone="yellow">{q.work.title}</Badge>}
                {q.exam && <Badge>{q.exam.title}{q.sourceNo ? ` · №${q.sourceNo}` : ''}</Badge>}
                {q.status !== 'ACTIVE' && <Badge tone="red">{STATUS_LABEL[q.status]}</Badge>}
                {q.timesAsked > 0 && <Badge tone="green">{Math.round((q.timesCorrect / q.timesAsked) * 100)}% верни ({q.timesAsked})</Badge>}
              </div>
            </Link>
          </li>
        ))}
        {rows.length === 0 && <li className="px-4 py-8 text-center text-muted">Няма въпроси.</li>}
      </ul>
      {total > PAGE && (
        <div className="mt-4 flex justify-center gap-2">
          {page > 1 && <Link href={qs(page - 1)} className="rounded-xl bg-surface-2 px-4 py-2 font-bold">← Назад</Link>}
          <span className="px-3 py-2 font-bold text-muted">
            {page} / {Math.ceil(total / PAGE)}
          </span>
          {page * PAGE < total && <Link href={qs(page + 1)} className="rounded-xl bg-surface-2 px-4 py-2 font-bold">Напред →</Link>}
        </div>
      )}
    </div>
  );
}
