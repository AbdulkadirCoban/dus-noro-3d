// Z-Anatomy / BodyParts3D kaynaklarından sıkıştırılmış GLB katmanları üretir.
// Girdi: .model-src/ (depoya eklenmez, README'de nasıl üretildiği yazılı)
// Çıktı: public/models/*.glb ve data/geo_index.json
import fs from 'node:fs';
import path from 'node:path';
import { Document, NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier, MeshoptDecoder } from 'meshoptimizer';
import { GEO } from './content/geo.mjs';

await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
await MeshoptDecoder.ready;

const SRC = '.model-src';
const OUT = 'public/models';
const BP_OFFSET = [0, 90, 71.5];
const CENTER = [0, -5, 1590];

// Z-Anatomy mm -> sahne: X = sağ-sol, Y = yukarı, Z = öne doğru
const toScene = ([x, y, z]) => [x - CENTER[0], z - CENTER[2], -(y - CENTER[1])];

const zaIndex = JSON.parse(fs.readFileSync(`${SRC}/za/mesh/index.json`, 'utf8'));
const splines = JSON.parse(fs.readFileSync(`${SRC}/za/splines.json`, 'utf8'));

function loadZa(name) {
  const e = zaIndex[name];
  if (!e) throw new Error(`Z-Anatomy mesh yok: ${name}`);
  const pb = fs.readFileSync(`${SRC}/za/mesh/${e.file}.pos`);
  const ib = fs.readFileSync(`${SRC}/za/mesh/${e.file}.idx`);
  const pos = new Float32Array(pb.buffer.slice(pb.byteOffset, pb.byteOffset + pb.length));
  const idx = new Uint32Array(ib.buffer.slice(ib.byteOffset, ib.byteOffset + ib.length));
  return { pos, idx };
}

function loadBp(id) {
  const txt = fs.readFileSync(`${SRC}/bp3d/${id}.obj`, 'latin1');
  const pos = [];
  const idx = [];
  for (const line of txt.split(/\r?\n/)) {
    if (line.startsWith('v ')) {
      const p = line.split(/\s+/);
      pos.push(+p[1] + BP_OFFSET[0], +p[2] + BP_OFFSET[1], +p[3] + BP_OFFSET[2]);
    } else if (line.startsWith('f ')) {
      const f = line.trim().split(/\s+/).slice(1).map((s) => parseInt(s, 10) - 1);
      for (let i = 1; i < f.length - 1; i++) idx.push(f[0], f[i], f[i + 1]);
    }
  }
  return { pos: new Float32Array(pos), idx: new Uint32Array(idx) };
}

const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
const nearestIndex = (pts, p) => {
  let best = 0;
  let bd = Infinity;
  pts.forEach((q, i) => {
    const d = dist2(q, p);
    if (d < bd) { bd = d; best = i; }
  });
  return best;
};

function curvePoints(s) {
  const all = splines[s.name];
  if (!all) throw new Error(`Eğri yok: ${s.name}`);
  if (!all[s.spline]) throw new Error(`Dal yok: ${s.name}[${s.spline}]`);
  let pts = all[s.spline];
  if (s.from) pts = pts.slice(nearestIndex(pts, s.from));
  if (s.to) pts = pts.slice(0, nearestIndex(pts, s.to) + 1);
  if (s.minZ != null) {
    const k = pts.findIndex((p) => p[2] < s.minZ);
    if (k > 0) pts = pts.slice(0, k);
    else if (k === 0) return [];
  }
  return pts;
}

// Yolu Catmull-Rom ile yumuşatıp eşit aralıkla örnekler (elle çizilmiş az noktalı yollar için gerekli)
function resample(pts, step = 1.5) {
  const clean = pts.filter((p, i) => i === 0 || dist2(p, pts[i - 1]) > 1e-4);
  if (clean.length < 2) return clean;
  const dense = [];
  for (let i = 0; i < clean.length - 1; i++) {
    const p0 = clean[Math.max(0, i - 1)];
    const p1 = clean[i];
    const p2 = clean[i + 1];
    const p3 = clean[Math.min(clean.length - 1, i + 2)];
    const n = 6;
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const t2 = t * t;
      const t3 = t2 * t;
      dense.push([0, 1, 2].map((a) => 0.5 * (2 * p1[a] + (p2[a] - p0[a]) * t + (2 * p0[a] - 5 * p1[a] + 4 * p2[a] - p3[a]) * t2 + (3 * p1[a] - p0[a] - 3 * p2[a] + p3[a]) * t3)));
    }
  }
  dense.push(clean[clean.length - 1]);
  const out = [dense[0]];
  let acc = 0;
  for (let i = 1; i < dense.length; i++) {
    acc += Math.sqrt(dist2(dense[i], dense[i - 1]));
    if (acc >= step) { out.push(dense[i]); acc = 0; }
  }
  if (out[out.length - 1] !== dense[dense.length - 1]) out.push(dense[dense.length - 1]);
  return out;
}

// Yol etrafında tüp mesh'i (paralel taşıma çerçevesi ile burulmasız)
function sweep(pts, radius, sides = 8) {
  const P = resample(pts, Math.max(1, radius * 1.6));
  if (P.length < 2) return null;
  const pos = [];
  const idx = [];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const l = Math.hypot(...a) || 1; return a.map((v) => v / l); };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  let t = norm(sub(P[1], P[0]));
  let n = norm(Math.abs(t[2]) < 0.9 ? cross(t, [0, 0, 1]) : cross(t, [1, 0, 0]));
  for (let i = 0; i < P.length; i++) {
    const nt = norm(sub(P[Math.min(i + 1, P.length - 1)], P[Math.max(i - 1, 0)]));
    n = norm(sub(n, nt.map((v) => v * dot(n, nt))));
    t = nt;
    const b = cross(t, n);
    for (let s = 0; s < sides; s++) {
      const a = (s / sides) * Math.PI * 2;
      const c = Math.cos(a) * radius;
      const d = Math.sin(a) * radius;
      pos.push(P[i][0] + n[0] * c + b[0] * d, P[i][1] + n[1] * c + b[1] * d, P[i][2] + n[2] * c + b[2] * d);
    }
  }
  for (let i = 0; i < P.length - 1; i++) {
    for (let s = 0; s < sides; s++) {
      const a = i * sides + s;
      const b = i * sides + (s + 1) % sides;
      const c = a + sides;
      const d = b + sides;
      idx.push(a, b, c, b, d, c);
    }
  }
  // Uç kapakları
  for (const [ring, flip] of [[0, true], [P.length - 1, false]]) {
    const center = pos.length / 3;
    pos.push(...P[ring]);
    for (let s = 0; s < sides; s++) {
      const a = ring * sides + s;
      const b = ring * sides + (s + 1) % sides;
      if (flip) idx.push(center, b, a); else idx.push(center, a, b);
    }
  }
  return { pos: new Float32Array(pos), idx: new Uint32Array(idx) };
}

function simplifyMesh(m, ratio) {
  if (ratio >= 1) return m;
  const target = Math.floor((m.idx.length * ratio) / 3) * 3;
  const [ni] = MeshoptSimplifier.simplify(m.idx, m.pos, 3, target, 0.02, []);
  // Kullanılmayan köşeleri at
  const map = new Map();
  const pos = [];
  const idx = new Uint32Array(ni.length);
  ni.forEach((v, i) => {
    if (!map.has(v)) {
      map.set(v, map.size);
      pos.push(m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]);
    }
    idx[i] = map.get(v);
  });
  return { pos: new Float32Array(pos), idx };
}

function merge(parts) {
  const nv = parts.reduce((a, p) => a + p.pos.length, 0);
  const ni = parts.reduce((a, p) => a + p.idx.length, 0);
  const pos = new Float32Array(nv);
  const idx = new Uint32Array(ni);
  let vo = 0;
  let io = 0;
  for (const p of parts) {
    pos.set(p.pos, vo);
    for (let i = 0; i < p.idx.length; i++) idx[io + i] = p.idx[i] + vo / 3;
    vo += p.pos.length;
    io += p.idx.length;
  }
  return { pos, idx };
}

function toSceneMesh(m, mirror) {
  const pos = new Float32Array(m.pos.length);
  for (let i = 0; i < m.pos.length; i += 3) {
    const x = mirror ? -m.pos[i] : m.pos[i];
    const [sx, sy, sz] = toScene([x, m.pos[i + 1], m.pos[i + 2]]);
    pos[i] = sx; pos[i + 1] = sy; pos[i + 2] = sz;
  }
  let idx = m.idx;
  if (mirror) {
    idx = new Uint32Array(m.idx);
    for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  }
  return { pos, idx };
}

function normals(m) {
  const n = new Float32Array(m.pos.length);
  for (let i = 0; i < m.idx.length; i += 3) {
    const [a, b, c] = [m.idx[i] * 3, m.idx[i + 1] * 3, m.idx[i + 2] * 3];
    const e1 = [m.pos[b] - m.pos[a], m.pos[b + 1] - m.pos[a + 1], m.pos[b + 2] - m.pos[a + 2]];
    const e2 = [m.pos[c] - m.pos[a], m.pos[c + 1] - m.pos[a + 1], m.pos[c + 2] - m.pos[a + 2]];
    const f = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    for (const v of [a, b, c]) { n[v] += f[0]; n[v + 1] += f[1]; n[v + 2] += f[2]; }
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
    n[i] /= l; n[i + 1] /= l; n[i + 2] /= l;
  }
  return n;
}

function sphereOf(pos) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) {
    for (let a = 0; a < 3; a++) {
      min[a] = Math.min(min[a], pos[i + a]);
      max[a] = Math.max(max[a], pos[i + a]);
    }
  }
  const c = min.map((v, a) => (v + max[a]) / 2);
  let r = 0;
  for (let i = 0; i < pos.length; i += 3) r = Math.max(r, Math.hypot(pos[i] - c[0], pos[i + 1] - c[1], pos[i + 2] - c[2]));
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i < pos.length; i += 3) {
    const d = (pos[i] - c[0]) ** 2 + (pos[i + 1] - c[1]) ** 2 + (pos[i + 2] - c[2]) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return { c: c.map((v) => +v.toFixed(2)), r: +r.toFixed(2), a: [pos[best], pos[best + 1], pos[best + 2]].map((v) => +v.toFixed(2)) };
}

// Yukarı bakan (üst çene) dişin çatallanan kökünü çatallanmanın hemen altından kesip tek konik kök örer
function singleRoot(m) {
  const weld = new Map();
  const ids = new Uint32Array(m.pos.length / 3);
  for (let i = 0; i < ids.length; i++) {
    const key = `${m.pos[3 * i].toFixed(3)},${m.pos[3 * i + 1].toFixed(3)},${m.pos[3 * i + 2].toFixed(3)}`;
    if (!weld.has(key)) weld.set(key, i);
    ids[i] = weld.get(key);
  }
  const z = (i) => m.pos[3 * i + 2];
  const sections = (h) => {
    const parent = new Map();
    const find = (a) => {
      while (parent.get(a) !== a) a = parent.get(a);
      return a;
    };
    for (let t = 0; t < m.idx.length; t += 3) {
      const tri = [m.idx[t], m.idx[t + 1], m.idx[t + 2]];
      const zs = tri.map(z);
      if (Math.min(...zs) > h || Math.max(...zs) < h) continue;
      const [a, b, c] = tri.map((i) => ids[i]);
      for (const k of [a, b, c]) if (!parent.has(k)) parent.set(k, k);
      parent.set(find(a), find(b));
      parent.set(find(b), find(c));
    }
    return new Set([...parent.keys()].map(find)).size;
  };
  let zMin = Infinity;
  let zMax = -Infinity;
  for (let i = 0; i < ids.length; i++) {
    zMin = Math.min(zMin, z(i));
    zMax = Math.max(zMax, z(i));
  }
  let fork = null;
  for (let h = (zMin + zMax) / 2; h < zMax && fork === null; h += 0.25) if (sections(h) >= 2) fork = h;
  if (fork === null) throw new Error('singleRoot: çatallanma bulunamadı');
  const cut = fork - 1.5;

  const idx = [];
  const net = new Map();
  for (let t = 0; t < m.idx.length; t += 3) {
    const tri = [m.idx[t], m.idx[t + 1], m.idx[t + 2]];
    if (Math.max(...tri.map(z)) > cut) continue;
    idx.push(...tri);
    const w = tri.map((i) => ids[i]);
    for (let e = 0; e < 3; e++) {
      const [u, v] = [w[e], w[(e + 1) % 3]];
      if (net.has(`${v},${u}`)) net.delete(`${v},${u}`);
      else net.set(`${u},${v}`, [u, v]);
    }
  }
  const next = new Map([...net.values()]);
  if (next.size !== net.size) throw new Error('singleRoot: kesit sınırı basit değil');
  const start = next.keys().next().value;
  const loop = [start];
  for (let u = next.get(start); u !== start; u = next.get(u)) loop.push(u);
  if (loop.length !== next.size) throw new Error('singleRoot: kesitte birden çok sınır var');

  const mean = (list) => {
    const c = [0, 0, 0];
    for (const i of list) for (let a = 0; a < 3; a++) c[a] += m.pos[3 * i + a] / list.length;
    return c;
  };
  const c0 = mean(loop);
  // Kök ucu: iki eski apeksin ortası, kök boyu korunur
  const tips = [];
  for (let i = 0; i < ids.length; i++) if (z(i) > fork + (zMax - fork) * 0.8) tips.push(i);
  const tip = mean(tips);
  const pos = [...m.pos];
  const RINGS = 14;
  // Kesim sınırı dişli olduğundan kesit yukarı çıktıkça yumuşatılmış çevreye geçer; yoksa kökte çizgiler kalır
  const SMOOTH = 6;
  const raw = loop.map((b) => [m.pos[3 * b] - c0[0], m.pos[3 * b + 1] - c0[1]]);
  const smooth = raw.map((_, i) => {
    const o = [0, 0];
    for (let d = -SMOOTH; d <= SMOOTH; d++) {
      const r = raw[(i + d + raw.length) % raw.length];
      o[0] += r[0] / (2 * SMOOTH + 1);
      o[1] += r[1] / (2 * SMOOTH + 1);
    }
    return o;
  });
  const rings = [loop];
  for (let k = 1; k <= RINGS; k++) {
    // Halkalar uca doğru sıklaşır; kök incelir ve yuvarlak biter
    const t = 1 - (1 - k / (RINGS + 1)) ** 1.6;
    const s = (1 - 0.55 * t) * Math.sqrt(1 - t ** 4);
    const b = Math.min(1, t * 4);
    const ring = [];
    loop.forEach((v, i) => {
      ring.push(pos.length / 3);
      pos.push(
        c0[0] + (tip[0] - c0[0]) * t + (raw[i][0] + (smooth[i][0] - raw[i][0]) * b) * s,
        c0[1] + (tip[1] - c0[1]) * t + (raw[i][1] + (smooth[i][1] - raw[i][1]) * b) * s,
        z(v) + (zMax - z(v)) * t,
      );
    });
    rings.push(ring);
  }
  const apex = pos.length / 3;
  pos.push(tip[0], tip[1], zMax);
  // Sınır kenarı u→v ise komşu yüz v→u kenarını kullanır: sarım kopmaz
  for (let r = 0; r < RINGS; r++) {
    for (let i = 0; i < loop.length; i++) {
      const j = (i + 1) % loop.length;
      const [u, v, u1, v1] = [rings[r][i], rings[r][j], rings[r + 1][i], rings[r + 1][j]];
      idx.push(v, u, u1, v, u1, v1);
    }
  }
  const last = rings[RINGS];
  for (let i = 0; i < loop.length; i++) idx.push(last[(i + 1) % loop.length], last[i], apex);
  return compact(pos, idx);
}

function compact(pos, idx) {
  const map = new Map();
  const out = [];
  const ni = idx.map((v) => {
    if (!map.has(v)) {
      map.set(v, map.size);
      out.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]);
    }
    return map.get(v);
  });
  return { pos: new Float32Array(out), idx: new Uint32Array(ni) };
}

function buildSource(g) {
  const meshes = [];
  for (const s of g.src) {
    if (s.kind === 'za') {
      meshes.push(simplifyMesh(loadZa(s.name), s.ratio));
    } else if (s.kind === 'bp') {
      meshes.push(simplifyMesh(loadBp(s.id), s.ratio ?? 1));
    } else {
      const pts = s.kind === 'cv' ? curvePoints(s) : s.pts;
      if (pts.length >= 2) {
        const t = sweep(pts, g.radius ?? 0.6);
        if (t) meshes.push(t);
      }
    }
  }
  return g.singleRoot ? singleRoot(merge(meshes)) : merge(meshes);
}

const files = { bones: [], arteries: [], veins: [], nerves: [], context: [], teeth: [], muscles: [], attachments: [] };
const index = { center: CENTER, items: {}, files: {} };

for (const [id, g] of Object.entries(GEO)) {
  if (g.marker) {
    const left = [-g.marker[0], g.marker[1], g.marker[2]];
    const sides = [];
    if (g.side === 'mid') sides.push({ tag: 'M', c: toScene(g.marker) });
    else {
      sides.push({ tag: 'R', c: toScene(g.marker) });
      sides.push({ tag: 'L', c: toScene(left) });
    }
    index.items[id] = { marker: true, r: g.r, scale: g.scale, ganglion: !!g.ganglion, vein: !!g.veinMarker, movesWithMandible: !!g.movesWithMandible, sides };
    continue;
  }
  const m = buildSource(g);
  const entry = { file: g.file, sides: [], schematic: !!g.schematic, needle: !!g.needle, movesWithMandible: !!g.movesWithMandible };
  const add = (tag, mesh) => {
    const sm = toSceneMesh(mesh, tag === 'L');
    const name = `${id}#${tag}`;
    files[g.file].push({ name, mesh: sm });
    entry.sides.push({ tag, node: name, ...sphereOf(sm.pos) });
  };
  if (g.side === 'mid') add('M', m);
  else if (g.side === 'R') add('R', m);
  else if (g.side === 'L') add('L', m);
  else { add('R', m); add('L', m); }
  for (const ex of g.extra ?? []) {
    const t = sweep(ex.pts, g.radius ?? 0.6);
    const sm = toSceneMesh(t, false);
    const name = `${id}#${ex.side}`;
    files[g.file].push({ name, mesh: sm });
    entry.sides.push({ tag: ex.side, node: name, ...sphereOf(sm.pos) });
  }
  index.items[id] = entry;
}

fs.mkdirSync(OUT, { recursive: true });
const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({
  'meshopt.encoder': MeshoptEncoder,
  'meshopt.decoder': MeshoptDecoder,
});

let total = 0;
for (const [file, nodes] of Object.entries(files)) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene(file);
  let tris = 0;
  for (const { name, mesh } of nodes) {
    tris += mesh.idx.length / 3;
    const prim = doc.createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(mesh.pos).setBuffer(buffer))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(normals(mesh)).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(mesh.idx).setBuffer(buffer));
    const node = doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim));
    scene.addChild(node);
  }
  doc.getRoot().getAsset().copyright = 'Z-Anatomy (CC BY-SA 4.0) / BodyParts3D, DBCLS';
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'high' }));
  const dest = path.join(OUT, `${file}.glb`);
  await io.write(dest, doc);
  const size = fs.statSync(dest).size;
  total += size;
  index.files[file] = { size, tris };
  console.log(`${file}.glb  ${(size / 1048576).toFixed(2)} MB  ${tris} üçgen  ${nodes.length} düğüm`);
}
console.log(`TOPLAM ${(total / 1048576).toFixed(2)} MB`);
fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/geo_index.json', JSON.stringify(index));
