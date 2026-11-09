'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Alert, Button, Field, Input } from '@/components/ui';
import { forgotAction, type FormState } from '../actions';

export function ForgotForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(forgotAction, {});
  return (
    <form action={action} className="space-y-4">
      <Field label="Имейл">
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      {state.error && <Alert>{state.error}</Alert>}
      {state.ok && <p className="rounded-2xl bg-primary/10 p-3 text-sm font-bold text-primary-dark">{state.ok}</p>}
      <Button type="submit" block size="lg" disabled={pending}>
        {pending ? '…' : 'Изпрати линк'}
      </Button>
      <p className="text-center text-sm">
        <Link href="/login" className="font-bold text-secondary">Обратно към входа</Link>
      </p>
    </form>
  );
}
