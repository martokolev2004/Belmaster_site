'use client';

import { useActionState } from 'react';
import { Alert, Button } from '@/components/ui';
import { BirthFields } from '@/components/auth/BirthFields';
import { completeProfileAction, type FormState } from '../actions';

export function WelcomeForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(completeProfileAction, {});
  return (
    <form action={action} className="space-y-4">
      <BirthFields />
      {state.error && <Alert>{state.error}</Alert>}
      <Button type="submit" block size="lg" disabled={pending}>
        {pending ? '…' : 'Продължи'}
      </Button>
    </form>
  );
}
