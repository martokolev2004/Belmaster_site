import { prisma } from '@/lib/db';
import { Badge, Card } from '@/components/ui';
import { DecideTeacher } from '../../teacher/forms';

export const dynamic = 'force-dynamic';

export default async function AdminTeachersPage() {
  const [pending, approved] = await Promise.all([
    prisma.user.findMany({ where: { teacherStatus: 'PENDING' }, orderBy: { teacherAt: 'asc' } }),
    prisma.user.findMany({ where: { teacherStatus: 'APPROVED' }, orderBy: { displayName: 'asc' }, include: { _count: { select: { classesTaught: true, teacherTests: true } } } }),
  ]);
  return (
    <div className="space-y-6">
      <Card>
        <h2 className="mb-3 text-lg font-black">Заявки за учител ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="text-muted">Няма чакащи заявки.</p>
        ) : (
          <ul className="divide-y-2 divide-line">
            {pending.map((u) => (
              <li key={u.id} className="flex flex-wrap items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold text-ink-strong">
                    {u.displayName} <span className="text-sm font-bold text-muted">· {u.email}</span>
                  </p>
                  <p className="text-sm">
                    {u.teacherSchool} · {u.teacherSubject}
                    {u.teacherEmail ? ` · служебен: ${u.teacherEmail}` : ''}
                  </p>
                  {u.teacherNote && <p className="mt-1 text-sm text-muted">„{u.teacherNote}“</p>}
                  <p className="text-xs text-muted">{u.teacherAt?.toLocaleString('bg-BG', { timeZone: 'Europe/Sofia' })}</p>
                </div>
                <DecideTeacher userId={u.id} />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <h2 className="mb-3 text-lg font-black">Одобрени учители ({approved.length})</h2>
        <ul className="divide-y-2 divide-line">
          {approved.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 py-2">
              <span className="flex-1 font-bold">
                {u.displayName} <span className="text-sm text-muted">· {u.teacherSchool}</span>
              </span>
              <Badge>{u._count.classesTaught} класа</Badge>
              <Badge>{u._count.teacherTests} теста</Badge>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
