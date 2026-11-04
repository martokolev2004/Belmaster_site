import Link from 'next/link';
import { ChevronRight, School } from 'lucide-react';
import { gradeLabel } from '@belmaster/shared';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { assignmentState, isTeacher, maxScoreOf, questionsOf } from '@/lib/teacher';
import { Alert, Badge, ButtonLink, Card, PageHeader } from '@/components/ui';
import { JoinForm, LeaveButton } from './JoinForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Моят клас' };
const fmt = (d: Date) => d.toLocaleString('bg-BG', { timeZone: 'Europe/Sofia', dateStyle: 'short', timeStyle: 'short' });

export default async function MyClassPage() {
  const user = await requireUser();
  const m = await prisma.classMember.findUnique({ where: { userId: user.id }, include: { class: { include: { teacher: true } } } });

  if (!m) {
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader title="Моят клас" subtitle="Влез в класа на учителя си с кода, който ти е дал." />
        {user.isGuest ? (
          <Alert tone="blue">Гостите не могат да влизат в клас — направи си профил.</Alert>
        ) : (
          <Card>
            <JoinForm />
          </Card>
        )}
        {isTeacher(user) && (
          <p className="mt-4 text-sm text-muted">
            Ти си учител — класовете си управляваш от <Link href="/teacher" className="font-bold text-secondary">„Учител“</Link>.
          </p>
        )}
      </div>
    );
  }

  const c = m.class;
  const teacherName = c.teacher.displayName;
  if (m.status === 'PENDING') {
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader title="Моят клас" />
        <Card>
          <p className="text-lg font-extrabold text-ink-strong">⏳ Чакаш одобрение</p>
          <p className="mt-1 text-muted">
            Клас {c.name} · учител {teacherName}. Ще получиш известие, когато те приеме.
          </p>
          <div className="mt-3">
            <LeaveButton pendingOnly />
          </div>
        </Card>
      </div>
    );
  }

  const [assignments, subs] = await Promise.all([
    prisma.assignment.findMany({ where: { classId: c.id }, orderBy: { opensAt: 'desc' } }),
    prisma.submission.findMany({ where: { userId: user.id, assignment: { classId: c.id } } }),
  ]);
  const bySub = new Map(subs.map((s) => [s.assignmentId, s]));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={`Клас ${c.name}`} subtitle={`${gradeLabel(c.grade)} · учител ${teacherName} · ти си ${m.realName}`} />
      {assignments.length === 0 ? (
        <Card className="text-center">
          <School className="mx-auto size-10 text-muted" />
          <p className="mt-2 text-muted">Учителят още не е дал тестове.</p>
        </Card>
      ) : (
        <ul className="card3d divide-y-2 divide-line rounded-2xl bg-surface">
          {assignments.map((a) => {
            const st = assignmentState(a);
            const s = bySub.get(a.id);
            const max = maxScoreOf(questionsOf(a));
            const visible = s?.status === 'SUBMITTED' && (a.showResult || a.releasedAt);
            return (
              <li key={a.id}>
                <Link href={`/class/${a.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-surface-2">
                  <span className="min-w-0 flex-1">
                    <span className="block font-extrabold text-ink-strong">{a.title}</span>
                    <span className="block text-sm text-muted">
                      {st === 'upcoming' ? `Отваря се ${fmt(a.opensAt)}` : `До ${fmt(a.closesAt)}`}
                      {a.timeLimitMin ? ` · ${a.timeLimitMin} мин` : ''}
                    </span>
                  </span>
                  {s?.status === 'SUBMITTED' ? (
                    visible ? <Badge tone="green">{s.score}/{max}</Badge> : <Badge tone="yellow">Предаден · чака проверка</Badge>
                  ) : s ? (
                    st === 'open' ? <Badge tone="blue">Продължи</Badge> : <Badge>Изтекъл</Badge>
                  ) : st === 'open' ? (
                    <Badge tone="green">Реши</Badge>
                  ) : st === 'upcoming' ? (
                    <Badge tone="blue">Предстои</Badge>
                  ) : (
                    <Badge>Пропуснат</Badge>
                  )}
                  <ChevronRight className="size-5 text-muted" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <LeaveButton pendingOnly={false} />
      {!assignments.length && <ButtonLink href="/tests" variant="outline">Към мини тестовете</ButtonLink>}
    </div>
  );
}
