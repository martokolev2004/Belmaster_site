import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { TEACHER_TYPE_LABELS, answerSummary, teacherCorrectText, type AnyAnswer } from '@belmaster/shared';
import { prisma } from '@/lib/db';
import { isAdmin } from '@/lib/auth';
import { assignmentState, finalizeExpired, maxScoreOf, needsManual, questionStats, questionsOf, requireTeacher } from '@/lib/teacher';
import { Badge, Card } from '@/components/ui';
import { cn } from '@/lib/cn';
import { DeleteAssignment, ReleaseButton } from '../../forms';
import { GradeInput } from './GradeInput';

export const dynamic = 'force-dynamic';
const fmt = (d: Date) => d.toLocaleString('bg-BG', { timeZone: 'Europe/Sofia', dateStyle: 'short', timeStyle: 'short' });

export default async function AssignmentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ s?: string }> }) {
  const { id } = await params;
  const { s: openSub } = await searchParams;
  const user = await requireTeacher();
  const a = await prisma.assignment.findUnique({ where: { id }, include: { class: true } });
  if (!a || (a.class.teacherId !== user.id && !isAdmin(user))) notFound();
  await finalizeExpired(a);
  const [members, subs] = await Promise.all([
    prisma.classMember.findMany({ where: { classId: a.classId, status: 'APPROVED' }, orderBy: { realName: 'asc' } }),
    prisma.submission.findMany({ where: { assignmentId: a.id } }),
  ]);
  const qs = questionsOf(a);
  const max = maxScoreOf(qs);
  const done = subs.filter((s) => s.status === 'SUBMITTED');
  const bySub = new Map(subs.map((s) => [s.userId, s]));
  const stats = questionStats(qs, done);
  const free = qs.filter((q) => q.type === 'FREE_TEXT');
  const ungraded = done.reduce((n, s) => n + free.filter((q) => (s.manualScores as Record<string, number>)[q.id] == null).length, 0);
  const avg = done.length ? Math.round((done.reduce((x, s) => x + s.score, 0) / done.length) * 10) / 10 : 0;
  const st = assignmentState(a);
  const hardest = [...stats].filter((x) => x.n).sort((x, y) => x.avgPct - y.avgPct).slice(0, 5);

  return (
    <div className="space-y-6">
      <Link href={`/teacher/classes/${a.classId}`} className="inline-flex items-center gap-1 font-bold text-secondary">
        <ArrowLeft className="size-4" /> {a.class.name}
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">{a.title}</h1>
          <p className="text-muted">
            {fmt(a.opensAt)} – {fmt(a.closesAt)}
            {a.timeLimitMin ? ` · таймер ${a.timeLimitMin} мин` : ''} · {qs.length} въпроса · {max} точки
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone={st === 'open' ? 'green' : st === 'upcoming' ? 'blue' : 'gray'}>{st === 'open' ? 'Отворен' : st === 'upcoming' ? 'Предстои' : 'Затворен'}</Badge>
            <Badge tone={a.showResult ? 'green' : a.releasedAt ? 'green' : 'yellow'}>
              {a.showResult ? 'Учениците виждат резултата веднага' : a.releasedAt ? `Резултатите са пуснати ${fmt(a.releasedAt)}` : 'Резултатите са скрити'}
            </Badge>
          </div>
        </div>
        {!a.showResult && <ReleaseButton assignmentId={a.id} released={!!a.releasedAt} ungraded={ungraded} />}
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Предали" value={`${done.length}/${members.length}`} />
        <Stat label="Среден резултат" value={`${avg}/${max}`} />
        <Stat label="Среден %" value={`${max ? Math.round((avg / max) * 100) : 0}%`} />
        <Stat label="За проверка" value={needsManual(qs) ? String(ungraded) : '—'} tone={ungraded ? 'text-orange' : undefined} />
      </section>

      <Card>
        <h2 className="mb-3 text-lg font-black">Ученици</h2>
        <ul className="divide-y-2 divide-line">
          {members.map((m) => {
            const s = bySub.get(m.userId);
            const opened = openSub === s?.id;
            return (
              <li key={m.id} className="py-2">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex-1 font-extrabold text-ink-strong">{m.realName}</span>
                  {!s ? (
                    <span className="text-sm text-muted">не е започнал</span>
                  ) : s.status === 'STARTED' ? (
                    <Badge tone="blue">решава сега</Badge>
                  ) : (
                    <>
                      <span className="font-black">
                        {s.score}/{max} <span className="text-sm text-muted">({max ? Math.round((s.score / max) * 100) : 0}%)</span>
                      </span>
                      {free.some((q) => (s.manualScores as Record<string, number>)[q.id] == null) && <Badge tone="yellow">за проверка</Badge>}
                      <Link href={opened ? `?` : `?s=${s.id}#sub`} scroll={false} className="text-sm font-extrabold text-secondary">
                        {opened ? 'Скрий' : 'Отговори'}
                      </Link>
                    </>
                  )}
                </div>
                {opened && s && (
                  <div id="sub" className="mt-3 space-y-3 rounded-xl bg-surface-2 p-3">
                    {qs.map((q, i) => {
                      const ans = (s.answers as Record<string, AnyAnswer>)[q.id];
                      const auto = (s.autoScores as Record<string, number>)[q.id] ?? null;
                      const man = (s.manualScores as Record<string, number>)[q.id] ?? null;
                      const pts = man ?? auto ?? 0;
                      return (
                        <div key={q.id} className={cn('rounded-xl border-2 bg-surface p-3', q.type === 'FREE_TEXT' && man == null ? 'border-accent' : pts >= q.points ? 'border-primary/40' : pts > 0 ? 'border-orange/40' : 'border-error/40')}>
                          <div className="flex flex-wrap items-start gap-3">
                            <p className="min-w-0 flex-1 font-bold">
                              {i + 1}. {q.prompt} <span className="text-xs text-muted">({TEACHER_TYPE_LABELS[q.type]})</span>
                            </p>
                            <GradeInput submissionId={s.id} questionId={q.id} max={q.points} value={man} auto={auto} />
                          </div>
                          <p className="mt-1 whitespace-pre-line text-sm">
                            <span className="font-extrabold text-muted">Отговор: </span>
                            {answerSummary(q, ans)}
                          </p>
                          {teacherCorrectText(q) && (
                            <p className="mt-1 whitespace-pre-line text-sm text-primary-dark">
                              <span className="font-extrabold">{q.type === 'FREE_TEXT' ? 'Критерии: ' : 'Вярно: '}</span>
                              {teacherCorrectText(q)}
                            </p>
                          )}
                        </div>
                      );
                    })}
                    <p className="text-xs text-muted">Празно поле = автоматичните точки. Напиши число, за да ги промениш.</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      {done.length > 0 && (
        <Card>
          <h2 className="mb-1 text-lg font-black">Най-сгрешени въпроси</h2>
          <p className="mb-3 text-sm text-muted">По среден процент точки, с най-честите грешни отговори.</p>
          <ul className="space-y-3">
            {hardest.map((x) => (
              <li key={x.id} className="rounded-xl bg-surface-2 p-3">
                <div className="flex items-start gap-3">
                  <span className={cn('rounded-lg px-2 py-0.5 text-sm font-black text-white', x.avgPct < 40 ? 'bg-error' : x.avgPct < 70 ? 'bg-orange' : 'bg-primary')}>{x.avgPct}%</span>
                  <p className="flex-1 font-bold">
                    {x.no}. {x.prompt}
                  </p>
                  <span className="text-sm text-muted">
                    изцяло вярно: {x.fullCorrect}/{x.n}
                  </span>
                </div>
                {(x.wrongAnswers.length > 0 || x.blank > 0) && (
                  <ul className="mt-2 space-y-0.5 pl-12 text-sm">
                    {x.blank > 0 && <li className="text-muted">без отговор — {x.blank} ученици</li>}
                    {x.wrongAnswers.map((w) => (
                      <li key={w.text}>
                        <span className="font-bold text-error-dark">{w.text}</span> <span className="text-muted">— {w.count} ученици</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <DeleteAssignment assignmentId={a.id} />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="card3d rounded-2xl bg-surface p-4">
      <p className="text-xs font-extrabold uppercase text-muted">{label}</p>
      <p className={cn('text-2xl font-black text-ink-strong', tone)}>{value}</p>
    </div>
  );
}
