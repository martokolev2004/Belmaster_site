'use client';

/**
 * ТЕСТ: битката в 3D — наклонена карта с релефни области и замъци на столиците.
 * Без въпроси и без сървър: областите се завладяват сами (и с клик), за да се види как изглежда.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { MAPS, PLAYER_COLORS, type GameMap } from '@belmaster/shared';
import { backOut, easeOut, Puffs, skyTexture, textSprite, Tweens } from '@/components/three/util';

const MAP_LIST: { id: string; label: string }[] = [
  { id: 'island', label: 'Островът' },
  { id: 'river-s', label: 'Реката' },
  { id: 'lake-s', label: 'Езерото' },
  { id: 'continent', label: 'Континентът' },
];
const NEUTRAL = ['#9ccc65', '#8bc34a', '#aed581', '#7cb342'];
const H = { neutral: 12, owned: 24, capital: 30 };

function parsePath(d: string): [number, number][][] {
  return d
    .split('M')
    .filter(Boolean)
    .map((sub) => {
      const nums = sub.match(/-?\d+(\.\d+)?/g)!.map(Number);
      const pts: [number, number][] = [];
      for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
      return pts;
    });
}
function inside(p: [number, number], poly: [number, number][]) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

interface Tile {
  id: string;
  group: THREE.Group;
  slab: THREE.Mesh;
  top: THREE.MeshStandardMaterial;
  deco: THREE.Group;
  castle: THREE.Group | null;
  label: THREE.Sprite;
  center: THREE.Vector3;
  neighbors: string[];
  owner: number | null;
  capital: boolean;
  h: number;
  base: THREE.Color;
}

function castle(color: string): THREE.Group {
  const g = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: '#e9e4d8', roughness: 0.9, flatShading: true });
  const roof = new THREE.MeshStandardMaterial({ color, roughness: 0.7, flatShading: true });
  const keep = new THREE.Mesh(new THREE.BoxGeometry(26, 22, 26), stone);
  keep.position.y = 11;
  g.add(keep);
  for (const [x, z] of [[-15, -15], [15, -15], [-15, 15], [15, 15]]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 7.5, 30, 8), stone);
    t.position.set(x, 15, z);
    const c = new THREE.Mesh(new THREE.ConeGeometry(8.5, 13, 8), roof);
    c.position.set(x, 36, z);
    g.add(t, c);
  }
  const top = new THREE.Mesh(new THREE.ConeGeometry(13, 18, 4), roof);
  top.rotation.y = Math.PI / 4;
  top.position.y = 31;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 26, 5), stone);
  pole.position.y = 50;
  const flag = new THREE.Mesh(new THREE.BoxGeometry(14, 9, 0.8), roof);
  flag.position.set(7.5, 58, 0);
  flag.name = 'flag';
  g.add(top, pole, flag);
  g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  return g;
}

class Engine {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(36, 1, 10, 6000);
  world = new THREE.Group();
  tiles = new Map<string, Tile>();
  tweens = new Tweens();
  puffs: Puffs;
  ray = new THREE.Raycaster();
  sea: THREE.Mesh;
  az = 0;
  pol = 0.92;
  userAz = 0;
  idle = 0;
  hover: Tile | null = null;
  raf = 0;
  last = performance.now();
  nextMove = 2;
  frames = 0;
  fpsAt = performance.now();
  auto = true;
  players = 3;
  onChange: (s: { counts?: number[]; fps?: number; msg?: string | null }) => void = () => {};

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.scene.background = skyTexture('#5fb7ee', '#d9f0ff');
    this.scene.fog = new THREE.Fog('#cfeaff', 1700, 3600);
    this.scene.add(new THREE.HemisphereLight('#e8f6ff', '#5d7a4a', 1.3));
    const sun = new THREE.DirectionalLight('#fff3d6', 2.3);
    sun.position.set(-380, 620, 260);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -640; sc.right = 640; sc.top = 460; sc.bottom = -460; sc.near = 10; sc.far = 1800;
    sun.shadow.bias = -0.001;
    this.scene.add(sun);
    this.sea = new THREE.Mesh(new THREE.PlaneGeometry(7000, 7000, 1, 1), new THREE.MeshStandardMaterial({ color: '#2f8fd0', roughness: 0.25, metalness: 0.1 }));
    this.sea.rotation.x = -Math.PI / 2;
    this.sea.receiveShadow = true;
    this.scene.add(this.sea, this.world);
    this.puffs = new Puffs(this.scene);
    this.load('island');
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  load(id: string) {
    const map: GameMap = MAPS[id];
    this.tweens.clear();
    this.world.clear();
    this.tiles.clear();
    this.hover = null;
    const cx = map.width / 2, cy = map.height / 2;
    const side = new THREE.MeshStandardMaterial({ color: '#c9a26b', roughness: 1 });
    const treeMat = new THREE.MeshStandardMaterial({ color: '#2f7d32', roughness: 1, flatShading: true });
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#6d4c2f', roughness: 1 });
    const rockMat = new THREE.MeshStandardMaterial({ color: '#a8a39a', roughness: 1, flatShading: true });
    map.regions.forEach((r, i) => {
      const poly = parsePath(r.path)[0];
      const [mx, my] = r.center;
      const shape = new THREE.Shape();
      poly.forEach(([x, y], k) => {
        // леко свиване към центъра — да се виждат фугите между плочките
        const px = mx + (x - mx) * 0.975 - cx, py = -(my + (y - my) * 0.975 - cy);
        if (k === 0) shape.moveTo(px, py);
        else shape.lineTo(px, py);
      });
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2);
      const base = new THREE.Color(NEUTRAL[i % NEUTRAL.length]);
      const top = new THREE.MeshStandardMaterial({ color: base.clone(), roughness: 0.85 });
      const slab = new THREE.Mesh(geo, [top, side]);
      slab.castShadow = true;
      slab.receiveShadow = true;
      slab.scale.y = H.neutral;
      slab.userData.id = r.id;
      const group = new THREE.Group();
      const deco = new THREE.Group();
      deco.position.y = H.neutral;
      // дръвчета и камъни на случайни места вътре в областта
      let s = i * 7.13 + 1;
      const rand = () => ((s = Math.sin(s) * 43758.5453), (s -= Math.floor(s)));
      for (let k = 0, placed = 0; k < 40 && placed < 5; k++) {
        const p: [number, number] = [mx + (rand() - 0.5) * 150, my + (rand() - 0.5) * 120];
        if (!inside(p, poly) || Math.hypot(p[0] - mx, p[1] - my) < 34) continue;
        if (![[12, 0], [-12, 0], [0, 12], [0, -12]].every(([dx, dy]) => inside([p[0] + dx, p[1] + dy], poly))) continue;
        const item = new THREE.Group();
        if (rand() < 0.75) {
          const hgt = 16 + rand() * 12;
          const tr = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2, 6, 5), trunkMat);
          tr.position.y = 3;
          const cr = new THREE.Mesh(new THREE.ConeGeometry(7 + rand() * 3, hgt, 6), treeMat);
          cr.position.y = 6 + hgt / 2;
          cr.castShadow = true;
          item.add(tr, cr);
        } else {
          const rk = new THREE.Mesh(new THREE.DodecahedronGeometry(4 + rand() * 4, 0), rockMat);
          rk.position.y = 3;
          rk.castShadow = true;
          item.add(rk);
        }
        item.position.set(p[0] - cx, 0, p[1] - cy);
        deco.add(item);
        placed++;
      }
      const label = textSprite(r.name, r.sub, 1.35);
      const center = new THREE.Vector3(mx - cx, 0, my - cy);
      label.position.set(center.x, H.neutral + 22, center.z);
      group.add(slab, deco, label);
      this.world.add(group);
      this.tiles.set(r.id, { id: r.id, group, slab, top, deco, castle: null, label, center, neighbors: r.neighbors, owner: null, capital: false, h: H.neutral, base });
    });
    const caps = map.capitals[String(map.capitals['3'] ? 3 : 2)];
    this.players = caps.length;
    caps.forEach((id, p) => {
      const t = this.tiles.get(id)!;
      t.capital = true;
      t.castle = castle(PLAYER_COLORS[p]);
      t.castle.position.set(t.center.x, H.neutral, t.center.z);
      t.group.add(t.castle);
      this.take(t, p, false);
    });
    this.nextMove = 1.5;
    this.count();
  }

  count(msg: string | null = null) {
    const counts = Array.from({ length: this.players }, () => 0);
    this.tiles.forEach((t) => t.owner != null && counts[t.owner]++);
    this.onChange({ counts, msg });
  }

  setHeight(t: Tile, h: number) {
    t.h = h;
    t.slab.scale.y = h;
    t.deco.position.y = h;
    if (t.castle) t.castle.position.y = h;
    t.label.position.y = h + (t.capital ? 90 : 26);
  }

  take(t: Tile, p: number, animate = true) {
    t.owner = p;
    const from = t.top.color.clone();
    const to = new THREE.Color(PLAYER_COLORS[p]).lerp(new THREE.Color('#ffffff'), 0.12);
    const h0 = t.h, h1 = t.capital ? H.capital : H.owned;
    if (!animate) {
      t.top.color.copy(to);
      this.setHeight(t, h1);
      return;
    }
    this.tweens.add(0.55, (k) => {
      t.top.color.copy(from).lerp(to, easeOut(k));
      this.setHeight(t, h0 - 8 * Math.sin(Math.min(1, k * 2.2) * Math.PI) * (k < 0.45 ? 1 : 0) + (h1 - h0) * backOut(k));
    });
    this.puffs.burst(new THREE.Vector3(t.center.x, h1 + 6, t.center.z), 14, PLAYER_COLORS[p], 110, 4.5);
  }

  /** Гюле от най-близката област на нападателя → после областта сменя цвета си. */
  attack(target: Tile, p: number) {
    let from: Tile | null = null;
    this.tiles.forEach((t) => {
      if (t.owner === p && target.neighbors.includes(t.id) && (!from || t.center.distanceTo(target.center) < from.center.distanceTo(target.center))) from = t;
    });
    if (!from) return false;
    const a = (from as Tile).center.clone().setY((from as Tile).h + 10), b = target.center.clone().setY(target.h + 6);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(5, 10, 8), new THREE.MeshStandardMaterial({ color: '#2b2b2b', roughness: 0.5 }));
    ball.castShadow = true;
    this.scene.add(ball);
    this.tweens.add(
      0.5,
      (k) => ball.position.lerpVectors(a, b, k).setY(a.y + (b.y - a.y) * k + Math.sin(k * Math.PI) * 70),
      () => {
        this.scene.remove(ball);
        this.puffs.burst(b, 10, '#f5efe0', 90, 5);
        this.take(target, p);
        this.count();
      },
    );
    return true;
  }

  autoMove() {
    const order = Array.from({ length: this.players }, (_, i) => i).sort(() => Math.random() - 0.5);
    for (const p of order) {
      const options: Tile[] = [];
      this.tiles.forEach((t) => {
        if (t.owner !== p && !t.capital && t.neighbors.some((n) => this.tiles.get(n)?.owner === p)) options.push(t);
      });
      const free = options.filter((t) => t.owner == null);
      const pool = free.length ? free : options;
      if (pool.length && this.attack(pool[Math.floor(Math.random() * pool.length)], p)) return;
    }
  }

  pick(x: number, y: number): Tile | null {
    this.ray.setFromCamera(new THREE.Vector2(x, y), this.camera);
    const hit = this.ray.intersectObjects([...this.tiles.values()].map((t) => t.slab), false)[0];
    return hit ? this.tiles.get(hit.object.userData.id as string) ?? null : null;
  }

  click(x: number, y: number) {
    const t = this.pick(x, y);
    if (!t) return;
    if (t.owner === 1) return this.count('Това вече е твое.');
    if (t.capital) return this.count('Столиците в този тест не се превземат.');
    if (!this.attack(t, 1)) this.count('Можеш да нападаш само съседни на твоите (сините) области.');
  }

  setHover(x: number, y: number) {
    const t = this.pick(x, y);
    if (t === this.hover) return;
    if (this.hover) this.hover.top.emissive.set('#000000');
    this.hover = t;
    if (t) t.top.emissive.set('#333322');
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
    if (this.auto) {
      this.nextMove -= dt;
      if (this.nextMove <= 0) {
        this.nextMove = 1.3;
        const free = [...this.tiles.values()].some((t) => t.owner == null);
        if (!free && Math.random() < 0.15) this.nextMove = 2.5;
        this.autoMove();
      }
    }
    // знамената се веят, морето леко диша
    this.tiles.forEach((t) => {
      const f = t.castle?.getObjectByName('flag');
      if (f) f.rotation.y = Math.sin(now / 260 + t.center.x) * 0.5;
    });
    this.sea.position.y = Math.sin(now / 1400) * 1.2 + 1;
    // камера: леко се поклаща; с влачене се върти
    this.idle += dt;
    const sway = Math.sin(now / 6000) * 0.22;
    this.az += (this.userAz + sway - this.az) * Math.min(1, dt * 4);
    // цялата карта да се побира и на тесен екран
    const half = Math.tan((this.camera.fov * Math.PI) / 360) * this.camera.aspect;
    const D = Math.max(1180, 640 / half);
    const fog = this.scene.fog as THREE.Fog;
    fog.near = D + 700;
    fog.far = D + 3200;
    this.camera.position.set(Math.sin(this.az) * Math.sin(this.pol) * D, Math.cos(this.pol) * D, Math.cos(this.az) * Math.sin(this.pol) * D);
    this.camera.lookAt(0, 0, 20);
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

export function Battle3DDemo() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const eng = useRef<Engine | null>(null);
  const drag = useRef<{ x: number; y: number; az: number; pol: number; moved: boolean } | null>(null);
  const [map, setMap] = useState('island');
  const [auto, setAuto] = useState(true);
  const [hud, setHud] = useState<{ counts: number[]; fps: number; msg: string | null }>({ counts: [], fps: 0, msg: null });
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
    Object.assign(window, { __b3d: e });
    e.onChange = (s) => setHud((h) => ({ counts: s.counts ?? h.counts, fps: s.fps ?? h.fps, msg: s.msg !== undefined ? s.msg : h.msg }));
    e.count();
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

  const ndc = (ev: React.PointerEvent) => {
    const r = wrap.current!.getBoundingClientRect();
    return [((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1] as const;
  };
  const pickMap = useCallback((id: string) => {
    setMap(id);
    eng.current?.load(id);
  }, []);

  if (error) return <p className="rounded-2xl bg-error/10 p-4 font-bold">Това устройство не поддържа 3D (WebGL). Тук ще остава обикновената карта.</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {MAP_LIST.map((m) => (
          <button key={m.id} onClick={() => pickMap(m.id)} className={`rounded-xl px-3 py-1.5 text-sm font-extrabold ${map === m.id ? 'bg-secondary text-white' : 'bg-surface-2 text-muted'}`}>
            {m.label}
          </button>
        ))}
        <button
          onClick={() => {
            const v = !auto;
            setAuto(v);
            if (eng.current) eng.current.auto = v;
          }}
          className="rounded-xl bg-surface-2 px-3 py-1.5 text-sm font-extrabold"
        >
          {auto ? '⏸ Спри автоматичната битка' : '▶ Пусни автоматичната битка'}
        </button>
        <span className="ml-auto text-xs font-bold text-muted">{hud.fps} кадъра/с</span>
      </div>
      <div
        ref={wrap}
        className="relative h-[70dvh] min-h-96 cursor-grab touch-none select-none overflow-hidden rounded-3xl border-4 border-line active:cursor-grabbing"
        onPointerDown={(ev) => {
          const e = eng.current;
          if (!e) return;
          (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
          drag.current = { x: ev.clientX, y: ev.clientY, az: e.userAz, pol: e.pol, moved: false };
        }}
        onPointerMove={(ev) => {
          const e = eng.current;
          if (!e) return;
          const d = drag.current;
          if (!d) return e.setHover(...ndc(ev));
          const dx = ev.clientX - d.x, dy = ev.clientY - d.y;
          if (Math.abs(dx) + Math.abs(dy) > 6) d.moved = true;
          e.userAz = Math.max(-1.2, Math.min(1.2, d.az - dx * 0.006));
          e.pol = Math.max(0.35, Math.min(1.25, d.pol - dy * 0.005));
        }}
        onPointerUp={(ev) => {
          const d = drag.current;
          drag.current = null;
          if (d && !d.moved) eng.current?.click(...ndc(ev));
        }}
      >
        <canvas ref={canvas} className="block size-full" />
        <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
          {hud.counts.map((c, i) => (
            <span key={i} className="rounded-xl px-3 py-1 text-lg font-black text-white [text-shadow:0_1px_3px_rgba(0,0,0,.5)]" style={{ background: PLAYER_COLORS[i] }}>
              {i === 1 ? 'Ти ' : ''}
              {c}
            </span>
          ))}
        </div>
        {hud.msg && <p className="pointer-events-none absolute inset-x-0 top-16 text-center text-lg font-black text-white [text-shadow:0_2px_6px_rgba(0,0,0,.7)]">{hud.msg}</p>}
        <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-sm font-extrabold text-white [text-shadow:0_2px_4px_rgba(0,0,0,.6)]">Влачи, за да завъртиш · натисни съседна област, за да я превземеш (ти си синият)</p>
      </div>
    </div>
  );
}
