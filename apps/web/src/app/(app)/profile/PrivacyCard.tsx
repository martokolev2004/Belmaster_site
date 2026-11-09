'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { Download, ShieldCheck, Trash2 } from 'lucide-react';
import { Alert, Button, Card, Field, Input } from '@/components/ui';
import { resendParentAction, resendVerifyAction, type FormState } from '@/app/(auth)/actions';
import { deleteAccountAction } from './actions';

export function PrivacyCard({ email, verified, needsParent, parentEmail, hasPassword }: { email: string | null; verified: boolean; needsParent: boolean; parentEmail: string | null; hasPassword: boolean }) {
  const [vState, verify, verifying] = useActionState<FormState, FormData>(resendVerifyAction, {});
  const [pState, parent, sendingParent] = useActionState<FormState, FormData>(resendParentAction, {});
  const [dState, del, deleting] = useActionState<FormState, FormData>(deleteAccountAction, {});
  const [showDelete, setShowDelete] = useState(false);
  return (
    <Card id="privacy">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-black">
        <ShieldCheck className="size-5 text-secondary" /> Поверителност и сигурност
      </h2>
      <div className="space-y-4 text-sm">
        {email && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold">{email}</span>
            {verified ? (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-extrabold text-primary-dark">потвърден</span>
            ) : (
              <form action={verify}>
                <button disabled={verifying} className="rounded-full bg-accent/25 px-2.5 py-1 text-xs font-extrabold text-ink hover:bg-accent/40">
                  Непотвърден — изпрати линк
                </button>
              </form>
            )}
            {vState.ok && <span className="text-xs font-bold text-primary-dark">{vState.ok}</span>}
            {vState.error && <span className="text-xs font-bold text-error">{vState.error}</span>}
          </div>
        )}

        {needsParent && (
          <form action={parent} className="rounded-2xl border-2 border-accent/50 bg-accent/10 p-3">
            <p className="mb-2 font-bold">Чакаме потвърждение от родител{parentEmail ? ` (${parentEmail})` : ''}. Дотогава не участваш в класации, приятели, класове и битки с други хора.</p>
            <div className="flex flex-wrap gap-2">
              <Input name="parentEmail" type="email" defaultValue={parentEmail ?? ''} placeholder="Имейл на родител" className="min-w-52 flex-1" />
              <Button type="submit" variant="outline" disabled={sendingParent}>
                Изпрати отново
              </Button>
            </div>
            {pState.ok && <p className="mt-2 text-xs font-bold text-primary-dark">{pState.ok}</p>}
            {pState.error && <p className="mt-2 text-xs font-bold text-error">{pState.error}</p>}
          </form>
        )}

        <div className="flex flex-wrap gap-2">
          <a href="/api/me/export" className="inline-flex items-center gap-1.5 rounded-xl bg-surface-2 px-3 py-2 font-extrabold hover:bg-line">
            <Download className="size-4" /> Изтегли данните ми
          </a>
          <button onClick={() => setShowDelete((v) => !v)} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 font-extrabold text-error hover:bg-error/10">
            <Trash2 className="size-4" /> Изтрий профила
          </button>
        </div>
        {showDelete && (
          <form action={del} className="space-y-3 rounded-2xl border-2 border-error/40 bg-error/5 p-3">
            <p className="font-bold">Изтриването е окончателно: губиш XP, нивата, постиженията, рекордите и приятелите си.</p>
            <Field label="Напиши ИЗТРИЙ">
              <Input name="confirm" autoComplete="off" required />
            </Field>
            {hasPassword && (
              <Field label="Паролата ти">
                <Input name="password" type="password" autoComplete="current-password" required />
              </Field>
            )}
            {dState.error && <Alert>{dState.error}</Alert>}
            <Button type="submit" variant="danger" disabled={deleting}>
              {deleting ? '…' : 'Изтрий профила завинаги'}
            </Button>
          </form>
        )}
        <p className="text-xs text-muted">
          <Link href="/privacy" className="underline">Политика за поверителност</Link> · <Link href="/terms" className="underline">Общи условия</Link>
        </p>
      </div>
    </Card>
  );
}
