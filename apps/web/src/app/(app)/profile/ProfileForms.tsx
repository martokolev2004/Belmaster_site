'use client';

import { useActionState, useState, useTransition } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { Alert, Button, Field, Input } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { FormState } from '@/app/(auth)/actions';
import { changePasswordAction, setThemeAction, updateProfileAction } from './actions';

const COLORS = ['#58cc02', '#1cb0f6', '#ffc800', '#ff4b4b', '#ce82ff', '#ff9600'];

export function ProfileForm({ displayName, avatarColor }: { displayName: string; avatarColor: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateProfileAction, {});
  const [color, setColor] = useState(avatarColor);
  return (
    <form action={action} className="space-y-4">
      <Field label="Име">
        <Input name="displayName" defaultValue={displayName} minLength={2} maxLength={30} required />
      </Field>
      <div>
        <span className="mb-1.5 block text-sm font-extrabold">Цвят</span>
        <input type="hidden" name="avatarColor" value={color} />
        <div className="flex gap-2">
          {COLORS.map((c) => (
            <button type="button" key={c} onClick={() => setColor(c)} aria-label={c} className={cn('size-9 rounded-full border-4', color === c ? 'border-ink-strong' : 'border-transparent')} style={{ background: c }} />
          ))}
        </div>
      </div>
      {state.error && <Alert>{state.error}</Alert>}
      {state.ok && <Alert tone="green">{state.ok}</Alert>}
      <Button type="submit" disabled={pending}>
        Запази
      </Button>
    </form>
  );
}

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(changePasswordAction, {});
  return (
    <form action={action} className="space-y-4">
      {hasPassword && (
        <Field label="Текуща парола">
          <Input name="current" type="password" autoComplete="current-password" required />
        </Field>
      )}
      <Field label={hasPassword ? 'Нова парола' : 'Задай парола'} hint="Поне 8 знака.">
        <Input name="next" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      {state.error && <Alert>{state.error}</Alert>}
      {state.ok && <Alert tone="green">{state.ok}</Alert>}
      <Button type="submit" variant="secondary" disabled={pending}>
        Смени паролата
      </Button>
    </form>
  );
}

export function ThemePicker({ current }: { current: 'light' | 'dark' | 'system' }) {
  const [pending, start] = useTransition();
  const [value, setValue] = useState(current);
  const opts = [
    { v: 'light' as const, label: 'Светла', icon: Sun },
    { v: 'dark' as const, label: 'Тъмна', icon: Moon },
    { v: 'system' as const, label: 'Системна', icon: Monitor },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {opts.map(({ v, label, icon: Icon }) => (
        <button
          key={v}
          disabled={pending}
          onClick={() => {
            setValue(v);
            if (v === 'system') document.documentElement.removeAttribute('data-theme');
            else document.documentElement.setAttribute('data-theme', v);
            start(() => setThemeAction(v));
          }}
          className={cn('card3d flex flex-col items-center gap-1 rounded-2xl p-3 text-sm font-extrabold', value === v ? 'border-secondary! bg-secondary/10 text-secondary' : 'bg-surface text-muted')}
        >
          <Icon className="size-5" /> {label}
        </button>
      ))}
    </div>
  );
}
