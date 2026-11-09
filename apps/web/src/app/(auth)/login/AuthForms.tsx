'use client';

import { useActionState, useState } from 'react';
import { GRADES } from '@belmaster/shared';
import { Alert, Button, Field, Input } from '@/components/ui';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import { BirthFields } from '@/components/auth/BirthFields';
import { guestAction, loginAction, registerAction, type FormState } from '../actions';

const GOOGLE_ERRORS: Record<string, string> = {
  google: 'Входът с Google не успя. Опитай пак.',
  google_email: 'Този имейл вече е регистриран с парола. Влез с паролата си.',
  blocked: 'Профилът е блокиран заради нарушение на Общите условия. Ако смяташ, че е грешка, пиши ни от страницата „Контакти“.',
};

export function AuthForms({
  next,
  initialTab,
  googleEnabled,
  error,
  isGuest,
}: {
  next: string;
  initialTab: 'login' | 'register';
  googleEnabled: boolean;
  error?: string;
  isGuest: boolean;
}) {
  const [tab, setTab] = useState<'login' | 'register'>(initialTab);
  const [loginState, login, loggingIn] = useActionState<FormState, FormData>(loginAction, {});
  const [regState, register, registering] = useActionState<FormState, FormData>(registerAction, {});

  return (
    <div className="animate-rise">
      <h1 className="mb-1 text-center text-3xl font-black">
        {isGuest ? 'Запази прогреса си' : tab === 'login' ? 'Добре дошъл отново!' : 'Създай профил'}
      </h1>
      <p className="mb-6 text-center text-muted">
        {isGuest ? 'Направи профил и всичко, което си постигнал като гост, остава.' : 'Подготвяй се за матурите по БЕЛ с игра.'}
      </p>

      {!isGuest && (
        <div className="mb-5 grid grid-cols-2 rounded-2xl bg-surface-2 p-1" role="tablist">
          {(['login', 'register'] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                'rounded-xl py-2.5 text-sm font-extrabold uppercase tracking-wide',
                tab === t ? 'bg-surface text-secondary shadow-sm' : 'text-muted',
              )}
            >
              {t === 'login' ? 'Вход' : 'Регистрация'}
            </button>
          ))}
        </div>
      )}

      {error && GOOGLE_ERRORS[error] && (
        <div className="mb-4">
          <Alert>{GOOGLE_ERRORS[error]}</Alert>
        </div>
      )}

      {tab === 'login' ? (
        <form action={login} className="space-y-4">
          <input type="hidden" name="next" value={next} />
          <Field label="Имейл">
            <Input name="email" type="email" autoComplete="email" required />
          </Field>
          <Field label="Парола">
            <Input name="password" type="password" autoComplete="current-password" required />
          </Field>
          {loginState.error && <Alert>{loginState.error}</Alert>}
          <p className="text-right text-sm">
            <Link href="/forgot" className="font-bold text-secondary">Забравена парола?</Link>
          </p>
          <Button type="submit" block size="lg" disabled={loggingIn}>
            {loggingIn ? 'Влизане…' : 'Влез'}
          </Button>
        </form>
      ) : (
        <form action={register} className="space-y-4">
          <Field label="Име (вижда се от другите)">
            <Input name="displayName" autoComplete="nickname" required minLength={2} maxLength={30} />
          </Field>
          <Field label="Имейл">
            <Input name="email" type="email" autoComplete="email" required />
          </Field>
          <Field label="Парола" hint="Поне 8 знака.">
            <Input name="password" type="password" autoComplete="new-password" required minLength={8} />
          </Field>
          <BirthFields />
          {regState.error && <Alert>{regState.error}</Alert>}
          <Button type="submit" block size="lg" disabled={registering}>
            {registering ? 'Създаване…' : isGuest ? 'Запази профила' : 'Създай профил'}
          </Button>
        </form>
      )}

      {googleEnabled && (
        <>
          <Divider />
          <a
            href={`/api/auth/google?next=${encodeURIComponent(next)}`}
            className="btn3d card3d flex h-12 w-full items-center justify-center gap-3 rounded-2xl bg-surface font-extrabold text-ink [--btn-shadow:var(--line)]"
          >
            <GoogleIcon /> Продължи с Google
          </a>
        </>
      )}

      {!isGuest && (
        <>
          <Divider />
          <form action={guestAction} className="card3d rounded-2xl bg-surface p-4">
            <input type="hidden" name="next" value={next} />
            <p className="mb-3 font-extrabold text-ink-strong">Пробвай като гост</p>
            <p className="mb-3 text-sm text-muted">Без регистрация. Гостите могат да играят, но не влизат в класациите.</p>
            <div className="mb-3 grid grid-cols-3 gap-2">
              {GRADES.map((g, i) => (
                <label key={g.code} className="cursor-pointer">
                  <input type="radio" name="grade" value={g.code} defaultChecked={i === 2} className="peer sr-only" />
                  <span className="card3d block rounded-xl py-2 text-center text-sm font-extrabold peer-checked:border-secondary peer-checked:bg-secondary/10 peer-checked:text-secondary">
                    {g.label}
                  </span>
                </label>
              ))}
            </div>
            <Button type="submit" variant="outline" block>
              Влез като гост
            </Button>
            <p className="mt-2 text-center text-xs text-muted">
              С влизането приемаш <Link href="/terms" className="underline">Общите условия</Link> и <Link href="/privacy" className="underline">Политиката за поверителност</Link>.
            </p>
          </form>
        </>
      )}
    </div>
  );
}

function Divider() {
  return (
    <div className="my-5 flex items-center gap-3 text-xs font-extrabold uppercase text-muted">
      <span className="h-0.5 flex-1 bg-line" />
      или
      <span className="h-0.5 flex-1 bg-line" />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
