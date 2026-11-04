'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { GRADES } from '@belmaster/shared';
import { Alert, Button, Field, Input, Select, Textarea } from '@/components/ui';
import {
  approveMembersAction,
  assignTestAction,
  createClassAction,
  decideTeacherAction,
  deleteAssignmentAction,
  deleteClassAction,
  deleteTestAction,
  duplicateTestAction,
  regenerateCodeAction,
  releaseResultsAction,
  removeMemberAction,
  requestTeacherAction,
  updateClassAction,
} from './actions';

type S = { error?: string; ok?: boolean };

export function TeacherRequestForm() {
  const [state, action, pending] = useActionState<S, FormData>(requestTeacherAction, {});
  if (state.ok) return <Alert tone="green">Заявката е изпратена. Ще получиш известие, когато я одобрим.</Alert>;
  return (
    <form action={action} className="space-y-4">
      <Field label="Училище">
        <Input name="school" required placeholder="напр. 119 СУ „Акад. Михаил Арнаудов“, София" />
      </Field>
      <Field label="Предмет">
        <Input name="subject" required defaultValue="Български език и литература" />
      </Field>
      <Field label="Служебен имейл (по желание)" hint="Помага ни да те потвърдим по-бързо.">
        <Input name="email" type="email" placeholder="ime@school.bg" />
      </Field>
      <Field label="Бележка (по желание)">
        <Textarea name="note" rows={3} placeholder="Нещо, което да знаем" />
      </Field>
      {state.error && <Alert>{state.error}</Alert>}
      <Button type="submit" disabled={pending}>
        Изпрати заявка
      </Button>
    </form>
  );
}

export function CreateClassForm() {
  const [state, action, pending] = useActionState<S, FormData>(async (s, fd) => (await createClassAction(s, fd)) ?? {}, {});
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
      <Field label="Име на класа">
        <Input name="name" required placeholder="напр. 12Б" maxLength={40} />
      </Field>
      <Field label="Клас">
        <Select name="grade" defaultValue="G12">
          {GRADES.map((g) => (
            <option key={g.code} value={g.code}>
              {g.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Брой ученици">
        <Input name="capacity" type="number" min={1} max={60} defaultValue={26} required className="w-28" />
      </Field>
      <Button type="submit" disabled={pending}>
        Създай
      </Button>
      {state.error && (
        <div className="sm:col-span-4">
          <Alert>{state.error}</Alert>
        </div>
      )}
    </form>
  );
}

function useAct() {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<unknown>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    start(async () => {
      await fn();
      router.refresh();
    });
  };
  return { pending, run };
}

export function DecideTeacher({ userId }: { userId: string }) {
  const { pending, run } = useAct();
  return (
    <div className="flex gap-2">
      <Button size="sm" disabled={pending} onClick={() => run(() => decideTeacherAction(userId, true))}>
        Одобри
      </Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => decideTeacherAction(userId, false), 'Да откажа ли заявката?')}>
        Откажи
      </Button>
    </div>
  );
}

export function MemberButtons({ classId, memberId, pendingMember }: { classId: string; memberId: string; pendingMember: boolean }) {
  const { pending, run } = useAct();
  return (
    <div className="flex gap-2">
      {pendingMember && (
        <Button size="sm" disabled={pending} onClick={() => run(() => approveMembersAction(classId, [memberId]))}>
          Одобри
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => run(() => removeMemberAction(classId, memberId), pendingMember ? 'Да откажа ли ученика?' : 'Да махна ли ученика от класа?')}
      >
        {pendingMember ? 'Откажи' : 'Махни'}
      </Button>
    </div>
  );
}

export function ApproveAll({ classId, count }: { classId: string; count: number }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        size="sm"
        disabled={pending || !count}
        onClick={() =>
          start(async () => {
            const r = await approveMembersAction(classId, 'all');
            setMsg(r.left ? `Одобрени ${r.approved}. Няма място за още ${r.left} — увеличи броя или откажи някого.` : `Одобрени ${r.approved}.`);
            router.refresh();
          })
        }
      >
        Одобри всички чакащи ({count})
      </Button>
      {msg && <span className="text-sm font-bold text-muted">{msg}</span>}
    </div>
  );
}

export function ClassSettings({ classId, name, capacity }: { classId: string; name: string; capacity: number }) {
  const [n, setN] = useState(name);
  const [c, setC] = useState(capacity);
  const [err, setErr] = useState<string | null>(null);
  const { pending, run } = useAct();
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Име">
          <Input value={n} onChange={(e) => setN(e.target.value)} maxLength={40} className="w-40" />
        </Field>
        <Field label="Брой ученици">
          <Input type="number" min={1} max={60} value={c} onChange={(e) => setC(Number(e.target.value))} className="w-28" />
        </Field>
        <Button
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const r = await updateClassAction(classId, { name: n, capacity: c });
              setErr(r.error ?? null);
            })
          }
        >
          Запази
        </Button>
      </div>
      {err && <Alert>{err}</Alert>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => regenerateCodeAction(classId), 'Старият код спира да работи. Нов код?')}>
          Нов код
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => deleteClassAction(classId), 'Да изтрия ли класа с всички резултати? Това не може да се върне.')}>
          Изтрий класа
        </Button>
      </div>
    </div>
  );
}

function localInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function AssignForm({ classId, tests }: { classId: string; tests: { id: string; title: string; count: number }[] }) {
  const [state, action, pending] = useActionState<S, FormData>(assignTestAction, {});
  const [tz, setTz] = useState(0);
  const [defaults, setDefaults] = useState<{ open: string; close: string } | null>(null);
  useEffect(() => {
    const now = new Date();
    now.setSeconds(0, 0);
    setTz(now.getTimezoneOffset());
    setDefaults({ open: localInput(now), close: localInput(new Date(now.getTime() + 7 * 86_400_000)) });
  }, []);
  if (!tests.length) return <p className="text-sm text-muted">Първо направи тест в „Моите тестове“.</p>;
  if (!defaults) return null;
  return (
    <form action={action} className="space-y-4" key={state.ok ? 'done' : 'form'}>
      <input type="hidden" name="classId" value={classId} />
      <input type="hidden" name="tzOffset" value={tz} />
      <Field label="Тест">
        <Select name="testId" required>
          {tests.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title} ({t.count} въпроса)
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Отваря се">
          <Input type="datetime-local" name="opensAt" defaultValue={defaults.open} required />
        </Field>
        <Field label="Затваря се">
          <Input type="datetime-local" name="closesAt" defaultValue={defaults.close} required />
        </Field>
        <Field label="Таймер (минути)" hint="Празно = без таймер">
          <Input type="number" name="timeLimitMin" min={1} max={600} placeholder="напр. 40" />
        </Field>
      </div>
      <Field label="Резултат">
        <Select name="showResult" defaultValue="later">
          <option value="later">Аз проверявам и после пускам резултатите</option>
          <option value="now">Ученикът вижда резултата веднага след предаване</option>
        </Select>
      </Field>
      {state.error && <Alert>{state.error}</Alert>}
      {state.ok && <Alert tone="green">Тестът е даден. Учениците получиха известие.</Alert>}
      <Button type="submit" disabled={pending}>
        Дай теста на класа
      </Button>
    </form>
  );
}

export function TestRowActions({ testId }: { testId: string }) {
  const { pending, run } = useAct();
  return (
    <div className="flex gap-1">
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => duplicateTestAction(testId))}>
        Копирай
      </Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => deleteTestAction(testId), 'Да изтрия ли теста? Вече дадените задания остават.')}>
        Изтрий
      </Button>
    </div>
  );
}

export function ReleaseButton({ assignmentId, released, ungraded }: { assignmentId: string; released: boolean; ungraded: number }) {
  const { pending, run } = useAct();
  return (
    <Button
      variant={released ? 'outline' : 'primary'}
      disabled={pending}
      onClick={() =>
        run(
          () => releaseResultsAction(assignmentId),
          ungraded ? `Има ${ungraded} непроверени отговора със свободен текст (ще се броят 0 т.). Да пусна ли резултатите?` : released ? 'Да пратя ли пак известие с резултатите?' : 'Да пусна ли резултатите на учениците?',
        )
      }
    >
      {released ? 'Прати резултатите пак' : 'Покажи резултатите на учениците'}
    </Button>
  );
}

export function DeleteAssignment({ assignmentId }: { assignmentId: string }) {
  const { pending, run } = useAct();
  return (
    <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => deleteAssignmentAction(assignmentId), 'Да изтрия ли заданието с всички отговори?')}>
      Изтрий заданието
    </Button>
  );
}
