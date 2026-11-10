import * as THREE from 'three';

/** Небе — вертикален преливащ цвят. */
export function skyTexture(top: string, bottom: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Надпис, който винаги гледа към камерата (до два реда). */
export function textSprite(text: string, sub?: string, scale = 1): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 160;
  const g = c.getContext('2d')!;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  const draw = (t: string, y: number, size: number, alpha = 1) => {
    g.font = `800 ${size}px Nunito, system-ui, sans-serif`;
    g.lineWidth = size / 5;
    g.strokeStyle = 'rgba(0,0,0,.55)';
    g.strokeText(t, 256, y);
    g.fillStyle = `rgba(255,255,255,${alpha})`;
    g.fillText(t, 256, y);
  };
  draw(text, sub ? 58 : 80, 62);
  if (sub) draw(sub, 120, 40, 0.92);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set(128 * scale, 40 * scale, 1);
  s.renderOrder = 10;
  return s;
}

/** Емоджи като спрайт (за летящите предмети). */
export function emojiSprite(emoji: string, size = 40): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.font = '96px system-ui, "Apple Color Emoji", "Noto Color Emoji", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(emoji, 64, 70);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  s.scale.set(size, size, 1);
  return s;
}

/** Малки анимации във времето: fn(k) с k от 0 до 1. */
export class Tweens {
  list: { t: number; d: number; delay: number; fn: (k: number) => void; done?: () => void }[] = [];
  add(d: number, fn: (k: number) => void, done?: () => void, delay = 0) {
    this.list.push({ t: 0, d, delay, fn, done });
  }
  after(delay: number, done: () => void) {
    this.add(0.001, () => {}, done, delay);
  }
  update(dt: number) {
    for (const a of [...this.list]) {
      if (a.delay > 0) {
        a.delay -= dt;
        continue;
      }
      a.t += dt;
      const k = Math.min(1, a.t / a.d);
      a.fn(k);
      if (k >= 1) {
        this.list.splice(this.list.indexOf(a), 1);
        a.done?.();
      }
    }
  }
  clear() {
    this.list = [];
  }
}

/** Прах / искри: малки топчета, които се разлитат и изчезват. */
export class Puffs {
  items: { mesh: THREE.Mesh; v: THREE.Vector3; life: number; max: number }[] = [];
  geo = new THREE.SphereGeometry(1, 6, 5);
  constructor(private scene: THREE.Scene) {}
  burst(at: THREE.Vector3, n: number, color: string, speed = 100, size = 4, life = 0.7) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(this.geo, mat);
      m.position.copy(at);
      m.scale.setScalar(size);
      this.scene.add(m);
      this.items.push({ mesh: m, v: new THREE.Vector3((Math.random() - 0.5) * 2 * speed, Math.random() * speed * 1.2, (Math.random() - 0.5) * 2 * speed), life, max: life });
      m.userData.size = size;
    }
  }
  update(dt: number) {
    for (const p of this.items) {
      p.life -= dt;
      p.v.y -= 220 * dt;
      p.mesh.position.addScaledVector(p.v, dt);
      p.mesh.scale.setScalar(Math.max(0.01, p.life / p.max) * (p.mesh.userData.size as number));
    }
    this.items = this.items.filter((p) => (p.life > 0 ? true : (this.scene.remove(p.mesh), false)));
  }
}

export const easeOut = (k: number) => 1 - (1 - k) ** 3;
export const backOut = (k: number) => 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2;
