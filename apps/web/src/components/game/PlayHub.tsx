'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { MODE_LABELS, type GameMode } from '@belmaster/shared';
import { BookOpen, Bot, Hash, Plus, Shuffle, Swords, Zap } from 'lucide-react';
import { Alert, Button, Input } from '@/components/ui';
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
        <p className="ln-eyebrow mb-3">Режим</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(MODE_LABELS) as GameMode[]).map((m) => (
            <button key={m} onClick={() => setMode(m)} data-on={mode === m} className="nx-panel ph-mode" style={{ '--c': m === 'CLASSIC' ? '#6ea2ff' : '#ffd166' } as React.CSSProperties}>
              <span className="nx-tile-ic">{m === 'CLASSIC' ? <Shuffle className="size-6" /> : <BookOpen className="size-6" />}</span>
              <span className="min-w-0">
                <span className="ln-display nx-tile-t block">{MODE_LABELS[m].name}</span>
                <span className="mt-1 block text-sm font-semibold text-muted">{MODE_LABELS[m].description}</span>
              </span>
              <span className="ph-check" aria-hidden>
                ✓
              </span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <p className="ln-eyebrow mb-3">Как ще играеш</p>
        <div className="grid gap-3 md:grid-cols-3">
          <ActionCard
            icon={<Zap className="size-6" />}
            c="#6ea2ff"
            title="Бърза игра"
            text="1 на 1 със случаен съперник от твоя клас."
            action={
              <Button
                block
                disabled={!connected || quick.searching}
                onClick={() => {
                  wantRoom.current = true;
                  socket?.emit('quick:join', { mode });
                }}
              >
                Търси съперник
              </Button>
            }
          />
          <ActionCard
            icon={<Plus className="size-6" />}
            c="#5fe0d0"
            title="Нова стая"
            text="За 2–4 приятели — с код или линк."
            action={
              <Button variant="outline" block disabled={!connected} onClick={create}>
                Създай стая
              </Button>
            }
          />
          <ActionCard
            icon={<Bot className="size-6" />}
            c="#c59bff"
            title="Упражнение"
            text="Срещу бот, без рейтинг. Добре за загрявка."
            action={
              <Button
                variant="outline"
                block
                disabled={!connected}
                onClick={() => {
                  wantRoom.current = true;
                  socket?.emit('bot:start', { mode });
                }}
              >
                Играй с бота
              </Button>
            }
          />
        </div>
      </section>

      <section className="nx-panel ph-code">
        <p className="ln-display nx-tile-t flex items-center gap-2">
          <Hash className="size-5 text-muted" /> Имаш код?
        </p>
        <form
          className="flex flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim().length >= 4) router.push(`/play/${code.trim().toUpperCase()}`);
          }}
        >
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="НАПР. K7Q2MX" maxLength={6} className="font-mono tracking-widest" />
          <Button type="submit" variant="outline" disabled={code.trim().length < 4}>
            Влез
          </Button>
        </form>
      </section>

      {!connected && <p className="text-center text-sm text-muted">Свързване с игровия сървър…</p>}
      {quick.searching && <Searching since={quick.since} mode={mode} />}
      {!quick.searching && quick.offerBot && <NoOpponent mode={mode} onBot={() => (wantRoom.current = true)} />}
    </div>
  );
}

function ActionCard({ icon, c, title, text, action }: { icon: React.ReactNode; c: string; title: string; text: string; action: React.ReactNode }) {
  return (
    <div className="nx-panel ph-act" style={{ '--c': c } as React.CSSProperties}>
      <span className="nx-tile-ic">{icon}</span>
      <p className="ln-display nx-tile-t mt-4">{title}</p>
      <p className="mb-5 mt-1 flex-1 text-sm font-semibold text-muted">{text}</p>
      {action}
    </div>
  );
}

function Searching({ since, mode }: { since: number | null; mode: GameMode }) {
  const { socket } = useGame();
  const elapsed = useCountdown(since ? since + 3_600_000 : null);
  const secs = since ? Math.floor((3_600_000 - elapsed) / 1000) : 0;
  void mode;
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
        <Button variant="ghost" block className="mt-3" onClick={() => socket?.emit('quick:leave')}>
          Откажи
        </Button>
      </div>
    </div>
  );
}

/** Никой не се появи — казваме го и предлагаме бот или нов опит. */
function NoOpponent({ mode, onBot }: { mode: GameMode; onBot: () => void }) {
  const { socket } = useGame();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card3d w-full max-w-sm animate-pop rounded-3xl bg-surface p-6 text-center">
        <p className="text-5xl">😴</p>
        <p className="mt-2 text-xl font-black">Няма свободен съперник</p>
        <p className="mt-1 text-sm text-muted">В момента никой от твоя клас не търси битка. Опитай пак след малко, покани приятел или играй срещу бота.</p>
        <div className="mt-4 space-y-2">
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
          <Button variant="outline" block onClick={() => socket?.emit('quick:join', { mode })}>
            Опитай пак
          </Button>
          <Button variant="ghost" block onClick={() => socket?.emit('quick:leave')}>
            Затвори
          </Button>
        </div>
      </div>
    </div>
  );
}
