// Mandibula hareketi: TME ölçümü, iki fazlı kinematik, kas gerdirme ve panel
import * as THREE from 'three';
import { bakeMesh } from './scene.js';

// Kas-hareket eşleşmesi. region: yalnız bu lif grubu parlak; sides: hasta tarafı (R sağ, L sol), yoksa iki taraf.
const SUPRA = [{ id: 'm_digastric' }, { id: 'm_mylohyoid' }, { id: 'm_geniohyoid' }];
export const MOTIONS = {
  dep: {
    name: 'Açma', full: 'Ağız açma (depresyon)', rest: 0, view: 'side',
    muscles: [{ id: 'm_latpt', note: 'alt baş', region: 'lower' }, ...SUPRA],
  },
  ele: {
    name: 'Kapama', full: 'Ağız kapama (elevasyon)', rest: 1, view: 'side',
    muscles: [{ id: 'm_masseter' }, { id: 'm_temporalis' }, { id: 'm_medpt' }],
  },
  pro: {
    name: 'Protrüzyon', full: 'Protrüzyon', rest: 0, view: 'side',
    muscles: [{ id: 'm_latpt' }, { id: 'm_medpt' }, { id: 'm_masseter', note: 'yüzeyel', region: 'superficial' }],
  },
  ret: {
    name: 'Retrüzyon', full: 'Retrüzyon', rest: 0.8, view: 'side',
    muscles: [{ id: 'm_temporalis', note: 'arka lifler', region: 'posterior' }],
  },
  latR: {
    name: 'Sağa lateral', full: 'Sağa lateral hareket', rest: 0, view: 'front', working: 'R',
    muscles: [{ id: 'm_latpt', note: 'sol', sides: ['L'] }, { id: 'm_medpt', note: 'sol', sides: ['L'] }, { id: 'm_temporalis', note: 'sağ, arka lifler', sides: ['R'], region: 'posterior' }],
  },
  latL: {
    name: 'Sola lateral', full: 'Sola lateral hareket', rest: 0, view: 'front', working: 'L',
    muscles: [{ id: 'm_latpt', note: 'sağ', sides: ['R'] }, { id: 'm_medpt', note: 'sağ', sides: ['R'] }, { id: 'm_temporalis', note: 'sol, arka lifler', sides: ['L'], region: 'posterior' }],
  },
};

const DISC_RATIO = 0.55; // disk translasyonda kondilden az gider
const DISC_DROP = 0.22; // eminentiaya dinlenmedekinden fazla girmesin (mm/mm)
const OPEN_ROT_MM = 23; // rotasyon fazı sonunda insizal açıklık
const OPEN_MAX_MM = 46;
const PHASE = 0.5; // rotasyon fazının hareket içindeki payı
const PROTRUDE_MM = 8; // kondil öne
const PROTRUDE_PITCH = 0.018; // kesici kenarlar birbirini geçsin diye küçük açılma (rad)
const LATERAL_MM = 7.5; // dengeleyen kondil öne; daha ötesinde koronoid maksilla tüberine girer
const LATERAL_PITCH = 0.045;
const BENNETT_MM = 1.5; // çalışan kondil dışa
const RETRUDE_MM = 1.2;
const RETRUDE_PITCH = 0.012;
const PLAY_MS = 4200;
const HOLD_MS = 700;
const BLEND_MS = 450;

const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const smooth = (lo, hi, x) => {
  const k = Math.min(1, Math.max(0, (x - lo) / (hi - lo)));
  return k * k * (3 - 2 * k);
};

// ---------- TME ölçümü: yalnız köşe dizileri kullanılır, sahneden bağımsızdır ----------
function measureCondyle(pos, sign) {
  let top = null;
  for (let i = 0; i < pos.length; i += 3) {
    if (pos[i] * sign <= 0) continue;
    if (!top || pos[i + 1] > top[1]) top = [pos[i], pos[i + 1], pos[i + 2]];
  }
  // Kondil başı: en üst köşenin çevresi; koronoid öndedir ve bu küreye girmez
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) {
    if (pos[i] * sign <= 0 || pos[i + 1] < top[1] - 9) continue;
    if (Math.hypot(pos[i] - top[0], pos[i + 1] - top[1], pos[i + 2] - top[2]) > 16) continue;
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], pos[i + k]);
      max[k] = Math.max(max[k], pos[i + k]);
    }
  }
  const rz = (max[2] - min[2]) / 2;
  const c = [(min[0] + max[0]) / 2, top[1] - rz, (min[2] + max[2]) / 2];
  return { c, top, rz, rx: (max[0] - min[0]) / 2, min, max };
}

function boxCenter(pos) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], pos[i + k]);
      max[k] = Math.max(max[k], pos[i + k]);
    }
  }
  return { c: [0, 1, 2].map((k) => (min[k] + max[k]) / 2), min, max };
}

// Temporal kemiğin sagittal kesitlerinden kondil üstündeki alt yüzey: fossa ve eminentia profili
function measureProfile(temporal, cond) {
  const { pos, idx } = temporal;
  const pts = [];
  const zLo = cond.c[2] - cond.rz;
  const yLo = cond.c[1] - 4;
  for (const dx of [-4, 0, 4]) {
    const x0 = cond.c[0] + dx;
    for (let t = 0; t < idx.length; t += 3) {
      const tri = [idx[t], idx[t + 1], idx[t + 2]];
      for (let k = 0; k < 3; k++) {
        const p = tri[k];
        const q = tri[(k + 1) % 3];
        const dp = pos[3 * p] - x0;
        const dq = pos[3 * q] - x0;
        if ((dp < 0) === (dq < 0)) continue;
        const u = dp / (dp - dq);
        const y = pos[3 * p + 1] + (pos[3 * q + 1] - pos[3 * p + 1]) * u;
        const z = pos[3 * p + 2] + (pos[3 * q + 2] - pos[3 * p + 2]) * u;
        if (z >= zLo && z < cond.c[2] + 34 && y >= yLo && y < cond.top[1] + 14) pts.push([z, y]);
      }
    }
  }
  return pts;
}

// Yuvarlanan top: yarıçapı R olan küre profile değene kadar yükselir. Sonuç eklem yüzeyine paralel bir yoldur.
function ballPath(pts, R, z0) {
  const samples = [];
  for (let z = z0 - 2; z <= z0 + 24; z += 0.5) {
    let y = Infinity;
    for (const [pz, py] of pts) {
      const d = Math.abs(pz - z);
      if (d <= R) y = Math.min(y, py - Math.sqrt(R * R - d * d));
    }
    samples.push({ z, y });
  }
  const filled = samples.map((s, i) => {
    if (Number.isFinite(s.y)) return s;
    const near = samples.slice(Math.max(0, i - 6), i + 7).filter((o) => Number.isFinite(o.y));
    return { z: s.z, y: near.length ? Math.min(...near.map((o) => o.y)) : 0 };
  });
  const out = filled.map((s, i) => {
    const near = filled.slice(Math.max(0, i - 3), i + 4);
    return { z: s.z, y: near.reduce((a, o) => a + o.y, 0) / near.length };
  });
  const at = (z) => {
    const f = Math.max(0, Math.min(out.length - 1.001, (z - out[0].z) / 0.5));
    const i = Math.floor(f);
    return out[i].y + (out[i + 1].y - out[i].y) * (f - i);
  };
  const rest = at(z0);
  // Eminentia tepesinden sonra yol yeniden yükselmez: kondil tepenin önünde yüzeyden ayrılmaz, geri çıkmaz
  let low = Infinity;
  const floor = out.map((s) => {
    if (s.z >= z0) low = Math.min(low, s.y);
    return s.z >= z0 ? low : s.y;
  });
  const clamped = (z) => {
    const f = Math.max(0, Math.min(floor.length - 1.001, (z - out[0].z) / 0.5));
    const i = Math.floor(f);
    return floor[i] + (floor[i + 1] - floor[i]) * (f - i);
  };
  return (dz) => (dz > 0 ? clamped(z0 + dz) : at(z0 + dz)) - rest;
}

function extreme(pos, k, sign) {
  let best = null;
  for (let i = 0; i < pos.length; i += 3) {
    if (!best || pos[i + k] * sign > best[k] * sign) best = [pos[i], pos[i + 1], pos[i + 2]];
  }
  return best;
}

// input: { mandible, temporal:{R,L}, disc:{R,L}, teeth:{t_41,t_31,t_11,t_21} } (dünya koordinatı)
export function measureJoint(input) {
  const out = { sides: {} };
  for (const [tag, sign] of [['R', -1], ['L', 1]]) {
    const cond = measureCondyle(input.mandible.pos, sign);
    const pts = measureProfile(input.temporal[tag], cond);
    const disc = boxCenter(input.disc[tag].pos);
    const discR = (disc.max[2] - disc.min[2]) / 2;
    // Eminentia tepesi: kondil önünde profilin en alt noktası
    const front = pts.filter(([z]) => z > cond.c[2]);
    const yCrest = Math.min(...front.map((p) => p[1]));
    const crest = front.filter((p) => p[1] < yCrest + 0.6);
    const zCrest = crest.reduce((a, p) => a + p[0], 0) / crest.length;
    const roof = pts.filter(([z]) => Math.abs(z - cond.c[2]) < 2.5).map((p) => p[1]);
    out.sides[tag] = {
      condyle: cond,
      disc,
      eminence: { z: zCrest, y: yCrest },
      fossaRoofY: Math.min(...roof),
      path: ballPath(pts, cond.rz, cond.c[2]),
      discPath: ballPath(pts, discR, disc.c[2]),
    };
  }
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  out.incisalLower = mid(extreme(input.teeth.t_41, 1, 1), extreme(input.teeth.t_31, 1, 1));
  out.incisalUpper = mid(extreme(input.teeth.t_11, 1, -1), extreme(input.teeth.t_21, 1, -1));
  out.pogonion = extreme(input.mandible.pos, 2, 1);
  const r = out.sides.R.condyle.c;
  const l = out.sides.L.condyle.c;
  out.center = mid(r, l);
  out.intercondylar = Math.hypot(...sub3(l, r));
  return out;
}

// ---------- Kinematik ----------
const zero = () => ({ R: [0, 0, 0], L: [0, 0, 0], th: 0 });
const X_AXIS = new THREE.Vector3(1, 0, 0);
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _a = new THREE.Vector3();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);

// Duruş: iki kondilin yer değiştirmesi ve kondil ekseni çevresinde açılma
export function jawMatrix(pose, joint, out = new THREE.Matrix4()) {
  const r = joint.sides.R.condyle.c;
  const l = joint.sides.L.condyle.c;
  _a.set(l[0] + pose.L[0] - r[0] - pose.R[0], l[1] + pose.L[1] - r[1] - pose.R[1], l[2] + pose.L[2] - r[2] - pose.R[2]).normalize();
  _q.setFromUnitVectors(X_AXIS, _a).multiply(_q2.setFromAxisAngle(X_AXIS, pose.th));
  const c = joint.center;
  _v.set(-c[0], -c[1], -c[2]).applyQuaternion(_q);
  out.compose(_v, _q, _s);
  const e = out.elements;
  e[12] += c[0] + (pose.R[0] + pose.L[0]) / 2;
  e[13] += c[1] + (pose.R[1] + pose.L[1]) / 2;
  e[14] += c[2] + (pose.R[2] + pose.L[2]) / 2;
  return out;
}

// Disk rotasyon fazında durur; yalnız kondilin translasyonunun bir kısmı kadar ve eklem yüzeyini izleyerek gider
export function discMatrix(pose, joint, tag, out = new THREE.Matrix4()) {
  const s = joint.sides[tag];
  const d = pose[tag];
  const dz = d[2] * DISC_RATIO;
  const dy = dz > 0 ? s.discPath(dz) - DISC_DROP * dz : d[1] * DISC_RATIO;
  const dx = d[0] * DISC_RATIO;
  // Eklem yüzeyinin eğimini yarı oranda izler
  const tilt = dz > 0 ? 0.5 * Math.atan2(-s.discPath(dz), Math.max(dz, 0.5)) * Math.min(1, dz / 2) : 0;
  _q.setFromAxisAngle(X_AXIS, tilt);
  const c = s.disc.c;
  _v.set(-c[0], -c[1], -c[2]).applyQuaternion(_q);
  out.compose(_v, _q, _s);
  const e = out.elements;
  e[12] += c[0] + dx;
  e[13] += c[1] + dy;
  e[14] += c[2] + dz;
  return out;
}

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
export function incisalOpening(pose, joint) {
  jawMatrix(pose, joint, _m);
  _p.set(...joint.incisalLower).applyMatrix4(_m);
  return Math.hypot(_p.x - joint.incisalUpper[0], _p.y - joint.incisalUpper[1], _p.z - joint.incisalUpper[2]);
}

// Açılma açıları varsayılmaz: hedef insizal açıklıklara ikiye bölme ile çözülür
function solveTheta(target, make, joint) {
  let lo = 0;
  let hi = 0.9;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (incisalOpening(make(m), joint) < target) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}

export function buildKinematics(joint) {
  const { R, L } = joint.sides;
  // En geniş açılışta kondil eminentia tepesinin hemen önüne ulaşır
  const trans = Math.min(R.eminence.z - R.condyle.c[2], L.eminence.z - L.condyle.c[2]) + 3;
  const atFwd = (dz) => ({ R: [0, R.path(dz), dz], L: [0, L.path(dz), dz] });
  const thRot = solveTheta(OPEN_ROT_MM, (th) => ({ ...zero(), th }), joint);
  const thMax = solveTheta(OPEN_MAX_MM, (th) => ({ ...atFwd(trans), th }), joint);
  const open = (t) => {
    if (t <= PHASE) return { ...zero(), th: thRot * (t / PHASE) };
    const u = (t - PHASE) / (1 - PHASE);
    return { ...atFwd(trans * u), th: thRot + (thMax - thRot) * u };
  };
  const protrude = (u) => ({ ...atFwd(PROTRUDE_MM * u), th: PROTRUDE_PITCH * u });
  const retruded = (u) => ({ R: [0, 0, -RETRUDE_MM * u], L: [0, 0, -RETRUDE_MM * u], th: RETRUDE_PITCH * u });
  const lateral = (work) => (t) => {
    const bal = work === 'R' ? 'L' : 'R';
    const sw = work === 'R' ? -1 : 1;
    const dz = LATERAL_MM * t;
    const dy = joint.sides[bal].path(dz);
    const w = joint.sides[work].condyle.c;
    const b = joint.sides[bal].condyle.c;
    const shift = sw * BENNETT_MM * t;
    // Dengeleyen kondilin içe gidişi kondiller arası uzaklığı koruyan rijit koşuldan çıkar
    const dyz = Math.hypot(b[1] + dy - w[1], b[2] + dz - w[2]);
    const xb = w[0] + shift - sw * Math.sqrt(joint.intercondylar ** 2 - dyz ** 2);
    return { [work]: [shift, 0, 0], [bal]: [xb - b[0], dy, dz], th: LATERAL_PITCH * t };
  };
  return {
    translation: trans,
    thetaRotation: thRot,
    thetaMax: thMax,
    poses: {
      dep: open,
      ele: (t) => open(1 - t),
      pro: protrude,
      ret: (t) => {
        const rest = MOTIONS.ret.rest;
        return t <= rest ? protrude(1 - t / rest) : retruded((t - rest) / (1 - rest));
      },
      latR: lateral('R'),
      latL: lateral('L'),
    },
  };
}

const lerpPose = (a, b, k) => {
  const mix = (p, q) => [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k, p[2] + (q[2] - p[2]) * k];
  return { R: mix(a.R, b.R), L: mix(a.L, b.L), th: a.th + (b.th - a.th) * k };
};
const isZero = (p) => [...p.R, ...p.L, p.th].every((v) => Math.abs(v) < 1e-9);

// ---------- Yumuşak doku bağları: w=0 köşe yerinde kalır, w=1 köşe mandibulayla gider ----------
// Yapışma: kaynak iki nokta kümesine uzaklık oranı. Rampa: bir eksen boyunca geçiş.
const attach = (ins, fix) => ({ kind: 'attach', ins, fix });
const rampY = (lo, hi) => ({ kind: 'ramp', axis: 1, lo, hi }); // lo/hi: yapının kendi sınırına göre [0,1] konumu
const SOFT = {
  m_masseter: attach('ai_masseter', 'ao_masseter'),
  m_temporalis: attach('ai_temporalis', 'ao_temporalis'),
  m_medpt: attach('ai_medpt', 'ao_medpt'),
  m_latpt: { kind: 'condyle', fix: 'ao_latpt' },
  m_digastric: { kind: 'ramp', axis: 2, abs: [34, 56] },
  m_mylohyoid: attach('ao_mylohyoid', 'b_hyoid'),
  m_geniohyoid: attach('ao_geniohyoid', 'ai_geniohyoid'),
  m_genioglossus: { kind: 'ramp', axis: 2, lo: 0.35, hi: 0.9 },
  m_tongue: { kind: 'ramp', axis: 2, lo: 0.3, hi: 0.95 },
  m_mentalis: { kind: 'all' },
  m_dli: rampY(1, 0.45),
  m_dao: rampY(1, 0.35),
  m_orbicularis: rampY(0.62, 0.4),
  j_capsule: rampY(1, 0.45),
  j_latlig: rampY(1, 0.3),
  j_smlig: rampY(1, 0.15),
  j_stlig: rampY(0.9, 0.1),
  // Kanala giren sinir ve arter: kemik dışındaki üst ucu yerinde kalır, foramenden aşağısı rijit gider
  n_ian: { kind: 'foramen' },
  n_mylohyoid: { kind: 'foramen' },
  a_ial: { kind: 'foramen' },
  n_lingual: rampY(1, 0.25),
};

function nearest2(p, list) {
  let best = Infinity;
  for (let i = 0; i < list.length; i += 3) {
    const dx = list[i] - p[0];
    const dy = list[i + 1] - p[1];
    const dz = list[i + 2] - p[2];
    const d = dx * dx + dy * dy + dz * dz;
    if (d < best) best = d;
  }
  return best;
}

function components(mesh, world) {
  const n = world.length / 3;
  const parent = Int32Array.from({ length: n }, (_, i) => i);
  const find = (a) => {
    while (parent[a] !== a) {
      parent[a] = parent[parent[a]];
      a = parent[a];
    }
    return a;
  };
  const weld = new Map();
  for (let i = 0; i < n; i++) {
    const key = `${Math.round(world[3 * i] * 16)},${Math.round(world[3 * i + 1] * 16)},${Math.round(world[3 * i + 2] * 16)}`;
    if (weld.has(key)) parent[find(i)] = find(weld.get(key));
    else weld.set(key, i);
  }
  const ix = mesh.geometry.index.array;
  for (let t = 0; t < ix.length; t += 3) {
    parent[find(ix[t])] = find(ix[t + 1]);
    parent[find(ix[t])] = find(ix[t + 2]);
  }
  const groups = new Map();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, { list: [], y: 0, zMax: -Infinity });
    const g = groups.get(r);
    g.list.push(i);
    g.y += world[3 * i + 1];
    g.zMax = Math.max(g.zMax, world[3 * i + 2]);
  }
  return [...groups.values()].map((g) => ({ ...g, y: g.y / g.list.length }));
}

// ---------- Panel ve sahne bağlantısı ----------
export function createMotion({ scene, stage, button, panel, chips, tools, clipPanel, section, byId, index, onSelectMuscle, setLayerChip }) {
  const records = scene.records;
  let joint = null;
  let kin = null;
  let installed = false;
  const rigid = []; // { mesh, base, kind:'jaw'|'discR'|'discL' }
  const soft = []; // { mesh, world, rest, w, inv, attr }
  const tinted = new Map(); // mesh -> { color attribute, regions }
  let key = 'dep';
  let t = 0;
  let pose = zero();
  let playing = false;
  let raf = 0;
  let blend = null;
  let hold = 0;
  let last = 0;
  let isOpen = false;
  const jaw = new THREE.Matrix4();
  const discs = { R: new THREE.Matrix4(), L: new THREE.Matrix4() };
  const stats = { poseUpdates: 0, installMs: 0 };

  const meshOf = (id, side) => records.get(id).meshes.find((m) => !side || m.userData.side === side);
  const geomOf = (mesh) => {
    mesh.updateWorldMatrix(true, false);
    return { pos: bakeMesh(mesh), idx: mesh.geometry.index?.array };
  };

  function install() {
    if (installed) return;
    const t0 = performance.now();
    installed = true;
    joint = measureJoint({
      mandible: geomOf(meshOf('b_mandible')),
      temporal: { R: geomOf(meshOf('b_temporal', 'R')), L: geomOf(meshOf('b_temporal', 'L')) },
      disc: { R: geomOf(meshOf('j_disc', 'R')), L: geomOf(meshOf('j_disc', 'L')) },
      teeth: Object.fromEntries(['t_41', 't_31', 't_11', 't_21'].map((id) => [id, geomOf(meshOf(id)).pos])),
    });
    kin = buildKinematics(joint);
    const foramen = index.items.f_mandibular.sides[0].c[1];
    for (const [id, rec] of records) {
      const mobile = !!index.items[id]?.movesWithMandible;
      const spec = SOFT[id];
      if (spec) {
        for (const mesh of rec.meshes) soft.push(makeSoft(mesh, id, spec, foramen));
      } else if (mobile) {
        for (const mesh of rec.meshes) {
          mesh.updateMatrix();
          mesh.updateWorldMatrix(true, false);
          mesh.matrixAutoUpdate = false;
          mesh.userData.restWorld = mesh.matrixWorld.clone();
          rigid.push({ mesh, base: mesh.matrix.clone(), kind: id === 'j_disc' ? `disc${mesh.userData.side}` : 'jaw' });
        }
      }
    }
    for (const id of ['m_masseter', 'm_temporalis', 'm_medpt', 'm_latpt', 'm_digastric', 'm_mylohyoid', 'm_geniohyoid', 'j_disc']) {
      for (const mesh of records.get(id).meshes) makeTint(mesh);
    }
    scene.setAnchorPose((id, tag, p) => {
      if (id === 'j_disc') p.applyMatrix4(discs[tag] ?? discs.R);
      else if (index.items[id]?.movesWithMandible) p.applyMatrix4(jaw);
    });
    scene.capsChanged();
    buildArrows();
    stats.installMs = +(performance.now() - t0).toFixed(1);
  }

  function makeSoft(mesh, id, spec, foramen) {
    mesh.updateWorldMatrix(true, false);
    const pos = bakeMesh(mesh);
    const n = pos.length / 3;
    const w = new Float32Array(n);
    const side = mesh.userData.side;
    const bbox = boxCenter(pos);
    const cloud = (src) => {
      const list = records.get(src).meshes.filter((m) => m.userData.side === side || side === 'M' || m.userData.side === 'M');
      return list.flatMap((m) => Array.from(geomOf(m).pos));
    };
    if (spec.kind === 'all') {
      w.fill(1);
    } else if (spec.kind === 'attach') {
      const ins = cloud(spec.ins);
      const fix = cloud(spec.fix);
      for (let i = 0; i < n; i++) {
        const p = [pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]];
        const di = Math.sqrt(nearest2(p, ins));
        const df = Math.sqrt(nearest2(p, fix));
        w[i] = smooth(0.18, 0.82, df / (di + df + 1e-6));
      }
    } else if (spec.kind === 'condyle') {
      // Lateral pterygoid: origo içte ve önde, insersiyo kondil boynunda. Fibrillerin doğrultusunda geçiş.
      const cond = joint.sides[side].condyle.c;
      const neck = [cond[0], cond[1] - 3, cond[2] + 2];
      const sign = side === 'R' ? 1 : -1;
      const start = [sign > 0 ? bbox.max[0] : bbox.min[0], bbox.c[1], bbox.max[2]];
      const axis = sub3(neck, start);
      const len2 = axis[0] ** 2 + axis[1] ** 2 + axis[2] ** 2;
      for (let i = 0; i < n; i++) {
        const u = ((pos[3 * i] - start[0]) * axis[0] + (pos[3 * i + 1] - start[1]) * axis[1] + (pos[3 * i + 2] - start[2]) * axis[2]) / len2;
        w[i] = smooth(0.15, 0.95, u);
      }
    } else if (spec.kind === 'foramen') {
      for (let i = 0; i < n; i++) w[i] = smooth(bbox.max[1], foramen - 1, pos[3 * i + 1]);
    } else {
      const a = spec.axis;
      const [lo, hi] = spec.abs ?? [bbox.min[a] + (bbox.max[a] - bbox.min[a]) * spec.lo, bbox.min[a] + (bbox.max[a] - bbox.min[a]) * spec.hi];
      for (let i = 0; i < n; i++) w[i] = smooth(lo, hi, pos[3 * i + a]);
    }
    // Kuantize edilmiş ortak tampon yazılamaz: yerel uzayda ayrı Float32 konum dizisi
    const g = mesh.geometry;
    const src = g.attributes.position;
    const local = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      local[3 * i] = src.getX(i);
      local[3 * i + 1] = src.getY(i);
      local[3 * i + 2] = src.getZ(i);
    }
    const attr = new THREE.BufferAttribute(local.slice(), 3).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', attr);
    mesh.userData.soft = true;
    mesh.userData.softVer = 0;
    return { mesh, world: pos, rest: local, w, inv: mesh.matrixWorld.clone().invert(), attr, bounds: { box: g.boundingBox?.clone(), sphere: g.boundingSphere?.clone() }, moved: false };
  }

  function makeTint(mesh) {
    const pos = bakeMesh(mesh);
    const n = pos.length / 3;
    const color = new THREE.BufferAttribute(new Float32Array(n * 4).fill(1), 4);
    mesh.geometry.setAttribute('color', color);
    const id = mesh.userData.id;
    const regions = {};
    if (id === 'm_latpt' || id === 'm_masseter') {
      const comps = components(mesh, pos);
      // Kaynak modelde iki baş ayrı parçadır: alt baş daha aşağıda, yüzeyel masseter daha öne uzanır
      const pick = id === 'm_latpt' ? comps.reduce((a, b) => (b.y < a.y ? b : a)) : comps.reduce((a, b) => (b.zMax > a.zMax ? b : a));
      const mask = new Float32Array(n);
      for (const i of pick.list) mask[i] = 1;
      regions[id === 'm_latpt' ? 'lower' : 'superficial'] = mask;
    }
    if (id === 'm_temporalis') {
      // Arka lifler: yelpazenin kulak üstü ve arkasından gelen bölümü (z ekseninde)
      const box = boxCenter(pos);
      const mid = box.min[2] + (box.max[2] - box.min[2]) * 0.46;
      regions.posterior = Float32Array.from({ length: n }, (_, i) => 1 - smooth(mid - 4, mid + 6, pos[3 * i + 2]));
    }
    tinted.set(mesh, { color, regions });
  }

  function applyTint() {
    const on = new Map();
    for (const m of MOTIONS[key].muscles) on.set(m.id, m);
    for (const [mesh, { color, regions }] of tinted) {
      const mask = regions[on.get(mesh.userData.id)?.region];
      const arr = color.array;
      for (let i = 0; i < color.count; i++) arr[4 * i + 3] = mask ? 0.14 + 0.86 * mask[i] : 1;
      color.needsUpdate = true;
    }
  }

  function workingMap() {
    const map = new Map();
    for (const m of MOTIONS[key].muscles) map.set(m.id, m.sides ? new Set(m.sides) : null);
    map.set('j_disc', null);
    return map;
  }

  // ---------- Duruşun sahneye uygulanması ----------
  function applyPose() {
    if (!installed) return;
    stats.poseUpdates++;
    const rest = isZero(pose);
    jawMatrix(pose, joint, jaw);
    discMatrix(pose, joint, 'R', discs.R);
    discMatrix(pose, joint, 'L', discs.L);
    if (rest) {
      jaw.identity();
      discs.R.identity();
      discs.L.identity();
    }
    for (const r of rigid) {
      const m = r.kind === 'jaw' ? jaw : discs[r.kind.slice(4)];
      if (rest) r.mesh.matrix.copy(r.base);
      else r.mesh.matrix.multiplyMatrices(m, r.base);
      r.mesh.matrixWorld.copy(r.mesh.matrix);
      r.mesh.matrixWorldNeedsUpdate = false;
    }
    const e = jaw.elements;
    for (const s of soft) {
      if (rest && !s.moved) continue;
      const a = s.attr.array;
      if (rest) {
        a.set(s.rest);
        s.moved = false;
        const g = s.mesh.geometry;
        if (s.bounds.box) g.boundingBox.copy(s.bounds.box);
        if (s.bounds.sphere) g.boundingSphere.copy(s.bounds.sphere);
      } else {
        const f = s.inv.elements;
        const p = s.world;
        for (let i = 0, n = s.w.length; i < n; i++) {
          const w = s.w[i];
          const x = p[3 * i];
          const y = p[3 * i + 1];
          const z = p[3 * i + 2];
          const qx = x + w * (e[0] * x + e[4] * y + e[8] * z + e[12] - x);
          const qy = y + w * (e[1] * x + e[5] * y + e[9] * z + e[13] - y);
          const qz = z + w * (e[2] * x + e[6] * y + e[10] * z + e[14] - z);
          a[3 * i] = f[0] * qx + f[4] * qy + f[8] * qz + f[12];
          a[3 * i + 1] = f[1] * qx + f[5] * qy + f[9] * qz + f[13];
          a[3 * i + 2] = f[2] * qx + f[6] * qy + f[10] * qz + f[14];
        }
        s.moved = true;
        const g = s.mesh.geometry;
        g.computeBoundingBox();
        g.computeBoundingSphere();
      }
      s.attr.needsUpdate = true;
      s.mesh.userData.softVer++;
    }
    updateArrows();
    updateReadout();
    scene.invalidate();
    section.refresh();
  }

  // ---------- Yön okları: çenede hareket, kondillerde translasyon ----------
  let arrows = null;
  function makeArrow(scale, color) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, depthTest: false, depthWrite: false });
    const g = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.9 * scale, 0.9 * scale, 16 * scale, 12), mat);
    shaft.position.y = 8 * scale;
    const head = new THREE.Mesh(new THREE.ConeGeometry(2.8 * scale, 7 * scale, 16), mat);
    head.position.y = 19.5 * scale;
    for (const m of [shaft, head]) {
      m.renderOrder = 30;
      g.add(m);
    }
    g.visible = false;
    scene.root.add(g);
    return g;
  }
  function buildArrows() {
    arrows = { chin: makeArrow(1, 0x6cc4e8), R: makeArrow(0.55, 0xffd166), L: makeArrow(0.55, 0xffd166) };
  }
  const UP = new THREE.Vector3(0, 1, 0);
  const _dir = new THREE.Vector3();
  const _a2 = new THREE.Vector3();
  const _b2 = new THREE.Vector3();
  const _m2 = new THREE.Matrix4();
  const poseAt = (x) => kin.poses[key](Math.max(0, Math.min(1, x)));
  function updateArrows() {
    if (!arrows) return;
    if (!isOpen) {
      arrows.chin.visible = arrows.R.visible = arrows.L.visible = false;
      return;
    }
    // Yön: seçili hareketin şu andaki teğeti, dolayısıyla faz değişince ok da döner
    // Geriye bakan fark: rotasyon fazının sonunda kondil oku erken görünmez
    const hi = t > 0 ? t : 0.04;
    const lo = Math.max(0, hi - 0.04);
    const pa = poseAt(lo);
    const pb = poseAt(hi);
    jawMatrix(pa, joint, _m2);
    _a2.set(...joint.pogonion).applyMatrix4(_m2);
    jawMatrix(pb, joint, _m2);
    _b2.set(...joint.pogonion).applyMatrix4(_m2);
    _dir.subVectors(_b2, _a2);
    const chin = arrows.chin;
    chin.visible = _dir.lengthSq() > 1e-8;
    if (chin.visible) {
      _dir.normalize();
      _p.set(...joint.pogonion).applyMatrix4(jaw);
      chin.position.copy(_p).addScaledVector(_dir, 5);
      chin.quaternion.setFromUnitVectors(UP, _dir);
    }
    for (const tag of ['R', 'L']) {
      const a = arrows[tag];
      const c = joint.sides[tag].condyle.c;
      _dir.set(pb[tag][0] - pa[tag][0], pb[tag][1] - pa[tag][1], pb[tag][2] - pa[tag][2]);
      a.visible = _dir.lengthSq() > 1e-4;
      if (!a.visible) continue;
      _dir.normalize();
      a.position.set(c[0] + pose[tag][0], c[1] + pose[tag][1], c[2] + pose[tag][2]).addScaledVector(_dir, 7);
      a.quaternion.setFromUnitVectors(UP, _dir);
    }
  }

  // ---------- Panel ----------
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  panel.innerHTML = `
    <div class="motion-grid" role="group" aria-label="Hareket seçimi">
      ${Object.entries(MOTIONS).map(([k, m]) => `<button class="tool" data-motion="${k}" aria-pressed="false" aria-label="${esc(m.full)}">${esc(m.name)}</button>`).join('')}
      <button class="tool" id="motion-close" aria-label="Çene hareketi panelini kapat">✕</button>
    </div>
    <div class="motion-row">
      <button class="tool" id="motion-play" aria-pressed="false">▶ Oynat</button>
      <label><span id="motion-pct">%0</span><input type="range" id="motion-range" min="0" max="100" step="1" value="0" aria-label="Hareket yüzdesi" /></label>
      <button class="tool" id="motion-reset">Sıfırla</button>
    </div>
    <p id="motion-read" aria-live="off"></p>
    <div class="motion-muscles" role="group" aria-label="Çalışan kaslar"></div>
    <p id="motion-note">Kaslar basit gerdirmeyle izler: kısalma ve şişme modellenmez.</p>`;
  const range = panel.querySelector('#motion-range');
  const pct = panel.querySelector('#motion-pct');
  const playBtn = panel.querySelector('#motion-play');
  const readEl = panel.querySelector('#motion-read');
  const listEl = panel.querySelector('.motion-muscles');

  function metrics() {
    if (!joint) return null;
    const open = incisalOpening(pose, joint);
    _p.set(...joint.incisalLower).applyMatrix4(jaw);
    const lat = _p.x - joint.incisalLower[0];
    const fwd = _p.z - joint.incisalLower[2];
    const c = { R: pose.R, L: pose.L };
    _a2.set(...joint.sides.R.disc.c).applyMatrix4(discs.R);
    _b2.set(...joint.sides.L.disc.c).applyMatrix4(discs.L);
    return {
      opening: open,
      lateral: lat,
      forward: fwd,
      condyle: c,
      disc: { R: _a2.toArray().map((v, i) => v - joint.sides.R.disc.c[i]), L: _b2.toArray().map((v, i) => v - joint.sides.L.disc.c[i]) },
      theta: THREE.MathUtils.radToDeg(pose.th),
    };
  }

  function updateReadout() {
    if (!isOpen || !joint) return;
    const m = metrics();
    const f = (v) => Math.abs(v).toFixed(1);
    const parts = [];
    const lat = MOTIONS[key].working;
    if (lat) {
      const bal = lat === 'R' ? 'L' : 'R';
      const b = m.condyle[bal];
      parts.push(`Çene ucu yana ${f(m.lateral)} mm`);
      parts.push(`Çalışan (${lat === 'R' ? 'sağ' : 'sol'}) kondil döner, dışa ${f(m.condyle[lat][0])} mm`);
      parts.push(`Dengeleyen (${bal === 'R' ? 'sağ' : 'sol'}) kondil öne ${f(b[2])}, içe ${f(b[0])}, aşağı ${f(b[1])} mm`);
    } else {
      const c = m.condyle.R;
      const moving = Math.abs(c[2]) > 0.01;
      parts.push(`İnsizal açıklık ${m.opening.toFixed(1)} mm`);
      parts.push(`Açı ${m.theta.toFixed(1)}°`);
      parts.push(moving ? `Kondil ${c[2] < 0 ? 'geri' : 'öne'} ${f(c[2])}, ${c[1] > 0 ? 'yukarı' : 'aşağı'} ${f(c[1])} mm` : 'Kondil yerinde döner');
      parts.push(`Disk ${f(m.disc.R[2])} mm`);
    }
    readEl.textContent = parts.join(' · ');
  }

  function syncUi() {
    panel.querySelectorAll('[data-motion]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.motion === key)));
    range.value = Math.round(t * 100);
    pct.textContent = `%${Math.round(t * 100)}`;
    playBtn.textContent = playing ? '⏸ Durdur' : '▶ Oynat';
    playBtn.setAttribute('aria-pressed', String(playing));
  }

  function renderMuscles() {
    listEl.innerHTML = MOTIONS[key].muscles.map((m) => `<button class="chip lay-muscle on" data-goto="${m.id}"><i class="dot"></i>${esc(byId.get(m.id).name)}${m.note ? ` <small>${esc(m.note)}</small>` : ''}</button>`).join('');
  }

  function layout() {
    if (!isOpen) return;
    const top = chips.offsetTop + chips.offsetHeight + 8;
    panel.style.maxHeight = `${Math.max(120, tools.offsetTop - 8 - top)}px`;
  }

  // Kamera: görünür alan üstteki çiplerle alttaki panel arasıdır; çene bu alanın ortasına yerleşir
  const VIEW_DIR = { side: [-1, 0.04, 0.1], front: [0.02, -0.12, 1] };
  let viewSize = [0, 0];
  function frameView() {
    if (!joint) return;
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    viewSize = [w, h];
    const top = chips.offsetTop + chips.offsetHeight + 4;
    const bottom = (panel.hidden ? tools.offsetTop : panel.offsetTop) - 4;
    const visH = Math.max(120, bottom - top);
    const tan = Math.tan(THREE.MathUtils.degToRad(scene.camera.fov) / 2);
    const R = 88;
    const d = Math.min(800, Math.max((R * h) / (visH * tan), (R * w) / ((w - 16) * tan * (w / h))));
    const dir = new THREE.Vector3(...VIEW_DIR[MOTIONS[key].view]).normalize();
    const c = new THREE.Vector3(0, -48, 28);
    const right = new THREE.Vector3().crossVectors(UP, dir).normalize();
    const up = new THREE.Vector3().crossVectors(dir, right);
    const shift = (((top + bottom) / 2 - h / 2) / (h / 2)) * d * tan;
    const tar = c.addScaledVector(up, shift);
    scene.flyTo(tar.clone().addScaledVector(dir, d).toArray(), tar.toArray());
  }

  // ---------- Oynatma: kare yalnız burada istenir, durunca rAF zinciri tamamen biter ----------
  function schedule() {
    if (!raf && (playing || blend)) raf = requestAnimationFrame(tick);
  }
  function tick(now) {
    raf = 0;
    const dt = Math.min(64, now - last);
    last = now;
    if (blend) {
      const k = Math.min(1, (now - blend.t0) / BLEND_MS);
      const e = k * k * (3 - 2 * k);
      pose = lerpPose(blend.from, blend.to, e);
      if (k >= 1) {
        pose = blend.to;
        const done = blend.done;
        blend = null;
        done?.();
      }
      applyPose();
    } else if (playing) {
      if (hold > 0) {
        hold -= dt;
        if (hold <= 0) startFrom(0);
      } else {
        t = Math.min(1, t + dt / PLAY_MS);
        pose = kin.poses[key](t);
        applyPose();
        if (t >= 1) hold = HOLD_MS;
        syncUi();
      }
    }
    schedule();
  }
  // Başlangıç duruşuna sıçramadan yumuşak geçiş
  function startFrom(x) {
    t = x;
    blend = { t0: performance.now(), from: pose, to: kin.poses[key](x), done: null };
    syncUi();
    schedule();
  }
  function play() {
    if (!isOpen || playing) return;
    playing = true;
    last = performance.now();
    hold = 0;
    const rest = MOTIONS[key].rest;
    if (t >= 1 || (rest > 0 && Math.abs(t - rest) < 1e-6)) startFrom(0);
    syncUi();
    schedule();
  }
  function pause() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    playing = false;
    hold = 0;
    // Geçiş ortasında durdurulursa görünen duruş seçili yüzdeyle eşleşsin
    if (blend) {
      blend = null;
      pose = kin.poses[key](t);
      applyPose();
    }
    syncUi();
  }
  function setT(x) {
    if (!isOpen) return;
    pause();
    t = Math.max(0, Math.min(1, x));
    pose = kin.poses[key](t);
    applyPose();
    syncUi();
  }
  function reset() {
    if (!isOpen) return;
    pause();
    t = MOTIONS[key].rest;
    blend = { t0: performance.now(), from: pose, to: zero(), done: null };
    syncUi();
    last = performance.now();
    schedule();
  }
  function choose(k) {
    pause();
    key = k;
    t = MOTIONS[k].rest;
    if (!isZero(pose)) {
      blend = { t0: performance.now(), from: pose, to: zero(), done: null };
      schedule();
    }
    applyTint();
    scene.setWorking(workingMap());
    renderMuscles();
    syncUi();
    updateArrows();
    updateReadout();
    frameView();
  }

  // Sabit damar ve sinirler çene oynarken yanıltıcıdır: panel açıkken kapanır, çipten yeniden açılabilir
  const QUIET = ['foramen', 'nerve', 'artery', 'vein'];
  let quieted = [];
  function open() {
    if (isOpen || !scene.loaded) return;
    install();
    isOpen = true;
    quieted = QUIET.filter((g) => scene.layerOn[g]);
    quieted.forEach((g) => setLayerChip(g, false));
    panel.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    // Kesit paneliyle aynı alanı kullanır
    clipPanel.hidden = true;
    document.querySelector('#btn-clip')?.setAttribute('aria-expanded', 'false');
    layout();
    section.layout();
    choose(key);
  }
  // Panel kapanır: çene kısa geçişle sıfıra döner. now: quiz gibi anında sıfırlama gereken durumlar.
  function close({ now = false } = {}) {
    if (!installed) {
      isOpen = false;
      panel.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      return;
    }
    pause();
    const wasOpen = isOpen;
    isOpen = false;
    panel.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    scene.setWorking(null);
    if (wasOpen) quieted.forEach((g) => setLayerChip(g, true));
    quieted = [];
    updateArrows();
    section.layout();
    t = 0;
    if (now || isZero(pose)) {
      pose = zero();
      applyPose();
    } else if (wasOpen) {
      blend = { t0: performance.now(), from: pose, to: zero(), done: null };
      last = performance.now();
      schedule();
    }
  }

  // Kesit paneli aynı alanı kullanır: çene oturumu sürerken panel geçici gizlenir, duruş korunur
  function hidePanel() {
    if (isOpen) panel.hidden = true;
  }
  function showPanel() {
    if (!isOpen) return;
    panel.hidden = false;
    layout();
    updateReadout();
    syncUi();
  }
  button.addEventListener('click', () => {
    if (isOpen && panel.hidden) {
      clipPanel.hidden = true;
      document.querySelector('#btn-clip')?.setAttribute('aria-expanded', 'false');
      showPanel();
      section.layout();
    } else if (isOpen) close();
    else open();
  });
  panel.addEventListener('click', (e) => {
    const m = e.target.closest('[data-motion]');
    if (m) {
      choose(m.dataset.motion);
      return;
    }
    const g = e.target.closest('[data-goto]');
    if (g) onSelectMuscle(g.dataset.goto);
  });
  panel.querySelector('#motion-close').addEventListener('click', () => close());
  playBtn.addEventListener('click', () => (playing ? pause() : play()));
  panel.querySelector('#motion-reset').addEventListener('click', reset);
  range.addEventListener('input', () => setT(Number(range.value) / 100));
  new ResizeObserver(() => {
    layout();
    if (isOpen && (Math.abs(stage.clientWidth - viewSize[0]) > 40 || Math.abs(stage.clientHeight - viewSize[1]) > 40)) frameView();
  }).observe(stage);
  new ResizeObserver(layout).observe(chips);

  return {
    open,
    close,
    closeNow: () => close({ now: true }),
    hidePanel,
    showPanel,
    play,
    pause,
    reset,
    setT,
    choose,
    metrics,
    layout,
    stats,
    get joint() { return joint; },
    get kinematics() { return kin; },
    get isOpen() { return isOpen; },
    get playing() { return playing; },
    get busy() { return playing || !!blend; },
    get t() { return t; },
    get key() { return key; },
    get pose() { return pose; },
  };
}
