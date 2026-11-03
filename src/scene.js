import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const COLORS = {
  bone: 0xe6dcc2,
  foramen: 0x4fd8d8,
  nerve: 0xf5d04e,
  ganglion: 0xff9c3a,
  artery: 0xef5350,
  vein: 0x5b8dee,
  context: 0xb39ddb,
  tooth: 0xf6f1e3,
  muscle: 0xb8473b,
  joint: 0x7fc6b4,
  attach_o: 0xe53935,
  attach_i: 0x1e88e5,
  needle: 0x6ee7a8,
  gland: 0x8bc34a,
  cartilage: 0xa9cfe0,
  region: 0x26a69a,
};
// Seçili yapı her katmanda aynı renktir. İlişkili yapılar katman rengini korur (sinir sarı, arter kırmızı);
// kendi rengi soluk ve nötr kalan kemik ile diş kehribar olur.
const SEL_COLOR = 0xff2bd6;
const SEL_EMISSIVE = 0x7a0f66;
const REL_COLOR = 0xf2a93b;
const GROUP_OF = { bone: 'bone', cartilage: 'bone', foramen: 'foramen', nerve: 'nerve', ganglion: 'nerve', artery: 'artery', vein: 'vein', context: 'context', tooth: 'tooth', muscle: 'muscle', joint: 'muscle', attach_o: 'attachment', attach_i: 'attachment', gland: 'gland', region: 'region' };
const LOAD_ORDER = ['bones', 'teeth', 'nerves', 'arteries', 'veins', 'glands', 'muscles', 'attachments', 'regions', 'context'];
const FILE_LABEL = { bones: 'Kemik', nerves: 'Sinir', arteries: 'Arter', veins: 'Ven', context: 'Dura ve beyin sapı', teeth: 'Diş', muscles: 'Kas ve TME', attachments: 'Kas yapışması', glands: 'Bez ve kıkırdak', regions: 'Boyun üçgeni' };
const HOME = { dir: [0.42, 0.2, 0.88], target: [0, -55, -12], halfH: 192, halfW: 110 };
// Renk modu: her kemik ayrı canlı renk; komşular (maxilla-zygomaticum, palatinum-vomer vb.) ayırt edilir
const BONE_PALETTE = {
  b_frontal: 0x3d7fe0, b_parietal: 0xf0cf3a, b_temporal: 0x3fbf6a, b_occipital: 0x8f6ad8, b_sphenoid: 0xe04fa8,
  b_ethmoid: 0xc9a227, b_zygomatic: 0xf28c28, b_maxilla: 0x22c3c9, b_mandible: 0xe8504a, b_nasal: 0xa4d93a,
  b_lacrimal: 0xff7ac6, b_palatine: 0xb06ae0, b_vomer: 0xf2a65a, b_concha: 0x7ad1a0, b_atlas: 0x9aa7b3, b_axis: 0xb3a89a, b_hyoid: 0xc2b280,
};
// Dokunmada kaba (arka plan) sayılan katmanlar: ince yapılar bunların arkasında kalsa da önce seçilir
const COARSE = new Set(['bone', 'cartilage', 'context', 'region']);
const PRESET_DIR = { front: [0, 0.05, 1], right: [-1, 0.05, 0.02], left: [1, 0.05, 0.02], top: [0, 1, 0.02], bottom: [0, -1, 0.02] };

// Dünya koordinatlarında konum dizisi: kesit yüzeyi ve 2B kesit görüntüsü bunu kullanır
export function bakeMesh(mesh, out = new Float32Array(mesh.geometry.attributes.position.count * 3), matrix = mesh.matrixWorld) {
  const a = mesh.geometry.attributes.position;
  const e = matrix.elements;
  for (let i = 0, n = a.count; i < n; i++) {
    const x = a.getX(i);
    const y = a.getY(i);
    const z = a.getZ(i);
    out[3 * i] = e[0] * x + e[4] * y + e[8] * z + e[12];
    out[3 * i + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
    out[3 * i + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
  }
  return out;
}
export function meshIndex(mesh) {
  const ix = mesh.geometry.index;
  if (ix) return ix.array;
  return Uint32Array.from({ length: mesh.geometry.attributes.position.count }, (_, i) => i);
}

// Kesit yüzeyi yalnız kapalı katmanlar için: tüpler (sinir, damar) ve kabuklar dışarıda kalır
const CAP_COLORS = { bone: 0xe8d8b0, cartilage: 0xb9dbe8, muscle: 0xb5342a, gland: 0x8fbf5a, joint: 0x6fb5a3, tooth: 0xffffff };
const CAP_LAYERS = Object.keys(CAP_COLORS);
const AXES = ['x', 'y', 'z'];
const CAP_VS = 'varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
const STENCIL_FS = 'uniform vec4 uPlane; varying vec3 vW; void main() { if (dot(uPlane.xyz, vW) + uPlane.w < 0.0) discard; gl_FragColor = vec4(0.0); }';
const CAP_FS = 'uniform vec4 uA; uniform vec4 uB; uniform vec3 uColor; varying vec3 vW; void main() { if (dot(uA.xyz, vW) + uA.w < 0.0 || dot(uB.xyz, vW) + uB.w < 0.0) discard; gl_FragColor = vec4(uColor, 1.0); }';

// Stencil sayımı kapalı yüzey ister: kenar dengesi bozuk delikler kendi merkezlerinden yelpazeyle örtülür.
// Hacmi negatif (ters sarımlı) meshler birleştirilirken çevrilir.
// Çene oynarken kurulsa bile veri dinlenme konumundan alınır (restWorld).
function closeMesh(mesh) {
  const pos = bakeMesh(mesh, undefined, mesh.userData.restWorld ?? mesh.matrixWorld);
  const src = meshIndex(mesh);
  const nv = pos.length / 3;
  const weld = new Map();
  const ids = new Int32Array(nv);
  for (let i = 0; i < nv; i++) {
    const key = Math.round(pos[3 * i] * 64 + 65536) + Math.round(pos[3 * i + 1] * 64 + 65536) * 2 ** 17 + Math.round(pos[3 * i + 2] * 64 + 65536) * 2 ** 34;
    const w = weld.get(key);
    if (w === undefined) weld.set(key, i);
    ids[i] = w ?? i;
  }
  const BASE = 2 ** 24;
  const net = new Map();
  const add = (u, v) => {
    if (u === v) return;
    const k = u < v ? u * BASE + v : v * BASE + u;
    net.set(k, (net.get(k) ?? 0) + (u < v ? 1 : -1));
  };
  let vol = 0;
  for (let t = 0; t < src.length; t += 3) {
    const a = src[t];
    const b = src[t + 1];
    const c = src[t + 2];
    add(ids[a], ids[b]);
    add(ids[b], ids[c]);
    add(ids[c], ids[a]);
    const bx = pos[3 * b];
    const by = pos[3 * b + 1];
    const bz = pos[3 * b + 2];
    const cx = pos[3 * c];
    const cy = pos[3 * c + 1];
    const cz = pos[3 * c + 2];
    vol += pos[3 * a] * (by * cz - bz * cy) - pos[3 * a + 1] * (bx * cz - bz * cx) + pos[3 * a + 2] * (bx * cy - by * cx);
  }
  const out = new Map();
  for (const [k, n] of net) {
    if (!n) continue;
    const lo = Math.floor(k / BASE);
    const hi = k - lo * BASE;
    const [u, v] = n > 0 ? [lo, hi] : [hi, lo];
    if (!out.has(u)) out.set(u, []);
    for (let i = 0; i < Math.abs(n); i++) out.get(u).push(v);
  }
  const extraPos = [];
  const extraIdx = [];
  const extraLoops = [];
  for (const start of out.keys()) {
    while (out.get(start).length) {
      const loop = [];
      let u = start;
      do {
        const v = out.get(u)?.pop();
        if (v === undefined) break;
        loop.push([u, v]);
        u = v;
      } while (u !== start);
      let cx = 0;
      let cy = 0;
      let cz = 0;
      for (const [a] of loop) { cx += pos[3 * a]; cy += pos[3 * a + 1]; cz += pos[3 * a + 2]; }
      const c = nv + extraPos.length / 3;
      extraPos.push(cx / loop.length, cy / loop.length, cz / loop.length);
      extraLoops.push(loop.map(([a]) => a));
      for (const [a, b] of loop) extraIdx.push(c, b, a);
    }
  }
  return { pos, src, vol, extraPos, extraIdx, extraLoops, nv };
}

function layerMaterials(layer) {
  const color = COLORS[layer];
  const std = (o) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, ...o });
  if (layer === 'bone') {
    // Saydamlık setBoneOpacity ile ayarlanır; varsayılan opaktır
    const solid = { side: THREE.DoubleSide, roughness: 0.85 };
    return {
      base: std({ ...solid }),
      dim: std({ ...solid }),
      rel: std({ ...solid, color: REL_COLOR }),
      sel: std({ ...solid, color: SEL_COLOR, emissive: SEL_EMISSIVE }),
    };
  }
  if (layer === 'context' || layer === 'region') {
    const glass = { transparent: true, depthWrite: false, side: THREE.DoubleSide };
    return {
      base: std({ ...glass, opacity: 0.28 }),
      dim: std({ ...glass, opacity: 0.1 }),
      rel: std({ ...glass, opacity: 0.45, emissive: 0x2c2350 }),
      sel: std({ ...glass, opacity: 0.7, color: SEL_COLOR, emissive: SEL_EMISSIVE }),
    };
  }
  const em = new THREE.Color(color).multiplyScalar(0.55);
  const set = {
    // Çene hareketinde çalışan yapı: kemiğin içinden görünür, lif grubu köşe alfasıyla seçilir
    work: std({ transparent: true, opacity: 0.74, depthWrite: false, vertexColors: true, color: new THREE.Color(color).lerp(new THREE.Color(0xff8a5c), layer === 'muscle' ? 0.45 : 0), emissive: em.clone().multiplyScalar(0.8) }),
    base: std({}),
    dim: std({ transparent: true, opacity: 0.13, depthWrite: false }),
    // Vurgulu yapılar saydam kuyrukta en son çizilir, böylece opak kemiğin içinden görünür
    rel: layer === 'tooth'
      ? std({ transparent: true, color: REL_COLOR, emissive: new THREE.Color(REL_COLOR).multiplyScalar(0.25) })
      : std({ transparent: true, emissive: em.clone().multiplyScalar(0.5) }),
    // İğne seçimin parçası değildir, kendi yeşilinde kalır
    // Boyun üçgeni seçiliyken sınır kasları saydamlaşır: üçgen yüzeyi ve içerik arkada kalmasın
    ghost: std({ transparent: true, opacity: 0.32, depthWrite: false, emissive: em.clone().multiplyScalar(0.4) }),
    sel: layer === 'needle'
      ? std({ transparent: true, emissive: em, color: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.25) })
      : std({ transparent: true, color: SEL_COLOR, emissive: SEL_EMISSIVE }),
  };
  // Yapışma bölgeleri kemik yüzeyinde durur; titreşmesin diye öne alınır
  if (layer.startsWith('attach')) {
    for (const m of Object.values(set)) {
      m.side = THREE.DoubleSide;
      m.polygonOffset = true;
      m.polygonOffsetFactor = -2;
      m.polygonOffsetUnits = -2;
    }
  }
  return set;
}

export function createScene({ canvas, stage, labelsEl, index, byId }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, stencil: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = false;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 4, 3000);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445066, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(1, 1.2, 1.5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xbfd4ff, 0.7);
  fill.position.set(-1.2, -0.4, -1);
  scene.add(fill);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(...HOME.target);
  // Genel görünüm: kafatası sahnenin en-boy oranı ne olursa olsun sığar
  const homePos = () => {
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const d = Math.max(HOME.halfH / tan, HOME.halfW / (tan * camera.aspect));
    return new THREE.Vector3(...HOME.target).addScaledVector(new THREE.Vector3(...HOME.dir).normalize(), d);
  };
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.rotateSpeed = 0.75;
  controls.zoomSpeed = 0.9;
  controls.panSpeed = 0.9;
  controls.minDistance = 14;
  controls.maxDistance = 900;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  // Kıstırma ve tekerlek parmakların (imlecin) olduğu yere doğru yaklaştırır
  controls.zoomToCursor = true;
  controls.screenSpacePanning = true;

  const mats = Object.fromEntries(Object.keys(COLORS).map((k) => [k, layerMaterials(k)]));

  // Derinliği temizleyen görünmez nesne: bundan sonra çizilen vurgulu yapılar kemiğin önüne geçer
  const XRAY_ORDER = 10;
  const depthClear = new THREE.Mesh(
    new THREE.PlaneGeometry(1e-3, 1e-3),
    new THREE.MeshBasicMaterial({ transparent: true, colorWrite: false, depthWrite: false, depthTest: false }),
  );
  depthClear.frustumCulled = false;
  depthClear.renderOrder = XRAY_ORDER - 1;
  depthClear.onBeforeRender = (r) => r.clearDepth();
  depthClear.visible = false;
  scene.add(depthClear);

  // Her renkli kemiğin kendi malzeme takımı vardır; saydamlık ayarı hepsine birlikte uygulanır
  const boneSets = new Map();
  for (const [id, st] of byId) {
    if (st.layer !== 'bone') continue;
    const color = new THREE.Color(BONE_PALETTE[id] ?? 0xb0b8c0);
    const std = (o) => new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.7, metalness: 0.02, ...o });
    boneSets.set(id, {
      base: std({}),
      dim: std({}),
      rel: std({ color: REL_COLOR }),
      sel: std({ color: SEL_COLOR, emissive: SEL_EMISSIVE }),
    });
  }
  let colorMode = false;

  let boneOpaque = true;
  function setBoneOpacity(o) {
    boneOpaque = o >= 0.99;
    const set = (m, opacity) => {
      m.transparent = !boneOpaque;
      m.depthWrite = boneOpaque;
      m.opacity = boneOpaque ? 1 : opacity;
      m.needsUpdate = true;
    };
    for (const b of [mats.bone, ...boneSets.values()]) {
      set(b.base, o);
      set(b.dim, o * 0.5);
      set(b.rel, Math.min(1, o * 1.5));
      set(b.sel, Math.min(1, o * 2.5));
    }
    invalidate();
  }

  // id -> { layer, meshes: [], sides }
  const records = new Map();
  const record = (id) => {
    if (!records.has(id)) records.set(id, { id, layer: byId.get(id)?.layer ?? 'needle', meshes: [] });
    return records.get(id);
  };
  const pickables = [];
  // Delik ağzı halkanın çocuğudur: halka gizliyse görünmez sayılır
  const isShown = (m) => m.visible && (!m.userData.child || m.parent.visible);

  const layerOn = { bone: true, foramen: true, nerve: true, artery: true, vein: true, context: false, tooth: true, muscle: false, attachment: false, gland: true, region: false };
  // hidden: kullanıcının gizlediği yapılar; solo: yalnız gösterilen yapılar (null ise kapalı)
  const state = { sel: [], rel: [], needle: null, primary: null, hideLabels: false, view: null, work: null, hidden: new Set(), solo: null };
  // Soru görünümü katman düğmelerini ezer, onların durumunu değiştirmez
  const inView = (rec) => {
    const w = state.view;
    return !w.hide.has(rec.id) && (w.groups.has(GROUP_OF[rec.layer]) || w.ids.has(rec.id));
  };

  // Delik ve ganglion işaretçileri model yüklenmeden kullanılabilsin diye burada üretilir
  // Delikler halka ve koyu ağızla çizilir: küre kemiğin içinde kaybolup neyin delik olduğu anlaşılmıyordu.
  // Halka, delikten geçen yapıların yönüne göre load() sonunda döndürülür.
  const sphere = new THREE.SphereGeometry(1, 20, 14);
  const ring = new THREE.TorusGeometry(1.15, 0.32, 10, 32);
  const mouth = new THREE.CircleGeometry(0.9, 28);
  const mouthMat = new THREE.MeshBasicMaterial({ color: 0x061418, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  for (const [id, it] of Object.entries(index.items)) {
    if (!it.marker) continue;
    const st = byId.get(id);
    if (!st) continue;
    const rec = record(id);
    const isHole = st.layer === 'foramen';
    for (const side of it.sides) {
      const mesh = new THREE.Mesh(isHole ? ring : sphere, mats[st.layer].base);
      if (isHole) {
        const m = new THREE.Mesh(mouth, mouthMat);
        m.userData = { id, side: side.tag, layer: st.layer, child: true };
        mesh.add(m);
        pickables.push(m);
      }
      mesh.position.set(...side.c);
      const s = it.scale ?? [1, 1, 1];
      mesh.scale.set(it.r * s[0], it.r * s[1], it.r * s[2]);
      mesh.userData = { id, side: side.tag };
      mesh.userData.baseOrder = 3;
      rec.meshes.push(mesh);
      pickables.push(mesh);
      scene.add(mesh);
    }
  }

  const clip = {
    x: new THREE.Plane(new THREE.Vector3(-1, 0, 0), 1e4),
    y: new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e4),
    z: new THREE.Plane(new THREE.Vector3(0, 0, -1), 1e4),
  };
  renderer.clippingPlanes = [];

  let needsRender = true;
  let raf = 0;
  let tween = null;
  let frames = 0;
  const frameListeners = new Set();

  function invalidate() {
    needsRender = true;
    if (!raf) raf = requestAnimationFrame(frame);
  }
  function frame(now) {
    raf = 0;
    if (tween) {
      const k = Math.min(1, (now - tween.t0) / tween.ms);
      const e = k * k * (3 - 2 * k);
      camera.position.lerpVectors(tween.fromPos, tween.toPos, e);
      controls.target.lerpVectors(tween.fromTar, tween.toTar, e);
      if (k >= 1) tween = null;
    }
    const moved = controls.update();
    if (needsRender || moved || tween) {
      needsRender = false;
      syncCaps();
      renderer.render(scene, camera);
      frames++;
      updateLabels();
      if (holeLabels) {
        placeHoles();
        clearTimeout(holeTimer);
        holeTimer = setTimeout(checkHoles, 140);
      }
      frameListeners.forEach((f) => f());
    }
    if (moved || tween) invalidate();
  }
  controls.addEventListener('change', invalidate);

  let touched = false;
  controls.addEventListener('start', () => { touched = true; });
  function resize() {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (!touched) camera.position.copy(homePos());
    invalidate();
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  function applyMaterials() {
    const sel = new Set(state.sel);
    const rel = new Set(state.rel);
    const active = sel.size > 0 && !state.keepBase;
    let xray = false;
    for (const rec of records.values()) {
      const group = GROUP_OF[rec.layer];
      const isSel = sel.has(rec.id);
      const isRel = rel.has(rec.id);
      const m = (colorMode && boneSets.get(rec.id)) || mats[rec.layer];
      const ghost = isRel && state.ghostRel && (rec.layer === 'muscle' || rec.layer === 'gland' || rec.layer === 'joint');
      const material = isSel || rec.layer === 'needle' ? m.sel : ghost ? m.ghost : isRel ? m.rel : active ? m.dim : m.base;
      let visible;
      if (rec.layer === 'needle') visible = state.needle === rec.id;
      // İlişkili yapı kapatılmış katmanı geri açmaz (ör. kaslar kapalıyken n. facialis kasları göstermez);
      // yardımcı katmanlar (yapışma, üçgen, dura) ve blok/üçgen sahneleri ilişkiliyi her zaman gösterir
      else visible = isSel || (isRel && relShown(rec)) || (state.view ? inView(rec) : !!layerOn[group]);
      const front = (!COARSE.has(rec.layer) || (rec.layer === 'region' && isSel)) && (isSel || isRel || rec.layer === 'needle');
      if (front && visible) xray = true;
      if (state.hidden.has(rec.id) || (state.solo && !state.solo.has(rec.id) && rec.layer !== 'needle')) visible = false;
      const work = state.work?.has(rec.id) ? state.work.get(rec.id) ?? true : null;
      for (const mesh of rec.meshes) {
        // Seçim önceliklidir; çalışan kasın yalnız ilgili tarafı vurgulanır
        const isWork = !isSel && work && (work === true || work.has(mesh.userData.side));
        mesh.material = isWork ? m.work : material;
        mesh.visible = visible || !!isWork;
        mesh.renderOrder = front || isWork ? XRAY_ORDER : mesh.userData.baseOrder ?? 0;
        if (isWork) xray = true;
      }
    }
    depthClear.visible = xray;
    invalidate();
  }

  // Çene hareketliyken çapalar duruşla birlikte taşınır; pin testi geo_index'in sıfır konumunu kullanır
  let anchorPose = null;
  const _pa = new THREE.Vector3();
  const posedArr = (id, tag, arr) => {
    _pa.set(...arr);
    anchorPose(id, tag, _pa);
    return _pa.toArray();
  };
  function anchorOf(id) {
    const it = index.items[id];
    if (!it) return null;
    const side = it.sides.find((s) => s.tag === 'R') ?? it.sides[0];
    if (!anchorPose) return side;
    return { ...side, c: posedArr(id, side.tag, side.c), a: side.a ? posedArr(id, side.tag, side.a) : undefined };
  }

  // Seçili yapının etiketi ve komşu etiketleri
  const labels = [];
  function clearLabels() {
    labels.splice(0).forEach((l) => l.el.remove());
  }
  function addLabel(id, cls, onTap) {
    const st = byId.get(id);
    const anchor = anchorOf(id);
    if (!st || !anchor) return;
    const el = document.createElement('div');
    el.className = `label ${cls} lay-${st.layer}`;
    const b = document.createElement('button');
    const t = document.createElement('span');
    t.textContent = st.name;
    b.append(t);
    if (onTap) b.addEventListener('click', () => onTap(id));
    el.append(b);
    labelsEl.append(el);
    labels.push({ el, id, pos: new THREE.Vector3(...(anchor.a ?? anchor.c)) });
  }
  const v = new THREE.Vector3();
  function updateLabels() {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    const boxes = labels.map((l) => {
      if (anchorPose) {
        const a = anchorOf(l.id);
        l.pos.set(...(a.a ?? a.c));
      }
      v.copy(l.pos).project(camera);
      const lw = l.el.offsetWidth;
      return {
        l,
        inView: v.z < 1,
        x: Math.max(4, Math.min((v.x * 0.5 + 0.5) * w + 22, w - lw - 4)),
        y: Math.max(116, Math.min((-v.y * 0.5 + 0.5) * h - 22, h - 150)),
      };
    });
    // Üst üste binmesin diye etiketler yukarıdan aşağıya dizilir
    boxes.sort((a, b) => a.y - b.y);
    boxes.forEach((b, i) => {
      if (i > 0 && b.y < boxes[i - 1].y + 40) b.y = boxes[i - 1].y + 40;
      b.l.el.style.transform = `translate(${b.x}px, ${b.y}px)`;
      b.l.el.style.visibility = b.inView ? 'visible' : 'hidden';
    });
  }

  function focusOn(ids, { instant = false } = {}) {
    touched = true;
    const box = new THREE.Box3();
    const tmp = new THREE.Vector3();
    let any = false;
    for (const id of ids) {
      const side = anchorOf(id);
      const it = index.items[id];
      if (!side) continue;
      const r = it.marker ? it.r : side.r;
      tmp.set(...side.c);
      box.expandByPoint(tmp.clone().addScalar(r));
      box.expandByPoint(tmp.clone().addScalar(-r));
      any = true;
    }
    if (!any) return;
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 9);
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const fit = Math.max(radius / Math.sin(fov / 2), (radius / Math.sin(fov / 2)) / Math.min(camera.aspect, 1)) * 1.15;
    const dist = Math.min(Math.max(fit, 95), 620);
    const dir = camera.position.clone().sub(controls.target).normalize();
    // Kamera yapının karşı tarafındaysa kemik arkada kalmasın diye aynı tarafa geçir
    if (center.x < -6 && dir.x > 0.55) dir.x = -dir.x;
    if (center.x > 6 && dir.x < -0.55) dir.x = -dir.x;
    const toPos = center.clone().addScaledVector(dir.normalize(), dist);
    if (instant) {
      camera.position.copy(toPos);
      controls.target.copy(center);
      controls.update();
      invalidate();
      return;
    }
    tween = { t0: performance.now(), ms: 650, fromPos: camera.position.clone(), toPos, fromTar: controls.target.clone(), toTar: center };
    invalidate();
  }

  function setView(preset) {
    const dir = new THREE.Vector3(...PRESET_DIR[preset]).normalize();
    const dist = camera.position.distanceTo(controls.target);
    tween = { t0: performance.now(), ms: 500, fromPos: camera.position.clone(), toPos: controls.target.clone().addScaledVector(dir, dist), fromTar: controls.target.clone(), toTar: controls.target.clone() };
    invalidate();
  }
  function home() {
    tween = { t0: performance.now(), ms: 600, fromPos: camera.position.clone(), toPos: homePos(), fromTar: controls.target.clone(), toTar: new THREE.Vector3(...HOME.target) };
    invalidate();
  }

  const AUX = new Set(['attachment', 'region', 'context']);
  function relShown(rec) {
    const group = GROUP_OF[rec.layer];
    if (group === 'bone') return false;
    if (state.forceRel || layerOn[group]) return true;
    // Yapışma bölgesi kasın parçasıdır: kaslar kapalıyken yalnız kas seçiliyse görünür
    if (group === 'attachment') return !!layerOn.muscle || state.sel.some((id) => GROUP_OF[records.get(id)?.layer] === 'muscle');
    return AUX.has(group);
  }
  let labelArgs = null;
  function drawLabels() {
    clearLabels();
    if (!labelArgs) return;
    const { primary, relLabels, labelTap } = labelArgs;
    addLabel(primary, 'main', null);
    relLabels.filter((id) => { const r = records.get(id); return !r || state.view || relShown(r) || layerOn[GROUP_OF[r.layer]]; }).slice(0, 3).forEach((id) => addLabel(id, 'rel', labelTap));
  }
  function highlight({ sel = [], rel = [], needle = null, primary = null, labelTap = null, showLabels = true, relLabels = rel, keepBase = false, ghostRel = false, forceRel = false } = {}) {
    state.keepBase = keepBase;
    state.ghostRel = ghostRel;
    state.forceRel = forceRel;
    state.sel = sel;
    state.rel = rel;
    state.needle = needle;
    state.primary = primary;
    labelArgs = showLabels && primary ? { primary, relLabels, labelTap } : null;
    drawLabels();
    applyMaterials();
  }

  function setColorMode(on) {
    colorMode = !!on;
    applyMaterials();
  }

  // Pin testi: { groups, ids, hide } ile görünen yapılar sınırlanır; engel listesi de bunlardan oluşur
  let occluders = [];
  function setQuizView(w) {
    state.view = w ? { groups: new Set(w.groups ?? []), ids: new Set(w.ids ?? []), hide: new Set(w.hide ?? []) } : null;
    occluders = [];
    if (w) {
      for (const rec of records.values()) {
        if (rec.layer !== 'needle' && !index.items[rec.id]?.marker && inView(rec)) occluders.push(...rec.meshes);
      }
    }
    applyMaterials();
  }
  const occRay = new THREE.Raycaster();
  const occO = new THREE.Vector3();
  const occD = new THREE.Vector3();
  function occCast(from, to, extra) {
    occO.set(...from);
    occD.set(...to).sub(occO);
    const dist = occD.length();
    occRay.set(occO, occD.normalize());
    occRay.far = Math.max(0.001, dist + extra);
    return occRay.intersectObjects(occluders, false);
  }
  // Noktanın önünde (eps toleransla) görünümdeki bir mesh var mı?
  const pointVisible = (p, from = camera.position.toArray(), eps = 1.5) => occCast(from, p, -eps).length === 0;
  // Noktaya giden ışının ilk çarptığı yapı
  const firstHitId = (p, from = camera.position.toArray(), beyond = 8) => occCast(from, p, beyond)[0]?.object.userData.id ?? null;

  function flyTo(pos, target, { ms = 650 } = {}) {
    touched = true;
    tween = { t0: performance.now(), ms, fromPos: camera.position.clone(), toPos: new THREE.Vector3(...pos), fromTar: controls.target.clone(), toTar: new THREE.Vector3(...target) };
    invalidate();
  }

  function setLayer(group, on) {
    layerOn[group] = on;
    if (labelArgs) drawLabels();
    applyMaterials();
  }

  function setClip(axis, value) {
    if (value == null) {
      renderer.clippingPlanes = renderer.clippingPlanes.filter((p) => p !== clip[axis]);
    } else {
      clip[axis].constant = value;
      if (!renderer.clippingPlanes.includes(clip[axis])) renderer.clippingPlanes = [...renderer.clippingPlanes, clip[axis]];
    }
    invalidate();
  }

  // ---------- Kesit yüzeyi ----------
  // Meshler katman başına tek geometride birleşir: düzlem başına en çok katman x 2 çizim yapılır.
  // Bu malzemeler renderer'ın genel düzlemlerini almaz; her geçiş yalnız kendi düzlemini kullanır.
  const capRoot = new THREE.Group();
  capRoot.visible = false;
  scene.add(capRoot);
  const closed = new WeakMap();
  let capParts = [];
  let capDirty = true;
  const capQuad = new THREE.PlaneGeometry(1400, 1400);
  const capMats = {};
  AXES.forEach((axis, ai) => {
    const uPlane = { value: new THREE.Vector4() };
    const stencil = (side, op) => new THREE.ShaderMaterial({
      vertexShader: CAP_VS, fragmentShader: STENCIL_FS, uniforms: { uPlane }, side,
      colorWrite: false, depthWrite: false, depthTest: false,
      stencilWrite: true, stencilFunc: THREE.AlwaysStencilFunc, stencilFail: op, stencilZFail: op, stencilZPass: op,
    });
    const others = [{ value: new THREE.Vector4(0, 0, 0, 1) }, { value: new THREE.Vector4(0, 0, 0, 1) }];
    const caps = {};
    CAP_LAYERS.forEach((layer, li) => {
      const c = CAP_COLORS[layer];
      const q = new THREE.Mesh(capQuad, new THREE.ShaderMaterial({
        vertexShader: CAP_VS, fragmentShader: CAP_FS, side: THREE.DoubleSide,
        uniforms: { uA: others[0], uB: others[1], uColor: { value: new THREE.Vector3((c >> 16) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255) } },
        stencilWrite: true, stencilRef: 0, stencilFunc: THREE.NotEqualStencilFunc,
        stencilFail: THREE.ReplaceStencilOp, stencilZFail: THREE.ReplaceStencilOp, stencilZPass: THREE.ReplaceStencilOp,
      }));
      if (axis === 'x') q.rotation.y = Math.PI / 2;
      if (axis === 'y') q.rotation.x = -Math.PI / 2;
      q.frustumCulled = false;
      q.visible = false;
      q.renderOrder = 6 + ai + li * 0.1 + 0.05;
      q.onAfterRender = (r) => r.clearStencil();
      caps[layer] = q;
      capRoot.add(q);
    });
    capMats[axis] = { uPlane, others, caps, back: stencil(THREE.BackSide, THREE.IncrementWrapStencilOp), front: stencil(THREE.FrontSide, THREE.DecrementWrapStencilOp) };
  });

  function buildCaps() {
    capDirty = false;
    for (const part of capParts) {
      part.geometry.dispose();
      capRoot.remove(...part.meshes);
    }
    const groups = new Map();
    for (const rec of records.values()) {
      if (!CAP_LAYERS.includes(rec.layer)) continue;
      const jaw = !!index.items[rec.id]?.movesWithMandible;
      // Parça başına tek dönüşüm izlenir: çene, iki disk ve gerdirilen yumuşak doku ayrı gruptur
      for (const mesh of rec.meshes) {
        const mover = mesh.userData.soft ? 'soft' : rec.id === 'j_disc' ? `disc${mesh.userData.side}` : jaw ? 'jaw' : 'fixed';
        const key = `${rec.layer}|${mover}`;
        if (!groups.has(key)) groups.set(key, { layer: rec.layer, mover, list: [] });
        groups.get(key).list.push({ mesh, rec });
      }
    }
    capParts = [...groups.values()].filter((g) => g.list.length).map(({ layer, mover, list }) => {
      const mobile = mover !== 'fixed' && mover !== 'soft';
      let nv = 0;
      let ni = 0;
      for (const { mesh } of list) {
        mesh.updateWorldMatrix(true, false);
        if (!closed.has(mesh)) closed.set(mesh, closeMesh(mesh));
        const d = closed.get(mesh);
        nv += d.nv + d.extraPos.length / 3;
        ni += d.src.length + d.extraIdx.length;
      }
      const pos = new Float32Array(nv * 3);
      const full = new Uint32Array(ni);
      let vo = 0;
      let io = 0;
      const ranges = list.map(({ mesh, rec }) => {
        const d = closed.get(mesh);
        pos.set(d.pos, vo * 3);
        pos.set(d.extraPos, (vo + d.nv) * 3);
        const start = io;
        const [p1, p2] = d.vol < 0 ? [2, 1] : [1, 2];
        for (const arr of [d.src, d.extraIdx]) {
          for (let t = 0; t < arr.length; t += 3) {
            full[io++] = arr[t] + vo;
            full[io++] = arr[t + p1] + vo;
            full[io++] = arr[t + p2] + vo;
          }
        }
        const at = vo;
        vo += d.nv + d.extraPos.length / 3;
        return { mesh, rec, start, count: io - start, on: null, at, ver: null };
      });
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(ni), 1).setUsage(THREE.DynamicDrawUsage));
      geometry.setDrawRange(0, 0);
      const li = CAP_LAYERS.indexOf(layer);
      const meshes = [];
      AXES.forEach((axis, ai) => {
        ['back', 'front'].forEach((face, fi) => {
          const m = new THREE.Mesh(geometry, capMats[axis][face]);
          m.frustumCulled = false;
          m.matrixAutoUpdate = false;
          m.renderOrder = 6 + ai + li * 0.1 + 0.01 + fi * 0.01;
          m.userData.axis = axis;
          meshes.push(m);
        });
      });
      capRoot.add(...meshes);
      const ref = list[0].mesh;
      const inv = (ref.userData.restWorld ?? ref.matrixWorld).clone().invert();
      return { layer, mobile, soft: mover === 'soft', geometry, full, ranges, meshes, ref, inv, drawn: 0 };
    });
  }

  // Gerdirilen kasların kesiti: konumlar yalnız köşeler değişince yeniden yazılır
  function syncSoftPart(part) {
    let dirty = false;
    const arr = part.geometry.attributes.position.array;
    for (const r of part.ranges) {
      const ver = r.mesh.userData.softVer ?? 0;
      if (r.ver === ver) continue;
      r.ver = ver;
      dirty = true;
      const d = closed.get(r.mesh);
      const nv = d.nv;
      const out = arr.subarray(r.at * 3, (r.at + nv + d.extraLoops.length) * 3);
      bakeMesh(r.mesh, out);
      d.extraLoops.forEach((loop, k) => {
        let x = 0;
        let y = 0;
        let z = 0;
        for (const a of loop) { x += out[3 * a]; y += out[3 * a + 1]; z += out[3 * a + 2]; }
        out[3 * (nv + k)] = x / loop.length;
        out[3 * (nv + k) + 1] = y / loop.length;
        out[3 * (nv + k) + 2] = z / loop.length;
      });
    }
    if (dirty) part.geometry.attributes.position.needsUpdate = true;
  }

  const capMat = new THREE.Matrix4();
  function syncCaps() {
    const planes = renderer.clippingPlanes;
    capRoot.visible = planes.length > 0;
    if (!planes.length) return;
    if (capDirty) buildCaps();
    const drawnLayers = new Set();
    for (const part of capParts) {
      let changed = false;
      for (const r of part.ranges) {
        // Saydam kemikte kesit yüzeyi kapalıdır; soluk diş ve kasın kesiti görünür kalır
        const on = r.mesh.visible && (r.rec.layer !== 'bone' || boneOpaque || r.mesh.material.opacity >= 0.99);
        if (on !== r.on) { r.on = on; changed = true; }
      }
      if (changed) {
        const dst = part.geometry.index.array;
        let n = 0;
        for (const r of part.ranges) {
          if (!r.on) continue;
          dst.set(part.full.subarray(r.start, r.start + r.count), n);
          n += r.count;
        }
        part.drawn = n;
        part.geometry.index.needsUpdate = true;
        part.geometry.setDrawRange(0, n);
      }
      if (part.drawn) drawnLayers.add(part.layer);
      if (part.soft) syncSoftPart(part);
      if (part.mobile) {
        // Çene hareket ederse birleşik geometri referans meshin dönüşümünü izler
        part.ref.updateWorldMatrix(true, false);
        capMat.multiplyMatrices(part.ref.matrixWorld, part.inv);
      }
      for (const m of part.meshes) {
        m.visible = part.drawn > 0 && planes.includes(clip[m.userData.axis]);
        if (part.mobile) {
          m.matrix.copy(capMat);
          // matrixAutoUpdate kapalı: bu işaret olmadan dünya matrisi güncellenmez
          m.matrixWorldNeedsUpdate = true;
        }
      }
    }
    for (const axis of AXES) {
      const on = planes.includes(clip[axis]);
      const cm = capMats[axis];
      const p = clip[axis];
      cm.uPlane.value.set(p.normal.x, p.normal.y, p.normal.z, p.constant);
      AXES.filter((o) => o !== axis).forEach((o, i) => {
        const q = clip[o];
        if (planes.includes(q)) cm.others[i].value.set(q.normal.x, q.normal.y, q.normal.z, q.constant);
        else cm.others[i].value.set(0, 0, 0, 1);
      });
      for (const layer of CAP_LAYERS) {
        const q = cm.caps[layer];
        q.visible = on && drawnLayers.has(layer);
        q.position.set(axis === 'x' ? p.constant : 0, axis === 'y' ? p.constant : 0, axis === 'z' ? p.constant : 0);
      }
    }
  }

  // Kamera kesit yüzüne bakar: tutulan taraf düzlemin arkasında kalır
  function frameSection(axis, center, radius) {
    touched = true;
    const dir = new THREE.Vector3(axis === 'x' ? 1 : 0.18, axis === 'y' ? 1 : 0.12, axis === 'z' ? 1 : axis === 'y' ? 0.25 : 0.18).normalize();
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const dist = Math.min(620, (radius / Math.sin(fov / 2)) * Math.max(1, 1 / camera.aspect));
    const toTar = new THREE.Vector3(...center);
    tween = { t0: performance.now(), ms: 650, fromPos: camera.position.clone(), toPos: toTar.clone().addScaledVector(dir, dist), fromTar: controls.target.clone(), toTar };
    invalidate();
  }

  // Dokunma ile seçim: ince yapılara da dokunulabilsin diye merkezin çevresine birkaç ışın atılır
  const ray = new THREE.Raycaster();
  const OFFSETS = [[0, 0], [-10, 0], [10, 0], [0, -10], [0, 10], [-7, -7], [7, -7], [-7, 7], [7, 7], [-18, 0], [18, 0], [0, -18], [0, 18]];
  function pickAt(cx, cy) {
    const rect = canvas.getBoundingClientRect();
    const planes = renderer.clippingPlanes;
    const passes = (p) => planes.every((pl) => pl.distanceToPoint(p) >= 0);
    const castAll = (dx, dy, list) => {
      ray.setFromCamera(new THREE.Vector2(((cx + dx - rect.left) / rect.width) * 2 - 1, -(((cy + dy - rect.top) / rect.height) * 2 - 1)), camera);
      return ray.intersectObjects(list, false).filter((h) => passes(h.point));
    };
    const visible = pickables.filter(isShown);
    const fine = visible.filter((m) => !COARSE.has(m.userData.layer));
    const coarse = visible.filter((m) => COARSE.has(m.userData.layer));
    const wall = castAll(0, 0, coarse)[0];
    const shown = new Set([...state.sel, ...state.rel, ...(state.work?.keys() ?? [])]);
    for (const [dx, dy] of OFFSETS) {
      // Opak kemiğin arkasındaki görünmeyen yapı seçilmez; vurgulu olanlar görünür olduğu için seçilebilir
      const hit = castAll(dx, dy, fine).find((h) => !boneOpaque || !wall || h.distance < wall.distance || shown.has(h.object.userData.id));
      if (hit) return hit.object.userData.id;
    }
    return wall ? wall.object.userData.id : null;
  }

  let pickCb = null;
  let longCb = null;
  let downAt = null;
  let multi = false;
  let lastTap = null;
  let pressTimer = 0;
  // Uzun basış (iPad) ve sağ tık (masaüstü) yapı menüsünü açar; iki kez dokunma o noktaya yaklaştırır
  const LONG_MS = 550;
  canvas.addEventListener('pointerdown', (e) => {
    clearTimeout(pressTimer);
    if (e.isPrimary) {
      downAt = { x: e.clientX, y: e.clientY, t: performance.now(), long: false };
      multi = false;
      const at = downAt;
      if (e.button === 0) {
        pressTimer = setTimeout(() => {
          if (downAt !== at || multi || !longCb) return;
          at.long = true;
          longCb({ id: pickAt(at.x, at.y), x: at.x, y: at.y });
        }, LONG_MS);
      }
    } else {
      multi = true;
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (downAt && e.isPrimary && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) >= 9) clearTimeout(pressTimer);
  });
  canvas.addEventListener('pointercancel', () => clearTimeout(pressTimer));
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (longCb && e.pointerType !== 'touch') longCb({ id: pickAt(e.clientX, e.clientY), x: e.clientX, y: e.clientY });
  });
  canvas.addEventListener('pointerup', (e) => {
    clearTimeout(pressTimer);
    if (!e.isPrimary || !downAt || multi) return;
    if (downAt.long || e.button !== 0) {
      downAt = null;
      return;
    }
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
    const quick = performance.now() - downAt.t < 450;
    downAt = null;
    if (!(moved < 9 && quick)) return;
    const now = performance.now();
    if (lastTap && now - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) {
      lastTap = null;
      zoomAt(e.clientX, e.clientY);
      return;
    }
    lastTap = { t: now, x: e.clientX, y: e.clientY };
    if (pickCb) pickCb(pickAt(e.clientX, e.clientY));
  });

  // Dokunulan yüzey noktasına yaklaşır ve dönme merkezini oraya taşır
  const zoomRay = new THREE.Raycaster();
  function zoomAt(cx, cy) {
    const rect = canvas.getBoundingClientRect();
    zoomRay.setFromCamera(new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -(((cy - rect.top) / rect.height) * 2 - 1)), camera);
    const planes = renderer.clippingPlanes;
    const hit = zoomRay.intersectObjects(pickables.filter(isShown), false).find((h) => planes.every((pl) => pl.distanceToPoint(h.point) >= 0));
    const target = hit ? hit.point : controls.target.clone();
    const dist = Math.max(controls.minDistance * 2, camera.position.distanceTo(target) * 0.55);
    const dir = camera.position.clone().sub(target).normalize();
    flyTo(target.clone().addScaledVector(dir, dist).toArray(), target.toArray(), { ms: 450 });
  }
  // Düğmeyle yakınlaştırma: hedef aynı kalır
  function zoomBy(f) {
    const dir = camera.position.clone().sub(controls.target);
    const d = THREE.MathUtils.clamp(dir.length() * f, controls.minDistance, controls.maxDistance);
    flyTo(controls.target.clone().addScaledVector(dir.normalize(), d).toArray(), controls.target.toArray(), { ms: 260 });
  }
  // Tek parmak (ve sol fare tuşu): döndür veya kaydır
  function setPanMode(on) {
    controls.touches.ONE = on ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE;
    controls.mouseButtons.LEFT = on ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
  }

  // ---------- Gizleme ve yalnız gösterme ----------
  function setHidden(id, on) {
    if (on) state.hidden.add(id);
    else state.hidden.delete(id);
    applyMaterials();
  }
  function showAll() {
    state.hidden.clear();
    state.solo = null;
    applyMaterials();
  }
  function setSolo(ids) {
    state.solo = ids ? new Set(ids) : null;
    applyMaterials();
  }

  let loaded = false;
  async function load(onProgress) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const total = LOAD_ORDER.reduce((a, f) => a + index.files[f].size, 0);
    let done = 0;
    for (const file of LOAD_ORDER) {
      const url = new URL(`models/${file}.glb`, document.baseURI).href;
      const gltf = await new Promise((res, rej) => {
        loader.load(url, res, (ev) => {
          onProgress({ ratio: Math.min(1, (done + Math.min(ev.loaded, index.files[file].size)) / total), label: FILE_LABEL[file], file });
        }, rej);
      });
      done += index.files[file].size;
      gltf.scene.updateMatrixWorld(true);
      const nodes = [];
      gltf.scene.traverse((o) => { if (o.isMesh) nodes.push(o); });
      for (const m of nodes) {
        const named = m.name.includes('#') ? m : m.parent;
        const [id, side] = named.name.split('#');
        const rec = record(id);
        const needleItem = id.startsWith('x_');
        if (!needleItem && !byId.get(id)) continue;
        scene.attach(m);
        const layer = needleItem ? 'needle' : byId.get(id).layer;
        m.userData = { id, side, layer };
        m.material = mats[layer].base;
        if (COARSE.has(layer)) m.userData.baseOrder = 5;
        rec.meshes.push(m);
        if (!needleItem) pickables.push(m);
      }
      capDirty = true;
      applyMaterials();
      onProgress({ ratio: done / total, label: FILE_LABEL[file], file, finished: true });
    }
    orientForamina();
    loaded = true;
  }

  for (const m of pickables) m.userData.layer = byId.get(m.userData.id).layer;
  applyMaterials();

  // Delik halkası, delikten geçen sinir ve damarların o noktadaki ortak yönüne dik durur (yerel noktaların ana ekseni)
  function orientForamina() {
    const z = new THREE.Vector3(0, 0, 1);
    const p = new THREE.Vector3();
    for (const rec of records.values()) {
      if (rec.layer !== 'foramen') continue;
      const st = byId.get(rec.id);
      const via = [...new Set([...(st.through ?? []), ...(st.rel ?? [])].flatMap((x) => String(x).match(/\b[a-z]{1,3}_[a-z0-9_]+\b/g) ?? []))]
        .filter((x) => ['nerve', 'artery', 'vein'].includes(byId.get(x)?.layer) && records.has(x));
      for (const mesh of rec.meshes) {
        const c = mesh.position;
        const r = Math.max(6, mesh.scale.x * 3);
        const pts = [];
        for (const id of via) {
          for (const m of records.get(id).meshes) {
            const s = m.userData.side;
            if (s && s !== 'M' && mesh.userData.side !== 'M' && s !== mesh.userData.side) continue;
            const a = m.geometry.attributes.position;
            m.updateWorldMatrix(true, false);
            for (let i = 0; i < a.count; i += 2) {
              p.fromBufferAttribute(a, i).applyMatrix4(m.matrixWorld);
              if (p.distanceToSquared(c) < r * r) pts.push(p.clone());
            }
          }
        }
        mesh.userData.axisPts = pts.length;
        if (pts.length < 12) continue;
        const mean = pts.reduce((s, q) => s.add(q), new THREE.Vector3()).multiplyScalar(1 / pts.length);
        // Kovaryansın ana öz vektörü (kuvvet yöntemi)
        const cov = [0, 0, 0, 0, 0, 0];
        for (const q of pts) {
          const dx = q.x - mean.x;
          const dy = q.y - mean.y;
          const dz = q.z - mean.z;
          cov[0] += dx * dx; cov[1] += dx * dy; cov[2] += dx * dz; cov[3] += dy * dy; cov[4] += dy * dz; cov[5] += dz * dz;
        }
        const v = new THREE.Vector3(1, 0.7, 0.4);
        for (let k = 0; k < 24; k++) {
          v.set(cov[0] * v.x + cov[1] * v.y + cov[2] * v.z, cov[1] * v.x + cov[3] * v.y + cov[4] * v.z, cov[2] * v.x + cov[4] * v.y + cov[5] * v.z).normalize();
        }
        mesh.quaternion.setFromUnitVectors(z, v);
        mesh.userData.axis = v.toArray();
      }
    }
    invalidate();
  }

  // ---------- Delik adları ----------
  // Yalnız kameradan görünen deliklerin adı gösterilir; görünürlük kamera durunca ışınla denetlenir
  let holeLabels = null;
  let holeTimer = 0;
  const holeRay = new THREE.Raycaster();
  const holeP = new THREE.Vector3();
  function setHoleLabels(on) {
    holeLabels?.forEach((l) => l.el.remove());
    holeLabels = null;
    if (on) {
      holeLabels = [];
      for (const rec of records.values()) {
        if (rec.layer !== 'foramen') continue;
        for (const mesh of rec.meshes) {
          const el = document.createElement('button');
          el.className = 'hole-label';
          el.textContent = byId.get(rec.id).name;
          el.dataset.goto = rec.id;
          labelsEl.append(el);
          holeLabels.push({ el, mesh, open: false });
        }
      }
      checkHoles();
    }
    invalidate();
  }
  function checkHoles() {
    if (!holeLabels) return;
    const walls = pickables.filter((m) => isShown(m) && (m.userData.layer === 'bone' || m.userData.layer === 'cartilage'));
    const planes = renderer.clippingPlanes;
    for (const l of holeLabels) {
      const c = l.mesh.getWorldPosition(new THREE.Vector3());
      const d = c.clone().sub(camera.position);
      const len = d.length();
      holeRay.set(camera.position, d.normalize());
      holeRay.far = Math.max(0.01, len - Math.max(2, l.mesh.scale.x * 1.6));
      l.open = isShown(l.mesh) && planes.every((pl) => pl.distanceToPoint(c) >= 0)
        && !holeRay.intersectObjects(walls, false).some((h) => planes.every((pl) => pl.distanceToPoint(h.point) >= 0));
    }
    placeHoles();
  }
  function placeHoles() {
    if (!holeLabels) return;
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    const boxes = [];
    for (const l of holeLabels) {
      holeP.copy(l.mesh.getWorldPosition(new THREE.Vector3())).project(camera);
      const x = (holeP.x * 0.5 + 0.5) * w;
      const y = (-holeP.y * 0.5 + 0.5) * h;
      const bw = l.el.offsetWidth || 80;
      const box = [x + 8, y - 12, x + 8 + bw, y + 12];
      // Üst üste binen etiket gösterilmez
      const ok = l.open && holeP.z < 1 && x > 0 && x < w - 20 && y > 100 && y < h - 60 && !boxes.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1]);
      if (ok) boxes.push(box);
      l.el.style.visibility = ok ? 'visible' : 'hidden';
      l.el.style.transform = `translate(${box[0]}px, ${box[1]}px)`;
    }
  }

  // Çene hareketi: çalışan yapılar (id -> taraf kümesi veya null) ve çapa dönüşümü
  function setWorking(map) {
    state.work = map;
    applyMaterials();
  }

  return {
    load, highlight, focusOn, setLayer, setClip, setView, home, invalidate, setBoneOpacity, frameSection,
    setHidden, showAll, setSolo, zoomBy, zoomAt, setPanMode, setHoleLabels,
    get hidden() { return [...state.hidden]; },
    get solo() { return state.solo ? [...state.solo] : null; },
    onLongPress: (cb) => { longCb = cb; },
    setColorMode, setQuizView, pointVisible, firstHitId, flyTo, setWorking,
    setAnchorPose: (fn) => { anchorPose = fn; },
    capsChanged: () => { capDirty = true; invalidate(); },
    root: scene,
    get colorMode() { return colorMode; },
    get loaded() { return loaded; },
    get capParts() { return capParts; },
    onPick: (cb) => { pickCb = cb; },
    onFrame: (cb) => frameListeners.add(cb),
    pickAt,
    project(id) {
      const a = anchorOf(id);
      if (!a) return null;
      const p = new THREE.Vector3(...(a.a ?? a.c)).project(camera);
      const r = canvas.getBoundingClientRect();
      return { x: r.left + (p.x * 0.5 + 0.5) * r.width, y: r.top + (-p.y * 0.5 + 0.5) * r.height };
    },
    // Dünya noktasının sahne içi konumu (px); front false ise kameranın arkasındadır
    projectPoint(p) {
      v.set(...p).project(camera);
      return { x: (v.x * 0.5 + 0.5) * stage.clientWidth, y: (-v.y * 0.5 + 0.5) * stage.clientHeight, front: v.z < 1 };
    },
    get frames() { return frames; },
    get tweening() { return !!tween; },
    records,
    camera,
    controls,
    layerOn,
    renderer,
  };
}
