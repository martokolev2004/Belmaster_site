'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import type { AnyAnswer, PublicTeacherQuestion } from '@belmaster/shared';
import { Badge, Button, ProgressBar } from '@/components/ui';
import { AnswerInput, hasAnswer } from '@/components/quiz/inputs';
import { ContextBox } from '@/components/quiz/ContextBox';
import { cn } from '@/lib/cn';
import { saveAnswersAction, startAssignmentAction, submitAssignmentAction } from '../actions';

export function StartButton({ assignmentId }: { assignmentId: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  return (
    <>
      <Button
        size="lg"
        block
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await startAssignmentAction(assignmentId);
            if (r.error) setErr(r.error);
            router.refresh();
          })
        }
      >
        {pending ? '…' : 'Започни'}
      </Button>
      {err && <p className="mt-2 text-sm font-bold text-error">{err}</p>}
    </>
  );
}

function fmt(ms: number) {
  const t = Math.ceil(ms / 1000);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(s).padStart(2, '0')}`;
}

export function AssignmentRunner({
  assignmentId,
  questions,
  initialAnswers,
  deadline,
  serverNow,
  showTimer,
}: {
  assignmentId: string;
  questions: PublicTeacherQuestion[];
  initialAnswers: Record<string, AnyAnswer>;
  deadline: number;
  serverNow: number;
  showTimer: boolean;
}) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState(initialAnswers);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const [offset] = useState(() => serverNow - Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [pending, start] = useTransition();
  const router = useRouter();
  const dirty = useRef(false);
  const latest = useRef(answers);
  latest.current = answers;
  const submitted = useRef(false);

  const q = questions[idx];
  const left = Math.max(0, deadline - (now + offset));
  const answered = questions.filter((x) => hasAnswer(x as never, answers[x.id])).length;

  // автоматично запазване на всеки 4 секунди при промяна
  useEffect(() => {
    const t = setInterval(async () => {
      if (!dirty.current) return;
      dirty.current = false;
      setSaveState('saving');
      const r = await saveAnswersAction(assignmentId, latest.current).catch(() => ({ ok: false }));
      setSaveState(r.ok ? 'saved' : 'error');
    }, 4000);
    return () => clearInterval(t);
  }, [assignmentId]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const submit = (force = false) => {
    if (submitted.current) return;
    const missing = questions.length - answered;
    if (!force && missing > 0 && !window.confirm(`Имаш ${missing} въпроса без отговор. Да предам ли теста? Имаш само един опит.`)) return;
    if (!force && missing === 0 && !window.confirm('Да предам ли теста? Имаш само един опит.')) return;
    submitted.current = true;
    start(async () => {
      await submitAssignmentAction(assignmentId, latest.current);
      router.refresh();
    });
  };

  useEffect(() => {
    if (left === 0) submit(true);
  });

  useEffect(() => {
    const on = (e: BeforeUnloadEvent) => {
      if (submitted.current) return;
      void saveAnswersAction(assignmentId, latest.current);
      e.preventDefault();
    };
    window.addEventListener('beforeunload', on);
    return () => window.removeEventListener('beforeunload', on);
  }, [assignmentId]);

  const set = (a: AnyAnswer) => {
    dirty.current = true;
    setAnswers((p) => ({ ...p, [q.id]: { ...p[q.id], ...a } }));
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center gap-4">
        <ProgressBar value={(answered / questions.length) * 100} />
        <span className="shrink-0 text-sm font-extrabold text-muted">
          {idx + 1}/{questions.length}
        </span>
        {showTimer && (
          <span className={cn('flex shrink-0 items-center gap-1 rounded-xl px-2.5 py-1 font-mono text-sm font-black tabular-nums', left < 5 * 60_000 ? 'animate-pulse bg-error/15 text-error' : 'bg-surface-2 text-ink-strong')}>
            <Clock className="size-4" /> {fmt(left)}
          </span>
        )}
      </div>

      <section key={q.id} className="animate-rise">
        <div className="mb-3 flex flex-wrap gap-2">
          <Badge>
            {q.points} {q.points === 1 ? 'точка' : 'точки'}
          </Badge>
          <span className="text-xs font-bold text-muted">{saveState === 'saving' ? 'Запазване…' : saveState === 'error' ? '⚠ Не се запази — провери интернета' : 'Запазено'}</span>
        </div>
        <h2 className="whitespace-pre-line text-xl font-extrabold leading-snug md:text-2xl">{q.prompt}</h2>
        {q.context && q.type !== 'FILL_BLANKS' && <ContextBox text={q.context} />}
        <div className="mt-6">
          <AnswerInput q={q as never} value={answers[q.id]} onChange={set} />
        </div>
      </section>

      <div className="mt-8 flex items-center justify-between gap-3">
        <Button variant="outline" onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0} icon={<ChevronLeft className="size-5" />}>
          Назад
        </Button>
        {idx < questions.length - 1 ? (
          <Button variant="secondary" onClick={() => setIdx(idx + 1)}>
            Напред <ChevronRight className="size-5" />
          </Button>
        ) : (
          <Button onClick={() => submit()} disabled={pending}>
            {pending ? 'Предаване…' : 'Предай'}
          </Button>
        )}
      </div>
      <div className="mt-6 flex flex-wrap gap-1.5">
        {questions.map((x, i) => (
          <button
            key={x.id}
            onClick={() => setIdx(i)}
            className={cn(
              'size-9 rounded-xl border-2 text-sm font-extrabold',
              i === idx ? 'border-secondary bg-secondary text-white' : hasAnswer(x as never, answers[x.id]) ? 'border-primary/50 bg-primary/10 text-primary-dark' : 'border-line text-muted',
            )}
          >
            {i + 1}
          </button>
        ))}
        <button onClick={() => submit()} disabled={pending} className="ml-auto rounded-xl border-2 border-primary px-3 text-sm font-extrabold text-primary-dark hover:bg-primary/10">
          Предай сега
        </button>
      </div>
    </div>
  );
}
