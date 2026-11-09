'use client';

import { useActionState } from 'react';
import { Alert, Button } from '@/components/ui';
import { parentConsentAction, type FormState } from '../actions';

export function ParentForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(parentConsentAction, {});
  if (state.ok) return <p className="rounded-2xl bg-primary/10 p-4 font-bold text-primary-dark">{state.ok}</p>;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <label className="flex items-start gap-2.5">
        <input type="checkbox" name="agree" required className="mt-1 size-5 shrink-0" />
        <span>Аз съм родител (настойник) на детето и давам съгласие данните му да се обработват, както е описано в политиката за поверителност.</span>
      </label>
      {state.error && <Alert>{state.error}</Alert>}
      <Button type="submit" block size="lg" disabled={pending}>
        {pending ? '…' : 'Потвърждавам'}
      </Button>
    </form>
  );
}
