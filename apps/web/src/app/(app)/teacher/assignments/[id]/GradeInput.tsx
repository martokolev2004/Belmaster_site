'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { gradeAction } from '../../actions';
import { cn } from '@/lib/cn';

/** Точки за един въпрос на един ученик (ръчна проверка или промяна). */
export function GradeInput({ submissionId, questionId, max, value, auto }: { submissionId: string; questionId: string; max: number; value: number | null; auto: number | null }) {
  const [v, setV] = useState(value != null ? String(value) : '');
  const [state, setState] = useState<'idle' | 'saved' | 'error'>('idle');
  const [pending, start] = useTransition();
  const router = useRouter();
  const save = () => {
    const n = v.trim() === '' ? null : Number(v.replace(',', '.'));
    if (n != null && (Number.isNaN(n) || n < 0 || n > max)) return setState('error');
    start(async () => {
      const r = await gradeAction(submissionId, questionId, n);
      setState(r.error ? 'error' : 'saved');
      router.refresh();
    });
  };
  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        value={v}
        onChange={(e) => (setV(e.target.value), setState('idle'))}
        onBlur={save}
        onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
        inputMode="decimal"
        placeholder={auto != null ? String(auto) : '?'}
        disabled={pending}
        className={cn(
          'h-9 w-16 rounded-lg border-2 bg-surface px-2 text-center font-black',
          state === 'error' ? 'border-error' : state === 'saved' ? 'border-primary' : value == null && auto == null ? 'border-accent' : 'border-line',
        )}
      />
      <span className="text-sm font-bold text-muted">/ {max}</span>
    </span>
  );
}
