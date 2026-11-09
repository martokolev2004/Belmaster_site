'use client';

import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { ReportUserButton } from '@/components/report/ReportUserButton';
import { Check, Copy, Swords } from 'lucide-react';
import { Alert, Avatar, Button, Input } from '@/components/ui';
import { useGame } from '@/components/game/GameSocketProvider';
import { cn } from '@/lib/cn';
import type { FormState } from '@/app/(auth)/actions';
import { addFriendAction } from './actions';

export function AddFriendForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(addFriendAction, {});
  return (
    <form action={action} className="space-y-3">
      <div className="flex gap-2">
        <Input name="code" placeholder="Код на приятел (напр. K7Q2MX)" maxLength={6} className="font-mono uppercase tracking-widest" required />
        <Button type="submit" disabled={pending}>
          Добави
        </Button>
      </div>
      {state.error && <Alert>{state.error}</Alert>}
      {state.ok && <Alert tone="green">{state.ok}</Alert>}
    </form>
  );
}

export function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-2 rounded-2xl border-2 border-dashed border-secondary/60 bg-secondary/10 px-4 py-2 font-mono text-2xl font-black tracking-[0.3em] text-secondary"
    >
      {code} {copied ? <Check className="size-5" /> : <Copy className="size-5" />}
    </button>
  );
}

export interface FriendRow {
  id: string;
  name: string;
  color: string;
  avatar?: unknown;
  grade: string | null;
  sameGrade: boolean;
}

export function FriendList({ friends }: { friends: FriendRow[] }) {
  const { socket, online, connected } = useGame();
  useEffect(() => {
    if (!socket || !connected || !friends.length) return;
    const ask = () => socket.emit('presence:query', { uids: friends.map((f) => f.id) });
    ask();
    const t = setInterval(ask, 20_000);
    return () => clearInterval(t);
  }, [socket, connected, friends]);

  return (
    <ul className="card3d divide-y-2 divide-line rounded-2xl bg-surface">
      {friends.map((f) => {
        const on = online.has(f.id);
        return (
          <li key={f.id} className="flex items-center gap-3 px-4 py-3">
            <span className="relative">
              <Avatar name={f.name} avatar={f.avatar} seed={f.id} size={40} />
              <span className={cn('absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-surface', on ? 'bg-primary' : 'bg-line')} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-extrabold text-ink-strong">{f.name}</span>
              <span className="block text-xs text-muted">
                {on ? 'на линия' : 'офлайн'} · {f.grade}
              </span>
            </span>
            <ReportUserButton userId={f.id} name={f.name} />
            {f.sameGrade ? (
              <Link
                href={`/play?invite=${f.id}`}
                className="btn3d inline-flex items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-sm font-extrabold uppercase text-[#4b3b00] [--btn-shadow:var(--color-accent-dark)]"
              >
                <Swords className="size-4" /> Покани
              </Link>
            ) : (
              <span className="text-xs text-muted">друг клас</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
