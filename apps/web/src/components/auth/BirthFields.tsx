'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Field, Input } from '@/components/ui';

const MONTHS = ['януари', 'февруари', 'март', 'април', 'май', 'юни', 'юли', 'август', 'септември', 'октомври', 'ноември', 'декември'];
const CONSENT_AGE = 14;

function age(d: number, m: number, y: number) {
  if (!d || !m || !y) return null;
  const now = new Date();
  let a = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) a--;
  return a;
}

/** Дата на раждане + (под 14 г.) имейл на родител + съгласие с условията. */
export function BirthFields({ withTerms = true }: { withTerms?: boolean }) {
  const [d, setD] = useState(0);
  const [m, setM] = useState(0);
  const [y, setY] = useState(0);
  const a = age(d, m, y);
  const child = a != null && a < CONSENT_AGE;
  const year = new Date().getFullYear();
  const sel = 'h-12 w-full rounded-2xl border-2 border-line bg-surface-2 px-3 font-bold text-ink focus:border-secondary focus:outline-none';
  return (
    <>
      <Field label="Дата на раждане">
        <div className="grid grid-cols-[1fr_1.6fr_1.2fr] gap-2">
          <select name="birthDay" required className={sel} value={d || ''} onChange={(e) => setD(Number(e.target.value))}>
            <option value="">Ден</option>
            {Array.from({ length: 31 }, (_, i) => (
              <option key={i} value={i + 1}>{i + 1}</option>
            ))}
          </select>
          <select name="birthMonth" required className={sel} value={m || ''} onChange={(e) => setM(Number(e.target.value))}>
            <option value="">Месец</option>
            {MONTHS.map((n, i) => (
              <option key={n} value={i + 1}>{n}</option>
            ))}
          </select>
          <select name="birthYear" required className={sel} value={y || ''} onChange={(e) => setY(Number(e.target.value))}>
            <option value="">Година</option>
            {Array.from({ length: 70 }, (_, i) => year - 9 - i).map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>
      </Field>
      {child && (
        <div className="rounded-2xl border-2 border-accent/50 bg-accent/10 p-3">
          <p className="mb-2 text-sm font-bold text-ink">Под 14 години си — по закон е нужно съгласие на родител. Ще му изпратим имейл с линк за потвърждение. Дотогава можеш да учиш и да играеш срещу бота, но не влизаш в класациите, приятелите и битките с други хора.</p>
          <Field label="Имейл на родител">
            <Input name="parentEmail" type="email" required />
          </Field>
        </div>
      )}
      {withTerms && (
        <label className="flex items-start gap-2.5 text-sm">
          <input type="checkbox" name="terms" required className="mt-0.5 size-5 shrink-0 accent-[var(--color-primary)]" />
          <span>
            Приемам{' '}
            <Link href="/terms" target="_blank" className="font-bold text-secondary underline">
              общите условия
            </Link>{' '}
            и{' '}
            <Link href="/privacy" target="_blank" className="font-bold text-secondary underline">
              политиката за поверителност
            </Link>
            .
          </span>
        </label>
      )}
    </>
  );
}
