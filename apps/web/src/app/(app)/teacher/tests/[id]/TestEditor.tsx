'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowLeft, ArrowUp, Copy, Eye, Library, Plus, Trash2, X } from 'lucide-react';
import {
  GRADES,
  TEACHER_TYPE_LABELS,
  defaultTeacherPoints,
  prepareTeacherQuestion,
  publicTeacherQuestion,
  type AnyAnswer,
  type GradeCode,
  type TeacherQType,
  type TeacherQuestion,
} from '@belmaster/shared';
import { Alert, Badge, Button, Field, Input, Select, Textarea } from '@/components/ui';
import { AnswerInput, LETTERS } from '@/components/quiz/inputs';
import { ContextBox } from '@/components/quiz/ContextBox';
import { cn } from '@/lib/cn';
import { bankFiltersAction, saveTestAction, searchBankAction } from '../../actions';

type EQ = TeacherQuestion & { _touched?: boolean };

const uid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Math.random()).slice(2));
const TYPES: TeacherQType[] = ['SINGLE_CHOICE', 'SHORT_ANSWER', 'MATCHING', 'FILL_BLANKS', 'PUNCTUATION', 'FREE_TEXT'];

function blank(type: TeacherQType): EQ {
  const base = { id: uid(), type, prompt: '', context: '', points: 1 };
  let q: EQ;
  switch (type) {
    case 'SINGLE_CHOICE':
      q = { ...base, options: ['', '', '', ''], correctIndex: null };
      break;
    case 'SHORT_ANSWER':
      q = { ...base, acceptedAnswers: [''], answerCount: 1 };
      break;
    case 'MATCHING':
      q = { ...base, matching: { left: ['', '', ''], right: ['', '', ''], pairs: [0, 1, 2] } };
      break;
    case 'FILL_BLANKS':
      q = { ...base, blanks: { text: 'Текст с {{А}} празно място.', blanks: [{ label: 'А', options: ['', '', ''], correct: 0 }] } };
      break;
    case 'PUNCTUATION':
      q = { ...base, prompt: 'Поставете пропуснатите препинателни знаци.', punctText: '', punctAnswer: '' };
      break;
    case 'FREE_TEXT':
      q = { ...base, guide: '' };
      break;
  }
  q.points = defaultTeacherPoints(q);
  return q;
}

/** Точките по подразбиране се обновяват, докато учителят не ги смени ръчно. */
function withAutoPoints(q: EQ): EQ {
  if (q._touched) return q;
  let calc = q;
  if (q.type === 'PUNCTUATION') calc = prepareTeacherQuestion(q).q;
  return { ...q, points: defaultTeacherPoints(calc) };
}

export function TestEditor({
  initial,
}: {
  initial: { id: string | null; title: string; grade: GradeCode; description: string; questions: TeacherQuestion[] };
}) {
  const [title, setTitle] = useState(initial.title);
  const [grade, setGrade] = useState<GradeCode>(initial.grade);
  const [description, setDescription] = useState(initial.description);
  const [qs, setQs] = useState<EQ[]>(() => initial.questions.map((q) => ({ ...q, _touched: true })));
  const [errors, setErrors] = useState<Record<number, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [bank, setBank] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (!dirty) return;
    const on = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', on);
    return () => window.removeEventListener('beforeunload', on);
  }, [dirty]);

  const change = (i: number, patch: Partial<EQ>) => {
    setDirty(true);
    setSaved(null);
    setQs((all) => all.map((q, k) => (k === i ? withAutoPoints({ ...q, ...patch }) : q)));
  };
  const move = (i: number, d: number) =>
    setQs((all) => {
      const j = i + d;
      if (j < 0 || j >= all.length) return all;
      const n = [...all];
      [n[i], n[j]] = [n[j], n[i]];
      setDirty(true);
      return n;
    });
  const add = (q: EQ) => {
    setDirty(true);
    setQs((all) => [...all, q]);
    setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 50);
  };

  const total = qs.reduce((s, q) => s + (Number(q.points) || 0), 0);

  const save = () =>
    start(async () => {
      setError(null);
      const res = await saveTestAction({
        id: initial.id,
        title,
        grade,
        description,
        questions: qs.map(({ _touched, ...q }) => ({ ...q, points: Number(q.points) })),
      });
      if (res.error) setError(res.error);
      if (res.errors) {
        setErrors(Object.fromEntries(res.errors.map((e) => [e.index, e.messages])));
        setError(`Има грешки в ${res.errors.length} въпроса — оцветени са в червено.`);
        document.getElementById(`q-${res.errors[0].index}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      setErrors({});
      if (res.id) {
        setDirty(false);
        setSaved('Запазено ✓');
        if (!initial.id) router.replace(`/teacher/tests/${res.id}`);
        else router.refresh();
      }
    });

  return (
    <div className="mx-auto max-w-4xl pb-32">
      <Link href="/teacher" className="mb-4 inline-flex items-center gap-1 font-bold text-secondary">
        <ArrowLeft className="size-4" /> Учител
      </Link>
      <div className="card3d mb-6 space-y-4 rounded-2xl bg-surface p-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <Field label="Заглавие на теста">
            <Input value={title} onChange={(e) => (setTitle(e.target.value), setDirty(true))} placeholder="напр. Контролна — Вапцаров" maxLength={120} />
          </Field>
          <Field label="Клас">
            <Select value={grade} onChange={(e) => (setGrade(e.target.value as GradeCode), setDirty(true))}>
              {GRADES.map((g) => (
                <option key={g.code} value={g.code}>
                  {g.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Описание (по желание, вижда се от учениците)">
          <Textarea value={description} onChange={(e) => (setDescription(e.target.value), setDirty(true))} rows={2} maxLength={1000} />
        </Field>
      </div>

      <div className="space-y-4">
        {qs.map((q, i) => (
          <QuestionCard
            key={q.id}
            q={q}
            index={i}
            count={qs.length}
            errors={errors[i]}
            onChange={(p) => change(i, p)}
            onMove={(d) => move(i, d)}
            onCopy={() => add({ ...q, id: uid() })}
            onDelete={() => {
              if (window.confirm('Да изтрия ли въпроса?')) {
                setDirty(true);
                setQs((all) => all.filter((_, k) => k !== i));
              }
            }}
          />
        ))}
      </div>

      <div className="card3d mt-6 rounded-2xl border-dashed bg-surface p-5">
        <p className="mb-3 font-extrabold">Добави въпрос</p>
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <Button key={t} size="sm" variant="outline" icon={<Plus className="size-4" />} onClick={() => add(blank(t))}>
              {TEACHER_TYPE_LABELS[t]}
            </Button>
          ))}
          <Button size="sm" variant="purple" icon={<Library className="size-4" />} onClick={() => setBank(true)}>
            От матурите
          </Button>
        </div>
      </div>

      {/* лента за запазване */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-line bg-bg/95 backdrop-blur md:left-64">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3 px-4 py-3">
          <span className="text-sm font-extrabold text-muted">
            {qs.length} въпроса · {total} точки
          </span>
          {error && <span className="text-sm font-bold text-error">{error}</span>}
          {saved && !dirty && <span className="text-sm font-bold text-primary-dark">{saved}</span>}
          <Button className="ml-auto" onClick={save} disabled={pending}>
            {pending ? 'Запазване…' : 'Запази теста'}
          </Button>
        </div>
      </div>

      {bank && <BankDialog grade={grade} onClose={() => setBank(false)} onAdd={(q) => add({ ...q, _touched: true })} />}
    </div>
  );
}

function QuestionCard({
  q,
  index,
  count,
  errors,
  onChange,
  onMove,
  onCopy,
  onDelete,
}: {
  q: EQ;
  index: number;
  count: number;
  errors?: string[];
  onChange: (p: Partial<EQ>) => void;
  onMove: (d: number) => void;
  onCopy: () => void;
  onDelete: () => void;
}) {
  const [preview, setPreview] = useState(false);
  const [ans, setAns] = useState<AnyAnswer>({});
  return (
    <div id={`q-${index}`} className={cn('card3d rounded-2xl bg-surface p-5', errors?.length && 'border-error!')}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-secondary text-sm font-black text-white">{index + 1}</span>
        <Badge tone="blue">{TEACHER_TYPE_LABELS[q.type]}</Badge>
        {q.sourceQuestionId && <Badge tone="purple">от матура</Badge>}
        <label className="ml-auto flex items-center gap-2 text-sm font-extrabold text-muted">
          Точки
          <Input
            type="number"
            min={1}
            max={100}
            step={0.5}
            value={q.points}
            onChange={(e) => onChange({ points: Number(e.target.value), _touched: true })}
            className="h-9! w-20 py-1!"
          />
        </label>
        <div className="flex">
          <IconBtn title="Преглед" onClick={() => setPreview((p) => !p)} active={preview}>
            <Eye className="size-4" />
          </IconBtn>
          <IconBtn title="Нагоре" onClick={() => onMove(-1)} disabled={index === 0}>
            <ArrowUp className="size-4" />
          </IconBtn>
          <IconBtn title="Надолу" onClick={() => onMove(1)} disabled={index === count - 1}>
            <ArrowDown className="size-4" />
          </IconBtn>
          <IconBtn title="Копирай" onClick={onCopy}>
            <Copy className="size-4" />
          </IconBtn>
          <IconBtn title="Изтрий" onClick={onDelete}>
            <Trash2 className="size-4 text-error" />
          </IconBtn>
        </div>
      </div>

      {preview ? (
        <div className="rounded-xl bg-surface-2 p-4">
          <p className="mb-2 text-xs font-extrabold uppercase text-muted">Така го вижда ученикът</p>
          <h3 className="whitespace-pre-line text-lg font-extrabold">{q.prompt || '(без условие)'}</h3>
          {q.context && q.type !== 'FILL_BLANKS' && <ContextBox text={q.context} />}
          <div className="mt-4">
            <AnswerInput q={publicTeacherQuestion(prepareTeacherQuestion(q).q) as never} value={ans} onChange={(a) => setAns((p) => ({ ...p, ...a }))} />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <Field label="Условие">
            <Textarea value={q.prompt} onChange={(e) => onChange({ prompt: e.target.value })} rows={2} placeholder="Въпросът към ученика" />
          </Field>
          {q.type !== 'PUNCTUATION' && (
            <Field label="Текст към задачата (по желание)" hint="Откъс, изречение… Дума за подчертаване: „дума (А)“.">
              <Textarea value={q.context ?? ''} onChange={(e) => onChange({ context: e.target.value })} rows={q.context ? 4 : 1} />
            </Field>
          )}
          <TypeFields q={q} onChange={onChange} />
        </div>
      )}
      {errors?.length ? (
        <div className="mt-3">
          <Alert>{errors.join(' ')}</Alert>
        </div>
      ) : null}
    </div>
  );
}

function IconBtn({ children, onClick, disabled, title, active }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; title: string; active?: boolean }) {
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick} disabled={disabled} className={cn('rounded-lg p-2 text-muted hover:bg-surface-2 disabled:opacity-30', active && 'bg-secondary/15 text-secondary')}>
      {children}
    </button>
  );
}

function TypeFields({ q, onChange }: { q: EQ; onChange: (p: Partial<EQ>) => void }) {
  switch (q.type) {
    case 'SINGLE_CHOICE': {
      const opts = q.options ?? [];
      return (
        <div className="space-y-2">
          <p className="text-sm font-extrabold text-muted">Отговори — отбележи верния</p>
          {opts.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onChange({ correctIndex: i })}
                className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg border-2 font-black', q.correctIndex === i ? 'border-primary bg-primary text-white' : 'border-line text-muted')}
                title="Верен отговор"
              >
                {LETTERS[i]}
              </button>
              <Input value={o} onChange={(e) => onChange({ options: opts.map((x, k) => (k === i ? e.target.value : x)) })} />
              {opts.length > 2 && (
                <IconBtn
                  title="Махни"
                  onClick={() =>
                    onChange({
                      options: opts.filter((_, k) => k !== i),
                      correctIndex: q.correctIndex == null ? null : q.correctIndex === i ? null : q.correctIndex > i ? q.correctIndex - 1 : q.correctIndex,
                    })
                  }
                >
                  <X className="size-4" />
                </IconBtn>
              )}
            </div>
          ))}
          {opts.length < 6 && (
            <Button size="sm" variant="ghost" onClick={() => onChange({ options: [...opts, ''] })}>
              + отговор
            </Button>
          )}
        </div>
      );
    }
    case 'SHORT_ANSWER':
      return (
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Field label="Верни отговори — по един на ред" hint="Малки/главни букви и излишни интервали не се броят. За задачи за главна буква: =Текст">
            <Textarea
              value={(q.acceptedAnswers ?? []).join('\n')}
              onChange={(e) => onChange({ acceptedAnswers: e.target.value.split('\n') })}
              rows={3}
            />
          </Field>
          <Field label="Колко отговора иска">
            <Select value={q.answerCount ?? 1} onChange={(e) => onChange({ answerCount: Number(e.target.value) })}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      );
    case 'MATCHING': {
      const m = q.matching ?? { left: [], right: [], pairs: [] };
      const set = (p: Partial<typeof m>) => onChange({ matching: { ...m, ...p } });
      return (
        <div className="space-y-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-extrabold text-muted">Лява колона и вярната двойка</p>
              {m.left.map((l, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-5 text-sm font-black text-muted">{i + 1}.</span>
                  <Input value={l} onChange={(e) => set({ left: m.left.map((x, k) => (k === i ? e.target.value : x)) })} />
                  <Select value={m.pairs[i] ?? 0} onChange={(e) => set({ pairs: m.pairs.map((x, k) => (k === i ? Number(e.target.value) : x)) })} className="w-20!">
                    {m.right.map((_, r) => (
                      <option key={r} value={r}>
                        → {LETTERS[r]}
                      </option>
                    ))}
                  </Select>
                  {m.left.length > 2 && (
                    <IconBtn title="Махни" onClick={() => set({ left: m.left.filter((_, k) => k !== i), pairs: m.pairs.filter((_, k) => k !== i) })}>
                      <X className="size-4" />
                    </IconBtn>
                  )}
                </div>
              ))}
              <Button size="sm" variant="ghost" onClick={() => set({ left: [...m.left, ''], pairs: [...m.pairs, 0] })}>
                + ред
              </Button>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-extrabold text-muted">Дясна колона</p>
              {m.right.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-5 text-sm font-black text-muted">{LETTERS[i]})</span>
                  <Input value={r} onChange={(e) => set({ right: m.right.map((x, k) => (k === i ? e.target.value : x)) })} />
                  {m.right.length > 2 && (
                    <IconBtn
                      title="Махни"
                      onClick={() => set({ right: m.right.filter((_, k) => k !== i), pairs: m.pairs.map((p) => (p === i ? 0 : p > i ? p - 1 : p)) })}
                    >
                      <X className="size-4" />
                    </IconBtn>
                  )}
                </div>
              ))}
              {m.right.length < 6 && (
                <Button size="sm" variant="ghost" onClick={() => set({ right: [...m.right, ''] })}>
                  + отговор
                </Button>
              )}
            </div>
          </div>
        </div>
      );
    }
    case 'FILL_BLANKS': {
      const b = q.blanks ?? { text: '', blanks: [] };
      const set = (p: Partial<typeof b>) => onChange({ blanks: { ...b, ...p } });
      const addBlank = () => {
        const label = LETTERS[b.blanks.length] ?? String(b.blanks.length + 1);
        set({ text: `${b.text} {{${label}}}`, blanks: [...b.blanks, { label, options: ['', '', ''], correct: 0 }] });
      };
      return (
        <div className="space-y-3">
          <Field label="Текст с празни места" hint="Празното място се пише като {{А}}, {{Б}}…">
            <Textarea value={b.text} onChange={(e) => set({ text: e.target.value })} rows={4} />
          </Field>
          {b.blanks.map((bl, i) => (
            <div key={i} className="rounded-xl bg-surface-2 p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="font-black">Място {bl.label}</span>
                <span className="text-xs text-muted">— отбележи вярната дума</span>
                <IconBtn
                  title="Махни"
                  onClick={() => set({ blanks: b.blanks.filter((_, k) => k !== i), text: b.text.replace(`{{${bl.label}}}`, '…') })}
                >
                  <X className="size-4" />
                </IconBtn>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {bl.options.map((o, k) => (
                  <div key={k} className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      checked={bl.correct === k}
                      onChange={() => set({ blanks: b.blanks.map((x, j) => (j === i ? { ...x, correct: k } : x)) })}
                      className="size-4 accent-[var(--color-primary)]"
                    />
                    <Input
                      value={o}
                      onChange={(e) => set({ blanks: b.blanks.map((x, j) => (j === i ? { ...x, options: x.options.map((y, z) => (z === k ? e.target.value : y)) } : x)) })}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
          <Button size="sm" variant="ghost" onClick={addBlank}>
            + празно място
          </Button>
        </div>
      );
    }
    case 'PUNCTUATION': {
      const r = q.punctText && q.punctAnswer ? prepareTeacherQuestion(q) : null;
      return (
        <div className="space-y-3">
          <Field label="Текстът БЕЗ пропуснатите знаци (както го вижда ученикът)">
            <Textarea value={q.punctText ?? ''} onChange={(e) => onChange({ punctText: e.target.value })} rows={3} />
          </Field>
          <Field label="Верният текст (със знаците)">
            <Textarea value={q.punctAnswer ?? ''} onChange={(e) => onChange({ punctAnswer: e.target.value })} rows={3} />
          </Field>
          {r && (r.errors.length ? <Alert>{r.errors.join(' ')}</Alert> : <Alert tone="green">Липсващи знаци: {r.q.punctuation?.marks.length}</Alert>)}
        </div>
      );
    }
    case 'FREE_TEXT':
      return (
        <Field label="Примерен отговор / критерии (вижда се само от теб при проверка)">
          <Textarea value={q.guide ?? ''} onChange={(e) => onChange({ guide: e.target.value })} rows={3} />
        </Field>
      );
  }
}

const SECTIONS = [
  { v: '', l: 'Всички' },
  { v: 'LANGUAGE', l: 'Език' },
  { v: 'LITERATURE', l: 'Литература' },
  { v: 'READING', l: 'Четене с разбиране' },
];

function BankDialog({ grade, onClose, onAdd }: { grade: GradeCode; onClose: () => void; onAdd: (q: TeacherQuestion) => void }) {
  const [section, setSection] = useState('');
  const [examId, setExamId] = useState('');
  const [text, setText] = useState('');
  const [exams, setExams] = useState<{ id: string; title: string }[]>([]);
  const [items, setItems] = useState<{ label: string; question: TeacherQuestion }[]>([]);
  const [total, setTotal] = useState(0);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();

  useEffect(() => {
    void bankFiltersAction(grade).then(setExams);
  }, [grade]);
  const search = (skip = 0) =>
    start(async () => {
      const r = await searchBankAction({ grade, section: section || undefined, examId: examId || undefined, text, skip });
      setItems((prev) => (skip ? [...prev, ...r.items] : r.items));
      setTotal(r.total);
    });
  useEffect(() => {
    const t = setTimeout(() => search(0), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, examId, text]);
  const key = useMemo(() => (q: TeacherQuestion) => q.sourceQuestionId ?? q.id, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-3" role="dialog" aria-modal onClick={onClose}>
      <div className="flex max-h-[92dvh] w-full max-w-3xl flex-col rounded-3xl bg-surface" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b-2 border-line p-4">
          <h2 className="flex-1 text-lg font-black">Въпроси от матурите</h2>
          <IconBtn title="Затвори" onClick={onClose}>
            <X className="size-5" />
          </IconBtn>
        </div>
        <div className="grid gap-2 border-b-2 border-line p-4 sm:grid-cols-3">
          <Select value={section} onChange={(e) => setSection(e.target.value)}>
            {SECTIONS.map((s) => (
              <option key={s.v} value={s.v}>
                {s.l}
              </option>
            ))}
          </Select>
          <Select value={examId} onChange={(e) => setExamId(e.target.value)}>
            <option value="">Всички матури</option>
            {exams.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </Select>
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Търси в текста…" />
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {items.map(({ label, question: q }) => {
            const done = added.has(key(q));
            return (
              <div key={key(q)} className="flex items-start gap-3 rounded-xl border-2 border-line p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-muted">
                    {label} · {TEACHER_TYPE_LABELS[q.type]} · {q.points} т.
                  </p>
                  <p className="font-bold text-ink-strong">{q.prompt}</p>
                  {q.type === 'SINGLE_CHOICE' && <p className="mt-0.5 line-clamp-2 text-sm text-muted">{q.options?.map((o, i) => `${LETTERS[i]}) ${o}`).join('  ')}</p>}
                </div>
                <Button
                  size="sm"
                  variant={done ? 'outline' : 'primary'}
                  onClick={() => {
                    onAdd({ ...q, id: uid() });
                    setAdded((s) => new Set(s).add(key(q)));
                  }}
                >
                  {done ? 'Още веднъж' : 'Добави'}
                </Button>
              </div>
            );
          })}
          {!items.length && !pending && <p className="py-8 text-center text-muted">Няма въпроси с тези филтри.</p>}
          {items.length < total && (
            <Button variant="ghost" block disabled={pending} onClick={() => search(items.length)}>
              Още ({total - items.length})
            </Button>
          )}
        </div>
        <div className="border-t-2 border-line p-4 text-right">
          <Button onClick={onClose}>Готово{added.size ? ` (${added.size} добавени)` : ''}</Button>
        </div>
      </div>
    </div>
  );
}
