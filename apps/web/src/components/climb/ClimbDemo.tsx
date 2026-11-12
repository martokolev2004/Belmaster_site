'use client';

import { useEffect, useState } from 'react';
import { CLIMB, type ClimbOutcome, type ClimbPlayer, type ClimbState, type ClimbTheme } from '@belmaster/shared';
import { ClimbStage } from './ClimbStage';

const base = (uid: string, name: string, color: string, height: number, weapon: string): ClimbPlayer => ({
  uid, name, avatar: null, frame: 'none', weapon, color, isBot: false, isGuest: false, height, shieldUsed: false, shieldArmed: false,
  connected: true, left: false, correct: 0, answered: 0, ready: true, jokers: { fifty: false, time: false },
});

/** Сценарий за демото: [действие, височина на А, височина на Б] — върти се в кръг. */
const SCRIPT: { o: ClimbOutcome; h: [number, number] }[] = [
  { o: { kind: 'climb', actorUid: 'a' }, h: [4, 3] },
  { o: { kind: 'climb', actorUid: 'b' }, h: [4, 4] },
  { o: { kind: 'hit', actorUid: 'a', targetUid: 'b', weapon: 'stone', pos: 0.5, targetAtGround: false }, h: [4, 3] },
  { o: { kind: 'climb', actorUid: 'a' }, h: [5, 3] },
  { o: { kind: 'reflect', actorUid: 'a', targetUid: 'b', weapon: 'book', pos: 0.5, actorAtGround: false }, h: [4, 3] },
  { o: { kind: 'miss', actorUid: 'b', targetUid: 'a', weapon: 'ball', pos: 0.1, actorAtGround: false }, h: [4, 2] },
  { o: { kind: 'climb', actorUid: 'b' }, h: [4, 3] },
  { o: { kind: 'hit', actorUid: 'b', targetUid: 'a', weapon: 'ball', pos: 0.5, targetAtGround: false }, h: [3, 3] },
];

/** Живо демо за началото на „Към върха“ — без връзка със сървъра. */
export function ClimbDemo({ theme = 'night' }: { theme?: ClimbTheme }) {
  const [step, setStep] = useState(-1);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % SCRIPT.length), 3200);
    return () => clearInterval(t);
  }, []);
  const cur = step < 0 ? null : SCRIPT[step];
  const h = cur?.h ?? [3, 3];
  const state: ClimbState = {
    code: 'DEMO', theme, grade: 'G12', phase: 'resolve', you: '', hostUid: 'a', vsBot: false, isQuick: false,
    players: [base('a', 'Ти', '#ff4b4b', h[0], 'stone'), base('b', 'Противник', '#1cb0f6', h[1], 'ball')],
    questionNo: 1, maxQuestions: CLIMB.MAX_QUESTIONS, question: null, reveal: null, actorUid: null, aim: null,
    outcome: cur ? { ...cur.o, id: step + 1, outcomes: [cur.o] } : null,
    deadline: null, winnerUid: null, draw: false, log: [], matchId: null, ratingDelta: null, rematchCode: null, serverNow: 0,
  };
  return <ClimbStage state={state} />;
}
