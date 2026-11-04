'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { ChatEvent, ClientToServer, GameState, InviteEvent, ServerToClient } from '@belmaster/shared';

type GameSocket = Socket<ServerToClient, ClientToServer>;

interface Ctx {
  socket: GameSocket | null;
  connected: boolean;
  /** часовникът на сървъра минус локалния (ms) */
  clockOffset: number;
  state: GameState | null;
  chat: ChatEvent[];
  quick: { searching: boolean; since: number | null; offerBot: boolean };
  fifty: { questionId: string; removed: number[] } | null;
  invites: InviteEvent[];
  online: Set<string>;
  lastError: string | null;
  dismissInvite: (id: string) => void;
  clearError: () => void;
}

const GameCtx = createContext<Ctx | null>(null);

export function useGame() {
  const ctx = useContext(GameCtx);
  if (!ctx) throw new Error('useGame outside GameSocketProvider');
  return ctx;
}

export function GameSocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<GameSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [clockOffset, setClockOffset] = useState(0);
  const [state, setState] = useState<GameState | null>(null);
  const [chat, setChat] = useState<ChatEvent[]>([]);
  const [quick, setQuick] = useState<Ctx['quick']>({ searching: false, since: null, offerBot: false });
  const [fifty, setFifty] = useState<Ctx['fifty']>(null);
  const [invites, setInvites] = useState<InviteEvent[]>([]);
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [lastError, setLastError] = useState<string | null>(null);
  const codeRef = useRef<string | null>(null);

  useEffect(() => {
    let s: GameSocket | null = null;
    let cancelled = false;
    (async () => {
      const res = await fetch('/api/game-token', { cache: 'no-store' });
      if (!res.ok || cancelled) return;
      const { token, url } = (await res.json()) as { token: string; url: string };
      s = io(url, { auth: { token }, transports: ['websocket', 'polling'], reconnectionDelayMax: 3000 });
      s.on('connect', () => setConnected(true));
      s.on('disconnect', () => setConnected(false));
      s.on('state', (st) => {
        setClockOffset(st.serverNow - Date.now());
        if (codeRef.current !== st.code) setChat([]);
        codeRef.current = st.code;
        setState(st);
      });
      s.on('left', () => {
        codeRef.current = null;
        setState(null);
        setChat([]);
      });
      s.on('chat', (c) => setChat((prev) => [...prev.slice(-30), c]));
      s.on('quick:status', setQuick);
      s.on('joker:fifty', setFifty);
      s.on('invite', (i) => setInvites((prev) => [...prev.filter((p) => p.id !== i.id), i]));
      s.on('presence', (p) => setOnline(new Set(p.online)));
      s.on('error', (e) => setLastError(e.message));
      setSocket(s);
    })();
    return () => {
      cancelled = true;
      s?.disconnect();
    };
  }, []);

  const dismissInvite = useCallback((id: string) => setInvites((p) => p.filter((i) => i.id !== id)), []);
  const clearError = useCallback(() => setLastError(null), []);

  const value = useMemo(
    () => ({ socket, connected, clockOffset, state, chat, quick, fifty, invites, online, lastError, dismissInvite, clearError }),
    [socket, connected, clockOffset, state, chat, quick, fifty, invites, online, lastError, dismissInvite, clearError],
  );
  return <GameCtx.Provider value={value}>{children}</GameCtx.Provider>;
}
