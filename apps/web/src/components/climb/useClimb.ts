'use client';

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { ClimbClientToServer, ClimbServerToClient, ClimbState } from '@belmaster/shared';

export type ClimbSocket = Socket<ClimbServerToClient, ClimbClientToServer>;

/** Връзка с „Към върха“ (отделен канал /climb на игровия сървър). */
export function useClimb() {
  const [socket, setSocket] = useState<ClimbSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState<ClimbState | null>(null);
  const [offset, setOffset] = useState(0);
  const [quick, setQuick] = useState<{ searching: boolean; since: number | null; offerBot: boolean }>({ searching: false, since: null, offerBot: false });
  const [error, setError] = useState<string | null>(null);
  const [chat, setChat] = useState<{ uid: string; key: string; at: number }[]>([]);
  const codeRef = useRef<string | null>(null);

  useEffect(() => {
    let s: ClimbSocket | null = null;
    let cancelled = false;
    (async () => {
      const res = await fetch('/api/game-token', { cache: 'no-store' });
      if (!res.ok || cancelled) return;
      const { token, url } = (await res.json()) as { token: string; url: string };
      s = io(`${url || window.location.origin}/climb`, { auth: { token }, transports: ['polling', 'websocket'], reconnectionDelayMax: 3000 });
      s.on('connect', () => setConnected(true));
      s.on('disconnect', () => setConnected(false));
      s.on('state', (st) => {
        setOffset(st.serverNow - Date.now());
        if (codeRef.current !== st.code) setChat([]);
        codeRef.current = st.code;
        setState(st);
      });
      s.on('left', () => {
        codeRef.current = null;
        setState(null);
      });
      s.on('quick', setQuick);
      s.on('error', (e) => setError(e.message));
      s.on('chat', (c) => setChat((p) => [...p.slice(-10), c]));
      setSocket(s);
    })();
    return () => {
      cancelled = true;
      s?.disconnect();
    };
  }, []);

  return { socket, connected, state, offset, quick, error, clearError: () => setError(null), chat };
}

/** Секундите до краен срок (по часовника на сървъра). */
export function useLeft(deadline: number | null | undefined, offset: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [deadline]);
  return deadline ? Math.max(0, deadline - (now + offset)) : 0;
}
