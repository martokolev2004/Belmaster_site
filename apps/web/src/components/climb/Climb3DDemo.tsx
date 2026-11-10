'use client';

/**
 * ТЕСТ: „Към върха“ в 3D — планина със стъпала, два героя, чукче, летящи предмети и щит.
 * Без въпроси и без сървър: действията се избират с бутони (или автоматично).
 */
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { CLIMB, WEAPONS } from '@belmaster/shared';
import { backOut, easeOut, emojiSprite, Puffs, skyTexture, Tweens } from '@/components/three/util';

const HGT = 540;
const R0 = 340;
const R1 = 60;
const N = CLIMB.STEPS;
const COLORS = ['#1cb0f6', '#ff4b4b'];
const NAMES = ['Ти', 'Бот Перко'];
/** мащаб на героите */
const SC = 1.9;

const radius = (y: number) => R0 - ((R0 - R1) * y) / HGT;
/** Къде стои герой на височина h (0 = земята, N = върхът); s = -1 ляво, +1 дясно. */
function stand(s: number, h: number): THREE.Vector3 {
  if (h <= 0) return new THREE.Vector3(s * (R0 + 90), 0, 30);
  if (h >= N) return new THREE.Vector3(s * 26, HGT + 6, 0);
  const y = (h * HGT) / N;
  return new THREE.Vector3(s * (radius(y) + 30), y, 0);
}

interface Hero {
  s: number;
  g: THREE.Group;
  body: THREE.Group;
  arm: THREE.Group;
  shieldMesh: THREE.Mesh;
  height: number;
  steps: THREE.Mesh[];
  shield: boolean;
  shieldUsed: boolean;
  weapon: string;
}

function makeHero(color: string, s: number): Hero {
  const root = new THREE.Group();
  const g = new THREE.Group();
  g.scale.setScalar(SC);
  root.add(g);
  const skin = new THREE.MeshStandardMaterial({ color: '#f6cfa6', roughness: 0.8 });
  const cloth = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
  const dark = new THREE.MeshStandardMaterial({ color: '#2b2b33', roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(11, 14, 4, 10), cloth);
  body.position.y = 24;
  const head = new THREE.Mesh(new THREE.SphereGeometry(11.5, 14, 12), skin);
  head.position.y = 51;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(12.2, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), dark);
  hair.position.y = 52.5;
  for (const x of [-4, 4]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(1.6, 6, 6), dark);
    eye.position.set(x, 52, 10.6);
    g.add(eye);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(4, 8, 3, 6), dark);
    leg.position.set(x * 1.4, 7, 0);
    g.add(leg);
  }
  // ръка с чукче (върти се около рамото)
  const arm = new THREE.Group();
  arm.position.set(-s * 12, 34, 0);
  const upper = new THREE.Mesh(new THREE.CapsuleGeometry(3.4, 12, 3, 6), cloth);
  upper.position.y = -8;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 20, 5), new THREE.MeshStandardMaterial({ color: '#7a5230' }));
  handle.position.set(0, -18, 7);
  handle.rotation.x = Math.PI / 2;
  const hammer = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 12), new THREE.MeshStandardMaterial({ color: '#8d99a6', metalness: 0.5, roughness: 0.4 }));
  hammer.position.set(0, -18, 17);
  hammer.rotation.x = Math.PI / 2;
  arm.add(upper, handle, hammer);
  handle.name = hammer.name = 'hammer';
  const arm2 = new THREE.Mesh(new THREE.CapsuleGeometry(3.4, 12, 3, 6), cloth);
  arm2.position.set(s * 12, 26, 0);
  const shieldMesh = new THREE.Mesh(new THREE.SphereGeometry(44, 20, 14), new THREE.MeshStandardMaterial({ color: '#1cb0f6', transparent: true, opacity: 0.22, emissive: '#1cb0f6', emissiveIntensity: 0.6, depthWrite: false }));
  shieldMesh.position.y = 32;
  shieldMesh.visible = false;
  g.add(body, head, hair, arm, arm2, shieldMesh);
  g.traverse((o) => {
    if (o !== shieldMesh) (o as THREE.Mesh).castShadow = true;
  });
  root.rotation.y = -s * 0.5; // леко обърнат към средата
  return { s, g: root, body: g, arm, shieldMesh, height: 0, steps: [], shield: false, shieldUsed: false, weapon: s < 0 ? 'book' : 'ball' };
}

class Engine {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(36, 1, 10, 8000);
  tweens = new Tweens();
  puffs: Puffs;
  heroes: Hero[];
  flag: THREE.Mesh;
  clouds: THREE.Group[] = [];
  stoneMat = new THREE.MeshStandardMaterial({ color: '#b9b2a4', roughness: 0.95, flatShading: true });
  busy = false;
  auto = true;
  turn = 0;
  wait = 1.2;
  userAz = 0;
  az = 0;
  camY = 200;
  shake = 0;
  raf = 0;
  last = performance.now();
  frames = 0;
  fpsAt = performance.now();
  onChange: (s: { heights?: number[]; msg?: string | null; fps?: number; busy?: boolean; shieldUsed?: boolean }) => void = () => {};

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.scene.background = skyTexture('#4f9be0', '#ffe2c2');
    this.scene.fog = new THREE.Fog('#f1dcc4', 2200, 5200);
    this.scene.add(new THREE.HemisphereLight('#e6f3ff', '#6a5a4c', 1.25));
    const sun = new THREE.DirectionalLight('#fff0d2', 2.4);
    sun.position.set(-420, 900, 620);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -700; sc.right = 700; sc.top = 800; sc.bottom = -300; sc.near = 10; sc.far = 2600;
    sun.shadow.bias = -0.001;
    this.scene.add(sun);
    this.puffs = new Puffs(this.scene);

    const flat = (c: THREE.ColorRepresentation) => new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true });
    const ground = new THREE.Mesh(new THREE.CircleGeometry(3200, 48), flat('#7fae62'));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    // планината: пресечена пирамида с ръбове наляво и надясно — по тях са стъпалата
    const mountain = new THREE.Mesh(new THREE.CylinderGeometry(R1, R0, HGT, 4, 6), flat('#8c8478'));
    mountain.position.y = HGT / 2;
    mountain.castShadow = true;
    mountain.receiveShadow = true;
    const snow = new THREE.Mesh(new THREE.CylinderGeometry(R1 + 2, radius(HGT * 0.72) + 2, HGT * 0.28, 4, 1), flat('#f6f9fc'));
    snow.position.y = HGT * 0.86;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(R1 + 12, R1 + 6, 10, 4), flat('#e9eef3'));
    top.position.y = HGT + 1;
    top.receiveShadow = true;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 90, 6), flat('#5b4634'));
    pole.position.set(0, HGT + 48, -18);
    this.flag = new THREE.Mesh(new THREE.BoxGeometry(46, 28, 1.5), flat('#ffc800'));
    this.flag.position.set(24, HGT + 76, -18);
    this.scene.add(ground, mountain, snow, top, pole, this.flag);

    // далечни върхове, борчета и облаци
    let sd = 5;
    const r = () => ((sd = Math.sin(sd) * 43758.5453), (sd -= Math.floor(sd)));
    for (let k = 0; k < 14; k++) {
      const a = -Math.PI * 0.95 + r() * Math.PI * 0.9 * 2;
      const d = 1300 + r() * 1500;
      const h = 380 + r() * 620, w = 280 + r() * 320;
      const pk = new THREE.Mesh(new THREE.ConeGeometry(w, h, 6), flat(new THREE.Color().setHSL(0.6, 0.18, 0.36 + r() * 0.12)));
      pk.position.set(Math.sin(a) * d, h / 2, -Math.abs(Math.cos(a)) * d - 300);
      const sn = new THREE.Mesh(new THREE.ConeGeometry(w * 0.32, h * 0.32, 6), flat('#f4f7fb'));
      sn.position.set(pk.position.x, h * 0.845, pk.position.z);
      this.scene.add(pk, sn);
    }
    for (let k = 0; k < 40; k++) {
      const a = r() * Math.PI * 2, d = 560 + r() * 900;
      const hgt = 50 + r() * 50;
      const t = new THREE.Mesh(new THREE.ConeGeometry(18 + r() * 10, hgt, 6), flat('#3b7a3f'));
      t.position.set(Math.sin(a) * d, hgt / 2, Math.cos(a) * d * 0.8 - 150);
      t.castShadow = true;
      this.scene.add(t);
    }
    const cm = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, transparent: true, opacity: 0.93 });
    for (let k = 0; k < 8; k++) {
      const cl = new THREE.Group();
      for (let j = 0; j < 4; j++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(46 + r() * 30, 8, 6), cm);
        s.position.set(j * 50 - 75, r() * 18, r() * 20);
        s.scale.y = 0.6;
        cl.add(s);
      }
      cl.position.set(-1200 + r() * 2400, 260 + r() * 520, -500 - r() * 600);
      cl.userData.v = 8 + r() * 12;
      this.clouds.push(cl);
      this.scene.add(cl);
    }

    for (let k = 0; k < 26; k++) {
      const y = 20 + r() * HGT * 0.62, t = 0.15 + r() * 0.7, sx = r() < 0.5 ? -1 : 1, rr = radius(y) - 4;
      const at = new THREE.Vector3(sx * rr * t, y, rr * (1 - t));
      if (r() < 0.6) {
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(10 + r() * 16, 0), flat(new THREE.Color().setHSL(0.09, 0.08, 0.42 + r() * 0.12)));
        rock.position.copy(at);
        rock.castShadow = true;
        this.scene.add(rock);
      } else if (y < HGT * 0.45) {
        const hg = 36 + r() * 30;
        const pine = new THREE.Mesh(new THREE.ConeGeometry(13 + r() * 6, hg, 6), flat('#356f3a'));
        pine.position.copy(at).setY(y + hg / 2 - 4);
        pine.castShadow = true;
        this.scene.add(pine);
      }
    }
    this.heroes = [makeHero(COLORS[0], -1), makeHero(COLORS[1], 1)];
    for (const h of this.heroes) {
      h.g.position.copy(stand(h.s, 0));
      this.scene.add(h.g);
    }
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  emit(msg?: string | null) {
    this.onChange({ heights: this.heroes.map((h) => h.height), busy: this.busy, shieldUsed: this.heroes[0].shieldUsed, ...(msg !== undefined ? { msg } : {}) });
  }

  reset() {
    this.tweens.clear();
    for (const h of this.heroes) {
      h.steps.forEach((m) => this.scene.remove(m));
      h.steps = [];
      h.height = 0;
      h.shield = h.shieldUsed = false;
      h.shieldMesh.visible = false;
      h.g.position.copy(stand(h.s, 0));
      h.g.rotation.set(0, -h.s * 0.5, 0);
      h.arm.rotation.set(0, 0, 0);
    }
    this.busy = false;
    this.turn = 0;
    this.wait = 1.2;
    this.emit(null);
  }

  done(msg?: string | null) {
    this.busy = false;
    this.wait = 0.9;
    this.emit(msg);
  }

  hop(h: Hero, to: THREE.Vector3, d: number, lift: number, spin = 0, done?: () => void) {
    const from = h.g.position.clone();
    this.tweens.add(
      d,
      (k) => {
        h.g.position.lerpVectors(from, to, k);
        h.g.position.y += Math.sin(k * Math.PI) * lift;
        h.g.rotation.z = spin * Math.sin(k * Math.PI) * h.s;
      },
      () => {
        h.g.rotation.z = 0;
        done?.();
      },
    );
  }

  /** Строи стъпало с чукчето и се качва. */
  climb(i: number) {
    const h = this.heroes[i];
    if (this.busy || h.height >= N) return;
    this.busy = true;
    this.emit(null);
    const n = h.height + 1;
    if (h.shield) {
      h.shield = false;
      h.shieldMesh.visible = false;
    }
    if (n >= N) {
      this.hop(h, stand(h.s, N), 0.6, 60, 0, () => {
        h.height = N;
        for (let k = 0; k < 5; k++) this.tweens.after(k * 0.25, () => this.puffs.burst(new THREE.Vector3((Math.random() - 0.5) * 120, HGT + 90, 0), 26, ['#ffc800', '#ff4b4b', '#58cc02', '#1cb0f6'][k % 4], 190, 5, 1.3));
        this.emit(`🏆 ${NAMES[i]} стигна върха!`);
        this.tweens.after(4, () => this.reset());
      });
      return;
    }
    const y = (n * HGT) / N;
    const step = new THREE.Mesh(new THREE.BoxGeometry(112, 18, 140), this.stoneMat);
    step.position.set(h.s * (radius(y) + 22), y - 9, 0);
    step.scale.setScalar(0.01);
    step.castShadow = true;
    step.receiveShadow = true;
    this.scene.add(step);
    h.steps.push(step);
    const at = step.position.clone().add(new THREE.Vector3(h.s * 30, 14, 50));
    // три удара с чукчето
    for (let b = 0; b < 3; b++) {
      this.tweens.add(0.24, (k) => (h.arm.rotation.x = -Math.sin(k * Math.PI) * 2.1), () => this.puffs.burst(at, 7, '#ffd54a', 80, 2.6, 0.45), b * 0.26);
    }
    this.tweens.add(0.78, (k) => step.scale.setScalar(Math.max(0.01, backOut(k))));
    this.tweens.after(0.82, () => {
      h.arm.rotation.x = 0;
      this.hop(h, stand(h.s, n), 0.42, 60, 0, () => {
        h.height = n;
        this.puffs.burst(h.g.position.clone(), 6, '#e8e1d2', 60, 3.5, 0.5);
        this.done();
      });
    });
  }

  /** Пада едно стъпало надолу; стъпалото под него се рони. */
  fall(h: Hero, done: () => void) {
    if (h.height <= 0) {
      this.tweens.add(0.4, (k) => (h.g.rotation.z = Math.sin(k * Math.PI * 3) * 0.25 * (1 - k)), () => ((h.g.rotation.z = 0), done()));
      return;
    }
    const step = h.steps.pop();
    if (step) {
      this.puffs.burst(step.position.clone(), 16, '#b9b2a4', 120, 6, 0.8);
      this.tweens.add(0.35, (k) => (step.scale.setScalar(Math.max(0.01, 1 - k)), (step.rotation.z = k * h.s)), () => this.scene.remove(step));
    }
    this.shake = 0.3;
    this.hop(h, stand(h.s, h.height - 1), 0.55, 30, 0.9, () => {
      h.height--;
      this.puffs.burst(h.g.position.clone(), 10, '#e8e1d2', 80, 4, 0.6);
      done();
    });
  }

  throwAt(i: number) {
    const a = this.heroes[i], b = this.heroes[1 - i];
    if (this.busy) return;
    this.busy = true;
    this.emit(null);
    const emoji = WEAPONS.find((w) => w.id === a.weapon)?.emoji ?? '🪨';
    const ball = emojiSprite(emoji, 70);
    this.scene.add(ball);
    const from = a.g.position.clone().add(new THREE.Vector3(0, 110, 10));
    const target = b.g.position.clone().add(new THREE.Vector3(0, 65, 0));
    const reflect = b.shield;
    const hit = !reflect && Math.random() < 0.65;
    const miss = target.clone().add(new THREE.Vector3(b.s * 140, -40, 60));
    const end = hit || reflect ? target : miss;
    const arc = (p0: THREE.Vector3, p1: THREE.Vector3, k: number, lift: number) => {
      ball.position.lerpVectors(p0, p1, k);
      ball.position.y += Math.sin(k * Math.PI) * lift;
      ball.material.rotation = k * 9;
    };
    // замах
    this.tweens.add(0.3, (k) => (a.arm.rotation.x = -Math.sin(k * Math.PI) * 2.6));
    this.tweens.add(0.75, (k) => arc(from, end, k, 150), () => {
      if (reflect) {
        b.shield = false;
        b.shieldMesh.visible = true;
        this.puffs.burst(target, 18, '#7fd4ff', 150, 4, 0.6);
        this.tweens.add(0.5, (k) => (b.shieldMesh.scale.setScalar(1 + k * 0.5), ((b.shieldMesh.material as THREE.MeshStandardMaterial).opacity = 0.5 * (1 - k))), () => {
          b.shieldMesh.visible = false;
          b.shieldMesh.scale.setScalar(1);
          (b.shieldMesh.material as THREE.MeshStandardMaterial).opacity = 0.22;
        });
        const back = a.g.position.clone().add(new THREE.Vector3(0, 65, 0));
        this.tweens.add(0.6, (k) => arc(target, back, k, 130), () => {
          this.scene.remove(ball);
          this.puffs.burst(back, 12, '#fff3c4', 120, 4);
          this.fall(a, () => this.done(`🛡️ ${NAMES[1 - i]} отби удара!`));
        });
      } else if (hit) {
        this.scene.remove(ball);
        this.puffs.burst(target, 14, '#fff3c4', 130, 4);
        this.fall(b, () => this.done(`🎯 ${NAMES[i]} уцели!`));
      } else {
        this.tweens.add(0.4, (k) => (ball.position.y -= 260 * k * 0.05), () => this.scene.remove(ball));
        if (a.shield) {
          a.shield = false;
          a.shieldMesh.visible = false;
          this.puffs.burst(a.g.position.clone().add(new THREE.Vector3(0, 65, 0)), 14, '#7fd4ff', 120, 4);
          this.tweens.after(0.4, () => this.done(`🛡️ ${NAMES[i]} не уцели, но щитът го опази.`));
        } else this.fall(a, () => this.done(`💥 ${NAMES[i]} не уцели и падна.`));
      }
    });
  }

  shield(i: number) {
    const h = this.heroes[i];
    if (this.busy || h.shieldUsed || h.height <= 0) return;
    h.shield = h.shieldUsed = true;
    h.shieldMesh.visible = true;
    this.puffs.burst(h.g.position.clone().add(new THREE.Vector3(0, 65, 0)), 12, '#7fd4ff', 90, 3.5);
    this.emit(i === 0 ? '🛡️ Щитът е вдигнат (в играта другият не го вижда).' : null);
  }

  botAct(i: number) {
    const h = this.heroes[i], o = this.heroes[1 - i];
    const x = Math.random();
    if (!h.shieldUsed && h.height > 1 && x < 0.12) this.shield(i);
    if (o.height > 0 && Math.random() < (o.height > h.height ? 0.5 : 0.25)) this.throwAt(i);
    else this.climb(i);
  }

  /** Действие на играча (ляво); после ботът отговаря. */
  act(kind: 'climb' | 'throw' | 'shield') {
    if (this.busy || this.heroes.some((h) => h.height >= N)) return;
    if (kind === 'shield') return this.shield(0);
    this.turn = 1;
    if (kind === 'climb') this.climb(0);
    else this.throwAt(0);
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  loop(now: number) {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.tweens.update(dt);
    this.puffs.update(dt);
    const finished = this.heroes.some((h) => h.height >= N);
    if (!this.busy && !finished) {
      this.wait -= dt;
      if (this.wait <= 0 && (this.auto || this.turn === 1)) {
        const i = this.turn;
        this.turn = this.auto ? 1 - this.turn : 0;
        this.wait = 0.6;
        this.botAct(i);
      }
    }
    // леко „дишане“ на героите, вятър по знамето, облаци
    this.heroes.forEach((h, i) => {
      h.body.scale.y = SC * (1 + Math.sin(now / 420 + i * 2) * 0.025);
      if (h.shieldMesh.visible && h.shield) h.shieldMesh.rotation.y += dt * 1.5;
    });
    this.flag.rotation.y = Math.sin(now / 300) * 0.35;
    for (const c of this.clouds) {
      c.position.x += (c.userData.v as number) * dt;
      if (c.position.x > 1500) c.position.x = -1500;
    }
    // камерата следи по-високия герой и леко обикаля
    const lead = Math.max(...this.heroes.map((h) => h.g.position.y));
    const low = Math.min(...this.heroes.map((h) => h.g.position.y));
    this.camY += (lead * 0.65 + low * 0.35 + 70 - this.camY) * Math.min(1, dt * 1.8);
    this.az += (this.userAz + Math.sin(now / 7000) * 0.2 - this.az) * Math.min(1, dt * 4);
    const half = Math.tan((this.camera.fov * Math.PI) / 360) * this.camera.aspect;
    const D = Math.max(1000, 520 / half);
    const fog = this.scene.fog as THREE.Fog;
    fog.near = D + 1400;
    fog.far = D + 4400;
    this.shake = Math.max(0, this.shake - dt);
    const sh = this.shake * 24;
    this.camera.position.set(Math.sin(this.az) * D + (Math.random() - 0.5) * sh, this.camY + 170 + (Math.random() - 0.5) * sh, Math.cos(this.az) * D);
    this.camera.lookAt(0, this.camY + 30, 0);
    this.renderer.render(this.scene, this.camera);
    this.frames++;
    if (now - this.fpsAt > 1000) {
      this.onChange({ fps: Math.round((this.frames * 1000) / (now - this.fpsAt)) });
      this.frames = 0;
      this.fpsAt = now;
    }
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.renderer.dispose();
  }
}

export function Climb3DDemo() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const eng = useRef<Engine | null>(null);
  const drag = useRef<{ x: number; az: number } | null>(null);
  const [auto, setAuto] = useState(true);
  const [hud, setHud] = useState({ heights: [0, 0], msg: null as string | null, fps: 0, busy: false, shieldUsed: false });
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
    Object.assign(window, { __c3d: e });
    e.onChange = (s) => setHud((h) => ({ ...h, ...s, msg: s.msg !== undefined ? s.msg : h.msg }));
    const ro = new ResizeObserver(() => {
      const r = wrap.current!.getBoundingClientRect();
      e.resize(Math.max(200, r.width), Math.max(200, r.height));
    });
    ro.observe(wrap.current!);
    return () => {
      ro.disconnect();
      e.dispose();
    };
  }, []);

  if (error) return <p className="rounded-2xl bg-error/10 p-4 font-bold">Това устройство не поддържа 3D (WebGL). Тук ще остава обикновеният изглед.</p>;
  const btn = 'btn3d rounded-2xl px-4 py-2.5 text-sm font-extrabold uppercase disabled:opacity-40';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => {
            const v = !auto;
            setAuto(v);
            if (eng.current) {
              eng.current.auto = v;
              eng.current.turn = 0;
            }
          }}
          className="rounded-xl bg-surface-2 px-3 py-1.5 text-sm font-extrabold"
        >
          {auto ? '⏸ Спри автоматичната игра (играй сам)' : '▶ Пусни автоматичната игра'}
        </button>
        <button onClick={() => eng.current?.reset()} className="rounded-xl bg-surface-2 px-3 py-1.5 text-sm font-extrabold">
          ↻ Отначало
        </button>
        <span className="ml-auto text-xs font-bold text-muted">{hud.fps} кадъра/с</span>
      </div>
      <div
        ref={wrap}
        className="relative h-[70dvh] min-h-96 cursor-grab touch-none select-none overflow-hidden rounded-3xl border-4 border-line active:cursor-grabbing"
        onPointerDown={(ev) => eng.current && (drag.current = { x: ev.clientX, az: eng.current.userAz })}
        onPointerMove={(ev) => {
          if (drag.current && eng.current) eng.current.userAz = Math.max(-0.9, Math.min(0.9, drag.current.az - (ev.clientX - drag.current.x) * 0.006));
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerLeave={() => (drag.current = null)}
      >
        <canvas ref={canvas} className="block size-full" />
        <div className="pointer-events-none absolute inset-x-3 top-3 flex justify-between">
          {hud.heights.map((h, i) => (
            <span key={i} className="rounded-xl px-3 py-1 text-base font-black text-white [text-shadow:0_1px_3px_rgba(0,0,0,.5)]" style={{ background: COLORS[i] }}>
              {NAMES[i]}: {h}/{N}
            </span>
          ))}
        </div>
        {hud.msg && <p className="pointer-events-none absolute inset-x-0 top-16 px-4 text-center text-2xl font-black text-white [text-shadow:0_3px_8px_rgba(0,0,0,.7)]">{hud.msg}</p>}
        {!auto && (
          <div className="absolute inset-x-0 bottom-4 flex flex-wrap justify-center gap-2" onPointerDown={(e) => e.stopPropagation()}>
            <button disabled={hud.busy} onClick={() => eng.current?.act('climb')} className={`${btn} bg-primary text-white [--btn-shadow:var(--color-primary-dark)]`}>
              ⛏ Качи се
            </button>
            <button disabled={hud.busy} onClick={() => eng.current?.act('throw')} className={`${btn} bg-error text-white [--btn-shadow:#c93a3a]`}>
              🎯 Хвърли
            </button>
            <button disabled={hud.busy || hud.shieldUsed || hud.heights[0] === 0} onClick={() => eng.current?.act('shield')} className={`${btn} bg-secondary text-white [--btn-shadow:#1899d6]`}>
              🛡 Щит
            </button>
          </div>
        )}
        {auto && <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-sm font-extrabold text-white [text-shadow:0_2px_4px_rgba(0,0,0,.6)]">Влачи наляво-надясно, за да завъртиш планината</p>}
      </div>
    </div>
  );
}
