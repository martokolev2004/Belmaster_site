'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { ACHIEVEMENTS, gradeWord } from '@belmaster/shared';
import { Check, ChevronLeft, ChevronRight, Clock, Flag, Timer, X } from 'lucide-react';
import { Badge, Button, ButtonLink, Input, ProgressBar, Select, Textarea } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { Answer, ClientPassage, ClientQuestion, FinishResult, QuestionResult, TestKind } from '@/lib/quiz-types';
import { notifyProgress } from '@/components/unlocks/UnlockCelebration';
import { checkAnswerAction, finishTestAction, reportQuestionAction } from '@/app/(app)/tests/actions';

import { AnswerInput, hasAnswer as hasAnswerBase, LETTERS } from './inputs';
import { PassageText } from './PassageText';
import { ContextBox } from './ContextBox';
import { Confetti } from '@/components/game/BattleExtras';
import { play } from '@/lib/sound';
import './quiz.css';
export { LETTERS };

interface Props {
  kind: TestKind;
  examId?: string | null;
  mode: 'practice' | 'exam';
  title: string;
  questions: ClientQuestion[];
  passages: ClientPassage[];
  backHref: string;
  againHref: string;
  /** матура: минути за таймера (по избор на ученика) */
  timeLimitMin?: number;
}

function hasAnswer(q: ClientQuestion, a: Answer | undefined) {
  return hasAnswerBase(q, a);
}

export function QuizRunner({ kind, examId = null, mode, title, questions, passages, backHref, againHref, timeLimitMin }: Props) {
  // матура: начален екран, таймер
  const [started, setStarted] = useState(mode !== 'exam');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [checked, setChecked] = useState<Record<string, QuestionResult>>({});
  const [finished, setFinished] = useState<FinishResult | null>(null);
  const [pending, start] = useTransition();
  const [reportFor, setReportFor] = useState<string | null>(null);
  const [showPassage, setShowPassage] = useState(true);
  // обратна връзка: серия от поредни верни, светкавица, разтърсване
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [fx, setFx] = useState<{ k: 'ok' | 'part' | 'bad'; n: number; toast: string | null } | null>(null);

  const q = questions[idx];
  const passage = useMemo(() => passages.find((p) => p.id === q?.passageId) ?? null, [passages, q]);
  const answer = q ? answers[q.id] : undefined;
  const result = q ? checked[q.id] : undefined;
  const answeredCount = questions.filter((qq) => hasAnswer(qq, answers[qq.id])).length;

  const setAnswer = (a: Answer) => {
    if (!q || result) return;
    setAnswers((prev) => ({ ...prev, [q.id]: { ...prev[q.id], ...a } }));
  };

  const finish = (timedOut = false) =>
    start(async () => {
      const res = await finishTestAction(
        kind,
        examId,
        questions.map((qq) => ({ id: qq.id, answer: answers[qq.id] ?? {} })),
        { timeUsedSec: startedAt ? Math.round((Date.now() - startedAt) / 1000) : null, timedOut },
      );
      if ('error' in res) return;
      setFinished(res);
      window.scrollTo({ top: 0 });
      notifyProgress(1800);
    });

  const check = () =>
    start(async () => {
      if (!q) return;
      const r = await checkAnswerAction(q.id, answers[q.id] ?? {});
      if (!r) return;
      setChecked((prev) => ({ ...prev, [q.id]: r }));
      const s = r.correct ? streak + 1 : 0;
      setStreak(s);
      setBestStreak((b) => Math.max(b, s));
      play(r.correct ? 'correct' : 'wrong');
      setFx((f) => ({ k: r.correct ? 'ok' : r.score > 0 ? 'part' : 'bad', n: (f?.n ?? 0) + 1, toast: r.correct && [3, 5, 10, 15, 20].includes(s) ? `🔥 ${s} поредни верни!` : null }));
    });

  const next = () => {
    if (idx < questions.length - 1) {
      setIdx(idx + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else finish();
  };

  // таймер на матурата
  useEffect(() => {
    if (!deadline || finished) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [deadline, finished]);
  const left = deadline ? Math.max(0, deadline - now) : null;
  const firedTimeout = useRef(false);
  useEffect(() => {
    if (left === 0 && !finished && !firedTimeout.current) {
      firedTimeout.current = true;
      finish(true);
    }
  });
  // предупреждение при затваряне по време на матура
  useEffect(() => {
    if (mode !== 'exam' || !started || finished) return;
    const onLeave = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [mode, started, finished]);

  const submit = () => {
    const missing = questions.length - answeredCount;
    if (missing > 0 && !window.confirm(`Имаш ${missing} задачи без отговор. Да предам ли изпита?`)) return;
    finish();
  };

  // клавиши 1–6 за избор, Enter за проверка/напред
  useEffect(() => {
    if (finished || !q) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        if (e.key === 'Enter' && tag === 'INPUT') e.preventDefault();
        else return;
      }
      if (q.type === 'SINGLE_CHOICE' && /^[1-6]$/.test(e.key)) {
        const i = Number(e.key) - 1;
        if (i < q.options.length && !result) setAnswers((prev) => ({ ...prev, [q.id]: { index: i } }));
      }
      if (e.key === 'Enter' && mode === 'practice' && !pending) {
        if (result) next();
        else if (hasAnswer(q, answers[q.id])) check();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!questions.length) return null;
  if (!started) {
    const maxPoints = questions.reduce((s, qq) => s + qq.points, 0);
    const begin = (timed: boolean) => {
      const t = Date.now();
      setStartedAt(t);
      if (timed && timeLimitMin) setDeadline(t + timeLimitMin * 60_000);
      setStarted(true);
    };
    return (
      <div className="mx-auto max-w-xl">
        <div className="card3d rounded-3xl bg-surface p-6 text-center">
          <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-purple/20 text-purple-dark">
            <Timer className="size-9" />
          </span>
          <h2 className="mt-3 text-2xl font-black">Пробен изпит</h2>
          <p className="mt-1 text-muted">{title}</p>
          <ul className="mt-5 space-y-1.5 text-left text-sm">
            <li>📝 {questions.length} задачи · <b>{maxPoints} точки</b> (по ключа, с частични точки)</li>
            <li>✂️ Без есето и задачите със свободен текст — те не могат да се проверят автоматично.</li>
            <li>🔒 Отговорите се виждат чак след като предадеш.</li>
            <li>🎓 Накрая — точки, процент и ориентировъчна оценка.</li>
          </ul>
          <div className="mt-6 grid gap-2">
            {timeLimitMin ? (
              <Button block size="lg" onClick={() => begin(true)} icon={<Clock className="size-5" />}>
                Започни с таймер ({timeLimitMin} мин)
              </Button>
            ) : null}
            <Button block variant="outline" onClick={() => begin(false)}>
              Без таймер
            </Button>
          </div>
          {timeLimitMin ? <p className="mt-3 text-xs text-muted">Времето е пропорционално на истинския изпит (240 мин за 100 точки). Като изтече — изпитът се предава сам.</p> : null}
        </div>
      </div>
    );
  }

  if (finished) return <ResultScreen result={finished} questions={questions} answers={answers} againHref={againHref} backHref={backHref} onReport={setReportFor} reportFor={reportFor} bestStreak={mode === 'practice' ? bestStreak : null} />;

  const progress = mode === 'practice' ? ((idx + (result ? 1 : 0)) / questions.length) * 100 : (answeredCount / questions.length) * 100;

  return (
    <div className="mx-auto max-w-5xl">
      {/* Горна лента */}
      <div className="mb-6 flex items-center gap-4">
        <Link href={backHref} aria-label="Изход" className="rounded-xl p-1.5 text-muted hover:bg-surface-2">
          <X className="size-6" />
        </Link>
        {mode === 'practice' && questions.length <= 30 ? (
          <div className="qz-dots" aria-label={`Въпрос ${idx + 1} от ${questions.length}`}>
            {questions.map((qq, i) => {
              const r = checked[qq.id];
              return <i key={qq.id} data-s={r ? (r.correct ? 'ok' : r.score > 0 ? 'part' : 'bad') : i === idx ? 'now' : undefined} />;
            })}
          </div>
        ) : (
          <ProgressBar value={progress} />
        )}
        <span className="shrink-0 text-sm font-extrabold text-muted">
          {idx + 1}/{questions.length}
        </span>
        {streak >= 2 && (
          <span key={streak} className="qz-streak" title="Поредни верни отговори">
            🔥 {streak}
          </span>
        )}
        {left != null && (
          <span className={cn('flex shrink-0 items-center gap-1 rounded-xl px-2.5 py-1 font-mono text-sm font-black tabular-nums', left < 5 * 60_000 ? 'animate-pulse bg-error/15 text-error' : 'bg-surface-2 text-ink-strong')}>
            <Clock className="size-4" />
            {fmtTime(left)}
          </span>
        )}
      </div>

      <div className={cn('grid gap-6', passage && 'lg:grid-cols-2')}>
        {passage && (
          <aside className="lg:sticky lg:top-24 lg:max-h-[calc(100dvh-8rem)] lg:overflow-auto">
            <div className="card3d rounded-2xl bg-surface-2 p-5">
              <button onClick={() => setShowPassage((s) => !s)} className="flex w-full items-center justify-between text-left lg:pointer-events-none">
                <span className="font-extrabold text-ink-strong">{passage.title ?? 'Текст'}</span>
                <span className="text-sm font-bold text-secondary lg:hidden">{showPassage ? 'Скрий' : 'Покажи'}</span>
              </button>
              <div className={cn('mt-3', !showPassage && 'hidden lg:block')}>
                <PassageText text={passage.text} />
              </div>
            </div>
          </aside>
        )}

        <section key={q.id} className="animate-rise">
         <div key={fx && result ? fx.n : 0} className={fx && result ? (fx.k === 'bad' ? 'qz-shake' : fx.k === 'ok' ? 'qz-bump' : undefined) : undefined}>
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge tone="blue">{q.label}</Badge>
            {q.workTitle && <Badge tone="yellow">{q.workTitle}</Badge>}
            {mode === 'exam' && q.sourceNo && <Badge>Задача {q.sourceNo} · {q.points} {q.points === 1 ? 'точка' : 'точки'}</Badge>}
          </div>
          <h2 className="whitespace-pre-line text-xl font-extrabold leading-snug md:text-2xl">{q.prompt}</h2>
          {q.context && <ContextBox text={q.context} />}

          <div className="mt-6">
            <QuestionInput q={q} answer={answer} result={mode === 'practice' ? result : undefined} onAnswer={setAnswer} />
          </div>
         </div>

          {mode === 'exam' && (
            <div className="mt-8 flex items-center justify-between gap-3">
              <Button variant="outline" onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0} icon={<ChevronLeft className="size-5" />}>
                Назад
              </Button>
              {idx < questions.length - 1 ? (
                <Button onClick={() => setIdx(idx + 1)} variant="secondary">
                  Напред <ChevronRight className="size-5" />
                </Button>
              ) : (
                <Button onClick={submit} disabled={pending}>
                  {pending ? 'Проверка…' : 'Предай'}
                </Button>
              )}
            </div>
          )}
          {mode === 'exam' && (
            <div className="mt-6 flex flex-wrap gap-1.5">
              {questions.map((qq, i) => (
                <button
                  key={qq.id}
                  onClick={() => setIdx(i)}
                  className={cn(
                    'size-9 rounded-xl border-2 text-sm font-extrabold',
                    i === idx ? 'border-secondary bg-secondary text-white' : hasAnswer(qq, answers[qq.id]) ? 'border-primary/50 bg-primary/10 text-primary-dark' : 'border-line text-muted',
                  )}
                >
                  {i + 1}
                </button>
              ))}
              <button onClick={submit} disabled={pending} className="ml-auto rounded-xl border-2 border-primary px-3 text-sm font-extrabold text-primary-dark hover:bg-primary/10">
                Предай сега
              </button>
            </div>
          )}
        </section>
      </div>

      {/* светкавица по ръба на екрана и поздрав за серия */}
      {fx && result && <div key={`f${fx.n}`} className="qz-flash" data-k={fx.k} />}
      {fx?.toast && result && (
        <div key={`t${fx.n}`} className="qz-toast">
          {fx.toast}
        </div>
      )}

      {/* Долна лента (практика) */}
      {mode === 'practice' && (
        <div key={result ? `r${q.id}` : 'idle'} data-k={result ? (result.correct ? 'ok' : result.score > 0 ? 'part' : 'bad') : undefined} className={cn('fixed inset-x-0 bottom-0 z-40 border-t-2 md:left-64', result ? 'qz-bar' : 'border-line bg-bg')}>
          <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            {result ? (
              <div className="flex items-start gap-3">
                <span className="qz-ic" data-k={result.correct ? 'ok' : result.score > 0 ? 'part' : 'bad'}>
                  {result.correct ? <Check className="size-7" strokeWidth={3.5} /> : <X className="size-7" strokeWidth={3.5} />}
                  {result.correct &&
                    Array.from({ length: 12 }, (_, i) => {
                      const a = (i / 12) * Math.PI * 2;
                      return <b key={i} style={{ '--dx': `${Math.cos(a) * 52}px`, '--dy': `${Math.sin(a) * 52}px`, '--c': ['#ffd166', '#fff', '#9be564'][i % 3] } as React.CSSProperties} />;
                    })}
                </span>
                <div>
                  <p className="text-xl font-black text-white">
                    {result.correct ? (streak >= 3 ? `Вярно! ${streak} поредни` : 'Вярно!') : result.score > 0 ? `Частично вярно (${Math.round(result.score * 100)}%)` : 'Грешно'}
                  </p>
                  {!result.correct && <p className="font-bold text-white/90">Верен отговор: {correctAnswerText(q, result)}</p>}
                  {result.explanation && <p className="mt-1 text-sm text-white/80">{result.explanation}</p>}
                  <button onClick={() => setReportFor(q.id)} className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-white/60 hover:underline">
                    <Flag className="size-3" /> Докладвай въпроса
                  </button>
                </div>
              </div>
            ) : (
              <span className="hidden text-sm text-muted sm:block">Натисни Enter, за да провериш.</span>
            )}
            {result ? (
              <Button onClick={next} variant={result.correct ? 'primary' : 'danger'} size="lg" className="sm:min-w-44" disabled={pending}>
                {idx < questions.length - 1 ? 'Продължи' : pending ? 'Край…' : 'Край'}
              </Button>
            ) : (
              <Button onClick={check} size="lg" className="sm:min-w-44" disabled={!hasAnswer(q, answer) || pending}>
                {pending ? '…' : 'Провери'}
              </Button>
            )}
          </div>
        </div>
      )}
      {mode === 'practice' && <div className="h-40" />}
      {reportFor && <ReportDialog questionId={reportFor} onClose={() => setReportFor(null)} />}
    </div>
  );
}

export function correctAnswerText(q: ClientQuestion, r: QuestionResult): string {
  if (q.type === 'SINGLE_CHOICE' && r.correctIndex != null) return `${LETTERS[r.correctIndex]}) ${q.options[r.correctIndex]}`;
  if (q.type === 'SHORT_ANSWER') return q.answerCount > 1 ? `${q.answerCount} от: ${r.correctText ?? ''}` : r.correctText ?? '';
  if (q.type === 'MATCHING' && r.correctPairs) return r.correctPairs.map((p, i) => `${i + 1} → ${LETTERS[p]}`).join(', ');
  if (q.type === 'FILL_BLANKS' && r.correctBlanks && q.blanks)
    return r.correctBlanks.map((c, i) => `(${q.blanks!.blanks[i].label}) ${q.blanks!.blanks[i].options[c]}`).join(', ');
  if (q.type === 'PUNCTUATION') return r.correctFull ?? '';
  return '';
}

export function QuestionInput({ q, answer, result, onAnswer }: { q: ClientQuestion; answer?: Answer; result?: QuestionResult; onAnswer: (a: Answer) => void }) {
  return (
    <AnswerInput
      q={q}
      value={answer}
      onChange={onAnswer}
      disabled={!!result}
      autoFocus
      reveal={result ? { correctIndex: result.correctIndex, correctPairs: result.correctPairs, correctBlanks: result.correctBlanks, correctMarks: result.correctMarks } : null}
    />
  );
}

/** Число, което „се навива“ от 0 до стойността. */
function useCountUp(target: number, ms = 1400, delay = 250) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now() + delay;
    const tick = (now: number) => {
      const k = Math.max(0, Math.min(1, (now - t0) / ms));
      setV(target * (1 - (1 - k) ** 3));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, delay]);
  return v;
}

function ResultScreen({
  result,
  questions,
  answers,
  againHref,
  backHref,
  onReport,
  reportFor,
  bestStreak,
}: {
  result: FinishResult;
  questions: ClientQuestion[];
  answers: Record<string, Answer>;
  againHref: string;
  backHref: string;
  onReport: (id: string | null) => void;
  reportFor: string | null;
  bestStreak: number | null;
}) {
  const ex = result.exam;
  const pct = ex ? Math.round((ex.points / Math.max(1, ex.maxPoints)) * 100) : result.total ? Math.round((result.score / result.total) * 100) : 0;
  const byId = new Map(result.results.map((r) => [r.id, r]));
  const wrong = questions.filter((q) => byId.get(q.id) && !byId.get(q.id)!.correct);
  const right = result.results.filter((r) => r.correct).length;
  const [tab, setTab] = useState<'wrong' | 'all'>(wrong.length ? 'wrong' : 'all');
  const shownPct = useCountUp(pct);
  const shownGrade = useCountUp(ex ? ex.grade - 2 : 0);
  const shownXp = useCountUp(result.xpEarned, 1000, 900);
  const done = Math.round(shownPct) === pct;
  const tone = pct >= 80 ? '#58cc02' : pct >= 50 ? '#ffb020' : '#ff4b5f';
  const C = 2 * Math.PI * 54;
  useEffect(() => {
    const t = setTimeout(() => play(pct >= 50 ? 'win' : 'lose'), 1500);
    return () => clearTimeout(t);
  }, [pct]);
  const list = tab === 'wrong' ? wrong : questions;
  return (
    <div className="mx-auto max-w-3xl">
      {pct >= 80 && done && <Confetti />}
      <div className="qz-end animate-rise">
        <div className="qz-ring" data-done={done}>
          <svg viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="54" stroke="rgba(255,255,255,.1)" />
            <circle cx="60" cy="60" r="54" stroke={tone} strokeDasharray={C} strokeDashoffset={C * (1 - shownPct / 100)} style={{ filter: `drop-shadow(0 0 8px ${tone})` }} />
          </svg>
          <div className="qz-ring-in">
            <b className="ln-display">{ex ? (2 + shownGrade).toFixed(2) : `${Math.round(shownPct)}%`}</b>
            <small>{ex ? gradeWord(ex.grade) : `${right} от ${result.results.length} верни`}</small>
          </div>
        </div>
        <h1 className="ln-display mt-5 text-3xl">{pct >= 80 ? 'Страхотно!' : pct >= 50 ? 'Добра работа!' : 'Продължавай да учиш!'}</h1>
        {ex ? (
          <>
            {ex.timedOut && <p className="mt-1 font-bold text-error">Времето изтече — изпитът беше предаден автоматично.</p>}
            <p className="mt-2 text-lg font-extrabold text-white">
              {ex.points} от {ex.maxPoints} точки · {Math.round(shownPct)}%
            </p>
            <p className="mx-auto mt-2 max-w-md text-xs text-muted">
              Оценката е само ориентир: смятана е от процента точки без есето и задачите със свободен текст ({100 - ex.maxPoints} от 100 точки на истинската матура).
              {ex.timeUsedSec != null && ` Време: ${fmtTime(ex.timeUsedSec * 1000)}.`}
            </p>
          </>
        ) : (
          <p className="mt-1 text-muted">
            {Number.isInteger(result.score) ? result.score : result.score.toFixed(1)} от {result.total} точки
          </p>
        )}
      </div>
      <div className="qz-stats">
        <div className="nx-panel qz-stat" style={{ '--c': '#ffd166' } as React.CSSProperties}>
          <span>XP</span>
          <b>+{Math.round(shownXp)}</b>
        </div>
        <div className="nx-panel qz-stat" style={{ '--c': '#ff9d3c', animationDelay: '.08s' } as React.CSSProperties}>
          <span>Серия</span>
          <b>{result.streak} дни</b>
        </div>
        <div className="nx-panel qz-stat" style={{ '--c': '#6ea2ff', animationDelay: '.16s' } as React.CSSProperties}>
          <span>Ниво</span>
          <b>
            {result.level}
            {result.leveledUp ? ' ↑' : ''}
          </b>
        </div>
        <div className="nx-panel qz-stat" style={{ '--c': '#5fe0d0', animationDelay: '.24s' } as React.CSSProperties}>
          <span>{bestStreak != null ? 'Поредни верни' : 'Верни'}</span>
          <b>{bestStreak != null ? `🔥 ${bestStreak}` : `${right}/${result.results.length}`}</b>
        </div>
      </div>
      {result.unlocked.length > 0 && (
        <div className="mt-4 rounded-2xl border-2 border-accent bg-accent/15 p-4 text-center font-extrabold">
          🏅 Ново постижение: {result.unlocked.map((c) => ACHIEVEMENTS.find((a) => a.code === c)?.name).join(', ')}
        </div>
      )}
      {result.mistakesCount > 0 && (
        <a href="/tests/mistakes" className="mt-4 flex items-center justify-between rounded-2xl border-2 border-error/40 bg-error/10 px-4 py-3 font-extrabold text-error-dark hover:bg-error/15">
          <span>🔁 Упражни грешките си</span>
          <span className="rounded-full bg-error px-2.5 py-0.5 text-sm text-white">{result.mistakesCount}</span>
        </a>
      )}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <ButtonLink href={againHref} block size="lg">
          {ex ? 'Реши отново' : 'Нов тест'}
        </ButtonLink>
        <ButtonLink href={backHref} variant="outline" block size="lg">
          Към тестовете
        </ButtonLink>
      </div>

      <div className="mb-3 mt-10 flex flex-wrap items-center justify-between gap-3">
        <h2 className="ln-display text-xl">Разбор</h2>
        <div className="qz-tabs">
          {wrong.length > 0 && (
            <button data-on={tab === 'wrong'} onClick={() => setTab('wrong')}>
              Грешни · {wrong.length}
            </button>
          )}
          <button data-on={tab === 'all'} onClick={() => setTab('all')}>
            Всички · {questions.length}
          </button>
        </div>
      </div>
      {wrong.length === 0 && <p className="mb-3 font-bold text-primary">Нито една грешка — браво!</p>}
      <ol className="space-y-3">
        {list.map((q, n) => {
          const r = byId.get(q.id);
          if (!r) return null;
          const a = answers[q.id];
          const i = questions.indexOf(q);
          return (
            <li key={q.id} className="nx-panel qz-rev" style={{ '--c': r.correct ? '#58cc02' : r.score > 0 ? '#ff9d3c' : '#ff4b5f', animationDelay: `${Math.min(n, 8) * 0.04}s` } as React.CSSProperties}>
              <div className="flex items-start gap-3">
                <span className={cn('mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-white', r.correct ? 'bg-primary' : r.score > 0 ? 'bg-orange' : 'bg-error')}>
                  {r.correct ? <Check className="size-4" strokeWidth={3} /> : r.score > 0 ? <span className="text-[10px] font-black">{Math.round(r.score * 100)}%</span> : <X className="size-4" strokeWidth={3} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="qz-q whitespace-pre-line">
                    {i + 1}. {q.prompt}
                  </p>
                  {!r.correct && (
                    <p className="qz-row" data-k="you">
                      <small>Ти</small>
                      <span>{yourAnswerText(q, a) || 'без отговор'}</span>
                    </p>
                  )}
                  <p className="qz-row" data-k="ok">
                    <small>Верен</small>
                    <span>{correctAnswerText(q, r)}</span>
                  </p>
                  {r.explanation && <p className="mt-2 text-sm text-muted">{r.explanation}</p>}
                  <button onClick={() => onReport(q.id)} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-muted hover:underline">
                    <Flag className="size-3" /> Докладвай
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      {reportFor && <ReportDialog questionId={reportFor} onClose={() => onReport(null)} />}
    </div>
  );
}

function yourAnswerText(q: ClientQuestion, a?: Answer) {
  if (!a) return '';
  if (q.type === 'SINGLE_CHOICE' && a.index != null) return `${LETTERS[a.index]}) ${q.options[a.index]}`;
  if (q.type === 'SHORT_ANSWER') return q.answerCount > 1 ? (a.texts ?? []).filter(Boolean).join('; ') : a.text ?? '';
  if (q.type === 'MATCHING' && a.pairs) return a.pairs.map((p, i) => `${i + 1} → ${p == null ? '—' : LETTERS[p]}`).join(', ');
  if (q.type === 'FILL_BLANKS' && a.blanks && q.blanks)
    return a.blanks.map((c, i) => `(${q.blanks!.blanks[i].label}) ${c == null ? '—' : q.blanks!.blanks[i].options[c]}`).join(', ');
  if (q.type === 'PUNCTUATION') return a.text ?? '';
  return '';
}

const REASONS = ['Грешен верен отговор', 'Грешка в условието', 'Неясен въпрос', 'Друго'];

export function ReportDialog({ questionId, onClose }: { questionId: string; onClose: () => void }) {
  const [reason, setReason] = useState(REASONS[0]);
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={onClose}>
      <div className="card3d w-full max-w-md animate-pop rounded-3xl bg-surface p-6" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
        {done ? (
          <div className="text-center">
            <p className="text-xl font-black">Благодарим! 🙏</p>
            <p className="mt-1 text-muted">Ще прегледаме въпроса.</p>
            <Button className="mt-5" onClick={onClose} block>
              Затвори
            </Button>
          </div>
        ) : (
          <>
            <h3 className="mb-4 text-xl font-black">Какво не е наред?</h3>
            <div className="space-y-2">
              {REASONS.map((r) => (
                <label key={r} className={cn('card3d flex cursor-pointer items-center gap-3 rounded-xl p-3 font-bold', reason === r && 'border-secondary! bg-secondary/10')}>
                  <input type="radio" checked={reason === r} onChange={() => setReason(r)} className="accent-secondary" /> {r}
                </label>
              ))}
            </div>
            <Textarea className="mt-3" placeholder="Подробности (по желание)" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} />
            <div className="mt-4 flex gap-2">
              <Button variant="ghost" onClick={onClose} block>
                Отказ
              </Button>
              <Button
                block
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await reportQuestionAction(questionId, reason, message);
                    setDone(true);
                  })
                }
              >
                Изпрати
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function fmtTime(ms: number) {
  const t = Math.ceil(ms / 1000);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = t % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0');
  return `${h ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
}
