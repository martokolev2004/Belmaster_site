'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, RotateCcw, Shuffle, X } from 'lucide-react';
import type { Flashcard } from '@/lib/flashcards';

const load = (k: string): string[] => {
  try {
    return JSON.parse(localStorage.getItem(k) ?? '[]');
  } catch {
    return [];
  }
};
const save = (k: string, v: string[]) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};

/** вид карта → цвят и знак */
const KIND: Record<string, { c: string; ic: string }> = {
  Автор: { c: '#6ea2ff', ic: '✍️' },
  Жанр: { c: '#5fe0d0', ic: '📚' },
  Сюжет: { c: '#c59bff', ic: '📖' },
  Герой: { c: '#ff8a5c', ic: '🎭' },
  Теми: { c: '#ffd166', ic: '💡' },
  'За автора': { c: '#8fb0ff', ic: '🖋️' },
};

/** Тесте флаш карти: докосни = обръщане; плъзни надясно = „Знам“, наляво = „Не знам“. */
export function Flashcards({ workId, cards }: { workId: string; cards: Flashcard[] }) {
  const key = `bm-fc:${workId}`;
  const [known, setKnown] = useState<string[]>([]);
  const [order, setOrder] = useState<string[]>(() => cards.map((c) => c.id));
  const [res, setRes] = useState<Record<string, boolean>>({});
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  const [fly, setFly] = useState<'yes' | 'no' | null>(null);
  const [dx, setDx] = useState(0);
  const drag = useRef<{ x: number; moved: boolean } | null>(null);
  useEffect(() => setKnown(load(key)), [key]);
  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const done = i >= order.length;
  const card = byId.get(order[i]);
  const kind = KIND[card?.tag ?? ''] ?? KIND['Автор'];

  const mark = (ok: boolean) => {
    if (!card || fly) return;
    const next = ok ? [...new Set([...known, card.id])] : known.filter((k) => k !== card.id);
    setKnown(next);
    save(key, next);
    setRes((r) => ({ ...r, [card.id]: ok }));
    setFly(ok ? 'yes' : 'no');
    setTimeout(() => {
      setFly(null);
      setDx(0);
      setFlip(false);
      setI((n) => n + 1);
    }, 320);
  };
  const restart = (onlyUnknown = false, shuffle = false) => {
    let ids = cards.map((c) => c.id);
    if (onlyUnknown) ids = ids.filter((id) => !known.includes(id));
    if (!ids.length) ids = cards.map((c) => c.id);
    if (shuffle) ids = [...ids].sort(() => Math.random() - 0.5);
    setOrder(ids);
    setRes({});
    setI(0);
    setFlip(false);
  };

  // плъзгане с пръст (след като картата е обърната)
  const down = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, moved: false };
  };
  const move = (e: React.PointerEvent) => {
    if (!drag.current || !flip) return;
    const d = e.clientX - drag.current.x;
    if (Math.abs(d) > 6) drag.current.moved = true;
    setDx(d);
  };
  const up = () => {
    const moved = drag.current?.moved;
    drag.current = null;
    if (moved && Math.abs(dx) > 90) return mark(dx > 0);
    setDx(0);
    if (!moved) setFlip((f) => !f);
  };

  const learned = cards.filter((c) => known.includes(c.id)).length;
  const sessionOk = Object.values(res).filter(Boolean).length;
  return (
    <div className="fc">
      <div className="fc-top">
        <div className="fc-segs" aria-label={`${learned} от ${cards.length} научени`}>
          {order.map((id, n) => (
            <i key={id} data-s={id in res ? (res[id] ? 'ok' : 'no') : n === i ? 'now' : known.includes(id) ? 'known' : ''} />
          ))}
        </div>
        <button onClick={() => restart(false, true)} aria-label="Разбъркай" title="Разбъркай">
          <Shuffle className="size-4" />
        </button>
      </div>

      {done ? (
        <div className="fc-done animate-rise">
          <div className="fc-ring" style={{ '--p': (sessionOk / Math.max(1, order.length)) * 100 } as React.CSSProperties}>
            <b className="ln-display">
              {sessionOk}/{order.length}
            </b>
          </div>
          <p className="ln-display fc-done-t">{sessionOk === order.length ? 'Знаеш всичко!' : sessionOk >= order.length / 2 ? 'Почти си там!' : 'Още малко упражнение'}</p>
          <p className="fc-done-s">
            Общо научени: {learned} от {cards.length}
          </p>
          <div className="fc-done-btns">
            {learned < cards.length && (
              <button className="fc-btn fc-yes" onClick={() => restart(true)}>
                Повтори незнайните
              </button>
            )}
            <button className="fc-btn" onClick={() => restart(false, true)}>
              <RotateCcw className="size-4" /> Отначало
            </button>
            {learned > 0 && (
              <button
                className="fc-btn fc-ghost"
                onClick={() => {
                  setKnown([]);
                  save(key, []);
                  restart();
                }}
              >
                Изчисти наученото
              </button>
            )}
          </div>
        </div>
      ) : card ? (
        <>
          <div className="fc-deck" style={{ '--c': kind.c } as React.CSSProperties}>
            {order.length - i > 2 && <span className="fc-under fc-under-2" />}
            {order.length - i > 1 && <span className="fc-under fc-under-1" />}
            <div
              key={card.id}
              className="fc-card"
              data-flip={flip}
              data-fly={fly ?? undefined}
              data-drag={dx !== 0 || undefined}
              style={{ '--dx': `${dx}px`, '--rot': `${dx / 18}deg` } as React.CSSProperties}
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={() => ((drag.current = null), setDx(0))}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && (e.preventDefault(), setFlip((f) => !f))}
              aria-label={flip ? 'Покажи въпроса' : 'Покажи отговора'}
            >
              <div className="fc-inner">
                <div className="fc-face fc-front">
                  <span className="fc-wm" aria-hidden>
                    {kind.ic}
                  </span>
                  <div className="fc-head">
                    <span className="fc-tag">
                      {kind.ic} {card.tag}
                    </span>
                    <span className="fc-num">
                      {String(i + 1).padStart(2, '0')}
                      <small>/{String(order.length).padStart(2, '0')}</small>
                    </span>
                  </div>
                  <p className="ln-display fc-q">{card.front}</p>
                  {card.hint && <p className="fc-hint">{card.hint}</p>}
                  <span className="fc-tap">↻ Докосни, за да обърнеш</span>
                </div>
                <div className="fc-face fc-back">
                  <div className="fc-head">
                    <span className="fc-tag">{card.tag === 'Герой' ? `🎭 ${card.front}` : `${kind.ic} ${card.tag}`}</span>
                    {known.includes(card.id) && <span className="fc-known">✓ знаеш я</span>}
                  </div>
                  <div className="fc-a" data-short={!Array.isArray(card.back) && card.back.length < 40}>
                    {Array.isArray(card.back) ? (
                      <ul>
                        {card.back.map((b) => (
                          <li key={b}>{b}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>{card.back}</p>
                    )}
                  </div>
                  <span className="fc-tap">← не знам · плъзни · знам →</span>
                </div>
              </div>
              {dx !== 0 && <span className="fc-stamp" data-ok={dx > 0} style={{ opacity: Math.min(1, Math.abs(dx) / 90) }}>{dx > 0 ? 'ЗНАМ' : 'НЕ ЗНАМ'}</span>}
            </div>
          </div>
          <div className="fc-actions" data-show={flip}>
            <button className="fc-btn fc-no" onClick={() => mark(false)} disabled={!flip}>
              <X className="size-5" /> Не знам
            </button>
            <button className="fc-btn fc-yes" onClick={() => mark(true)} disabled={!flip}>
              <Check className="size-5" /> Знам
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
