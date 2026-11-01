import { bakeMesh, meshIndex } from './scene.js';

// 3B modelden şematik kesit: üçgen-düzlem kesişimi, even-odd dolgu. Gerçek görüntü verisi kullanılmaz.
const TONE = {
  muscle: { fill: '#6e6e6e', line: '#808080' },
  joint: { fill: '#8c8c8c', line: '#9c9c9c' },
  bone: { fill: '#c9c9c9', line: '#ececec' },
  tooth: { fill: '#ffffff', line: '#ffffff' },
};
const PULP = '#4a4a4a';
const SOLID_ORDER =['muscle', 'joint', 'bone', 'tooth'];
const THIN = { vein: '#5b8dee', artery: '#ef5350', nerve: '#f5d04e' };
const AXIS_NAME = { x: 'Sagittal', y: 'Aksiyel', z: 'Koronal' };
// Radyolojik yerleşim: koronal ve aksiyelde hastanın sağı görüntünün solunda, sagittalde ön solda
const LAYOUT = {
  z: { u: 0, us: 1, v: 1, tl: 'Sağ', tr: 'Sol', tt: 'Üst', tb: 'Alt' },
  y: { u: 0, us: 1, v: 2, tl: 'Sağ', tr: 'Sol', tt: 'Ön', tb: 'Arka' },
  x: { u: 2, us: -1, v: 1, tl: 'Ön', tr: 'Arka', tt: 'Üst', tb: 'Alt' },
};
const AXIS_INDEX = { x: 0, y: 1, z: 2 };
const MIN_GAP = 80;

export function createSection({ scene, panel, canvas, title, zoomBtn, stage, chips, tools, clipPanel, motionPanel }) {
  const ctx = canvas.getContext('2d');
  const cache = new Map();
  let axis = null;
  let value = 0;
  let roi = null;
  let zoomed = false;
  let timer = 0;
  let raf = 0;
  let lastDraw = -1e9;
  let cost = 0;
  const stats = { ms: 0, loops: 0, thin: 0, axis: null, value: null, draws: 0 };

  function boxOf(p) {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < p.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        if (p[i + k] < min[k]) min[k] = p[i + k];
        if (p[i + k] > max[k]) max[k] = p[i + k];
      }
    }
    return { min, max };
  }

  // Mesh verisi önbellekte: yalnız dönüşümü değişirse yeniden hesaplanır
  function entry(mesh, layer) {
    mesh.updateWorldMatrix(true, false);
    const e = mesh.matrixWorld.elements;
    let c = cache.get(mesh);
    // Gerdirilen kasta dönüşüm aynı kalır, köşeler değişir: sürüm de karşılaştırılır
    const ver = mesh.userData.softVer ?? 0;
    if (c && c.ver === ver && c.elements.every((v, i) => v === e[i])) return c;
    if (!c) {
      c = { mesh, layer, pos: null, idx: meshIndex(mesh), elements: new Float64Array(16), min: [0, 0, 0], max: [0, 0, 0] };
      cache.set(mesh, c);
    }
    c.pos = bakeMesh(mesh, c.pos ?? undefined);
    c.elements.set(e);
    c.ver = ver;
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < c.pos.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        const p = c.pos[i + k];
        if (p < min[k]) min[k] = p;
        if (p > max[k]) max[k] = p;
      }
    }
    c.min = min;
    c.max = max;
    // Görüntü çerçevesi dinlenme konumundan alınır: çene oynarken ölçek zıplamasın
    if (!c.frameMin) {
      const rest = mesh.userData.restWorld;
      const b = rest ? boxOf(bakeMesh(mesh, undefined, rest)) : { min, max };
      c.frameMin = b.min;
      c.frameMax = b.max;
    }
    return c;
  }

  function collect() {
    const out = [];
    for (const rec of scene.records.values()) {
      if (!TONE[rec.layer] && !THIN[rec.layer]) continue;
      for (const mesh of rec.meshes) out.push(entry(mesh, rec.layer));
    }
    return out;
  }

  // Düzlemle kesişen üçgen kenarlarından kapalı konturlar. Aynı kenar iki üçgende aynı noktayı verir.
  function contours(c, ai, val, uI, vI) {
    const { pos, idx } = c;
    const nodes = new Map();
    const node = (u, v) => {
      const key = Math.round(u * 128 + 131072) + Math.round(v * 128 + 131072) * 262144;
      let n = nodes.get(key);
      if (!n) {
        n = { u, v, links: [] };
        nodes.set(key, n);
      }
      return n;
    };
    const cross = (a, b, da, db) => {
      // Her zaman negatif taraftan pozitife: iki yönden de aynı sonuç
      const [p, q, dp, dq] = da < db ? [a, b, da, db] : [b, a, db, da];
      const t = -dp / (dq - dp);
      return node(pos[3 * p + uI] + (pos[3 * q + uI] - pos[3 * p + uI]) * t, pos[3 * p + vI] + (pos[3 * q + vI] - pos[3 * p + vI]) * t);
    };
    for (let t = 0, n = idx.length; t < n; t += 3) {
      const a = idx[t];
      const b = idx[t + 1];
      const e = idx[t + 2];
      const da = pos[3 * a + ai] - val;
      const db = pos[3 * b + ai] - val;
      const de = pos[3 * e + ai] - val;
      const sa = da >= 0;
      const sb = db >= 0;
      const se = de >= 0;
      if (sa === sb && sb === se) continue;
      let p;
      let q;
      if (sa !== sb && sa !== se) { p = cross(a, b, da, db); q = cross(a, e, da, de); }
      else if (sb !== sa && sb !== se) { p = cross(b, a, db, da); q = cross(b, e, db, de); }
      else { p = cross(e, a, de, da); q = cross(e, b, de, db); }
      if (p === q) continue;
      p.links.push(q);
      q.links.push(p);
    }
    const loops = [];
    for (const start of nodes.values()) {
      if (start.seen || !start.links.length) continue;
      const loop = [];
      let cur = start;
      while (cur && !cur.seen) {
        cur.seen = true;
        loop.push(cur);
        cur = cur.links.find((l) => !l.seen);
      }
      if (loop.length > 2) loops.push(loop);
    }
    return loops;
  }

  function frame(list, lay) {
    const uI = lay.u;
    const vI = lay.v;
    if (zoomed && roi) return { cu: roi.center[uI], cv: roi.center[vI], hu: roi.half, hv: roi.half };
    let u0 = Infinity;
    let u1 = -Infinity;
    let v0 = Infinity;
    let v1 = -Infinity;
    for (const c of list) {
      if (c.layer !== 'bone') continue;
      u0 = Math.min(u0, c.frameMin[uI]);
      u1 = Math.max(u1, c.frameMax[uI]);
      v0 = Math.min(v0, c.frameMin[vI]);
      v1 = Math.max(v1, c.frameMax[vI]);
    }
    if (!Number.isFinite(u0)) return { cu: 0, cv: 0, hu: 110, hv: 110 };
    return { cu: (u0 + u1) / 2, cv: (v0 + v1) / 2, hu: (u1 - u0) / 2 + 4, hv: (v1 - v0) / 2 + 4 };
  }

  function message(w, h, text) {
    ctx.fillStyle = '#9dacba';
    ctx.font = '13px -apple-system, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2);
  }

  function draw() {
    const t0 = performance.now();
    stats.draws++;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const bw = Math.round(w * dpr);
    const bh = Math.round(h * dpr);
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    zoomBtn.hidden = !roi;
    zoomBtn.setAttribute('aria-pressed', String(zoomed));
    if (!axis) {
      title.textContent = 'Kesit görüntüsü';
      message(w, h, 'Önce bir kesit düzlemi açın');
      stats.axis = null;
      stats.value = null;
      stats.loops = 0;
      stats.thin = 0;
      return;
    }
    title.textContent = `${AXIS_NAME[axis]} ${axis} = ${Math.round(value)} mm`;
    const lay = LAYOUT[axis];
    const ai = AXIS_INDEX[axis];
    const list = collect();
    const f = frame(list, lay);
    const s = Math.min(w / (2 * f.hu), h / (2 * f.hv));
    const X = (u) => w / 2 + lay.us * (u - f.cu) * s;
    const Y = (v) => h / 2 - (v - f.cv) * s;
    let nLoops = 0;
    let nThin = 0;
    const active = list.filter((c) => c.min[ai] <= value && c.max[ai] >= value);
    const trace = (path, loop) => {
      path.moveTo(X(loop[0].u), Y(loop[0].v));
      for (let i = 1; i < loop.length; i++) path.lineTo(X(loop[i].u), Y(loop[i].v));
      path.closePath();
    };
    ctx.lineJoin = 'round';
    for (const layer of SOLID_ORDER) {
      ctx.fillStyle = TONE[layer].fill;
      ctx.strokeStyle = TONE[layer].line;
      ctx.lineWidth = 0.8;
      for (const c of active) {
        if (c.layer !== layer) continue;
        const loops = contours(c, ai, value, lay.u, lay.v);
        if (!loops.length) continue;
        const path = new Path2D();
        loops.forEach((l) => trace(path, l));
        // Diş içindeki pulpa odası hava gibi siyah görünmesin
        if (layer === 'tooth' && loops.length > 1) {
          ctx.fillStyle = PULP;
          for (const l of loops) {
            const outer = new Path2D();
            trace(outer, l);
            ctx.fill(outer);
          }
          ctx.fillStyle = TONE.tooth.fill;
        }
        ctx.fill(path, 'evenodd');
        ctx.stroke(path);
        nLoops += loops.length;
      }
    }
    // Damar ve sinirler: küçük kesitleri de görünsün diye en az 2 px yarıçaplı nokta
    for (const layer of Object.keys(THIN)) {
      ctx.fillStyle = THIN[layer];
      for (const c of active) {
        if (c.layer !== layer) continue;
        for (const loop of contours(c, ai, value, lay.u, lay.v)) {
          let su = 0;
          let sv = 0;
          for (const n of loop) { su += n.u; sv += n.v; }
          ctx.beginPath();
          ctx.arc(X(su / loop.length), Y(sv / loop.length), 2.2, 0, Math.PI * 2);
          ctx.fill();
          nThin++;
        }
      }
    }
    // Yön harfleri ve 1 cm ölçek çizgisi
    ctx.font = '600 11px -apple-system, "Segoe UI", sans-serif';
    ctx.fillStyle = '#6cc4e8';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(lay.tl, 4, h / 2);
    ctx.textAlign = 'right';
    ctx.fillText(lay.tr, w - 4, h / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(lay.tt, w / 2, 3);
    ctx.textBaseline = 'bottom';
    ctx.fillText(lay.tb, w / 2, h - 3);
    const cm = 10 * s;
    ctx.strokeStyle = '#e8edf2';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(w - 6 - cm, h - 8);
    ctx.lineTo(w - 6, h - 8);
    ctx.stroke();
    ctx.fillStyle = '#e8edf2';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('1 cm', w - 6, h - 10);

    stats.ms = +(performance.now() - t0).toFixed(1);
    stats.loops = nLoops;
    stats.thin = nThin;
    stats.axis = axis;
    stats.value = value;
    cost = stats.ms;
  }

  // Kaydırıcı hareketinde çizimi seyrekleştirir; son konum her zaman çizilir
  function request(immediate = false) {
    if (panel.hidden || raf) return;
    if (timer) {
      if (!immediate) return;
      clearTimeout(timer);
      timer = 0;
    }
    const gap = Math.max(MIN_GAP, cost * 3);
    const wait = immediate ? 0 : Math.max(0, lastDraw + gap - performance.now());
    timer = setTimeout(() => {
      timer = 0;
      raf = requestAnimationFrame(() => {
        raf = 0;
        lastDraw = performance.now();
        draw();
      });
    }, wait);
  }

  // Panel yerleşimi: üstte çipler, altta araçlar, solda kesit paneli; hangisi daha büyük görüntü veriyorsa o seçilir
  function layout() {
    if (panel.hidden) return;
    const W = stage.clientWidth;
    const H = stage.clientHeight;
    const top = chips.offsetTop + chips.offsetHeight + 8;
    const bottom = tools.offsetTop - 8;
    panel.style.maxHeight = 'none';
    const headH = panel.offsetHeight - canvas.offsetHeight;
    const M = 8;
    let box = { w: W - 2 * M, h: bottom - top };
    // Kesit ve çene panelleri aynı anda açık olmaz
    const dock = !clipPanel.hidden ? clipPanel : !motionPanel.hidden ? motionPanel : null;
    if (dock) {
      const cw = dock.offsetWidth;
      const side = { w: W - cw - 3 * M, h: bottom - top };
      const stack = { w: W - 2 * M, h: dock.offsetTop - M - top };
      const size = (b) => Math.min(b.w - 2, b.h - headH);
      box = size(side) >= size(stack) ? side : stack;
    }
    const sidePx = Math.floor(Math.max(120, Math.min(480, box.w - 2, box.h - headH)));
    panel.style.top = `${top}px`;
    panel.style.width = `${sidePx + 2}px`;
    canvas.style.height = `${sidePx}px`;
    panel.style.maxHeight = `${Math.max(0, H - top - M)}px`;
    request(true);
  }
  new ResizeObserver(layout).observe(stage);
  new ResizeObserver(layout).observe(chips);

  zoomBtn.addEventListener('click', () => {
    zoomed = !zoomed;
    request(true);
  });

  return {
    // Etkin düzlem: axis null ise kesit yok
    setPlane(a, v) {
      axis = a;
      value = v;
      request();
    },
    setRoi(r) {
      roi = r;
      zoomed = !!r;
      request(true);
    },
    show(on) {
      panel.hidden = !on;
      if (on) layout();
    },
    layout,
    // Çene hareketi: dönüşüm değişti, seyrekleştirilmiş yeniden çizim
    refresh: () => request(),
    get open() { return !panel.hidden; },
    get zoomed() { return zoomed; },
    stats,
  };
}
