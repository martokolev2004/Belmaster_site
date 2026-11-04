import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { gradeLabel } from '@belmaster/shared';
import { prisma } from '@/lib/db';
import { requireTeacher, ownClass, assignmentState, questionsOf } from '@/lib/teacher';
import { Avatar, Badge, Card } from '@/components/ui';
import { ApproveAll, AssignForm, ClassSettings, MemberButtons } from '../../forms';

export const dynamic = 'force-dynamic';
const fmt = (d: Date) => d.toLocaleString('bg-BG', { timeZone: 'Europe/Sofia', dateStyle: 'short', timeStyle: 'short' });

export default async function ClassPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireTeacher();
  const c = await ownClass(user, id);
  if (!c) notFound();
  const [members, assignments, tests] = await Promise.all([
    prisma.classMember.findMany({ where: { classId: id }, include: { user: true }, orderBy: [{ status: 'desc' }, { realName: 'asc' }] }),
    prisma.assignment.findMany({ where: { classId: id }, orderBy: { opensAt: 'desc' }, include: { _count: { select: { submissions: { where: { status: 'SUBMITTED' } } } } } }),
    prisma.teacherTest.findMany({ where: { teacherId: c.teacherId }, orderBy: { updatedAt: 'desc' } }),
  ]);
  const pending = members.filter((m) => m.status === 'PENDING');
  const approved = members.filter((m) => m.status === 'APPROVED');
  const full = members.length >= c.capacity;

  return (
    <div className="space-y-6">
      <Link href="/teacher" className="inline-flex items-center gap-1 font-bold text-secondary">
        <ArrowLeft className="size-4" /> Учител
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">
            {c.name} <span className="text-lg text-muted">· {gradeLabel(c.grade)}</span>
          </h1>
          <p className="text-muted">
            {approved.length}/{c.capacity} ученици{full ? ' · класът е пълен — не приема нови' : ''}
          </p>
        </div>
        <div className="card3d rounded-2xl bg-surface px-5 py-3 text-center">
          <p className="text-xs font-extrabold uppercase text-muted">Код за влизане</p>
          <p className="font-mono text-3xl font-black tracking-[0.25em] text-ink-strong">{c.code}</p>
          <p className="text-xs text-muted">Учениците го въвеждат в „Моят клас“</p>
        </div>
      </div>

      {pending.length > 0 && (
        <Card className="border-accent! bg-accent/8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-black">Чакат одобрение ({pending.length})</h2>
            <ApproveAll classId={c.id} count={pending.length} />
          </div>
          <ul className="divide-y-2 divide-line">
            {pending.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <Avatar name={m.user.displayName} avatar={m.user.avatar} seed={m.user.id} size={36} />
                <span className="flex-1">
                  <span className="block font-extrabold text-ink-strong">{m.realName}</span>
                  <span className="block text-xs text-muted">
                    профил: {m.user.displayName}
                    {m.user.email ? ` · ${m.user.email}` : ''}
                  </span>
                </span>
                <MemberButtons classId={c.id} memberId={m.id} pendingMember />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <section className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <h2 className="mb-4 text-lg font-black">Дай тест</h2>
          <AssignForm classId={c.id} tests={tests.map((t) => ({ id: t.id, title: t.title, count: questionsOf(t).length }))} />
        </Card>
        <Card>
          <h2 className="mb-4 text-lg font-black">Настройки</h2>
          <ClassSettings classId={c.id} name={c.name} capacity={c.capacity} />
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-black">Тестове на класа</h2>
        {assignments.length === 0 ? (
          <p className="text-muted">Още няма дадени тестове.</p>
        ) : (
          <ul className="card3d divide-y-2 divide-line rounded-2xl bg-surface">
            {assignments.map((a) => {
              const st = assignmentState(a);
              return (
                <li key={a.id}>
                  <Link href={`/teacher/assignments/${a.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-surface-2">
                    <span className="min-w-0 flex-1">
                      <span className="block font-extrabold text-ink-strong">{a.title}</span>
                      <span className="block text-sm text-muted">
                        {fmt(a.opensAt)} – {fmt(a.closesAt)}
                        {a.timeLimitMin ? ` · ${a.timeLimitMin} мин` : ''} · предали {a._count.submissions}/{approved.length}
                      </span>
                    </span>
                    <Badge tone={st === 'open' ? 'green' : st === 'upcoming' ? 'blue' : 'gray'}>{st === 'open' ? 'Отворен' : st === 'upcoming' ? 'Предстои' : 'Затворен'}</Badge>
                    {!a.showResult && <Badge tone={a.releasedAt ? 'green' : 'yellow'}>{a.releasedAt ? 'Резултати пуснати' : 'Резултати скрити'}</Badge>}
                    <ChevronRight className="size-5 text-muted" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-black">Ученици ({approved.length})</h2>
        {approved.length === 0 ? (
          <p className="text-muted">Дай кода на учениците. Те влизат от „Моят клас“ с истинското си име, а ти ги одобряваш.</p>
        ) : (
          <ul className="card3d divide-y-2 divide-line rounded-2xl bg-surface">
            {approved.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                <Avatar name={m.user.displayName} avatar={m.user.avatar} seed={m.user.id} size={32} />
                <span className="flex-1">
                  <span className="font-extrabold text-ink-strong">{m.realName}</span> <span className="text-xs text-muted">({m.user.displayName})</span>
                </span>
                <MemberButtons classId={c.id} memberId={m.id} pendingMember={false} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
