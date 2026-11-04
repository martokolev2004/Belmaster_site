'use client';

import { useActionState } from 'react';
import { Alert, Button, Card, Field, Textarea } from '@/components/ui';
import { importAction } from '../actions';

export function ImportForm() {
  const [state, action, pending] = useActionState(importAction, {});
  return (
    <form action={action} className="space-y-4">
      <Card className="space-y-4">
        <Field label="JSON файл">
          <input type="file" name="file" accept="application/json,.json" className="block w-full text-sm font-bold" />
        </Field>
        <Field label="…или постави JSON тук">
          <Textarea name="json" className="min-h-64 font-mono text-xs" placeholder='{ "grade": "G12", "exam": { "year": 2023, "session": "май" }, "questions": [ … ] }' />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? 'Импортиране…' : 'Импортирай'}
        </Button>
      </Card>
      {state.error && <Alert>{state.error}</Alert>}
      {state.report && (
        <Card>
          <p className="font-extrabold text-primary-dark">
            ✓ {state.report.examTitle ?? 'Готово'}: добавени {state.report.created} въпроса{state.report.replaced ? `, заменени ${state.report.replaced}` : ''}.
          </p>
          {state.report.worksCreated.length > 0 && <p className="mt-2 text-sm">Нови произведения: {state.report.worksCreated.join('; ')}</p>}
          {state.report.warnings.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-sm text-error-dark">
              {state.report.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </form>
  );
}
