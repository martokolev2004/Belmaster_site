'use client';

// Кратки звуци, синтезирани в браузъра (без файлове). Включват/изключват се от бутона в битката.
let ctx: AudioContext | null = null;
const KEY = 'bm_sound';

export function soundEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setSoundEnabled(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    /* няма localStorage */
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.12) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, ctx.currentTime + start);
  g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
  g.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
  o.connect(g).connect(ctx.destination);
  o.start(ctx.currentTime + start);
  o.stop(ctx.currentTime + start + dur + 0.05);
}

export type Sfx = 'correct' | 'wrong' | 'capture' | 'lost' | 'hit' | 'win' | 'lose' | 'tick' | 'turn' | 'unlock' | 'levelup';

export function play(s: Sfx) {
  if (typeof window === 'undefined' || !soundEnabled()) return;
  try {
    ctx = ctx ?? new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    return;
  }
  switch (s) {
    case 'correct': tone(660, 0, 0.12, 'triangle'); tone(990, 0.1, 0.18, 'triangle'); break;
    case 'wrong': tone(300, 0, 0.18, 'sawtooth', 0.06); tone(220, 0.15, 0.25, 'sawtooth', 0.06); break;
    case 'capture': tone(523, 0, 0.1, 'square', 0.06); tone(784, 0.09, 0.2, 'square', 0.06); break;
    case 'lost': tone(392, 0, 0.15, 'triangle'); tone(262, 0.13, 0.3, 'triangle'); break;
    case 'hit': tone(120, 0, 0.25, 'square', 0.1); tone(80, 0.05, 0.3, 'sine', 0.15); break;
    case 'win': [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.25, 'triangle')); break;
    case 'lose': [392, 349, 294].forEach((f, i) => tone(f, i * 0.16, 0.3, 'triangle')); break;
    case 'tick': tone(1200, 0, 0.04, 'square', 0.03); break;
    case 'unlock': tone(1568, 0, 0.06, 'square', 0.04); tone(2093, 0.07, 0.1, 'triangle', 0.08); tone(1319, 0.2, 0.35, 'sine', 0.1); break;
    case 'levelup': [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.09, 0.3, 'triangle', 0.1)); break;
    case 'turn': tone(880, 0, 0.08, 'sine'); tone(1175, 0.08, 0.12, 'sine'); break;
  }
}
