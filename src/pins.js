// 3B pin testi: diş hekimliği yapı havuzu, kamera seçimi ve model üzerinde duran HTML pinler
import * as THREE from 'three';
import { bakeMesh } from './scene.js';

const BONES = ['b_maxilla', 'b_mandible', 'b_palatine', 'b_zygomatic', 'b_nasal', 'b_lacrimal', 'b_vomer', 'b_sphenoid', 'b_temporal'];
const FORAMINA = ['f_mandibular', 'f_mental', 'f_infraorbital', 'f_incisive', 'f_gpf', 'f_lpf'];
// Pin testi diş hekimliği kafatasıdır: omurga, boyun kemikleri ve gırtlak kıkırdakları gizlenir (alttan bakışı kapatmasın)
const NECK = ['b_atlas', 'b_axis', 'b_hyoid', 'b_c3', 'b_c4', 'b_c5', 'b_c6', 'b_c7', 'b_clavicle', 'b_rib1', 'b_manubrium', 'k_thyroid', 'k_cricoid', 'k_epiglottis', 'k_trachea'];
const SKULL = { groups: ['bone', 'tooth'], hide: NECK };
const FRAME_C = [0, -22, 25];
const FRAME_R = 125;
const MIN_DIST = 260;
const MIN_PINS = 4;
const SPACING = 48; // 44 px dokunma alanları üst üste binmesin
const HEAD = 16; // pin başının çapa noktasından yüksekliği (px)
const SAFE = { x: 34, top: 80, bottom: 72 };

// Fibonacci küresi: tam tepe ve tabandan bakış OrbitControls'ta kararsız olduğu için atlanır
const DIRS = Array.from({ length: 72 }, (_, i) => {
  const y = 1 - (2 * (i + 0.5)) / 72;
  const r = Math.sqrt(1 - y * y);
  return [r * Math.cos(i * 2.399963), y, r * Math.sin(i * 2.399963)];
}).filter((d) => Math.abs(d[1]) < 0.95);

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// Kare dokunma alanları için eksen bazlı uzaklık
const gap = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
// Derindeki kemikler dış yönden görünmez: ilk denenecek kamera yönü (yalnız arama hızı içindir)
const VIEW_HINT = {
  b_palatine: () => [0, -1, 0.25],
  b_vomer: () => [0, -1, 0.25],
  b_sphenoid: () => [Math.random() < 0.5 ? -1 : 1, 0.05, 0.3],
};
const shuffle = (a) => a.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);

// Havuz yalnız diş hekimliği alanındandır; adlar structures.json'dan gelir
export function dentalPool(items, byId, index) {
  const has = (s) => s && index.items[s.id];
  const blockNerves = [...new Set(items.filter((s) => s.layer === 'block').flatMap((s) => s.focus))].map((id) => byId.get(id)).filter((s) => s?.layer === 'nerve');
  const families = {
    bone: BONES.map((id) => byId.get(id)),
    tooth: items.filter((s) => s.cat === 'teeth'),
    foramen: FORAMINA.map((id) => byId.get(id)),
    muscle: items.filter((s) => s.cat === 'mastication'),
    attach: items.filter((s) => s.cat === 'attach' && byId.get(`m_${s.id.slice(3)}`)?.cat === 'mastication'),
    tme: items.filter((s) => s.cat === 'tmj'),
    nerve: blockNerves,
  };
  for (const k of Object.keys(families)) families[k] = families[k].filter(has);
  const familyOf = new Map();
  for (const [k, list] of Object.entries(families)) for (const s of list) familyOf.set(s.id, k);
  return { families, familyOf };
}

export function createPins({ layer, stage, scene, index, items, byId }) {
  const pool = dentalPool(items, byId, index);
  const { families, familyOf } = pool;
  const ids = (list) => list.map((s) => s.id);

  // Kas ve sinir pinleri için ilgili meshler gösterilir; disk kapsülün içinde kaldığı için ayrı görünümdedir
  const TME_OUTER = ids(families.tme).filter((id) => id !== 'j_disc');
  const VIEWS = {
    skull: { ...SKULL },
    muscle: { ...SKULL, ids: ids(families.muscle) },
    tme: { ...SKULL, ids: TME_OUTER },
    disc: { ...SKULL, ids: ['j_disc', ...TME_OUTER.filter((id) => id === 'j_smlig' || id === 'j_stlig')] },
    nerve: { ...SKULL, ids: ids(families.nerve) },
  };
  const viewKey = (id) => {
    const f = familyOf.get(id);
    if (f === 'muscle' || f === 'nerve') return f;
    if (f === 'tme') return id === 'j_disc' ? 'disc' : 'tme';
    return 'skull';
  };
  // Kemik sorusunda başka yapının pini de o kemiğin üzerinde durabileceğinden çeldiriciler kemik ve diştir
  const DISTRACT = {
    bone: ['bone', 'tooth'],
    tooth: ['tooth', 'foramen', 'attach'],
    foramen: ['foramen', 'attach', 'tooth'],
    attach: ['attach', 'foramen', 'tooth'],
    muscle: ['muscle', 'tooth', 'foramen'],
    tme: ['tme', 'tooth', 'foramen'],
    nerve: ['nerve', 'foramen', 'tooth'],
  };

  const hud = document.createElement('div');
  hud.id = 'pin-hud';
  hud.innerHTML = '<span class="good" aria-label="Doğru sayısı">✓ <b id="pin-good">0</b></span><span class="bad" aria-label="Yanlış sayısı">✗ <b id="pin-bad">0</b></span>';
  layer.append(hud);

  const anchorCache = new Map();
  const vertCache = new Map();
  const tmpCam = scene.camera.clone();
  const tmpV = new THREE.Vector3();
  let cur = null;
  let tapCb = null;

  function setCam(cam) {
    tmpCam.aspect = stage.clientWidth / stage.clientHeight;
    tmpCam.fov = scene.camera.fov;
    tmpCam.position.set(...cam.pos);
    tmpCam.lookAt(...cam.tar);
    tmpCam.updateMatrixWorld();
    tmpCam.updateProjectionMatrix();
  }
  // setCam sonrası: sahne pikseline izdüşüm
  function screen(p) {
    tmpV.set(...p).project(tmpCam);
    return { x: (tmpV.x * 0.5 + 0.5) * stage.clientWidth, y: (-tmpV.y * 0.5 + 0.5) * stage.clientHeight };
  }
  const inSafe = (s) => s.x > SAFE.x && s.x < stage.clientWidth - SAFE.x && s.y > SAFE.top && s.y < stage.clientHeight - SAFE.bottom;

  // Genel kamera: yüz ve kafa tabanı sığar. Pinler seçildikten sonra fit() yakınlaştırır
  function camAt(i) {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    const tan = Math.tan(THREE.MathUtils.degToRad(scene.camera.fov) / 2);
    const d = Math.min(620, Math.max((FRAME_R / tan) * (h / Math.max(120, h - SAFE.top - SAFE.bottom)), (FRAME_R / (tan * (w / h))) * (w / Math.max(120, w - 2 * SAFE.x))));
    const dir = DIRS[i];
    return { pos: [FRAME_C[0] + dir[0] * d, FRAME_C[1] + dir[1] * d, FRAME_C[2] + dir[2] * d], tar: FRAME_C, d };
  }

  function verts(id, side) {
    const key = `${id}|${side}`;
    if (!vertCache.has(key)) {
      const out = [];
      for (const m of scene.records.get(id)?.meshes ?? []) {
        if (m.userData.side !== side) continue;
        m.updateWorldMatrix(true, false);
        out.push(bakeMesh(m));
      }
      vertCache.set(key, out);
    }
    return vertCache.get(key);
  }

  // Kemik pini parçanın kenarına düşmesin: çevresindeki ışınlar da aynı kemiğe çarpmalı
  function solid(id, p, cam, right, up) {
    if (byId.get(id).layer !== 'bone') return true;
    for (const [a, b] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) {
      const q = [p[0] + right[0] * a + up[0] * b, p[1] + right[1] * a + up[1] * b, p[2] + right[2] * a + up[2] * b];
      if (scene.firstHitId(q, cam.pos) !== id) return false;
    }
    return true;
  }

  // Önce geo_index çapası (a) denenir. Çapa çoğu yapıda ağırlık merkezine en yakın köşe olduğundan
  // içeride kalabilir; o zaman aynı meshin bu yönden görünen, çapaya en yakın köşesi kullanılır.
  function anchorAt(id, side, i, cam, view) {
    const key = `${view}|${id}|${side}|${i}|${Math.round(cam.d)}`;
    if (anchorCache.has(key)) return anchorCache.get(key);
    const it = index.items[id];
    const s = it.sides.find((x) => x.tag === side);
    const base = s.a ?? s.c;
    // Delik işaretçisi kemik içinde durabilir; kendi yarıçapı kadar gömülü kabul edilir
    const eps = it.marker ? it.r + 1.8 : 1.5;
    const dir = DIRS[i];
    const right = norm(cross([0, 1, 0], dir));
    const up = cross(dir, right);
    let found = null;
    if (scene.pointVisible(base, cam.pos, eps) && solid(id, base, cam, right, up)) found = { point: base, eps, onAnchor: true };
    else if (!it.marker) {
      const list = [];
      let top = -Infinity;
      for (const arr of verts(id, side)) {
        const stride = Math.max(1, Math.ceil(arr.length / 3 / 800)) * 3;
        for (let k = 0; k < arr.length; k += stride) {
          const p = [arr[k], arr[k + 1], arr[k + 2]];
          const along = dot(p, dir);
          top = Math.max(top, along);
          list.push({ p, along, near: Math.hypot(...sub(p, base)) });
        }
      }
      const ranked = list.filter((v) => v.along > top - 22).sort((a, b) => a.near - b.near);
      const step = Math.max(1, Math.floor(ranked.length / 5));
      const near = ranked.filter((_, k) => k % step === 0).slice(0, 5);
      // Küçük yapıda (arka diş) çapaya yakın köşeler komşu dişin ardında kalabilir: kameraya en yakın köşeler de denenir
      const front = [...list].sort((a, b) => b.along - a.along).slice(0, 40).filter((_, k) => k % 8 === 0);
      for (const { p } of [...near, ...front]) {
        if (scene.pointVisible(p, cam.pos, 1.5) && solid(id, p, cam, right, up)) { found = { point: p, eps: 1.5, onAnchor: false }; break; }
      }
    }
    anchorCache.set(key, found);
    return found;
  }

  // Pin, başka yapının üzerine düşmesin: soru "doğru" ve "yanlış" pini ayıramaz hale gelir
  function touches(p, id, side) {
    const it = index.items[id];
    if (it.marker) {
      const c = it.sides.find((x) => x.tag === side).c;
      return Math.hypot(...sub(p, c)) < 5;
    }
    if (byId.get(id).layer === 'bone') return false;
    for (const arr of verts(id, side)) {
      for (let k = 0; k < arr.length; k += 3) {
        if (Math.abs(arr[k] - p[0]) < 4 && Math.abs(arr[k + 1] - p[1]) < 4 && Math.abs(arr[k + 2] - p[2]) < 4) return true;
      }
    }
    return false;
  }

  // Yapının dış yönüne, aynı tarafa ve öne bakan kameralar önce denenir
  function dirOrder(id, side) {
    const s = index.items[id].sides.find((x) => x.tag === side);
    const out = norm(VIEW_HINT[id]?.() ?? sub(s.c, FRAME_C));
    const sign = side === 'R' ? -1 : side === 'L' ? 1 : 0;
    return DIRS.map((d, i) => {
      let score = dot(d, out) + Math.random() * 0.25;
      if (sign) score += d[0] * sign > 0 ? 0.35 : -0.25;
      if (d[2] < -0.35) score -= 0.3;
      return [score, i];
    }).sort((a, b) => b[0] - a[0]).map((x) => x[1]);
  }

  // Seçilen pinlere yaklaşan kamera; scale ile geri çekilir
  function fit(pts, i, scale = 1) {
    const dir = DIRS[i];
    const right = norm(cross([0, 1, 0], dir));
    const up = cross(dir, right);
    const rs = pts.map((p) => dot(p, right));
    const us = pts.map((p) => dot(p, up));
    const ds = pts.map((p) => dot(p, dir));
    const midR = (Math.min(...rs) + Math.max(...rs)) / 2;
    const midU = (Math.min(...us) + Math.max(...us)) / 2;
    const midD = (Math.min(...ds) + Math.max(...ds)) / 2;
    const hx = (Math.max(...rs) - Math.min(...rs)) / 2 + 22;
    const hy = (Math.max(...us) - Math.min(...us)) / 2 + 22;
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    const tan = Math.tan(THREE.MathUtils.degToRad(scene.camera.fov) / 2);
    const d = Math.min(620, Math.max(MIN_DIST, Math.max((hy / tan) * (h / Math.max(120, h - SAFE.top - SAFE.bottom)), (hx / (tan * (w / h))) * (w / Math.max(120, w - 2 * SAFE.x))) * 1.12)) * scale;
    const tar = [0, 1, 2].map((a) => right[a] * midR + up[a] * midU + dir[a] * midD);
    return { pos: tar.map((v, a) => v + dir[a] * d), tar, d };
  }

  // Tüm pinler bu kameradan görünür, sahnede ve birbirinden ayrı mı?
  function camOk(pins, cam) {
    setCam(cam);
    const sc = pins.map((p) => screen(p.point));
    return pins.every((p, k) => scene.pointVisible(p.point, cam.pos, p.eps) && inSafe(sc[k]) && sc.every((o, m) => m === k || gap(o, sc[k]) >= SPACING - 2));
  }

  function sideFor(id, dir) {
    const tags = index.items[id].sides.map((s) => s.tag);
    if (tags.length === 1) return tags[0];
    return dir[0] > 0 ? 'L' : 'R';
  }

  // Soru yerleşimi: count = 1 "Bu pin nedir?", 4-6 "Dokun"
  function place(id, side, count) {
    const key = viewKey(id);
    scene.setQuizView(VIEWS[key]);
    const fam = familyOf.get(id);
    const allowed = new Set(VIEWS[key].ids ?? []);
    const usable = (o) => {
      const f = familyOf.get(o);
      if (f === 'muscle' || f === 'nerve' || f === 'tme') return allowed.has(o);
      return true;
    };
    let best = null;
    let tries = 0;
    // Tek karede uzun takılma olmasın: yeterli pin bulununca bütçe dolduğunda aranmaz
    const t0 = performance.now();
    const spent = () => performance.now() - t0;
    for (const i of dirOrder(id, side)) {
      if (best && spent() > 350) break;
      const cam = camAt(i);
      const t = anchorAt(id, side, i, cam, key);
      if (!t) continue;
      setCam(cam);
      const ts = screen(t.point);
      if (!inSafe(ts)) continue;
      if (tries++ >= (best ? 8 : 24)) break;
      const pins = [{ id, side, ...t }];
      const sc = [ts];
      if (count > 1) {
        const dir = DIRS[i];
        // Aileler dönüşümlü denenir: arka dişte diş pinleri sığmazsa delik ve yapışma pinleri de sıraya girer
        const queues = DISTRACT[fam].map((f) => shuffle(families[f].filter((s) => s.id !== id && usable(s.id))));
        const order = [];
        while (queues.some((q) => q.length)) for (const q of queues) if (q.length) order.push(q.pop());
        // Aynı kasın diğer ucu en öğretici çeldiricidir
        const twin = fam === 'attach' ? `${id.startsWith('ao_') ? 'ai_' : 'ao_'}${id.slice(3)}` : null;
        const list = twin && byId.has(twin) ? [byId.get(twin), ...order.filter((s) => s.id !== twin)] : order;
        let checks = 0;
        for (const o of list) {
          if (pins.length >= count || checks >= 18 || (pins.length >= MIN_PINS && spent() > 250)) break;
          checks++;
          const oSide = sideFor(o.id, dir);
          const a = anchorAt(o.id, oSide, i, cam, key);
          if (!a) continue;
          setCam(cam);
          const s = screen(a.point);
          if (!inSafe(s) || sc.some((q) => gap(q, s) < SPACING)) continue;
          if (touches(a.point, id, side) || touches(t.point, o.id, oSide)) continue;
          pins.push({ id: o.id, side: oSide, ...a });
          sc.push(s);
        }
      }
      if (pins.length >= (count > 1 ? MIN_PINS : 1) && (!best || pins.length > best.pins.length)) {
        // Son kamerada da hepsi görünmeli; olmazsa sıradaki yön denenir
        const pts = pins.map((p) => p.point);
        const final = [1, 1.2, 1.45].map((k) => fit(pts, i, k)).find((c) => camOk(pins, c)) ?? (camOk(pins, cam) ? cam : null);
        if (!final) continue;
        best = { pins, i, cam: final };
        if (pins.length >= count) break;
      }
    }
    if (!best) return null;
    return { pins: best.pins, targetId: id, cam: best.cam, dirIndex: best.i, view: key };
  }

  function clearPins() {
    if (!cur) return;
    cur.pins.forEach((p) => p.el.remove());
    cur.tag?.el.remove();
    clearTimeout(cur.timer);
    cur = null;
  }

  // Sıra karıştırılır: DOM sırası doğru pini ele vermesin
  function show(pl, interactive) {
    clearPins();
    const list = shuffle(pl.pins);
    cur = { ...pl, pins: list, target: list.findIndex((p) => p.id === pl.targetId), size: [stage.clientWidth, stage.clientHeight], lastCheck: 0, timer: 0, tag: null };
    list.forEach((p, n) => {
      const b = document.createElement('button');
      b.className = 'pin';
      b.setAttribute('aria-label', `Pin ${n + 1}`);
      b.innerHTML = '<i></i>';
      if (interactive) b.addEventListener('click', () => tapCb?.(n));
      else b.tabIndex = -1;
      layer.append(b);
      p.el = b;
    });
    layer.classList.add('flying');
    scene.flyTo(cur.cam.pos, cur.cam.tar);
  }

  function checkOcclusion() {
    if (!cur) return;
    cur.lastCheck = performance.now();
    const from = scene.camera.position.toArray();
    for (const p of cur.pins) {
      p.seen = scene.pointVisible(p.point, from, p.eps);
      p.el.classList.toggle('occl', !p.seen);
    }
    if (cur.tag) cur.tag.el.classList.toggle('occl', !cur.pins[cur.target].seen);
  }

  function follow() {
    if (!cur) return;
    layer.classList.toggle('flying', scene.tweening);
    if (scene.tweening) return;
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    // Yön değişince soru açısı yeni sahneye sığdırılır
    if (Math.abs(w - cur.size[0]) > 40 || Math.abs(h - cur.size[1]) > 40) {
      cur.size = [w, h];
      cur.cam = fit(cur.pins.map((p) => p.point), cur.dirIndex);
      scene.flyTo(cur.cam.pos, cur.cam.tar, { ms: 300 });
      return;
    }
    for (const p of cur.pins) {
      const s = scene.projectPoint(p.point);
      p.el.style.transform = `translate3d(${s.x - 22}px, ${s.y - 22 - HEAD}px, 0)`;
      p.sx = s.x;
      p.sy = s.y;
      if (!s.front) p.el.classList.add('occl');
    }
    if (cur.tag) {
      const t = cur.pins[cur.target];
      const tw = cur.tag.el.offsetWidth;
      const x = Math.max(6, Math.min(t.sx + 16, w - tw - 6));
      cur.tag.el.style.transform = `translate3d(${x}px, ${Math.max(54, t.sy - 52)}px, 0)`;
    }
    // Işın maliyeti düşük kalsın: hareket boyunca seyrek, durunca son kez denetlenir
    clearTimeout(cur.timer);
    if (performance.now() - cur.lastCheck > 180) checkOcclusion();
    else cur.timer = setTimeout(checkOcclusion, 200);
  }
  scene.onFrame(follow);

  function reveal(chosen, text) {
    if (!cur) return;
    cur.pins[cur.target].el.classList.add('right');
    if (chosen != null && chosen !== cur.target) cur.pins[chosen].el.classList.add('wrong');
    const el = document.createElement('div');
    el.className = 'pin-tag';
    el.textContent = text;
    layer.append(el);
    cur.tag = { el };
    scene.invalidate();
  }

  return {
    pool,
    place,
    show,
    clear: clearPins,
    reveal,
    onTap: (cb) => { tapCb = cb; },
    setScore(good, bad) {
      layer.querySelector('#pin-good').textContent = good;
      layer.querySelector('#pin-bad').textContent = bad;
    },
    resetView() {
      if (cur) scene.flyTo(cur.cam.pos, cur.cam.tar, { ms: 450 });
    },
    // Test ve tanı için anlık durum
    get state() {
      if (!cur) return null;
      return {
        view: cur.view,
        target: cur.target,
        pins: cur.pins.map((p) => ({ id: p.id, side: p.side, point: p.point, eps: p.eps, onAnchor: !!p.onAnchor, x: p.sx, y: p.sy, seen: p.seen })),
      };
    },
  };
}
