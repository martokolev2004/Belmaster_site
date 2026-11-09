'use client';

import { useState, useTransition } from 'react';
import { Flag } from 'lucide-react';
import { reportUserAction } from '@/app/actions/report-user';
import { USER_REPORT_REASONS } from '@/lib/report-reasons';

/** Малко знаме „Докладвай“ до името на друг потребител. */
export function ReportUserButton({ userId, name }: { userId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>(USER_REPORT_REASONS[0]);
  const [msg, setMsg] = useState('');
  const [res, setRes] = useState<{ ok?: string; error?: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <span className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} title={`Докладвай ${name}`} aria-label={`Докладвай ${name}`} className="rounded-lg p-1.5 text-muted/60 hover:bg-error/10 hover:text-error">
        <Flag className="size-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-30 w-72 rounded-2xl border-2 border-line bg-surface p-3 text-left text-sm shadow-xl">
          {res?.ok ? (
            <p className="font-bold text-primary-dark">{res.ok}</p>
          ) : (
            <>
              <p className="mb-2 font-extrabold">Докладвай „{name}“</p>
              <div className="space-y-1">
                {USER_REPORT_REASONS.map((r) => (
                  <label key={r} className="flex items-center gap-2">
                    <input type="radio" checked={reason === r} onChange={() => setReason(r)} /> {r}
                  </label>
                ))}
              </div>
              <textarea value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={500} rows={2} placeholder="Какво се случи? (по желание)" className="mt-2 w-full rounded-xl border-2 border-line bg-bg p-2 text-sm" />
              {res?.error && <p className="mt-1 text-xs font-bold text-error">{res.error}</p>}
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className="rounded-xl px-3 py-1.5 font-bold text-muted">
                  Отказ
                </button>
                <button type="button" disabled={pending} onClick={() => start(async () => setRes(await reportUserAction(userId, reason, msg)))} className="rounded-xl bg-error px-3 py-1.5 font-extrabold text-white">
                  Изпрати
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </span>
  );
}
