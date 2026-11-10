'use client';

/**
 * ТЕСТ: „Кула на Словото“ в 3D (three.js). Без въпроси и без сървър — само строенето,
 * със същите правила (simulateDrop) като истинската игра. Единици = пикселите на симулацията.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { TOWER, TOWER_BASE_W, craneX, floorSize, newTowerSim, simulateDrop, swayX, towerHeight, type TowerSim } from '@belmaster/shared';

type Style = 'revival' | 'fortress' | 'city';
const DEPTH = 112;
const STYLES: { id: Style; label: string }[] = [
  { id: 'revival', label: 'Възрожденска' },
  { id: 'fortress', label: 'Крепост' },
  { id: 'city', label: 'Град' },
];
const LOOK: Record<Style, { sky: [string, string]; ground: string; fog: string; top: string; base: string }> = {
  revival: { sky: ['#6ec3f4', '#fde9c9'], ground: '#7fb35a', fog: '#f3e3c8', top: '#d9cdb0', base: '#8a7a66' },
  fortress: { sky: ['#5a7fb5', '#dfe9f5'], ground: '#8e9a86', fog: '#d5dfea', top: '#7d7d78', base: '#5f5f5a' },
  city: { sky: ['#283a6b', '#f2a57c'], ground: '#4b5563', fog: '#d99a80', top: '#3d4a5c', base: '#2f3742' },
};
const CITY_COLORS = ['#f2b5a0', '#a8d5c8', '#f5d58a', '#b9c4ef', '#e8b6d6'];

function rnd(seed: number) {
  let s = seed * 9973 + 1;
  return () => {
    s = Math.sin(s) * 43758.5453;
    s -= Math.floor(s);
    return s;
  };
}

/** Фасада на етаж — рисува се върху платно и става текстура. */
function facade(style: Style, w: number, h: number, i: number): THREE.CanvasTexture {
  const S = 3;
  const c = document.createElement('canvas');
  c.width = Math.round(w * S);
  c.height = Math.round(h * S);
  const g = c.getContext('2d')!;
  g.scale(S, S);
  const n = w >= 150 ? 3 : 2;
  const xs = Array.from({ length: n }, (_, k) => (w * (k + 0.5)) / n);
  if (style === 'revival') {
    g.fillStyle = i % 2 ? '#f7f0de' : '#efe5cc';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#6b4a2e';
    g.fillRect(0, 0, w, 5);
    g.fillRect(0, h - 4, w, 4);
    for (const x of [0, w - 5]) g.fillRect(x, 0, 5, h);
    const wh = h * 0.5, ww = 17, y = (h - wh) / 2 + 1;
    for (const cx of xs) {
      g.fillStyle = '#3d6b4f';
      g.fillRect(cx - ww / 2 - 6, y, 6, wh);
      g.fillRect(cx + ww / 2, y, 6, wh);
      g.fillStyle = '#4b2f1c';
      g.fillRect(cx - ww / 2 - 1.5, y - 1.5, ww + 3, wh + 3);
      g.fillStyle = '#7fb6d9';
      g.fillRect(cx - ww / 2, y, ww, wh);
      g.fillStyle = 'rgba(255,255,255,.4)';
      g.fillRect(cx - ww / 2 + 2, y + 2, ww / 2 - 3, wh * 0.4);
      g.fillStyle = '#4b2f1c';
      g.fillRect(cx - 0.8, y, 1.6, wh);
    }
  } else if (style === 'fortress') {
    g.fillStyle = '#9d9c95';
    g.fillRect(0, 0, w, h);
    const r = rnd(i + 7);
    const rows = Math.max(2, Math.round(h / 14));
    for (let row = 0; row < rows; row++) {
      const bh = h / rows;
      let x = row % 2 ? -14 : 0;
      while (x < w) {
        const bw = 22 + r() * 14;
        g.fillStyle = `hsl(48 5% ${52 + r() * 14}%)`;
        g.fillRect(x + 0.8, row * bh + 0.8, bw - 1.6, bh - 1.6);
        x += bw;
      }
    }
    for (const cx of xs) {
      g.fillStyle = '#22262b';
      g.fillRect(cx - 3, h * 0.25, 6, h * 0.5);
      g.beginPath();
      g.arc(cx, h * 0.25, 3, Math.PI, 0);
      g.fill();
    }
  } else {
    g.fillStyle = CITY_COLORS[i % CITY_COLORS.length];
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.75)';
    g.fillRect(0, h - 4, w, 4);
    const r = rnd(i + 3);
    const wh = h * 0.52, ww = Math.min(26, w / n - 12), y = (h - wh) / 2 - 1;
    for (const cx of xs) {
      g.fillStyle = '#fff';
      g.fillRect(cx - ww / 2 - 1.5, y - 1.5, ww + 3, wh + 3);
      g.fillStyle = r() < 0.3 ? '#ffe9a3' : '#5d86ad';
      g.fillRect(cx - ww / 2, y, ww, wh);
      g.fillStyle = 'rgba(255,255,255,.35)';
      g.fillRect(cx - ww / 2 + 2, y + 2, ww / 2 - 3, wh * 0.45);
      g.fillStyle = '#fff';
      g.fillRect(cx - 0.8, y, 1.6, wh);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

interface Debris {
  mesh: THREE.Object3D;
  v: THREE.Vector3;
  w: THREE.Vector3;
  h: number;
}
interface Puff {
  mesh: THREE.Mesh;
  v: THREE.Vector3;
  life: number;
}

class Engine {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(38, 1, 10, 6000);
  tower = new THREE.Group();
  props = new THREE.Group();
  sun = new THREE.DirectionalLight('#fff4dd', 2.2);
  ground: THREE.Mesh;
  base: THREE.Mesh;
  floors: THREE.Mesh[] = [];
  roof: THREE.Group | null = null;
  hang: THREE.Mesh | null = null;
  rope: THREE.Mesh;
  debris: Debris[] = [];
  puffs: Puff[] = [];
  textures = new Map<string, THREE.CanvasTexture>();
  puffGeo = new THREE.SphereGeometry(5, 6, 5);
  style: Style = 'revival';
  seed = Math.random();
  sim: TowerSim = newTowerSim();
  phase: 'aim' | 'fall' | 'over' = 'aim';
  t0 = performance.now();
  fall: { from: THREE.Vector3; landX: number; t: number; kind: string; next: TowerSim } | null = null;
  sway = 0;
  camY = 60;
  camA = 0;
  shake = 0;
  raf = 0;
  last = performance.now();
  frames = 0;
  fpsAt = performance.now();
  onChange: (s: { floors: number; lives: number; over: boolean; msg: string | null; fps?: number }) => void = () => {};
  msg: string | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.scene.add(new THREE.HemisphereLight('#dff1ff', '#6b5a48', 1.25));
    this.sun.position.set(-260, 520, 380);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera;
    sc.left = -420; sc.right = 420; sc.top = 520; sc.bottom = -520; sc.near = 10; sc.far = 1800;
    this.sun.shadow.bias = -0.0015;
    this.scene.add(this.sun, this.sun.target);
    this.ground = new THREE.Mesh(new THREE.CircleGeometry(2600, 48), new THREE.MeshStandardMaterial({ roughness: 1 }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -22;
    this.ground.receiveShadow = true;
    this.base = new THREE.Mesh(new THREE.BoxGeometry(TOWER_BASE_W, 22, DEPTH + 26), new THREE.MeshStandardMaterial({ roughness: 0.9 }));
    this.base.position.y = -11;
    this.base.receiveShadow = true;
    this.base.castShadow = true;
    this.rope = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 1, 6), new THREE.MeshStandardMaterial({ color: '#3a3a3a' }));
    this.scene.add(this.ground, this.base, this.tower, this.props, this.rope);
    this.setStyle('revival');
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  tex(w: number, h: number, i: number) {
    const k = `${this.style}:${w}:${h}:${i % 10}`;
    let t = this.textures.get(k);
    if (!t) this.textures.set(k, (t = facade(this.style, w, h, i)));
    return t;
  }

  makeFloor(i: number): THREE.Mesh {
    const { w, h } = floorSize(this.seed, i);
    const front = new THREE.MeshStandardMaterial({ map: this.tex(w, h, i), roughness: 0.85 });
    const side = new THREE.MeshStandardMaterial({ map: this.tex(DEPTH > 140 ? 150 : 120, h, i + 1), roughness: 0.85 });
    const cap = new THREE.MeshStandardMaterial({ color: LOOK[this.style].top, roughness: 0.9 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, DEPTH), [side, side, cap, cap, front, front]);
    m.castShadow = true;
    m.receiveShadow = true;
    m.userData = { w, h };
    return m;
  }

  floorY(i: number) {
    return towerHeight(this.seed, i) + floorSize(this.seed, i).h / 2;
  }

  setStyle(style: Style) {
    this.style = style;
    const L = LOOK[style];
    const c = document.createElement('canvas');
    c.width = 4; c.height = 256;
    const g = c.getContext('2d')!;
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, L.sky[0]);
    grad.addColorStop(1, L.sky[1]);
    g.fillStyle = grad;
    g.fillRect(0, 0, 4, 256);
    const bg = new THREE.CanvasTexture(c);
    bg.colorSpace = THREE.SRGBColorSpace;
    this.scene.background = bg;
    this.scene.fog = new THREE.Fog(L.fog, 1900, 4600);
    (this.ground.material as THREE.MeshStandardMaterial).color.set(L.ground);
    (this.base.material as THREE.MeshStandardMaterial).color.set(L.base);
    this.sun.color.set(style === 'city' ? '#ffd2a8' : '#fff4dd');
    this.buildProps();
    this.restart();
  }

  /** Околност: къщички / върхове / блокове + облаци. */
  buildProps() {
    this.props.clear();
    const r = rnd(STYLES.findIndex((s) => s.id === this.style) + 11);
    const mat = (c: THREE.ColorRepresentation) => new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true });
    const hsl = (h: number, sat: number, l: number) => new THREE.Color().setHSL(h / 360, sat, l);
    for (let k = 0; k < 26; k++) {
      const a = r() * Math.PI * 2;
      const d = (this.style === 'fortress' ? 950 : 520) + r() * 1300;
      if (Math.abs(Math.sin(a)) < 0.35 && Math.cos(a) > 0 && d < 900) continue; // не пред камерата
      const g = new THREE.Group();
      if (this.style === 'revival') {
        const w = 70 + r() * 50, h = 50 + r() * 40;
        const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * 0.8), mat(r() < 0.5 ? '#f3ead3' : '#e6d6b4'));
        body.position.y = h / 2;
        const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.82, 38, 4), mat('#a8452f'));
        roof.rotation.y = Math.PI / 4;
        roof.position.y = h + 19;
        g.add(body, roof);
        if (r() < 0.6) {
          const tree = new THREE.Mesh(new THREE.ConeGeometry(26, 80, 7), mat('#3f7d3a'));
          tree.position.set(w, 40, 20);
          g.add(tree);
        }
      } else if (this.style === 'fortress') {
        const h = 260 + r() * 520, w = 200 + r() * 260;
        const peak = new THREE.Mesh(new THREE.ConeGeometry(w, h, 6), mat(hsl(215, 0.2, 0.3 + r() * 0.12)));
        peak.position.y = h / 2;
        const snow = new THREE.Mesh(new THREE.ConeGeometry(w * 0.3, h * 0.3, 6), mat('#f4f7fb'));
        snow.position.y = h * 0.86;
        g.add(peak, snow);
      } else {
        const w = 90 + r() * 80, h = 140 + r() * 420;
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mat(hsl(215 + r() * 25, 0.3, 0.2 + r() * 0.14)));
        b.position.y = h / 2;
        g.add(b);
      }
      g.position.set(Math.sin(a) * d, -22, -Math.cos(a) * d * 0.9 - 100);
      g.rotation.y = r() * Math.PI;
      this.props.add(g);
    }
    const cm = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, transparent: true, opacity: 0.92 });
    for (let k = 0; k < 9; k++) {
      const cl = new THREE.Group();
      for (let j = 0; j < 4; j++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(40 + r() * 30, 8, 6), cm);
        s.position.set(j * 46 - 70, r() * 18, r() * 20);
        s.scale.y = 0.6;
        cl.add(s);
      }
      cl.position.set(-900 + r() * 1800, 300 + r() * 1400, -500 - r() * 700);
      cl.userData.v = 6 + r() * 10;
      cl.name = 'cloud';
      this.props.add(cl);
    }
  }

  restart() {
    for (const f of this.floors) this.tower.remove(f);
    for (const d of this.debris) this.scene.remove(d.mesh);
    if (this.roof) this.tower.remove(this.roof);
    if (this.hang) this.scene.remove(this.hang);
    this.floors = [];
    this.debris = [];
    this.roof = null;
    this.hang = null;
    this.seed = Math.random();
    this.sim = newTowerSim();
    this.msg = null;
    this.startAim();
    this.emit();
  }

  startAim() {
    this.phase = 'aim';
    this.t0 = performance.now();
    this.hang = this.makeFloor(this.sim.xs.length);
    this.scene.add(this.hang);
  }

  emit(extra: { fps?: number } = {}) {
    this.onChange({ floors: this.sim.xs.length, lives: this.sim.lives, over: this.phase === 'over', msg: this.msg, ...extra });
  }

  buildRoof() {
    if (this.roof) this.tower.remove(this.roof);
    const n = this.floors.length;
    if (!n) return (this.roof = null);
    const { w } = floorSize(this.seed, n - 1);
    const g = new THREE.Group();
    const m = (c: string) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, flatShading: true });
    if (this.style === 'revival') {
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1, 34, 4), m('#a8452f'));
      roof.rotation.y = Math.PI / 4;
      roof.scale.set((w + 26) * 0.71, 1, (DEPTH + 26) * 0.71);
      roof.position.y = 17;
      const ch = new THREE.Mesh(new THREE.BoxGeometry(12, 26, 12), m('#8a5a44'));
      ch.position.set(w * 0.25, 22, 0);
      g.add(roof, ch);
    } else if (this.style === 'fortress') {
      const cnt = Math.max(3, Math.round(w / 34));
      for (let k = 0; k < cnt; k++)
        for (const z of [-DEPTH / 2 + 8, DEPTH / 2 - 8]) {
          const b = new THREE.Mesh(new THREE.BoxGeometry(16, 16, 16), m('#8f8e88'));
          b.position.set(-w / 2 + 8 + (k * (w - 16)) / (cnt - 1), 8, z);
          g.add(b);
        }
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 60, 6), m('#4b3a2a'));
      pole.position.y = 30;
      const flag = new THREE.Mesh(new THREE.BoxGeometry(30, 18, 1.5), m('#d63a3a'));
      flag.position.set(16, 50, 0);
      g.add(pole, flag);
    } else {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(w + 10, 6, DEPTH + 10), m('#e9edf2'));
      slab.position.y = 3;
      const box = new THREE.Mesh(new THREE.BoxGeometry(30, 18, 30), m('#9aa5b3'));
      box.position.set(-w * 0.2, 15, 0);
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 70, 6), m('#d7dde5'));
      ant.position.set(w * 0.22, 40, 0);
      g.add(slab, box, ant);
    }
    g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
    this.roof = g;
    this.tower.add(g);
  }

  drop() {
    if (this.phase !== 'aim' || !this.hang) return;
    const t = performance.now() - this.t0;
    const res = simulateDrop(this.sim, t, this.seed);
    this.phase = 'fall';
    this.fall = { from: this.hang.position.clone(), landX: res.landX, t: 0, kind: res.kind, next: res.next };
    this.msg = null;
  }

  burst(x: number, y: number, n: number, color: string, speed = 1) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 });
    for (let k = 0; k < n; k++) {
      const p = new THREE.Mesh(this.puffGeo, mat);
      p.position.set(x + (Math.random() - 0.5) * 120, y, (Math.random() - 0.5) * DEPTH);
      this.scene.add(p);
      this.puffs.push({ mesh: p, v: new THREE.Vector3((Math.random() - 0.5) * 260 * speed, 40 + Math.random() * 120 * speed, (Math.random() - 0.5) * 200 * speed), life: 0.7 });
    }
  }

  toDebris(mesh: THREE.Object3D, h: number, vx: number) {
    const p = new THREE.Vector3();
    mesh.getWorldPosition(p);
    mesh.removeFromParent();
    mesh.position.copy(p);
    this.scene.add(mesh);
    this.debris.push({ mesh, h, v: new THREE.Vector3(vx, 60 + Math.random() * 160, (Math.random() - 0.5) * 260), w: new THREE.Vector3((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 3, -vx / 60 + (Math.random() - 0.5) * 3) });
  }

  land() {
    const f = this.fall!;
    const mesh = this.hang!;
    this.hang = null;
    this.fall = null;
    const i = this.sim.xs.length;
    const topY = towerHeight(this.seed, i);
    if (f.kind === 'fall') {
      this.toDebris(mesh, mesh.userData.h, f.from.x > this.sway ? 150 : -150);
      this.sim = f.next;
      this.msg = 'Изпусна етажа!';
      this.shake = 0.25;
    } else {
      this.scene.remove(mesh);
      mesh.position.set(f.landX, this.floorY(i), 0);
      mesh.rotation.set(0, 0, 0);
      this.tower.add(mesh);
      this.floors.push(mesh);
      this.sim = f.next;
      this.buildRoof();
      const perfect = f.kind === 'perfect';
      this.burst(f.landX + this.sway, topY + 4, perfect ? 22 : 10, perfect ? '#ffd84d' : '#efe6d2', perfect ? 1.5 : 0.8);
      this.msg = perfect ? '✨ Перфектно!' : null;
      this.shake = perfect ? 0.08 : 0.16;
      if (f.kind === 'collapse') {
        this.msg = '💥 Кулата се срути!';
        const dir = Math.sign(this.sim.lean) || 1;
        this.floors.forEach((m, k) => this.toDebris(m, m.userData.h, dir * (80 + k * 22) + (Math.random() - 0.5) * 120));
        this.floors = [];
        if (this.roof) {
          this.toDebris(this.roof, 30, dir * 320);
          this.roof = null;
        }
        this.shake = 0.6;
      }
    }
    if (this.sim.lives <= 0) {
      this.phase = 'over';
      if (f.kind !== 'collapse') this.msg = 'Край — свършиха животите.';
    } else this.startAim();
    this.emit();
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // на тесен екран — по-широк ъгъл, за да се вижда целият замах на крана
    this.camera.fov = w / h < 0.8 ? 54 : w / h < 1.2 ? 46 : 38;
    this.camera.updateProjectionMatrix();
  }

  loop(now: number) {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const n = this.sim.xs.length;
    const topY = towerHeight(this.seed, n);
    const t = now - this.t0;

    // люлеене — върхът се отмества най-много
    const target = this.phase === 'over' ? 0 : swayX(t, this.sim);
    this.sway += (target - this.sway) * Math.min(1, dt * 14);
    this.floors.forEach((m, k) => {
      const f = (k + 1) / Math.max(1, this.floors.length);
      m.position.x = this.sim.xs[k] + this.sway * f * f;
      m.rotation.z = (-this.sway * f) / 900;
    });
    if (this.roof && this.floors.length) {
      const top = this.floors[this.floors.length - 1];
      this.roof.position.set(top.position.x, topY, 0);
      this.roof.rotation.z = top.rotation.z;
    }

    const craneY = topY + 190;
    if (this.phase === 'aim' && this.hang) {
      if (t >= TOWER.DROP_MS) this.drop();
      else {
        const cx = craneX(t, n, this.seed);
        const vx = craneX(t + 16, n, this.seed) - cx;
        this.hang.position.set(cx, craneY - this.hang.userData.h / 2, 0);
        this.hang.rotation.z = -vx / 55;
      }
    }
    if (this.phase === 'fall' && this.fall && this.hang) {
      const f = this.fall;
      f.t += dt;
      const h = this.hang.userData.h as number;
      const endY = f.kind === 'fall' ? topY - 40 : topY + h / 2;
      const y = f.from.y - 0.5 * 2600 * f.t * f.t;
      const k = Math.min(1, (f.from.y - y) / Math.max(1, f.from.y - endY));
      const endX = f.kind === 'fall' ? f.from.x : f.landX + this.sway;
      this.hang.position.set(f.from.x + (endX - f.from.x) * k, Math.max(endY, y), 0);
      this.hang.rotation.z *= 0.85;
      if (y <= endY) this.land();
    }
    // въже
    if (this.hang && this.phase === 'aim') {
      this.rope.visible = true;
      const top = craneY + 420;
      this.rope.position.set(this.hang.position.x, (craneY + top) / 2, 0);
      this.rope.scale.y = top - craneY;
    } else this.rope.visible = false;

    // отломки
    for (const d of this.debris) {
      d.v.y -= 1500 * dt;
      d.mesh.position.addScaledVector(d.v, dt);
      d.mesh.rotation.x += d.w.x * dt;
      d.mesh.rotation.y += d.w.y * dt;
      d.mesh.rotation.z += d.w.z * dt;
      const floor = -22 + d.h / 2;
      if (d.mesh.position.y < floor) {
        d.mesh.position.y = floor;
        if (Math.abs(d.v.y) > 120) this.burst(d.mesh.position.x, -16, 4, '#d8cdb8', 0.6);
        d.v.y = Math.abs(d.v.y) > 90 ? -d.v.y * 0.32 : 0;
        d.v.x *= 0.6;
        d.v.z *= 0.6;
        d.w.multiplyScalar(0.55);
      }
    }
    for (const p of this.puffs) {
      p.life -= dt;
      p.v.y -= 260 * dt;
      p.mesh.position.addScaledVector(p.v, dt);
      p.mesh.scale.setScalar(Math.max(0.01, p.life / 0.7) * 1.6);
    }
    this.puffs = this.puffs.filter((p) => (p.life > 0 ? true : (this.scene.remove(p.mesh), false)));
    this.props.children.forEach((c) => {
      if (c.name !== 'cloud') return;
      c.position.x += (c.userData.v as number) * dt;
      if (c.position.x > 1100) c.position.x = -1100;
    });

    // камера: бавно обикаля; при прицелване се връща отпред, за да е честно пускането
    const wantA = this.phase === 'aim' ? Math.sin(now / 5200) * 0.16 : this.phase === 'over' ? this.camA + dt * 0.25 : Math.sin(now / 5200) * 0.4;
    this.camA += (wantA - this.camA) * Math.min(1, dt * (this.phase === 'over' ? 60 : 2.2));
    this.camY += (Math.max(70, (this.phase === 'over' && !this.floors.length ? 0 : topY) - 20) - this.camY) * Math.min(1, dt * 2.5);
    const portrait = this.camera.aspect < 0.8;
    const D = portrait ? 860 : 820;
    this.shake = Math.max(0, this.shake - dt);
    const sh = this.shake * 26;
    this.camera.position.set(Math.sin(this.camA) * D + (Math.random() - 0.5) * sh, this.camY + 150 + (Math.random() - 0.5) * sh, Math.cos(this.camA) * D);
    this.camera.lookAt(0, this.camY + 40, 0);
    this.sun.position.set(-260, this.camY + 520, 380);
    this.sun.target.position.set(0, this.camY - 60, 0);

    this.renderer.render(this.scene, this.camera);
    this.frames++;
    if (now - this.fpsAt > 1000) {
      this.emit({ fps: Math.round((this.frames * 1000) / (now - this.fpsAt)) });
      this.frames = 0;
      this.fpsAt = now;
    }
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.textures.forEach((t) => t.dispose());
    this.renderer.dispose();
  }
}

export function Tower3DDemo() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const eng = useRef<Engine | null>(null);
  const [hud, setHud] = useState({ floors: 0, lives: 3, over: false, msg: null as string | null, fps: 0 });
  const [style, setStyle] = useState<Style>('revival');
  const [error, setError] = useState(false);

  useEffect(() => {
    let e: Engine;
    try {
      e = new Engine(canvas.current!);
    } catch {
      setError(true);
      return;
    }
    eng.current = e;
    // за автоматичните тестове на тази пробна страница
    Object.assign(window, { __t3d: e, __t3dfn: { craneX, swayX } });
    e.onChange = (s) => setHud((h) => ({ ...h, ...s, fps: s.fps ?? h.fps }));
    const ro = new ResizeObserver(() => {
      const r = wrap.current!.getBoundingClientRect();
      e.resize(Math.max(200, r.width), Math.max(200, r.height));
    });
    ro.observe(wrap.current!);
    const key = (ev: KeyboardEvent) => {
      if (ev.code === 'Space') {
        ev.preventDefault();
        e.drop();
      }
    };
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('keydown', key);
      ro.disconnect();
      e.dispose();
    };
  }, []);

  const pick = useCallback((s: Style) => {
    setStyle(s);
    eng.current?.setStyle(s);
  }, []);

  if (error) return <p className="rounded-2xl bg-error/10 p-4 font-bold">Това устройство не поддържа 3D (WebGL). Тук ще остава обикновеният изглед.</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {STYLES.map((s) => (
          <button key={s.id} onClick={() => pick(s.id)} className={`rounded-xl px-3 py-1.5 text-sm font-extrabold ${style === s.id ? 'bg-secondary text-white' : 'bg-surface-2 text-muted'}`}>
            {s.label}
          </button>
        ))}
        <button onClick={() => eng.current?.restart()} className="rounded-xl bg-surface-2 px-3 py-1.5 text-sm font-extrabold">
          ↻ Отначало
        </button>
        <span className="ml-auto text-xs font-bold text-muted">{hud.fps} кадъра/с</span>
      </div>
      <div ref={wrap} className="relative h-[72dvh] min-h-96 touch-none select-none overflow-hidden rounded-3xl border-4 border-line" onPointerDown={() => eng.current?.drop()}>
        <canvas ref={canvas} className="block size-full" />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3 text-white [text-shadow:0_2px_4px_rgba(0,0,0,.5)]">
          <span className="rounded-2xl bg-black/30 px-3 py-1.5 text-2xl font-black">{hud.floors} ет.</span>
          <span className="rounded-2xl bg-black/30 px-3 py-1.5 text-xl">{'❤️'.repeat(Math.max(0, hud.lives))}{'🖤'.repeat(Math.max(0, 3 - hud.lives))}</span>
        </div>
        {hud.msg && <p className="pointer-events-none absolute inset-x-0 top-20 text-center text-3xl font-black text-white [text-shadow:0_3px_8px_rgba(0,0,0,.6)]">{hud.msg}</p>}
        {hud.over ? (
          <div className="absolute inset-x-0 bottom-6 text-center">
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => eng.current?.restart()}
              className="btn3d rounded-2xl bg-primary px-6 py-3 text-lg font-extrabold uppercase text-white [--btn-shadow:var(--color-primary-dark)]"
            >
              Построй пак
            </button>
          </div>
        ) : (
          <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-sm font-extrabold text-white [text-shadow:0_2px_4px_rgba(0,0,0,.6)]">Натисни (или Space), за да пуснеш етажа</p>
        )}
      </div>
    </div>
  );
}
