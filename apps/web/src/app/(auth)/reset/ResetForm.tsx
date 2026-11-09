'use client';

import { useActionState } from 'react';
import { Alert, Button, Field, Input } from '@/components/ui';
import { resetAction, type FormState } from '../actions';

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(resetAction, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <Field label="Нова парола" hint="Поне 8 знака.">
        <Input name="password" type="password" autoComplete="new-password" required minLength={8} />
      </Field>
      <Field label="Повтори паролата">
        <Input name="password2" type="password" autoComplete="new-password" required minLength={8} />
      </Field>
      {state.error && <Alert>{state.error}</Alert>}
      <Button type="submit" block size="lg" disabled={pending}>
        {pending ? '…' : 'Запази паролата'}
      </Button>
    </form>
  );
}
