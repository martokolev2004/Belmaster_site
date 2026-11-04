'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { MODE_LABELS, type GameMode } from '@belmaster/shared';
import { BookOpen, Bot, Hash, Plus, Shuffle, Swords, Zap } from 'lucide-react';
import { Alert, Button, Input } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useGame } from './GameSocketProvider';
import { useCountdown } from './useCountdown';

export function PlayHub({ inviteUid, inviteName, hasQuestions }: { inviteUid: string | null; inviteName: string | null; hasQuestions: boolean }) {
  const { socket, connected, state, quick, lastError, clearError } = useGame();
  const router = useRouter();
  const [mode, setMode] = useState<GameMode>('CLASSIC');
  const [code, setCode] = useState('');
  const pendingInvite = useRef<string | null>(inviteUid);
  const wantRoom = useRef(false);

  // когато влезем в стая — отиваме на нейната страница (и изпращаме поканата, ако има)
  useEffect(() => {
    if (!state || !socket) return;
    if (wantRoom.current && pendingInvite.current && state.phase === 'lobby') {
      socket.emit('invite:send', { toUid: pendingInvite.current, code: state.code });
      pendingInvite.current = null;
    }
    if (wantRoom.current) router.push(`/play/${state.code}`);
  }, [state, socket, router]);

  const create = () => {
    clearError();
    wantRoom.current = true;
    socket?.emit('lobby:create', { mode });
  };

  return (
    <div className="space-y-6">
      {!hasQuestions && <Alert tone="blue">За твоя клас още няма въпроси в базата — битките ще тръгнат, щом бъдат добавени.</Alert>}
      {lastError && <Alert>{lastError}</Alert>}
      {state && state.phase !== 'finished' && !wantRoom.current && (
        <a href={`/play/${state.code}`} className="block">
          <Alert tone="blue">{state.phase === 'lobby' ? `Имаш отворена стая ${state.code} — върни се в нея.` : `Битката ти (${state.code}) продължава — върни се!`}</Alert>
        </a>
      )}
      {inviteName && <Alert tone="green">Създай стая — {inviteName} ще получи покана веднага.</Alert>}

      <section>
        <p className="mb-2 text-sm font-extrabold uppercase text-muted">Режим</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(MODE_LABELS) as GameMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn('card3d flex items-start gap-3 rounded-2xl bg-surface p-4 text-left transition', mode === m ? 'border-secondary! bg-secondary/10' : 'hover:bg-surface-2')}
            >
              <span className={cn('rounded-xl p-2.5', m === 'CLASSIC' ? 'bg-primary/15 text-primary' : 'bg-accent/20 text-[#b88600]')}>
                {m === 'CLASSIC' ? <Shuffle className="size-6" /> : <BookOpen className="size-6" />}
              </span>
              <span>
                <span className="block text-lg font-extrabold text-ink-strong">{MODE_LABELS[m].name}</span>
                <span className="block text-sm text-muted">{MODE_LABELS[m].description}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <ActionCard
          icon={<Zap className="size-7" />}
          tone="bg-accent text-[#4b3b00]"
          title="Бърза игра"
          text="1 на 1 със случаен съперник от твоя клас."
          action={
            <Button
              variant="accent"
              block
              disabled={!connected || quick.searching}
              onClick={() => {
                wantRoom.current = true;
                socket?.emit('quick:join', { mode });
              }}
            >
              Търси
            </Button>
          }
        />
        <ActionCard
          icon={<Plus className="size-7" />}
          tone="bg-primary text-white"
          title="Нова стая"
          text="За 2–4 приятели — с код или линк."
          action={
            <Button block disabled={!connected} onClick={create}>
              Създай
            </Button>
          }
        />
        <ActionCard
          icon={<Bot className="size-7" />}
          tone="bg-purple text-white"
          title="Упражнение"
          text="Срещу бот, без рейтинг. Добре за загрявка."
          action={
            <Button
              variant="purple"
              block
              disabled={!connected}
              onClick={() => {
                wantRoom.current = true;
                socket?.emit('bot:start', { mode });
              }}
            >
              Играй
            </Button>
          }
        />
      </section>

      <section className="card3d rounded-2xl bg-surface p-4">
        <p className="mb-2 flex items-center gap-2 font-extrabold">
          <Hash className="size-5 text-muted" /> Имаш код?
        </p>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim().length >= 4) router.push(`/play/${code.trim().toUpperCase()}`);
          }}
        >
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="НАПР. K7Q2MX" maxLength={6} className="font-mono tracking-widest" />
          <Button type="submit" variant="secondary" disabled={code.trim().length < 4}>
            Влез
          </Button>
        </form>
      </section>

      {!connected && <p className="text-center text-sm text-muted">Свързване с игровия сървър…</p>}
      {quick.searching && <Searching since={quick.since} offerBot={quick.offerBot} mode={mode} onBot={() => (wantRoom.current = true)} />}
    </div>
  );
}

function ActionCard({ icon, tone, title, text, action }: { icon: React.ReactNode; tone: string; title: string; text: string; action: React.ReactNode }) {
  return (
    <div className="card3d flex flex-col rounded-2xl bg-surface p-4">
      <span className={cn('mb-3 inline-flex w-fit rounded-2xl p-3', tone)}>{icon}</span>
      <p className="text-lg font-extrabold text-ink-strong">{title}</p>
      <p className="mb-4 flex-1 text-sm text-muted">{text}</p>
      {action}
    </div>
  );
}

function Searching({ since, offerBot, mode, onBot }: { since: number | null; offerBot: boolean; mode: GameMode; onBot: () => void }) {
  const { socket } = useGame();
  const elapsed = useCountdown(since ? since + 3_600_000 : null);
  const secs = since ? Math.floor((3_600_000 - elapsed) / 1000) : 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card3d w-full max-w-sm animate-pop rounded-3xl bg-surface p-6 text-center">
        <div className="relative mx-auto mb-4 size-20">
          <span className="absolute inset-0 animate-ping rounded-full bg-accent/40" />
          <span className="relative flex size-20 items-center justify-center rounded-full bg-accent text-[#4b3b00]">
            <Swords className="size-9" />
          </span>
        </div>
        <p className="text-xl font-black">Търсим съперник…</p>
        <p className="mt-1 tabular-nums text-muted">{secs} с</p>
        {offerBot && (
          <div className="mt-4">
            <p className="mb-2 text-sm text-muted">Никой не е свободен в момента. Искаш ли да играеш срещу бот?</p>
            <Button
              variant="purple"
              block
              onClick={() => {
                onBot();
                socket?.emit('bot:start', { mode });
              }}
              icon={<Bot className="size-5" />}
            >
              Играй срещу бот
            </Button>
          </div>
        )}
        <Button variant="ghost" block className="mt-3" onClick={() => socket?.emit('quick:leave')}>
          Откажи
        </Button>
      </div>
    </div>
  );
}
