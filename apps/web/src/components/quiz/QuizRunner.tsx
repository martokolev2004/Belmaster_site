'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { ACHIEVEMENTS } from '@belmaster/shared';
import { Check, ChevronLeft, ChevronRight, Flag, Flame, Gem, Trophy, X } from 'lucide-react';
import { Badge, Button, ButtonLink, Input, ProgressBar, Select, Textarea } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { Answer, ClientPassage, ClientQuestion, FinishResult, QuestionResult, TestKind } from '@/lib/quiz-types';
import { checkAnswerAction, finishTestAction, reportQuestionAction } from '@/app/(app)/tests/actions';

import { AnswerInput, hasAnswer as hasAnswerBase, LETTERS } from './inputs';
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
}

function hasAnswer(q: ClientQuestion, a: Answer | undefined) {
  return hasAnswerBase(q, a);
}

export function QuizRunner({ kind, examId = null, mode, title, questions, passages, backHref, againHref }: Props) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [checked, setChecked] = useState<Record<string, QuestionResult>>({});
  const [finished, setFinished] = useState<FinishResult | null>(null);
  const [pending, start] = useTransition();
  const [reportFor, setReportFor] = useState<string | null>(null);
  const [showPassage, setShowPassage] = useState(true);

  const q = questions[idx];
  const passage = useMemo(() => passages.find((p) => p.id === q?.passageId) ?? null, [passages, q]);
  const answer = q ? answers[q.id] : undefined;
  const result = q ? checked[q.id] : undefined;
  const answeredCount = questions.filter((qq) => hasAnswer(qq, answers[qq.id])).length;

  const setAnswer = (a: Answer) => {
    if (!q || result) return;
    setAnswers((prev) => ({ ...prev, [q.id]: { ...prev[q.id], ...a } }));
  };

  const finish = () =>
    start(async () => {
      const res = await finishTestAction(
        kind,
        examId,
        questions.map((qq) => ({ id: qq.id, answer: answers[qq.id] ?? {} })),
      );
      if ('error' in res) return;
      setFinished(res);
      window.scrollTo({ top: 0 });
    });

  const check = () =>
    start(async () => {
      if (!q) return;
      const r = await checkAnswerAction(q.id, answers[q.id] ?? {});
      if (r) setChecked((prev) => ({ ...prev, [q.id]: r }));
    });

  const next = () => {
    if (idx < questions.length - 1) {
      setIdx(idx + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else finish();
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
  if (finished) return <ResultScreen result={finished} questions={questions} answers={answers} againHref={againHref} backHref={backHref} onReport={setReportFor} reportFor={reportFor} />;

  const progress = mode === 'practice' ? ((idx + (result ? 1 : 0)) / questions.length) * 100 : (answeredCount / questions.length) * 100;

  return (
    <div className="mx-auto max-w-5xl">
      {/* Горна лента */}
      <div className="mb-6 flex items-center gap-4">
        <Link href={backHref} aria-label="Изход" className="rounded-xl p-1.5 text-muted hover:bg-surface-2">
          <X className="size-6" />
        </Link>
        <ProgressBar value={progress} />
        <span className="shrink-0 text-sm font-extrabold text-muted">
          {idx + 1}/{questions.length}
        </span>
      </div>

      <div className={cn('grid gap-6', passage && 'lg:grid-cols-2')}>
        {passage && (
          <aside className="lg:sticky lg:top-24 lg:max-h-[calc(100dvh-8rem)] lg:overflow-auto">
            <div className="card3d rounded-2xl bg-surface-2 p-5">
              <button onClick={() => setShowPassage((s) => !s)} className="flex w-full items-center justify-between text-left lg:pointer-events-none">
                <span className="font-extrabold text-ink-strong">{passage.title ?? 'Текст'}</span>
                <span className="text-sm font-bold text-secondary lg:hidden">{showPassage ? 'Скрий' : 'Покажи'}</span>
              </button>
              <div className={cn('mt-3 whitespace-pre-line leading-relaxed', !showPassage && 'hidden lg:block')}>{passage.text}</div>
            </div>
          </aside>
        )}

        <section key={q.id} className="animate-rise">
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge tone="blue">{q.label}</Badge>
            {q.workTitle && <Badge tone="yellow">{q.workTitle}</Badge>}
            {mode === 'exam' && q.sourceNo && <Badge>Задача {q.sourceNo}</Badge>}
          </div>
          <h2 className="whitespace-pre-line text-xl font-extrabold leading-snug md:text-2xl">{q.prompt}</h2>
          {q.context && <div className="mt-4 whitespace-pre-line rounded-2xl border-2 border-dashed border-line px-4 py-3 italic">{q.context}</div>}

          <div className="mt-6">
            <QuestionInput q={q} answer={answer} result={mode === 'practice' ? result : undefined} onAnswer={setAnswer} />
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
                <Button onClick={finish} disabled={pending}>
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
            </div>
          )}
        </section>
      </div>

      {/* Долна лента (практика) */}
      {mode === 'practice' && (
        <div className={cn('fixed inset-x-0 bottom-0 z-40 border-t-2 md:left-64', result ? (result.correct ? 'border-primary/30 bg-[#d7ffb8] dark:bg-[#1f3a12]' : 'border-error/30 bg-[#ffdfe0] dark:bg-[#3a1717]') : 'border-line bg-bg')}>
          <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            {result ? (
              <div className="flex items-start gap-3">
                <span className={cn('flex size-12 shrink-0 items-center justify-center rounded-full bg-white', result.correct ? 'text-primary' : 'text-error')}>
                  {result.correct ? <Check className="size-7" strokeWidth={3} /> : <X className="size-7" strokeWidth={3} />}
                </span>
                <div>
                  <p className={cn('text-xl font-black', result.correct ? 'text-primary-dark' : 'text-error-dark')}>
                    {result.correct ? 'Вярно!' : result.score > 0 ? `Частично вярно (${Math.round(result.score * 100)}%)` : 'Грешно'}
                  </p>
                  {!result.correct && <p className="font-bold text-error-dark">Верен отговор: {correctAnswerText(q, result)}</p>}
                  {result.explanation && <p className="mt-1 text-sm text-ink">{result.explanation}</p>}
                  <button onClick={() => setReportFor(q.id)} className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-muted hover:underline">
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

function QuestionInput({ q, answer, result, onAnswer }: { q: ClientQuestion; answer?: Answer; result?: QuestionResult; onAnswer: (a: Answer) => void }) {
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

function ResultScreen({
  result,
  questions,
  answers,
  againHref,
  backHref,
  onReport,
  reportFor,
}: {
  result: FinishResult;
  questions: ClientQuestion[];
  answers: Record<string, Answer>;
  againHref: string;
  backHref: string;
  onReport: (id: string | null) => void;
  reportFor: string | null;
}) {
  const pct = result.total ? Math.round((result.score / result.total) * 100) : 0;
  const byId = new Map(result.results.map((r) => [r.id, r]));
  return (
    <div className="mx-auto max-w-3xl">
      <div className="animate-pop text-center">
        <div className="mx-auto mb-4 flex size-24 items-center justify-center rounded-full bg-accent text-[#4b3b00] shadow-[0_6px_0_var(--color-accent-dark)]">
          <Trophy className="size-12" />
        </div>
        <h1 className="text-3xl font-black">{pct >= 80 ? 'Страхотно!' : pct >= 50 ? 'Добра работа!' : 'Продължавай да учиш!'}</h1>
        <p className="mt-1 text-muted">
          {Number.isInteger(result.score) ? result.score : result.score.toFixed(1)} от {result.total} точки ({pct}%)
        </p>
      </div>
      <div className="mt-6 grid grid-cols-3 gap-3">
        <Stat icon={<Gem className="size-5" />} color="text-secondary" label="XP" value={`+${result.xpEarned}`} />
        <Stat icon={<Flame className="size-5" />} color="text-orange" label="Серия" value={`${result.streak} дни`} />
        <Stat icon={<Trophy className="size-5" />} color="text-[#b88600]" label="Ниво" value={`${result.level}${result.leveledUp ? ' ↑' : ''}`} />
      </div>
      {result.unlocked.length > 0 && (
        <div className="mt-4 rounded-2xl border-2 border-accent bg-accent/15 p-4 text-center font-extrabold">
          🏅 Ново постижение: {result.unlocked.map((c) => ACHIEVEMENTS.find((a) => a.code === c)?.name).join(', ')}
        </div>
      )}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <ButtonLink href={againHref} block size="lg">
          Нов тест
        </ButtonLink>
        <ButtonLink href={backHref} variant="outline" block size="lg">
          Към тестовете
        </ButtonLink>
      </div>

      <h2 className="mb-3 mt-10 text-xl font-black">Разбор</h2>
      <ol className="space-y-3">
        {questions.map((q, i) => {
          const r = byId.get(q.id);
          if (!r) return null;
          const a = answers[q.id];
          return (
            <li key={q.id} className={cn('card3d rounded-2xl bg-surface p-4', r.correct ? 'border-primary/40' : r.score > 0 ? 'border-orange/50' : 'border-error/40')}>
              <div className="flex items-start gap-3">
                <span className={cn('mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-white', r.correct ? 'bg-primary' : r.score > 0 ? 'bg-orange' : 'bg-error')}>
                  {r.correct ? <Check className="size-4" strokeWidth={3} /> : r.score > 0 ? <span className="text-[10px] font-black">{Math.round(r.score * 100)}%</span> : <X className="size-4" strokeWidth={3} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-ink-strong">
                    {i + 1}. {q.prompt}
                  </p>
                  {!r.correct && <p className="mt-1 text-sm text-error-dark">Твой отговор: {yourAnswerText(q, a) || '—'}</p>}
                  <p className="mt-1 text-sm font-bold text-primary-dark">Верен: {correctAnswerText(q, r)}</p>
                  {r.explanation && <p className="mt-1 text-sm text-muted">{r.explanation}</p>}
                  <button onClick={() => onReport(q.id)} className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-muted hover:underline">
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
  if (q.type === 'PUNCTUATION') return `${a.marks?.length ?? 0} поставени знака`;
  return '';
}

function Stat({ icon, color, label, value }: { icon: React.ReactNode; color: string; label: string; value: string }) {
  return (
    <div className="card3d rounded-2xl bg-surface p-3 text-center">
      <div className={cn('mb-1 flex items-center justify-center gap-1 text-xs font-extrabold uppercase', color)}>
        {icon} {label}
      </div>
      <div className="text-xl font-black text-ink-strong">{value}</div>
    </div>
  );
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
