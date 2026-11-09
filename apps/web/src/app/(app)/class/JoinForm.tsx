'use client';

import { useActionState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Field, Input } from '@/components/ui';
import { joinClassAction, leaveClassAction } from './actions';

export function JoinForm() {
  const [state, action, pending] = useActionState<{ error?: string; ok?: boolean }, FormData>(joinClassAction, {});
  return (
    <form action={action} className="space-y-4">
      <Field label="Код от учителя">
        <Input name="code" required maxLength={8} placeholder="напр. K7P2QX" className="font-mono text-xl tracking-[0.25em] uppercase" />
      </Field>
      <Field label="Истинско име и фамилия" hint="Така учителят ще те познае. Вижда го само той.">
        <Input name="realName" required maxLength={60} placeholder="Иван Петров" />
      </Field>
      {state.error && <Alert>{state.error}</Alert>}
      <Button type="submit" disabled={pending}>
        Влез в класа
      </Button>
    </form>
  );
}

export function LeaveButton({ pendingOnly }: { pendingOnly: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(pendingOnly ? 'Да откажа ли заявката?' : 'Да изляза ли от класа? Учителят ще трябва да те одобри пак.')) return;
        start(async () => {
          await leaveClassAction();
          router.refresh();
        });
      }}
    >
      {pendingOnly ? 'Откажи заявката' : 'Излез от класа'}
    </Button>
  );
}
