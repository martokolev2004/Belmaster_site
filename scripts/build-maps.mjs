// Генерира картите на измисления континент (SVG пътища + съседства).
// Изход: packages/shared/src/maps.generated.ts
// Пуска се с: npm run maps:build
import { Delaunay } from 'd3-delaunay';
import polygonClipping from 'polygon-clipping';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const W = 1000;
const H = 640;

function outline(cx, cy, rx, ry, waves, steps = 160) {
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    let r = 1;
    for (const [amp, freq, phase] of waves) r += amp * Math.sin(freq * a + phase);
    pts.push([round(cx + Math.cos(a) * rx * r), round(cy + Math.sin(a) * ry * r)]);
  }
  pts.push(pts[0]);
  return pts;
}

function round(n) {
  return Math.round(n * 10) / 10;
}

function area(ring) {
  let s = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    s += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return s / 2;
}

function centroid(ring) {
  let x = 0;
  let y = 0;
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const f = ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    x += (ring[i][0] + ring[i + 1][0]) * f;
    y += (ring[i][1] + ring[i + 1][1]) * f;
    a += f;
  }
  a /= 2;
  return [round(x / (6 * a)), round(y / (6 * a))];
}

function ringToPath(ring) {
  return 'M' + ring.slice(0, -1).map(([x, y]) => `${x},${y}`).join('L') + 'Z';
}

/** MultiPolygon (с дупки или няколко части) или един пръстен */
function isMulti(shape) {
  return Array.isArray(shape[0][0][0]);
}

function sharesEdge(a, b) {
  // два полигона са съседи, ако имат поне 2 общи (почти) върха
  let shared = 0;
  for (const p of a) {
    for (const q of b) {
      if (Math.abs(p[0] - q[0]) < 0.6 && Math.abs(p[1] - q[1]) < 0.6) {
        shared++;
        break;
      }
    }
    if (shared >= 2) return true;
  }
  return false;
}

function build({ id, name, shape, regions, lands, capitalCounts }) {
  const seeds = regions.map((r) => r.at);
  const delaunay = Delaunay.from(seeds);
  const vor = delaunay.voronoi([0, 0, W, H]);
  const cells = regions.map((r, i) => {
    const cell = vor.cellPolygon(i);
    const clipped = polygonClipping.intersection([cell], isMulti(shape) ? shape : [shape]);
    // взимаме най-голямото парче
    let best = null;
    for (const poly of clipped) {
      const ring = poly[0].map(([x, y]) => [round(x), round(y)]);
      if (!best || Math.abs(area(ring)) > Math.abs(area(best))) best = ring;
    }
    if (!best) throw new Error(`Region ${r.id} is outside the shape`);
    return best;
  });

  const neighbors = regions.map((_, i) => {
    const out = [];
    for (const j of delaunay.neighbors(i)) {
      if (sharesEdge(cells[i], cells[j])) out.push(regions[j].id);
    }
    return out.sort();
  });

  // проверка за свързаност
  const seen = new Set([regions[0].id]);
  const queue = [0];
  while (queue.length) {
    const i = queue.shift();
    for (const nid of neighbors[i]) {
      const j = regions.findIndex((r) => r.id === nid);
      if (!seen.has(nid)) {
        seen.add(nid);
        queue.push(j);
      }
    }
  }
  if (seen.size !== regions.length) throw new Error(`Map ${id} is not connected`);

  // столици: най-отдалечени една от друга (по брой стъпки)
  const dist = (a, b) => {
    const start = regions.findIndex((r) => r.id === a);
    const d = new Map([[a, 0]]);
    const q = [start];
    while (q.length) {
      const i = q.shift();
      for (const nid of neighbors[i]) {
        if (!d.has(nid)) {
          d.set(nid, d.get(regions[i].id) + 1);
          q.push(regions.findIndex((r) => r.id === nid));
        }
      }
    }
    return d.get(b);
  };
  const capitals = {};
  for (const k of capitalCounts) {
    let bestSet = null;
    let bestScore = -1;
    // пълно изброяване за малки k е твърде много — алчен подход от всяка начална точка
    for (const startRegion of regions) {
      const set = [startRegion.id];
      while (set.length < k) {
        let pick = null;
        let pickScore = -1;
        for (const r of regions) {
          if (set.includes(r.id)) continue;
          const s = Math.min(...set.map((c) => dist(c, r.id)));
          if (s > pickScore) {
            pickScore = s;
            pick = r.id;
          }
        }
        set.push(pick);
      }
      let minD = Infinity;
      for (let a = 0; a < set.length; a++)
        for (let b = a + 1; b < set.length; b++) minD = Math.min(minD, dist(set[a], set[b]));
      if (minD > bestScore) {
        bestScore = minD;
        bestSet = set;
      }
    }
    capitals[k] = bestSet;
  }

  return {
    id,
    name,
    width: W,
    height: H,
    outline: isMulti(shape) ? shape.map((poly) => poly.map(ringToPath).join('')).join('') : ringToPath(shape),
    lands,
    regions: regions.map((r, i) => ({
      id: r.id,
      name: r.name,
      ...(r.sub ? { sub: r.sub } : {}),
      land: r.land,
      path: ringToPath(cells[i]),
      center: centroid(cells[i]),
      neighbors: neighbors[i],
    })),
    capitals,
  };
}

// ── Голяма карта: 20 области, 5 земи ──
const large = build({
  id: 'continent',
  name: 'Континентът на Словото',
  shape: outline(500, 320, 455, 280, [
    [0.07, 3, 0.4],
    [0.05, 5, 1.3],
    [0.035, 9, 2.1],
    [0.02, 13, 0.7],
  ]),
  lands: [
    { id: 'zora', name: 'Земя на Зората', color: '#58cc02' },
    { id: 'ravnina', name: 'Равнината на Делника', color: '#1cb0f6' },
    { id: 'vrahove', name: 'Върховете на Бляна', color: '#ce82ff' },
    { id: 'dolina', name: 'Долината на Огнищата', color: '#ff9600' },
    { id: 'zaliv', name: 'Заливът на Новото', color: '#ff4b4b' },
  ],
  regions: [
    { id: 'L1', name: 'Будилник', land: 'zora', at: [140, 210] },
    { id: 'L2', name: 'Читалище', land: 'zora', at: [250, 150] },
    { id: 'L3', name: 'Пергамент', land: 'zora', at: [130, 340] },
    { id: 'L4', name: 'Зорница', land: 'zora', at: [250, 280] },
    { id: 'L5', name: 'Чаршия', land: 'ravnina', at: [370, 110] },
    { id: 'L6', name: 'Нива', land: 'ravnina', at: [480, 90] },
    { id: 'L7', name: 'Хан', land: 'ravnina', at: [380, 220] },
    { id: 'L8', name: 'Хоро', land: 'ravnina', at: [500, 200] },
    { id: 'L9', name: 'Кула', land: 'vrahove', at: [610, 110] },
    { id: 'L10', name: 'Звездица', land: 'vrahove', at: [730, 130] },
    { id: 'L11', name: 'Сянка', land: 'vrahove', at: [620, 230] },
    { id: 'L12', name: 'Блян', land: 'vrahove', at: [770, 250] },
    { id: 'L13', name: 'Воденица', land: 'dolina', at: [230, 430] },
    { id: 'L14', name: 'Кладенец', land: 'dolina', at: [360, 350] },
    { id: 'L15', name: 'Огнище', land: 'dolina', at: [360, 490] },
    { id: 'L16', name: 'Мост', land: 'dolina', at: [490, 400] },
    { id: 'L17', name: 'Пристан', land: 'zaliv', at: [620, 360] },
    { id: 'L18', name: 'Фар', land: 'zaliv', at: [870, 330] },
    { id: 'L19', name: 'Екран', land: 'zaliv', at: [620, 500] },
    { id: 'L20', name: 'Вълна', land: 'zaliv', at: [760, 440] },
  ],
  capitalCounts: [2, 3, 4],
});

// ── Малка карта (1 на 1): 12 области, 3 земи ──
const small = build({
  id: 'island',
  name: 'Островът на Перото',
  shape: outline(500, 320, 400, 250, [
    [0.06, 2, 0.9],
    [0.05, 5, 0.2],
    [0.03, 8, 1.7],
    [0.02, 11, 2.5],
  ]),
  lands: [
    { id: 'nos', name: 'Северният нос', color: '#1cb0f6' },
    { id: 'sreda', name: 'Средната земя', color: '#58cc02' },
    { id: 'yug', name: 'Южният залив', color: '#ff9600' },
  ],
  regions: [
    { id: 'S1', name: 'Перо', land: 'nos', at: [200, 200] },
    { id: 'S2', name: 'Мастило', land: 'nos', at: [330, 140] },
    { id: 'S3', name: 'Свитък', land: 'nos', at: [190, 340] },
    { id: 'S4', name: 'Буквар', land: 'nos', at: [330, 270] },
    { id: 'S5', name: 'Слово', land: 'sreda', at: [470, 150] },
    { id: 'S6', name: 'Стих', land: 'sreda', at: [610, 160] },
    { id: 'S7', name: 'Рима', land: 'sreda', at: [460, 300] },
    { id: 'S8', name: 'Строфа', land: 'sreda', at: [610, 290] },
    { id: 'S9', name: 'Сричка', land: 'yug', at: [330, 430] },
    { id: 'S10', name: 'Глагол', land: 'yug', at: [490, 450] },
    { id: 'S11', name: 'Пристанче', land: 'yug', at: [760, 260] },
    { id: 'S12', name: 'Фарче', land: 'yug', at: [680, 420] },
  ],
  capitalCounts: [2],
});

// ── Езерото и Реката (допълнителни карти, избират се на случаен принцип) ──
const ell = (cx, cy, rx, ry, waves = [[0.05, 3, 0.5], [0.03, 7, 1.2]], steps = 120) => outline(cx, cy, rx, ry, waves, steps);
const rect = (x1, y1, x2, y2, w) => {
  // тясна ивица (мост) между две точки
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), nx = (-dy / L) * w / 2, ny = (dx / L) * w / 2;
  const r = [[x1 + nx, y1 + ny], [x2 + nx, y2 + ny], [x2 - nx, y2 - ny], [x1 - nx, y1 - ny]].map(([x, y]) => [round(x), round(y)]);
  r.push(r[0]);
  return r;
};
const union = (...polys) => polygonClipping.union(...polys.map((p) => [p]));
const ring = (n, cx, cy, rx, ry, offset = 0) => Array.from({ length: n }, (_, i) => { const a = offset + (i / n) * Math.PI * 2; return [round(cx + Math.cos(a) * rx), round(cy + Math.sin(a) * ry)]; });

// ── A: Езерото ──
function lake(big) {
  const outer = ell(500, 320, 450, 285, [[0.05, 4, 0.3], [0.03, 9, 1.1]], 160);
  const inner = ell(500, 320, big ? 200 : 185, big ? 120 : 110, [[0.08, 3, 0.9], [0.04, 7, 2]], 100);
  const shape = polygonClipping.difference([outer], [inner]);
  const names = big
    ? ['Бряг', 'Тръстика', 'Лодка', 'Мрежа', 'Кей', 'Рибар', 'Чайка', 'Вълнолом', 'Пясък', 'Мида', 'Котва', 'Залез', 'Изгрев', 'Остров', 'Фенер', 'Платно', 'Весло', 'Шамандура', 'Ехо', 'Мъгла']
    : ['Бряг', 'Тръстика', 'Лодка', 'Кей', 'Рибар', 'Чайка', 'Пясък', 'Мида', 'Котва', 'Фенер', 'Весло', 'Мъгла'];
  const pts = big ? [...ring(12, 500, 320, 395, 248, 0.26), ...ring(8, 500, 320, 290, 180, 0.6)] : ring(12, 500, 320, 330, 205, 0.26);
  const nLands = big ? 4 : 3;
  const lands = [
    { id: 'sever', name: 'Северният бряг', color: '#1cb0f6' },
    { id: 'iztok', name: 'Източният бряг', color: '#58cc02' },
    { id: 'yug', name: 'Южният бряг', color: '#ff9600' },
    { id: 'zapad', name: 'Западният бряг', color: '#ce82ff' },
  ].slice(0, nLands);
  const landOf = ([x, y]) => {
    const a = (Math.atan2(y - 320, x - 500) + Math.PI * 2 + Math.PI / 2) % (Math.PI * 2);
    return lands[Math.floor((a / (Math.PI * 2)) * nLands)].id;
  };
  return build({ id: big ? 'lake' : 'lake-s', name: 'Езерото', shape, lands, regions: pts.map((at, i) => ({ id: `${big ? 'E' : 'e'}${i + 1}`, name: names[i], land: landOf(at), at })), capitalCounts: big ? [2, 3, 4] : [2] });
}

// ── C: Реката ──
function river(big) {
  const land = ell(500, 320, 455, 285, [[0.06, 3, 1.4], [0.04, 5, 0.3], [0.02, 11, 1]], 160);
  const ry = (x) => 320 + Math.sin(x / 150) * 60;
  const half = 20;
  // гладка река: горен и долен бряг като една фигура
  const top = [], bot = [];
  for (let x = -20; x <= 1020; x += 10) {
    top.push([x, round(ry(x) - half)]);
    bot.push([x, round(ry(x) + half)]);
  }
  const water = [...top, ...bot.reverse()];
  water.push(water[0]);
  const bridgesAt = big ? [250, 500, 750] : [330, 670];
  const bridges = bridgesAt.map((x) => { const y = ry(x); const r = [[x - 18, y - 40], [x + 18, y - 40], [x + 18, y + 40], [x - 18, y + 40]].map(([a, b]) => [round(a), round(b)]); r.push(r[0]); return [r]; });
  const riverWithGaps = polygonClipping.difference([water], ...bridges);
  const shape = polygonClipping.difference([land], riverWithGaps);
  const lands = big
    ? [
        { id: 'nw', name: 'Северозапад', color: '#1cb0f6' },
        { id: 'ne', name: 'Североизток', color: '#ce82ff' },
        { id: 'sw', name: 'Югозапад', color: '#58cc02' },
        { id: 'se', name: 'Югоизток', color: '#ff9600' },
      ]
    : [
        { id: 'n', name: 'Северният бряг', color: '#1cb0f6' },
        { id: 'm', name: 'Средната долина', color: '#58cc02' },
        { id: 's', name: 'Южният бряг', color: '#ff9600' },
      ];
  // „Литературна България“ — родните места на писателите от програмата (и места от творбите им)
  const places = [
    ['Калофер', 'Ботев'], ['Сопот', 'Вазов'], ['Свищов', 'Алеко'], ['Чирпан', 'Яворов'], ['Байлово', 'Елин Пелин'], ['Жеравна', 'Йовков'],
    ['Копривщица', 'Дебелянов'], ['Кукуш', 'Смирненски'], ['Банско', 'Вапцаров'], ['Прилеп', 'Талев'], ['Трявна', 'П. Славейков'], ['Солун', 'Далчев'],
    ['Бургас', 'Дубарова'], ['Калиманица', 'Радичков'], ['Търново', 'Ем. Станев'], ['Батошево', 'Б. Христов'], ['Шипка', 'Вазов'], ['Сливница', 'Вазов'], ['Карлово', 'Левски'], ['Рила', 'Вазов'],
  ];
  const names = places.map((p) => p[0]);
  const regions = [];
  const add = (x, d, landId) => regions.push({ id: `${big ? 'R' : 'r'}${regions.length + 1}`, name: names[regions.length], sub: places[regions.length][1], land: landId, at: [x, round(ry(x) + d)] });
  if (big) {
    for (const [x, d] of [[150, -110], [290, -95], [420, -100], [200, -215], [360, -205]]) add(x, d, 'nw');
    for (const [x, d] of [[580, -100], [710, -95], [850, -100], [640, -205], [800, -200]]) add(x, d, 'ne');
    for (const [x, d] of [[150, 100], [290, 95], [420, 100], [200, 200], [360, 205]]) add(x, d, 'sw');
    for (const [x, d] of [[580, 100], [710, 95], [850, 100], [640, 200], [800, 195]]) add(x, d, 'se');
  } else {
    for (const [x, d] of [[180, -110], [400, -120], [620, -120], [830, -100]]) add(x, d, 'n');
    for (const [x, d] of [[180, 110], [400, 120], [620, 120], [830, 100]]) add(x, d, 's');
    for (const [x, d] of [[290, -230], [710, -220], [290, 220], [710, 210]]) add(x, d, d < 0 ? 'n' : 's');
  }
  return build({ id: big ? 'river' : 'river-s', name: 'Реката', shape, lands: big ? lands : lands.filter((l) => l.id !== 'm'), regions, capitalCounts: big ? [2, 3, 4] : [2] });
}

const lakeSmall = lake(false);
const lakeLarge = lake(true);
const riverSmall = river(false);
const riverLarge = river(true);

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '..', 'packages', 'shared', 'src', 'maps.generated.ts');
writeFileSync(
  out,
  `// АВТОМАТИЧНО ГЕНЕРИРАН ФАЙЛ — не редактирай ръчно. Виж scripts/build-maps.mjs\n` +
    `import type { GameMap } from './maps';\n\n` +
    `export const CONTINENT_MAP: GameMap = ${JSON.stringify(large, null, 2)};\n\n` +
    `export const ISLAND_MAP: GameMap = ${JSON.stringify(small, null, 2)};\n\n` +
    `export const LAKE_SMALL_MAP: GameMap = ${JSON.stringify(lakeSmall, null, 2)};\n\n` +
    `export const LAKE_MAP: GameMap = ${JSON.stringify(lakeLarge, null, 2)};\n\n` +
    `export const RIVER_SMALL_MAP: GameMap = ${JSON.stringify(riverSmall, null, 2)};\n\n` +
    `export const RIVER_MAP: GameMap = ${JSON.stringify(riverLarge, null, 2)};\n`,
);
for (const m of [large, small, lakeSmall, lakeLarge, riverSmall, riverLarge]) {
  console.log(m.id, m.regions.length, 'regions; capitals', JSON.stringify(m.capitals));
  for (const r of m.regions) console.log(' ', r.id, r.name, '->', r.neighbors.join(','));
}
