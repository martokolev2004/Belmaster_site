'use client';

import { useActionState } from 'react';
import { Alert, Button, Field, Input } from '@/components/ui';
import { contactAction } from './actions';

const SUBJECTS = ['Въпрос', 'Грешка в сайта', 'Сигнал за потребител', 'Лични данни (достъп, изтриване)', 'Друго'];

export function ContactForm({ name, email }: { name?: string; email?: string }) {
  const [state, action, pending] = useActionState(contactAction, {});
  if (state.ok) return <Alert tone="green">{state.ok}</Alert>;
  return (
    <form action={action} className="not-prose space-y-4">
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Име">
          <Input name="name" defaultValue={name} required maxLength={80} />
        </Field>
        <Field label="Имейл за отговор">
          <Input name="email" type="email" defaultValue={email} required maxLength={120} />
        </Field>
      </div>
      <Field label="Тема">
        <select name="subject" className="h-12 w-full rounded-2xl border-2 border-line bg-surface px-3 font-bold">
          {SUBJECTS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </Field>
      <Field label="Съобщение">
        <textarea name="message" required minLength={10} maxLength={4000} rows={6} className="w-full rounded-2xl border-2 border-line bg-surface p-3" />
      </Field>
      {state.error && <Alert>{state.error}</Alert>}
      <Button type="submit" disabled={pending}>
        {pending ? 'Изпращане…' : 'Изпрати'}
      </Button>
    </form>
  );
}
