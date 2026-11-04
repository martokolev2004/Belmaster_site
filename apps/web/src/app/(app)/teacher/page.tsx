import Link from 'next/link';
import { ChevronRight, ClipboardList, Plus, Users } from 'lucide-react';
import { gradeLabel } from '@belmaster/shared';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { isTeacher, questionsOf } from '@/lib/teacher';
import { Alert, ButtonLink, Card, PageHeader } from '@/components/ui';
import { CreateClassForm, TeacherRequestForm, TestRowActions } from './forms';

export const metadata = { title: 'Учител' };

export default async function TeacherPage() {
  const user = await requireUser({ allowNoGrade: true });

  if (!isTeacher(user)) {
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader title="Учителски режим" subtitle="Прави класове, давай тестове и виж резултатите на учениците си." />
        {user.isGuest ? (
          <Alert tone="blue">Първо си направи профил — гостите не могат да бъдат учители.</Alert>
        ) : user.teacherStatus === 'PENDING' ? (
          <Card>
            <p className="text-lg font-extrabold text-ink-strong">⏳ Заявката ти се проверява</p>
            <p className="mt-1 text-muted">
              {user.teacherSchool} · {user.teacherSubject}. Ще получиш известие, когато бъде одобрена.
            </p>
          </Card>
        ) : (
          <Card>
            {user.teacherStatus === 'REJECTED' && (
              <div className="mb-4">
                <Alert>Предишната ти заявка беше отказана. Можеш да пратиш нова с повече информация.</Alert>
              </div>
            )}
            <h2 className="mb-1 text-lg font-black">Аз съм учител</h2>
            <p className="mb-4 text-sm text-muted">Всяка заявка се проверява ръчно, за да не могат ученици да се представят за учители.</p>
            <TeacherRequestForm />
          </Card>
        )}
      </div>
    );
  }

  const [classes, tests] = await Promise.all([
    prisma.schoolClass.findMany({
      where: { teacherId: user.id },
      orderBy: { createdAt: 'desc' },
      include: { members: { select: { status: true } }, _count: { select: { assignments: true } } },
    }),
    prisma.teacherTest.findMany({ where: { teacherId: user.id }, orderBy: { updatedAt: 'desc' }, include: { _count: { select: { assignments: true } } } }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader title="Учител" subtitle={[user.teacherSchool, user.teacherSubject].filter(Boolean).join(' · ') || 'Твоите класове и тестове'} />

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-xl font-black">
          <Users className="size-5" /> Моите класове
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {classes.map((c) => {
            const approved = c.members.filter((m) => m.status === 'APPROVED').length;
            const waiting = c.members.length - approved;
            return (
              <Link key={c.id} href={`/teacher/classes/${c.id}`} className="card3d group flex items-center gap-4 rounded-2xl bg-surface p-4 hover:bg-surface-2">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-secondary/15 text-lg font-black text-secondary">{c.name.slice(0, 3)}</span>
                <span className="flex-1">
                  <span className="block font-extrabold text-ink-strong">
                    {c.name} · {gradeLabel(c.grade)}
                  </span>
                  <span className="block text-sm text-muted">
                    {approved}/{c.capacity} ученици · {c._count.assignments} теста
                  </span>
                </span>
                {waiting > 0 && <span className="rounded-full bg-error px-2.5 py-0.5 text-sm font-black text-white">{waiting} чакат</span>}
                <ChevronRight className="size-5 text-muted" />
              </Link>
            );
          })}
        </div>
        <Card className="mt-3">
          <h3 className="mb-3 font-extrabold">Нов клас</h3>
          <CreateClassForm />
        </Card>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-xl font-black">
            <ClipboardList className="size-5" /> Моите тестове
          </h2>
          <ButtonLink href="/teacher/tests/new" size="sm" icon={<Plus className="size-4" />}>
            Нов тест
          </ButtonLink>
        </div>
        {tests.length === 0 ? (
          <p className="text-muted">Още нямаш тестове. Направи тест с редактора — сам пишеш въпросите или избираш от матурите.</p>
        ) : (
          <ul className="card3d divide-y-2 divide-line rounded-2xl bg-surface">
            {tests.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Link href={`/teacher/tests/${t.id}`} className="min-w-0 flex-1">
                  <span className="block font-extrabold text-ink-strong hover:underline">{t.title}</span>
                  <span className="block text-sm text-muted">
                    {gradeLabel(t.grade)} · {questionsOf(t).length} въпроса · {questionsOf(t).reduce((s, q) => s + q.points, 0)} точки · дадено {t._count.assignments} пъти
                  </span>
                </Link>
                <TestRowActions testId={t.id} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
