'use client';

/**
 * ТЕСТ (/test): нов вид на „Кула на Словото“ — кран с въже, етажи с обем, небе, което се сменя с височината,
 * камера, прах, искри и срутване. Без въпроси и без сървър; правилата за пускане са същите (simulateDrop).
 */
import { useEffect, useRef, useState } from 'react';
import { TOWER, TOWER_BASE_W, craneX, floorSize, newTowerSim, simulateDrop, swayX, topX, towerHeight, type TowerSim } from '@belmaster/shared';

const VW = 450;
const VH = 800;
const GROUND = 706;
const HOOK_Y = 150;
const NS = 'http://www.w3.org/2000/svg';
const INK = '#141a33';
const PALETTE: [string, string][] = [
  ['#f7e8c9', '#d6b98a'],
  ['#f4a98f', '#c9705a'],
  ['#92d6ca', '#4fa699'],
  ['#f6d274', '#c99a2e'],
  ['#bdb8f3', '#7f78c9'],
  ['#f5b8d2', '#c9779c'],
  ['#aad3f7', '#5f96c9'],
];
const ease = {
  out: (k: number) => 1 - (1 - k) ** 3,
  back: (k: number) => 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2,
  elastic: (k: number) => (k === 0 || k === 1 ? k : 2 ** (-10 * k) * Math.sin((k * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
};
const rnd = (seed: number, i: number, k: number) => {
  const v = Math.sin(seed * 9301 + i * 49.297 + k * 233.11) * 43758.5453;
  return v - Math.floor(v);
};
/** Небето според височината (в единици на кулата): зора → ден → стратосфера → космос. */
const SKY: [number, string, string, string][] = [
  [0, '#3b6fd6', '#8fc3f5', '#ffd9b0'],
  [500, '#2f7ae0', '#6fb7f7', '#cfeaff'],
  [1400, '#173f9e', '#3f7ee0', '#9fd0ff'],
  [2600, '#0a1650', '#1c3a96', '#4f7fe0'],
  [4200, '#03051a', '#0a1240', '#1a2a70'],
];
const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mix = (a: string, b: string, k: number) => {
  const A = hex(a), B = hex(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',')})`;
};

/** Рисунката на един етаж; начало = средата на долния ръб. */
function floorArt(w: number, h: number, i: number, seed: number): string {
  const [c0, c1] = PALETTE[Math.floor(rnd(seed, i, 7) * PALETTE.length)];
  const x = -w / 2;
  const n = w >= 150 ? 3 : 2;
  const wh = Math.min(h - 16, 27), ww = 21, wy = -h + (h - wh) / 2 + 2;
  let s = `<rect x="${x}" y="${-h}" width="${w}" height="${h}" rx="5" fill="${c0}" stroke="${INK}" stroke-width="2.5"/>`;
  s += `<rect x="${x + w * 0.76}" y="${-h + 1.5}" width="${w * 0.24 - 1.5}" height="${h - 3}" fill="#1a1440" opacity=".12"/>`;
  s += `<rect x="${x + 2}" y="${-h + 2}" width="5" height="${h - 4}" rx="2" fill="#fff" opacity=".35"/>`;
  s += `<rect x="${x + 1.3}" y="-8" width="${w - 2.6}" height="6.7" fill="${c1}"/>`;
  for (let k = 0; k < n; k++) {
    const cx = x + (w * (k + 0.5)) / n;
    if (i === 0 && k === Math.floor(n / 2)) {
      s += `<rect x="${cx - 10}" y="${-h + 9}" width="20" height="${h - 9}" rx="3" fill="#7a4a2b" stroke="${INK}" stroke-width="2.5"/><circle cx="${cx + 5}" cy="${-(h - 9) / 2}" r="1.8" fill="#ffd84d"/><path d="M${cx - 15} ${-h + 9}h30l-4 -7h-22z" fill="#e2543f" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`;
      continue;
    }
    const lit = rnd(seed, i, k + 11) < 0.34;
    s += `<rect x="${cx - ww / 2 - 2}" y="${wy - 2}" width="${ww + 4}" height="${wh + 4}" rx="3" fill="#fffaf0" stroke="${INK}" stroke-width="2"/>`;
    s += `<rect x="${cx - ww / 2}" y="${wy}" width="${ww}" height="${wh}" rx="1.5" fill="${lit ? '#ffe08a' : '#4f78b3'}"/>`;
    s += `<path d="M${cx - ww / 2} ${wy + wh * 0.62}l${ww * 0.55} ${-wh * 0.62}h${ww * 0.25}l${-ww * 0.8} ${wh * 0.9}z" fill="#fff" opacity="${lit ? 0.35 : 0.22}"/>`;
    s += `<path d="M${cx} ${wy}v${wh}M${cx - ww / 2} ${wy + wh * 0.5}h${ww}" stroke="#fffaf0" stroke-width="1.8"/>`;
    if (h >= 44 && rnd(seed, i, k + 21) < 0.4) {
      s += `<rect x="${cx - ww / 2 - 3}" y="${wy + wh + 1}" width="${ww + 6}" height="5" rx="1.5" fill="#8a5a34" stroke="${INK}" stroke-width="1.6"/>`;
      for (let f = 0; f < 3; f++) s += `<circle cx="${cx - 7 + f * 7}" cy="${wy + wh}" r="3" fill="${['#ff7a8a', '#5fd08a', '#ffd84d'][(f + i) % 3]}" stroke="${INK}" stroke-width="1.2"/>`;
    }
  }
  s += `<rect x="${x - 4}" y="${-h - 3}" width="${w + 8}" height="7" rx="3" fill="#fffaf0" stroke="${INK}" stroke-width="2.5"/>`;
  return s;
}

export interface TowerHud {
  floors: number;
  lives: number;
  combo: number;
  over: boolean;
  started: boolean;
}

export function TowerStage({ onHud, control }: { onHud: (h: TowerHud) => void; control: React.MutableRefObject<{ drop: () => void; restart: () => void; setAuto: (v: boolean) => void } | null> }) {
  const svg = useRef<SVGSVGElement>(null);
  const hud = useRef(onHud);
  hud.current = onHud;

  useEffect(() => {
    const root = svg.current!;
    const q = <T extends SVGElement>(s: string) => root.querySelector(s) as T;
    const world = q<SVGGElement>('#tw-world'), floorsG = q<SVGGElement>('#tw-floors'), fx = q<SVGGElement>('#tw-fx'), hang = q<SVGGElement>('#tw-hang'), cable = q<SVGPathElement>('#tw-cable'), trolley = q<SVGGElement>('#tw-trolley');
    const ghost = q<SVGRectElement>('#tw-ghost'), ring = q<SVGCircleElement>('#tw-ring'), stars = q<SVGGElement>('#tw-stars'), cam = q<SVGGElement>('#tw-cam');
    const layers: [SVGGElement, number][] = [[q('#tw-l1'), 0.12], [q('#tw-l2'), 0.3], [q('#tw-l3'), 0.62], [q('#tw-clouds'), 0.5]];
    const stops = [q<SVGStopElement>('#tw-s0'), q<SVGStopElement>('#tw-s1'), q<SVGStopElement>('#tw-s2')];
    const mk = (tag: string, attrs: Record<string, string | number> = {}) => {
      const e = document.createElementNS(NS, tag);
      for (const k in attrs) e.setAttribute(k, String(attrs[k]));
      return e;
    };

    let showOver = false, alive = true, raf = 0, last = performance.now(), clock = 0, seed = Math.random(), sim: TowerSim = newTowerSim();
    let phase: 'aim' | 'fall' | 'over' = 'aim', t0 = performance.now(), camY = 0, shake = 0, hitstop = 0, combo = 0, auto = false, started = false, autoTol = 8, sway = 0;
    let els: { g: SVGGElement; x: number; y: number; h: number; w: number; bounce: number }[] = [];
    type Job = { t: number; d: number; fn: (k: number) => void; res: () => void };
    const jobs: Job[] = [];
    const run = (ms: number, fn: (k: number) => void) => new Promise<void>((res) => jobs.push({ t: 0, d: ms / 1000, fn, res }));
    interface P { el: SVGElement; x: number; y: number; vx: number; vy: number; g: number; life: number; max: number; rot: number; vr: number; grow: number }
    const parts: P[] = [];
    const puff = (x: number, y: number, n: number, color: string, speed = 110, size = 6, life = 0.6, g = 240, dirX = 0) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random() * 0.6);
        const el = mk('circle', { r: size * (0.5 + Math.random() * 0.8), fill: color });
        fx.appendChild(el);
        parts.push({ el, x, y, vx: Math.cos(a) * v + dirX * speed, vy: Math.sin(a) * v * 0.5 - speed * 0.35, g, life, max: life, rot: 0, vr: 0, grow: 0.8 });
      }
    };
    const sparkle = (x: number, y: number, n: number) => {
      for (let i = 0; i < n; i++) {
        const el = mk('path', { d: 'M0-9 2.4-2.4 9 0 2.4 2.4 0 9-2.4 2.4-9 0-2.4-2.4Z', fill: i % 2 ? '#fff6c9' : '#ffd84d' });
        fx.appendChild(el);
        const a = Math.random() * Math.PI * 2, v = 120 + Math.random() * 220;
        parts.push({ el, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, g: 320, life: 0.8, max: 0.8, rot: Math.random() * 90, vr: 400, grow: -0.6 });
      }
    };
    const pop = (x: number, y: number, text: string, color: string, size = 30) => {
      const t = mk('text', { 'text-anchor': 'middle', 'font-size': size, 'font-weight': 900, fill: color, stroke: INK, 'stroke-width': 6, 'paint-order': 'stroke', 'stroke-linejoin': 'round', class: 'tw-font' });
      t.textContent = text;
      fx.appendChild(t);
      const cx = Math.max(-150, Math.min(150, x));
      run(1000, (k) => {
        const s = k < 0.18 ? ease.back(k / 0.18) : 1;
        t.setAttribute('transform', `translate(${cx} ${y - 46 * ease.out(k)}) rotate(${-5 + k * 4}) scale(${s})`);
        t.setAttribute('opacity', String(k > 0.72 ? 1 - (k - 0.72) / 0.28 : 1));
      }).then(() => t.remove());
    };
    const flash = (x: number, y: number, w: number) => {
      const r = mk('rect', { x: -w / 2 - 30, y: -5, width: w + 60, height: 10, rx: 5, fill: '#fff' });
      const c = mk('circle', { r: 20, fill: 'none', stroke: '#ffe9a3', 'stroke-width': 7 });
      fx.append(r, c);
      run(380, (k) => {
        r.setAttribute('transform', `translate(${x} ${y}) scale(${1 + k * 0.5} ${1 - k})`);
        r.setAttribute('opacity', String(1 - k));
        c.setAttribute('transform', `translate(${x} ${y}) scale(${1 + ease.out(k) * 6})`);
        c.setAttribute('opacity', String(1 - k));
      }).then(() => (r.remove(), c.remove()));
    };

    const emit = () => hud.current({ floors: sim.xs.length, lives: sim.lives, combo, over: phase === 'over' && showOver, started });
    const yOf = (i: number) => -towerHeight(seed, i);
    const setHang = () => {
      const { w, h } = floorSize(seed, sim.xs.length);
      hang.innerHTML = `<g transform="translate(0 ${h})">${floorArt(w, h, sim.xs.length, seed)}</g>`;
      hang.dataset.w = String(w);
      hang.dataset.h = String(h);
      hang.setAttribute('opacity', '1');
      ghost.setAttribute('width', String(w));
    };
    const startAim = () => {
      phase = 'aim';
      t0 = performance.now();
      autoTol = 3 + Math.random() * (10 + sim.xs.length * 0.5);
      setHang();
    };
    const restart = () => {
      jobs.length = 0;
      parts.forEach((p) => p.el.remove());
      parts.length = 0;
      fx.replaceChildren();
      floorsG.replaceChildren();
      els = [];
      seed = Math.random();
      sim = newTowerSim();
      combo = 0;
      showOver = false;
      camY = 0;
      started = false;
      startAim();
      emit();
    };

    async function drop() {
      if (phase !== 'aim') return;
      started = true;
      const t = performance.now() - t0;
      const res = simulateDrop(sim, t, seed);
      const i = sim.xs.length, { w, h } = floorSize(seed, i);
      phase = 'fall';
      hang.setAttribute('opacity', '0');
      const g = mk('g') as SVGGElement;
      g.innerHTML = floorArt(w, h, i, seed);
      floorsG.appendChild(g);
      // от куката до върха на кулата
      const fromY = HOOK_Y - GROUND - camY + 34 + h;
      const toY = yOf(i);
      const x0 = res.craneX, x1 = res.kind === 'fall' ? res.craneX : res.landX + (res.targetX - topX(sim));
      const dist = Math.max(60, toY - fromY);
      await run(Math.sqrt(dist / 900) * 1000, (k) => g.setAttribute('transform', `translate(${x0 + (x1 - x0) * k * k} ${fromY + dist * k * k}) scale(${1 - 0.06 * k} ${1 + 0.1 * k})`));
      if (res.kind === 'fall') {
        // изпуснат — прекатурва се встрани и пада
        combo = 0;
        const dir = Math.sign(res.dx) || 1;
        shake = 0.25;
        puff(x1 - dir * w * 0.3, toY, 8, '#f3ead6', 120, 5, 0.5, 240, dir * 0.4);
        pop(x1, toY - 60, 'ИЗПУСНАТ!', '#ff8a8a', 26);
        sim = res.next;
        emit();
        await run(900, (k) => g.setAttribute('transform', `translate(${x1 + dir * 150 * k} ${toY + 760 * k * k - 30 * Math.sin(k * 3)}) rotate(${dir * 260 * k})`));
        g.remove();
      } else {
        sim = res.next;
        els.push({ g, x: res.landX, y: toY, h, w, bounce: 0 });
        const perfect = res.kind === 'perfect';
        combo = perfect ? combo + 1 : 0;
        hitstop = perfect ? 0.07 : 0.03;
        shake = Math.max(shake, perfect ? 0.14 : 0.22);
        // кацане: сплескване + вълна надолу по кулата
        run(520, (k) => (els[els.length - 1].bounce = (1 - ease.elastic(k)) * 0.16));
        for (let d = 1; d <= Math.min(6, els.length - 1); d++) {
          const e = els[els.length - 1 - d];
          setTimeout(() => run(380, (k) => (e.bounce = (1 - ease.elastic(k)) * 0.07 * (1 - d / 8))), d * 34);
        }
        const tx = res.landX;
        puff(tx - w / 2, toY, 6, '#f3ead6', 110, 5, 0.5, 220, -0.5);
        puff(tx + w / 2, toY, 6, '#f3ead6', 110, 5, 0.5, 220, 0.5);
        if (perfect) {
          flash(tx, toY, w);
          sparkle(tx, toY - h / 2, 14);
          pop(tx, toY - h - 26, combo > 1 ? `ПЕРФЕКТНО ×${combo}` : 'ПЕРФЕКТНО!', '#ffd84d', 28);
          if (res.steadied) setTimeout(() => pop(0, toY - h - 70, 'КУЛАТА СЕ ИЗПРАВИ', '#9fe8ff', 20), 300);
        } else pop(tx, toY - h - 20, `+1`, '#fff', 24);
        emit();
        if (res.kind === 'collapse') return collapse();
      }
      if (sim.lives <= 0) {
        phase = 'over';
        showOver = true;
        emit();
        return;
      }
      await run(160, () => {});
      startAim();
    }
    async function collapse() {
      phase = 'over';
      shake = 0.9;
      hitstop = 0.16;
      const dir = Math.sign(sim.lean) || 1;
      pop(0, yOf(els.length) - 40, 'СРУТВАНЕ!', '#ff7a7a', 36);
      els.forEach((e, k) => {
        const vx = dir * (60 + k * 26) + (Math.random() - 0.5) * 120, vr = dir * (80 + Math.random() * 240);
        let x = e.x, y = e.y, vy = -80 - Math.random() * 160, r = 0;
        const delay = (els.length - k) * 18;
        setTimeout(() => {
          run(1800, () => {
            const dt = 1 / 60;
            vy += 1500 * dt;
            x += vx * dt;
            y += vy * dt;
            r += vr * dt;
            if (y > 0) {
              y = 0;
              if (Math.abs(vy) > 200) puff(x, 0, 3, '#f3ead6', 90, 6, 0.5);
              vy = Math.abs(vy) > 160 ? -vy * 0.3 : 0;
            }
            e.g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${r.toFixed(0)} 0 ${-e.h / 2})`);
          });
        }, delay);
      });
      els = [];
      // панелът идва след като срутването се види
      setTimeout(() => alive && ((showOver = true), emit()), 1500);
    }

    control.current = { drop: () => void drop(), restart, setAuto: (v) => (auto = v) };
    Object.assign(window, { __tws: { drop: () => void drop(), get: () => ({ sim, seed, phase, t0 }), setAuto: (v: boolean) => (auto = v), fns: { craneX, swayX, topX } } });

    function frame(now: number) {
      if (!alive) return;
      raf = requestAnimationFrame(frame);
      const real = Math.min(0.05, (now - last) / 1000);
      last = now;
      const dt = hitstop > 0 ? ((hitstop -= real), real * 0.05) : real;
      clock += real;
      for (const j of [...jobs]) {
        j.t += dt;
        const k = j.d <= 0 ? 1 : Math.min(1, j.t / j.d);
        j.fn(k);
        if (k >= 1) {
          const i = jobs.indexOf(j);
          if (i >= 0) jobs.splice(i, 1);
          j.res();
        }
      }
      for (const p of parts) {
        p.life -= dt;
        p.vy += p.g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        const k = Math.max(0, p.life / p.max);
        p.el.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${p.rot.toFixed(0)}) scale(${Math.max(0.01, 1 + p.grow * (1 - k)).toFixed(2)})`);
        p.el.setAttribute('opacity', k.toFixed(2));
      }
      for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0) (parts[i].el.remove(), parts.splice(i, 1));

      const n = sim.xs.length, top = towerHeight(seed, n);
      const t = now - t0;
      // люлеене — върхът се отмества най-много; кулата леко се огъва
      const target = phase === 'over' ? 0 : swayX(t, sim);
      sway += (target - sway) * Math.min(1, real * 14);
      const vis = camY + 760;
      els.forEach((e, k) => {
        const f = ((k + 1) / Math.max(1, els.length)) ** 1.5;
        const hidden = -e.y < camY - 140 || -e.y > vis + 200;
        e.g.style.display = hidden ? 'none' : '';
        if (!hidden) e.g.setAttribute('transform', `translate(${(e.x + sway * f).toFixed(2)} ${e.y}) rotate(${((sway * f) / 26).toFixed(2)} 0 0) scale(${(1 + e.bounce * 0.5).toFixed(3)} ${(1 - e.bounce).toFixed(3)})`);
      });
      // кранът
      const hookWorldY = HOOK_Y - GROUND - camY;
      if (phase === 'aim') {
        if (t >= TOWER.DROP_MS || (auto && Math.abs(craneX(t, n, seed) - topX(sim) - swayX(t, sim)) < autoTol && t > 500)) void drop();
        const cx = craneX(t, n, seed), vx = craneX(t + 16, n, seed) - cx;
        const lag = -vx * 2.2;
        trolley.setAttribute('transform', `translate(${cx.toFixed(1)} 0)`);
        cable.setAttribute('d', `M${cx.toFixed(1)} ${hookWorldY - 96}Q${(cx + lag * 0.3).toFixed(1)} ${hookWorldY - 40} ${(cx + lag).toFixed(1)} ${hookWorldY + 34}`);
        hang.setAttribute('transform', `translate(${(cx + lag).toFixed(1)} ${hookWorldY + 34}) rotate(${(-vx * 0.9).toFixed(2)})`);
        const h = Number(hang.dataset.h ?? 44), w = Number(hang.dataset.w ?? 150);
        ghost.setAttribute('x', String(cx - w / 2));
        ghost.setAttribute('y', String(-top - 4));
        ghost.setAttribute('opacity', '0.32');
        const left = 1 - t / TOWER.DROP_MS;
        ring.setAttribute('stroke-dashoffset', String(113 * (1 - left)));
        ring.setAttribute('stroke', left < 0.3 ? '#ff6b6b' : '#fff');
        ring.setAttribute('transform', `translate(${cx.toFixed(1)} ${51 - GROUND - camY})`);
        ring.setAttribute('opacity', '1');
        void h;
      } else {
        ghost.setAttribute('opacity', '0');
        ring.setAttribute('opacity', '0');
        const cx = Number(trolley.getAttribute('transform')?.match(/-?[\d.]+/)?.[0] ?? 0);
        cable.setAttribute('d', `M${cx} ${hookWorldY - 96}L${cx} ${hookWorldY + 20 + Math.sin(clock * 9) * 3}`);
      }
      // камера и паралакс
      camY += (Math.max(0, top - 250) - camY) * Math.min(1, real * 2.6);
      shake = Math.max(0, shake - real * 1.8);
      const sh = shake * shake * 40;
      cam.setAttribute('transform', `translate(${((Math.random() - 0.5) * sh).toFixed(1)} ${((Math.random() - 0.5) * sh).toFixed(1)})`);
      world.setAttribute('transform', `translate(${VW / 2} ${(GROUND + camY).toFixed(1)})`);
      for (const [g, f] of layers) g.setAttribute('transform', `translate(0 ${(camY * f).toFixed(1)})`);
      // небето се сменя с височината
      let a = SKY[0], b = SKY[SKY.length - 1];
      for (let i = 0; i < SKY.length - 1; i++) if (camY >= SKY[i][0]) (a = SKY[i]), (b = SKY[i + 1]);
      const k = Math.max(0, Math.min(1, (camY - a[0]) / Math.max(1, b[0] - a[0])));
      stops.forEach((s, i) => s.setAttribute('stop-color', mix(a[i + 1] as string, b[i + 1] as string, k)));
      stars.setAttribute('opacity', String(Math.max(0, Math.min(1, (camY - 1500) / 1500))));
    }
    startAim();
    emit();
    raf = requestAnimationFrame(frame);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      control.current = null;
    };
  }, [control]);

  const house = (x: number, w: number, h: number, c: string, roof: string) => (
    <g key={x}>
      <rect x={x} y={GROUND - h} width={w} height={h} fill={c} />
      <path d={`M${x - 6} ${GROUND - h}l${w / 2 + 6} ${-h * 0.45} ${w / 2 + 6} ${h * 0.45}z`} fill={roof} />
      {[0.25, 0.65].map((k) => (
        <rect key={k} x={x + w * k} y={GROUND - h * 0.7} width={w * 0.16} height={h * 0.22} fill="#ffe9a3" opacity=".8" />
      ))}
    </g>
  );
  const cloud = (x: number, y: number, s: number, o: number, i: number) => (
    <g key={i} transform={`translate(${x} ${y}) scale(${s})`} opacity={o}>
      <path d="M0 0q16-22 44-10 20-24 52-4 30-8 40 16 24 2 20 20h-170q-14-18 14-22z" fill="#fff" className={i % 2 ? 'tw-drift' : 'tw-drift2'} />
    </g>
  );
  return (
    <svg ref={svg} viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMin meet" className="block size-full select-none" style={{ overflow: 'visible' }} role="img" aria-label="Кула на Словото">
      <defs>
        <linearGradient id="tw-sky" x1="0" y1="0" x2="0" y2="1">
          <stop id="tw-s0" offset="0" stopColor="#3b6fd6" />
          <stop id="tw-s1" offset=".55" stopColor="#8fc3f5" />
          <stop id="tw-s2" offset="1" stopColor="#ffd9b0" />
        </linearGradient>
        <radialGradient id="tw-sun">
          <stop offset="0" stopColor="#fff7df" />
          <stop offset=".25" stopColor="#ffe2a6" stopOpacity=".8" />
          <stop offset="1" stopColor="#ffb27a" stopOpacity="0" />
        </radialGradient>
        <pattern id="tw-truss" width="26" height="22" patternUnits="userSpaceOnUse">
          <path d="M0 22 13 0 26 22" fill="none" stroke="#f2b632" strokeWidth="3" />
        </pattern>
      </defs>
      <style>{`.tw-font{font-family:'Unbounded Variable','Nunito Variable',sans-serif}.tw-drift{animation:tw-d 70s linear infinite}.tw-drift2{animation:tw-d 110s linear infinite reverse}.tw-blink{animation:tw-b 1.2s steps(2) infinite}.tw-tw{animation:tw-t 3s ease-in-out infinite}@keyframes tw-d{from{transform:translateX(-60px)}to{transform:translateX(60px)}}@keyframes tw-b{50%{opacity:.2}}@keyframes tw-t{50%{opacity:.25}}`}</style>
      <rect x="-2000" y="-400" width="4450" height="1700" fill="url(#tw-sky)" />
      <g id="tw-stars" opacity="0">
        {Array.from({ length: 70 }, (_, i) => (
          <circle key={i} cx={-700 + ((i * 263.3) % 1850)} cy={(i * 97.7) % 760} r={0.8 + (i % 4) * 0.4} fill="#fff" className="tw-tw" style={{ animationDelay: `${(i % 7) * 0.4}s` }} />
        ))}
      </g>
      <g id="tw-cam">
        <g id="tw-l1">
          <circle cx="340" cy="560" r="230" fill="url(#tw-sun)" />
          <circle cx="340" cy="560" r="42" fill="#fff4d6" />
          <path d="M-900 720V600l120-90 110 70 130-120 120 100 90-60 140 110 110-130 120 90 130-70 110 90 120-110 140 120 110-80 120 70 130-110 120 100 110-60 140 90v110z" fill="#7fa3e0" opacity=".55" />
        </g>
        <g id="tw-clouds">
          {[[-380, 420, 1.2, 0.8], [260, 330, 0.9, 0.7], [-120, 180, 1.4, 0.75], [420, 40, 1.1, 0.7], [-520, -120, 1, 0.65], [120, -300, 1.5, 0.7], [-260, -520, 1.1, 0.6], [380, -760, 1.3, 0.55], [-80, -1050, 1.6, 0.5], [300, -1400, 1.2, 0.4]].map(([x, y, s, o], i) => cloud(x, y, s, o, i))}
        </g>
        <g id="tw-l2">
          <path d="M-900 720V560h70v-50h60v90h50v-140h80v100h60v-60h70v110h60v-170h90v120h50v-80h70v130h60v-100h80v70h60v-150h70v110h60v-70h90v140h50v-110h70v90h60v-60h80v120h60v-90h70v180z" fill="#5f86cf" opacity=".8" />
        </g>
        <g id="tw-l3">
          {[[-640, 90, 110, '#e9d7b4', '#b5553f'], [-500, 110, 150, '#d9c3a0', '#8f3f34'], [-360, 80, 96, '#efe0c4', '#b5553f'], [-250, 70, 120, '#dccaa6', '#9c4a3a'], [330, 90, 130, '#e9d7b4', '#8f3f34'], [450, 110, 100, '#d9c3a0', '#b5553f'], [590, 80, 150, '#efe0c4', '#9c4a3a'], [700, 100, 112, '#dccaa6', '#b5553f'], [820, 90, 140, '#e9d7b4', '#8f3f34']].map(([x, w, h, c, r]) => house(x as number, w as number, h as number, c as string, r as string))}
          {[-700, -180, 250, 560, 900].map((x) => (
            <g key={x}>
              <rect x={x - 4} y={GROUND - 46} width="8" height="46" fill="#6b4a2e" />
              <circle cx={x} cy={GROUND - 62} r="30" fill="#4f9d5a" />
              <circle cx={x - 16} cy={GROUND - 48} r="20" fill="#3f8a4b" />
              <circle cx={x + 18} cy={GROUND - 50} r="22" fill="#5fae69" />
            </g>
          ))}
        </g>
        <g id="tw-world">
          <rect x="-1400" y="0" width="2800" height="400" fill="#4a8a52" />
          <rect x="-1400" y="0" width="2800" height="10" fill="#6fb574" />
          <path d="M-1400 34h2800v46h-2800z" fill="#3a3f55" />
          <path d="M-1400 55h2800" stroke="#f4f6ff" strokeWidth="3" strokeDasharray="26 22" opacity=".7" />
          <rect x={-TOWER_BASE_W / 2 - 14} y="-2" width={TOWER_BASE_W + 28} height="16" rx="5" fill="#c9cdee" stroke={INK} strokeWidth="2.5" />
          <rect x={-TOWER_BASE_W / 2 - 14} y="12" width={TOWER_BASE_W + 28} height="8" fill="#8f96c4" stroke={INK} strokeWidth="2.5" />
          <g id="tw-floors" />
          <rect id="tw-ghost" height="4" rx="2" fill="#0b1030" opacity="0" />
          <path id="tw-cable" fill="none" stroke="#2b2f45" strokeWidth="3" strokeLinecap="round" />
          <g id="tw-hang" />
          <circle id="tw-ring" r="18" fill="none" strokeWidth="4" strokeLinecap="round" strokeDasharray="113" opacity="0" style={{ transformBox: 'fill-box' }} />
          <g id="tw-fx" />
        </g>
        {/* кранът — закачен за екрана */}
        <g transform={`translate(${VW / 2} 0)`}>
          <rect x="-1400" y="40" width="2800" height="22" fill="url(#tw-truss)" />
          <rect x="-1400" y="38" width="2800" height="5" fill="#f2b632" stroke={INK} strokeWidth="1.5" />
          <rect x="-1400" y="59" width="2800" height="5" fill="#d99a1f" stroke={INK} strokeWidth="1.5" />
          <g id="tw-trolley">
            <rect x="-22" y="34" width="44" height="34" rx="6" fill="#e2543f" stroke={INK} strokeWidth="2.5" />
            <circle cx="-11" cy="68" r="5" fill="#2b2f45" />
            <circle cx="11" cy="68" r="5" fill="#2b2f45" />
            <circle cx="0" cy="46" r="4" fill="#ffd84d" className="tw-blink" />
          </g>
        </g>
      </g>
    </svg>
  );
}

export function TowerStageDemo() {
  const control = useRef<{ drop: () => void; restart: () => void; setAuto: (v: boolean) => void } | null>(null);
  const [hud, setHud] = useState<TowerHud>({ floors: 0, lives: 3, combo: 0, over: false, started: false });
  const [auto, setAuto] = useState(false);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        control.current?.drop();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  return (
    <div className="twg" onPointerDown={() => !hud.over && control.current?.drop()}>
      <TowerStage onHud={setHud} control={control} />
      <div className="twg-hud">
        <div className="twg-score">
          <b className="ln-display">{hud.floors}</b>
          <span>етажа</span>
        </div>
        {hud.combo > 1 && <div className="twg-combo ln-display">×{hud.combo} перфектни</div>}
        <div className="twg-lives">
          {Array.from({ length: 3 }, (_, i) => (
            <span key={i} data-on={i < hud.lives}>♥</span>
          ))}
        </div>
      </div>
      {!hud.started && !hud.over && <p className="twg-hint ln-display">Натисни, за да пуснеш етажа</p>}
      {hud.over && (
        <div className="twg-over" onPointerDown={(e) => e.stopPropagation()}>
          <p className="ln-eyebrow" style={{ justifyContent: 'center' }}>Край на играта</p>
          <b className="ln-display ln-grad">{hud.floors}</b>
          <span>етажа</span>
          <button onClick={() => control.current?.restart()} className="ln-btn ln-btn-primary">Още една кула</button>
        </div>
      )}
      <div className="twg-tools" onPointerDown={(e) => e.stopPropagation()}>
        <button
          onClick={() => {
            const v = !auto;
            setAuto(v);
            control.current?.setAuto(v);
          }}
          className="ln-btn ln-btn-ghost ln-btn-sm"
        >
          {auto ? 'Спри авто' : 'Авто'}
        </button>
        <button onClick={() => control.current?.restart()} className="ln-btn ln-btn-ghost ln-btn-sm">↻</button>
      </div>
    </div>
  );
}
