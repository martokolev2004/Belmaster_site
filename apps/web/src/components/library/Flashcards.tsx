'use client';

import { useEffect, useMemo, useState } from 'react';
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

/** Тесте флаш карти: докосни, за да обърнеш; „Знам“ / „Не знам“. Наученото се помни на това устройство. */
export function Flashcards({ workId, cards }: { workId: string; cards: Flashcard[] }) {
  const key = `bm-fc:${workId}`;
  const [known, setKnown] = useState<string[]>([]);
  const [order, setOrder] = useState<string[]>(() => cards.map((c) => c.id));
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => setKnown(load(key)), [key]);
  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const card = byId.get(order[i]);

  const mark = (ok: boolean) => {
    if (!card) return;
    const next = ok ? [...new Set([...known, card.id])] : known.filter((k) => k !== card.id);
    setKnown(next);
    save(key, next);
    setFlip(false);
    if (i + 1 >= order.length) setDone(true);
    else setTimeout(() => setI(i + 1), 120);
  };
  const restart = (only?: 'unknown', shuffle = false) => {
    let ids = cards.map((c) => c.id);
    if (only) ids = ids.filter((id) => !known.includes(id));
    if (!ids.length) ids = cards.map((c) => c.id);
    if (shuffle) ids = [...ids].sort(() => Math.random() - 0.5);
    setOrder(ids);
    setI(0);
    setFlip(false);
    setDone(false);
  };
  const reset = () => {
    setKnown([]);
    save(key, []);
    restart();
  };

  const learned = cards.filter((c) => known.includes(c.id)).length;
  return (
    <div className="fc">
      <div className="fc-top">
        <div className="fc-bar">
          <i style={{ width: `${(learned / cards.length) * 100}%` }} />
        </div>
        <span>
          {learned}/{cards.length} научени
        </span>
        <button onClick={() => restart(undefined, true)} aria-label="Разбъркай" title="Разбъркай">
          <Shuffle className="size-4" />
        </button>
      </div>

      {done ? (
        <div className="fc-done">
          <p className="text-4xl">{learned === cards.length ? '🏆' : '📚'}</p>
          <p className="ln-display mt-2 text-lg text-white">{learned === cards.length ? 'Знаеш всичко!' : `Знаеш ${learned} от ${cards.length}`}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {learned < cards.length && (
              <button className="fc-btn fc-yes" onClick={() => restart('unknown')}>
                Повтори незнайните
              </button>
            )}
            <button className="fc-btn" onClick={() => restart(undefined, true)}>
              <RotateCcw className="size-4" /> Отначало
            </button>
            {learned > 0 && (
              <button className="fc-btn fc-ghost" onClick={reset}>
                Изчисти наученото
              </button>
            )}
          </div>
        </div>
      ) : card ? (
        <>
          <button className="fc-card" data-flip={flip} onClick={() => setFlip((f) => !f)} aria-label={flip ? 'Покажи въпроса' : 'Покажи отговора'}>
            <span className="fc-face fc-front">
              <small>
                {card.tag} · {i + 1}/{order.length}
                {known.includes(card.id) && ' · ✓'}
              </small>
              <b>{card.front}</b>
              {card.hint && <em>{card.hint}</em>}
              <span className="fc-tap">Докосни, за да видиш отговора</span>
            </span>
            <span className="fc-face fc-back">
              <small>{card.tag === 'Герой' ? `Герой · ${card.front}` : card.tag}</small>
              {Array.isArray(card.back) ? (
                <ul>
                  {card.back.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              ) : (
                <p>{card.back}</p>
              )}
            </span>
          </button>
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
