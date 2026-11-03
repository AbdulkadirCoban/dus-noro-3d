import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const shot = (page, testInfo, name) => {
  fs.mkdirSync('tests/screens', { recursive: true });
  return page.screenshot({ path: `tests/screens/${testInfo.project.name}-${name}.png` });
};

function watchErrors(page) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('requestfailed', (r) => errors.push(`istek: ${r.url()}`));
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()}: ${r.url()}`); });
  return errors;
}

async function open(page) {
  await page.goto('./');
  await page.waitForFunction(() => window.__app?.ready, null, { timeout: 90_000 });
}

const portrait = (page) => page.viewportSize().height > page.viewportSize().width;

async function settle(page) {
  await page.waitForFunction(() => !window.__app.scene.tweening);
  await page.waitForTimeout(250);
}

test('açılış: hata yok, tüm katmanlar yüklü, yollar alt dizinde', async ({ page }, info) => {
  const errors = watchErrors(page);
  await open(page);
  expect(page.url()).toContain('/dus-noro-3d/');
  await expect(page.locator('#loader')).toBeHidden();
  const missing = await page.evaluate(() => window.__app.items.filter((s) => s.layer !== 'block' && !(window.__app.scene.records.get(s.id)?.meshes.length)).map((s) => s.id));
  expect(missing).toEqual([]);
  await settle(page);
  await shot(page, info, '01-acilis');
  expect(errors).toEqual([]);
});

test('her yapı: listeden dokununca odak, etiket ve panel çalışır', async ({ page }) => {
  // Yapı sayısıyla büyür; yazılımsal WebGL'de yapı başına birkaç saniye sürebilir
  test.setTimeout(1_800_000);
  const errors = watchErrors(page);
  await open(page);
  const ids = await page.evaluate(() => window.__app.items.map((s) => s.id));
  const isP = portrait(page);
  const fails = [];
  for (const id of ids) {
    if (isP) await page.locator('#btn-list').tap();
    await page.evaluate(() => document.querySelectorAll('#list details').forEach((d) => { d.open = true; }));
    const before = await page.evaluate(() => window.__app.scene.controls.target.toArray().join());
    const row = page.locator(`.item[data-id="${id}"]`);
    await row.scrollIntoViewIfNeeded();
    await row.tap();
    const name = await page.evaluate((i) => window.__app.byId.get(i).name, id);
    const title = await page.locator('#detail h2').textContent();
    const label = await page.locator('.label.main').count();
    await page.waitForFunction(() => !window.__app.scene.tweening);
    const after = await page.evaluate(() => window.__app.scene.controls.target.toArray().join());
    if (title !== name) fails.push(`${id}: başlık ${title}`);
    if (label !== 1) fails.push(`${id}: etiket ${label}`);
    if (before === after && id !== ids[0]) fails.push(`${id}: odak değişmedi`);
    for (const tab of ['through', 'spot', 'clinic', 'route']) {
      const n = await page.locator(`.dtabs [data-tab="${tab}"]`).count();
      if (n !== 1) fails.push(`${id}: sekme ${tab} yok`);
    }
  }
  expect(fails).toEqual([]);
  expect(errors).toEqual([]);
});

test('sahneye dokunarak seçim, kesit, istirahatte çizim durur', async ({ page }, info) => {
  await open(page);
  await page.evaluate(() => window.__app.select('n_v3', { instant: true }));
  await settle(page);
  await shot(page, info, '02-v3');
  await page.evaluate(() => window.__app.select('n_ii', { instant: true }));
  await settle(page);
  const p = await page.evaluate(() => window.__app.scene.project('n_ii'));
  await page.touchscreen.tap(p.x, p.y);
  await settle(page);
  expect(await page.evaluate(() => window.__app.current)).toBeTruthy();

  // Hareketsizken çizim durur
  const f0 = await page.evaluate(() => window.__app.scene.frames);
  await page.waitForTimeout(1200);
  const f1 = await page.evaluate(() => window.__app.scene.frames);
  expect(f1 - f0).toBeLessThanOrEqual(1);

  // Kesit kaydırıcıları düzlem ekler ve kaldırır
  await page.locator('#btn-clip').tap();
  await page.locator('#clip-y').evaluate((el) => { el.value = 10; el.dispatchEvent(new Event('input')); });
  expect(await page.evaluate(() => window.__app.scene.renderer.clippingPlanes.length)).toBe(1);
  await page.locator('#clip-x').evaluate((el) => { el.value = -5; el.dispatchEvent(new Event('input')); });
  await page.locator('#clip-z').evaluate((el) => { el.value = 20; el.dispatchEvent(new Event('input')); });
  expect(await page.evaluate(() => window.__app.scene.renderer.clippingPlanes.length)).toBe(3);
  await settle(page);
  await shot(page, info, '03-kesit');
  await page.locator('#clip-reset').tap();
  expect(await page.evaluate(() => window.__app.scene.renderer.clippingPlanes.length)).toBe(0);
});

// Kesit yüzeyi düz renkli çizilir: tam renk eşleşmesi sayılır. WebKit ekran görüntüsüne güvenilmediği için gl.readPixels kullanılır
const capPixels = (page) => page.evaluate(() => new Promise((res) => {
  const s = window.__app.scene;
  let done = false;
  s.onFrame(() => {
    if (done) return;
    done = true;
    const gl = s.renderer.getContext();
    const c = s.renderer.domElement;
    const buf = new Uint8Array(4 * c.width * c.height);
    gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    const near = (i, r, g, b) => Math.abs(buf[i] - r) < 3 && Math.abs(buf[i + 1] - g) < 3 && Math.abs(buf[i + 2] - b) < 3;
    const n = { bone: 0, tooth: 0, muscle: 0 };
    for (let i = 0; i < buf.length; i += 4) {
      if (near(i, 0xe8, 0xd8, 0xb0)) n.bone++;
      else if (near(i, 255, 255, 255)) n.tooth++;
      else if (near(i, 0xb5, 0x34, 0x2a)) n.muscle++;
    }
    res(n);
  });
  s.invalidate();
}));
const slide = (page, axis, v) => page.locator(`#clip-${axis}`).evaluate((el, val) => { el.value = val; el.dispatchEvent(new Event('input')); }, v);
const sectionReady = (page, axis, value) => page.waitForFunction(([a, v]) => {
  const st = window.__app.section.stats;
  return st.axis === a && st.value === v;
}, [axis, value]);

test('kesit yüzeyi: kemik, diş ve kas dolu ve kendi renginde çizilir, saydam kemikte kapanır', async ({ page }, info) => {
  const errors = watchErrors(page);
  await open(page);
  await page.evaluate(() => window.__app.scene.setView('front'));
  await settle(page);
  const base = await capPixels(page);

  await page.locator('#btn-clip').tap();
  await slide(page, 'z', 54);
  await settle(page);
  const cut = await capPixels(page);
  expect(cut.bone).toBeGreaterThan(base.bone + 3000);
  expect(cut.tooth).toBeGreaterThan(base.tooth + 300);
  await shot(page, info, '09-cap');

  await page.locator('#chips [data-layer="muscle"]').tap();
  await settle(page);
  const withMuscle = await capPixels(page);
  expect(withMuscle.muscle).toBeGreaterThan(300);

  // Üç düzlem birlikte: yüzey diğer düzlemlerce de kırpılır, yine çizilir
  await slide(page, 'x', 0);
  await slide(page, 'y', 10);
  await settle(page);
  expect((await capPixels(page)).bone).toBeGreaterThan(1000);
  await slide(page, 'x', 80);
  await slide(page, 'y', 120);

  // Hareketsizken kesit açıkken de çizim durur
  await settle(page);
  const f0 = await page.evaluate(() => window.__app.scene.frames);
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => window.__app.scene.frames) - f0).toBeLessThanOrEqual(1);

  await page.locator('#bone-range').evaluate((el) => { el.value = 70; el.dispatchEvent(new Event('input')); });
  await settle(page);
  const glass = await capPixels(page);
  expect(glass.bone).toBeLessThan(cut.bone / 4);
  expect(glass.tooth).toBeGreaterThan(300);
  await page.evaluate(() => localStorage.clear());
  expect(errors).toEqual([]);
});

test('kesit düğmeleri: eksen aç/kapa, hazır kesitler geo_index konumundan türer', async ({ page }, info) => {
  const errors = watchErrors(page);
  await open(page);
  await page.locator('#btn-clip').tap();
  const planes = () => page.evaluate(() => window.__app.scene.renderer.clippingPlanes.map((p) => ({ n: p.normal.toArray().map(Math.abs), c: p.constant })));
  for (const axis of ['x', 'y', 'z']) {
    const b = page.locator(`.axis-btn[data-axis="${axis}"]`);
    await expect(b.locator('svg .cut')).toHaveCount(1);
    await b.tap();
    await expect(b).toHaveAttribute('aria-pressed', 'true');
    expect((await planes()).length).toBe(1);
    await b.tap();
    await expect(b).toHaveAttribute('aria-pressed', 'false');
    expect((await planes()).length).toBe(0);
  }
  const geo = JSON.parse(fs.readFileSync('data/geo_index.json', 'utf8')).items;
  const R = (id) => (geo[id].sides.find((s) => s.tag === 'R') ?? geo[id].sides[0]).c;
  const incisive = R('f_incisive');
  const expected = {
    mandibular: { ax: 2, v: R('t_46')[2] },
    sinus: { ax: 2, v: R('t_16')[2] },
    tme: { ax: 0, v: R('j_disc')[0] },
    palate: { ax: 1, v: incisive[1] + 7 },
  };
  for (const [key, e] of Object.entries(expected)) {
    await page.locator(`[data-preset="${key}"]`).tap();
    await expect(page.locator(`[data-preset="${key}"]`)).toHaveAttribute('aria-pressed', 'true');
    await settle(page);
    const ps = await planes();
    expect(ps.length).toBe(1);
    expect(ps[0].n[e.ax]).toBe(1);
    expect(Math.abs(ps[0].c - e.v)).toBeLessThanOrEqual(1);
    const px = await capPixels(page);
    expect(px.bone).toBeGreaterThan(1000);
    await shot(page, info, `10-hazir-${key}`);
  }
  await page.locator('#clip-reset').tap();
  expect((await planes()).length).toBe(0);
  await expect(page.locator('.axis-btn[aria-pressed="true"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('kesit görüntüsü: not görünür, panel taşmaz, çizim seyrek, doğru tonlar', async ({ page }, info) => {
  const errors = watchErrors(page);
  await open(page);
  await page.locator('#btn-clip').tap();
  await page.locator('#btn-section').tap();
  const note = page.locator('#section-note');
  await expect(note).toHaveText('3B modelden üretilmiş şematik kesit, gerçek BT değildir');
  await expect(page.locator('#section-title')).toHaveText('Kesit görüntüsü');

  const canvasStats = () => page.evaluate(() => {
    const c = document.querySelector('#section-canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const n = { total: d.length / 4, white: 0, grey: 0, black: 0, nerve: 0 };
    for (let i = 0; i < d.length; i += 4) {
      const [r, g, b] = [d[i], d[i + 1], d[i + 2]];
      if (r === 255 && g === 255 && b === 255) n.white++;
      else if (r === g && g === b && r > 60 && r < 240) n.grey++;
      else if (r === 0 && g === 0 && b === 0) n.black++;
      else if (r > 230 && g > 190 && b < 100) n.nerve++;
    }
    return n;
  });
  const rect = (sel) => page.locator(sel).evaluate((el) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; });
  const overlaps = (a, b) => a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;

  for (const key of ['mandibular', 'tme']) {
    await page.locator(`[data-preset="${key}"]`).tap();
    await settle(page);
    await page.waitForFunction(() => window.__app.section.stats.loops > 5);
    await page.waitForTimeout(250);
    const n = await canvasStats();
    expect(n.white + n.grey).toBeGreaterThan(n.total * 0.03);
    expect(n.black).toBeGreaterThan(n.total * 0.03);
    if (key === 'mandibular') {
      expect(n.white).toBeGreaterThan(50);
      expect(n.nerve).toBeGreaterThan(3);
    }
    const st = await rect('#stage');
    const pn = await rect('#section-panel');
    const nt = await rect('#section-note');
    await expect(note).toBeVisible();
    expect(nt.t).toBeGreaterThanOrEqual(pn.t);
    expect(nt.b).toBeLessThanOrEqual(await rect('#section-canvas').then((c) => c.t + 0.5));
    expect(pn.l).toBeGreaterThanOrEqual(st.l);
    expect(pn.r).toBeLessThanOrEqual(st.r);
    expect(pn.t).toBeGreaterThanOrEqual(st.t);
    expect(pn.b).toBeLessThanOrEqual(st.b);
    expect(pn.w).toBeGreaterThan(150);
    for (const other of ['#chips', '#stage-tools', '#clip-panel']) expect(overlaps(pn, await rect(other))).toBe(false);
    expect(overlaps(await rect('#clip-panel'), await rect('#stage-tools'))).toBe(false);
    expect(overlaps(await rect('#clip-panel'), await rect('#chips'))).toBe(false);
    await shot(page, info, `11-panel-${key}`);
  }

  // Dokunma hedefleri: yeni düğmeler dahil
  const small = await page.evaluate(() => [...document.querySelectorAll('#clip-panel button, #clip-panel input, #section-panel button')]
    .filter((e) => e.offsetParent !== null)
    .map((e) => { const r = e.getBoundingClientRect(); return { t: e.textContent.trim().slice(0, 30) || e.id, w: r.width, h: r.height }; })
    .filter((r) => r.h < 43.5 || r.w < 43.5));
  expect(small).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);

  // Yakın / genel
  const zoomed = () => page.evaluate(() => window.__app.section.zoomed);
  expect(await zoomed()).toBe(true);
  await page.locator('#section-zoom').tap();
  expect(await zoomed()).toBe(false);

  // Kaydırıcı seli: çizim sayısı olay sayısından çok az, son konum yine çizilir
  await page.waitForTimeout(200);
  const before = await page.evaluate(() => window.__app.section.stats.draws);
  await page.evaluate(() => {
    const el = document.querySelector('#clip-z');
    for (let v = 80; v > 0; v--) {
      el.value = v;
      el.dispatchEvent(new Event('input'));
    }
    el.value = 20;
    el.dispatchEvent(new Event('input'));
  });
  await sectionReady(page, 'z', 20);
  const after = await page.evaluate(() => window.__app.section.stats);
  expect(after.draws - before).toBeLessThanOrEqual(2);
  expect(after.ms).toBeLessThan(400);

  // Olaylar zamana yayılınca da çizim aralığı en az 80 ms'dir (yazılımsal WebGL'de döngü yavaşlayabilir)
  const paced = await page.evaluate(async () => {
    const s = window.__app.section.stats;
    const el = document.querySelector('#clip-z');
    const d0 = s.draws;
    const t0 = performance.now();
    for (let v = 60; v > 0; v--) {
      el.value = v;
      el.dispatchEvent(new Event('input'));
      await new Promise((r) => setTimeout(r, 5));
    }
    return { draws: s.draws - d0, ms: performance.now() - t0 };
  });
  expect(paced.draws).toBeLessThanOrEqual(paced.ms / 80 + 2);

  // Kesit kaldırılınca panel açık kalır, düzlem iste uyarısı gösterilir; kapat düğmesi çalışır
  await page.locator('#clip-reset').tap();
  await page.waitForFunction(() => window.__app.section.stats.axis === null);
  await expect(note).toBeVisible();
  await page.locator('#section-close').tap();
  await expect(page.locator('#section-panel')).toBeHidden();
  await expect(page.locator('#btn-section')).toHaveAttribute('aria-expanded', 'false');
  expect(errors).toEqual([]);
});

test('kemik opak başlar, kaydırıcı saydamlaştırır, GL gerçekten çizer', async ({ page, browserName }, info) => {
  await open(page);
  const glPixels = () => page.evaluate(() => new Promise((res) => {
    const s = window.__app.scene;
    const c = s.renderer.domElement;
    s.onFrame(() => {
      const gl = s.renderer.getContext();
      const buf = new Uint8Array(4 * 100 * 100);
      gl.readPixels((c.width / 2 - 50) | 0, (c.height / 2 - 50) | 0, 100, 100, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      let n = 0;
      for (let i = 3; i < buf.length; i += 4) if (buf[i] > 0) n++;
      res(n);
    });
    s.invalidate();
  }));
  const mat = () => page.evaluate(() => {
    const m = window.__app.scene.records.get('b_sphenoid').meshes[0].material;
    return { opacity: m.opacity, transparent: m.transparent };
  });
  expect(await mat()).toEqual({ opacity: 1, transparent: false });
  expect(await glPixels()).toBeGreaterThan(5000);

  // Seçili sinir opak kemiğe rağmen vurgulu çizilir
  await page.evaluate(() => window.__app.select('n_v2', { instant: true }));
  await settle(page);
  const rec = await page.evaluate(() => window.__app.scene.records.get('n_v2').meshes.map((m) => m.renderOrder));
  expect(Math.min(...rec)).toBe(10);
  await shot(page, info, '08-opak-v2');

  await page.locator('#bone-range').evaluate((el) => { el.value = 70; el.dispatchEvent(new Event('input')); });
  const m2 = await mat();
  expect(m2.transparent).toBe(true);
  await page.reload();
  await page.waitForFunction(() => window.__app?.ready);
  expect(await page.locator('#bone-range').inputValue()).toBe('70');
  await page.evaluate(() => localStorage.clear());

  // Görünüm değişince ekrana yansıyan piksel: Windows WebKit'in yeniden boyutlandırma hatası nedeniyle yalnızca Chromium'da
  expect(await glPixels()).toBeGreaterThan(5000);
  if (browserName === 'chromium') {
    const { PNG } = await import('./png.mjs');
    await page.locator('#tabs [data-view="quiz"]').tap();
    await page.locator('[data-mode="identify"]').tap();
    await settle(page);
    expect(PNG(await page.locator('#stage').screenshot())).toBeGreaterThan(0.05);
  }
});

test('15 ve 25 tek köklü, 14 ve 16 kök sayısını korur', async ({ page }) => {
  await open(page);
  // Köke yakın dilimde birbirine bağlı olmayan üçgen adaları sayılır (üst dişlerde kök ucu y+ yönündedir)
  const roots = await page.evaluate((ids) => {
    const count = (mesh, h) => {
      mesh.updateWorldMatrix(true, false);
      const a = mesh.geometry.attributes.position;
      const ix = mesh.geometry.index.array;
      const e = mesh.matrixWorld.elements;
      const y = (i) => e[1] * a.getX(i) + e[5] * a.getY(i) + e[9] * a.getZ(i) + e[13];
      const key = (i) => `${a.getX(i).toFixed(2)},${a.getY(i).toFixed(2)},${a.getZ(i).toFixed(2)}`;
      const parent = new Map();
      const find = (k) => { while (parent.get(k) !== k) k = parent.get(k); return k; };
      for (let t = 0; t < ix.length; t += 3) {
        const tri = [ix[t], ix[t + 1], ix[t + 2]];
        const ys = tri.map(y);
        if (Math.min(...ys) > h || Math.max(...ys) < h) continue;
        const ks = tri.map(key);
        for (const k of ks) if (!parent.has(k)) parent.set(k, k);
        parent.set(find(ks[0]), find(ks[1]));
        parent.set(find(ks[1]), find(ks[2]));
      }
      return new Set([...parent.keys()].map(find)).size;
    };
    return Object.fromEntries(ids.map((id) => {
      const mesh = window.__app.scene.records.get(id).meshes[0];
      mesh.updateWorldMatrix(true, false);
      const a = mesh.geometry.attributes.position;
      const e = mesh.matrixWorld.elements;
      let lo = Infinity;
      let hi = -Infinity;
      for (let i = 0; i < a.count; i++) {
        const y = e[1] * a.getX(i) + e[5] * a.getY(i) + e[9] * a.getZ(i) + e[13];
        lo = Math.min(lo, y);
        hi = Math.max(hi, y);
      }
      return [id, count(mesh, lo + (hi - lo) * 0.9)];
    }));
  }, ['t_14', 't_15', 't_16', 't_24', 't_25', 't_26']);
  expect(roots).toEqual({ t_14: 2, t_15: 1, t_16: 3, t_24: 2, t_25: 1, t_26: 3 });
});

test('seçim: ilişkili yapılar görünür ve seçili yapıdan farklı renktedir', async ({ page }) => {
  await open(page);
  const state = async (id) => page.evaluate((sel) => {
    const { scene, byId } = window.__app;
    window.__app.select(sel);
    const out = {};
    for (const [k, rec] of scene.records) {
      const m = rec.meshes[0];
      if (m?.visible && m.material.color) out[k] = m.material.color.getHex();
    }
    return { colors: out, hidden: scene.records.get('m_masseter') ? !scene.records.get('m_masseter').meshes[0].visible : null, layers: Object.fromEntries([...byId].map(([k, s]) => [k, s.layer])) };
  }, id);
  const SEL = 0xff2bd6;
  const REL = 0xf2a93b;

  // Sinir: dalları ve deliği görünür; aynı katmandaki sinir sarı kalır, seçili sinir pembe olur
  const ian = await state('n_ian');
  expect(ian.colors.n_ian).toBe(SEL);
  expect(ian.colors.n_lingual).toBe(0xf5d04e);
  expect(ian.colors.f_mandibular).toBe(0x4fd8d8);
  expect(ian.colors.b_mandible).toBe(REL);
  expect(ian.colors.t_46).toBe(REL);
  await expect(page.locator('.rel-row button[data-goto="n_lingual"]')).toBeVisible();

  // Arter: dal hem panelde hem sahnede, ana arter de (ters yönde ilişki) görünür
  const mma = await state('a_mma');
  expect(mma.colors.a_mma).toBe(SEL);
  expect(mma.colors.a_maxillary).toBe(0xef5350);
  expect(mma.colors.f_spinosum).toBe(0x4fd8d8);

  // Kemik katmanı kapalıyken ilişkili kemik katmanı geri açmaz
  await page.locator('#chips [data-layer="bone"]').click();
  const off = await state('n_ian');
  expect(off.colors.b_mandible).toBeUndefined();
  expect(off.colors.n_lingual).toBe(0xf5d04e);
  await page.locator('#chips [data-layer="bone"]').click();

  // Kas katmanı kapalıyken n. facialis kasları sahnede göstermez ama panelde listeler; açılınca gösterir
  const vii = await state('n_vii');
  const relMus = await page.evaluate(() => window.__app.relatedOf('n_vii').filter((k) => window.__app.byId.get(k)?.layer === 'muscle'));
  expect(relMus.length).toBeGreaterThan(0);
  for (const k of relMus) expect(vii.colors[k], k).toBeUndefined();
  await expect(page.locator(`.rel-row button[data-goto="${relMus[0]}"]`).first()).toBeAttached();
  await expect(page.locator('#labels .label.rel.lay-muscle')).toHaveCount(0);
  await page.locator('#chips [data-layer="muscle"]').click();
  expect(await page.evaluate((k) => window.__app.scene.records.get(k).meshes[0].visible, relMus[0])).toBe(true);
  await page.locator('#chips [data-layer="muscle"]').click();

  // Blok: hedef sinir seçili renkte, diğer yapılar ilişkili
  const blk = await state('blk_ianb');
  expect(blk.colors.n_ian).toBe(SEL);
  expect(blk.colors.n_lingual).toBe(0xf5d04e);
  expect(blk.colors.b_mandible).toBe(REL);
});

test('dokunma hedefleri 44 px ve yatay taşma yok', async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.__app.select('v_cavernous', { instant: true }));
  await settle(page);
  if (portrait(page)) await page.locator('#btn-list').tap();
  const small = await page.evaluate(() => [...document.querySelectorAll('button, input, summary')]
    .filter((e) => e.offsetParent !== null && !e.classList.contains('ilink'))
    .map((e) => { const r = e.getBoundingClientRect(); return { t: e.textContent.trim().slice(0, 30) || e.id, w: r.width, h: r.height }; })
    .filter((r) => r.h < 43.5 || r.w < 43.5));
  expect(small).toEqual([]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

test('quiz: üç soru tipi, yanlışta 3B gösterim, kalıcı ilerleme, yanlışları tekrar', async ({ page }, info) => {
  const errors = watchErrors(page);
  await open(page);
  await page.locator('#tabs [data-view="quiz"]').tap();
  await expect(page.locator('#quiz-panel')).toBeVisible();

  for (const mode of ['identify', 'foramen', 'lesion']) {
    await page.locator(`[data-mode="${mode}"]`).tap();
    await expect(page.locator('.qopts button')).toHaveCount(4);
    if (mode === 'identify') {
      expect(await page.locator('.label').count()).toBe(0);
      await settle(page);
      await shot(page, info, '04-quiz-3b');
    }
    await page.locator('.qopts button').first().tap();
    await expect(page.locator('.qwhy')).toBeVisible();
    expect(await page.locator('.label.main').count()).toBe(1);
    await settle(page);
    if (mode === 'lesion') await shot(page, info, '05-quiz-cevap');
    await page.locator('.qnav button.primary').tap();
    await expect(page.locator('.qopts button')).toHaveCount(4);
    await page.locator('#q-exit').tap();
  }
  const prog = await page.evaluate(() => JSON.parse(localStorage.getItem('dusnoro3d.v1')));
  expect(prog.answered).toBe(3);

  // Kesin yanlış üret: doğru olmayan şıkkı seç
  await page.locator('[data-mode="foramen"]').tap();
  const q = await page.locator('.qtext').textContent();
  const correct = await page.evaluate((text) => {
    const b = window.__quizBank.find((x) => x.q === text);
    return b.options[b.answer];
  }, q);
  const opts = page.locator('.qopts button');
  for (let i = 0; i < 4; i++) {
    if ((await opts.nth(i).textContent()) !== correct) { await opts.nth(i).tap(); break; }
  }
  await expect(page.locator('.qwhy.bad')).toBeVisible();
  await page.locator('.qnav button.primary').tap();
  await page.reload();
  await page.waitForFunction(() => window.__app?.ready);
  await page.locator('#tabs [data-view="quiz"]').tap();
  await expect(page.locator('.wronglist button').first()).toBeVisible();
  await page.locator('#q-wrong').tap();
  await expect(page.locator('.qopts button')).toHaveCount(4);
  expect(errors).toEqual([]);
});

test('localStorage bozuksa quiz hata vermeden çalışır', async ({ page }) => {
  const errors = watchErrors(page);
  await page.addInitScript(() => {
    const boom = () => { throw new DOMException('kota', 'QuotaExceededError'); };
    Object.defineProperty(window, 'localStorage', { get: boom });
  });
  await open(page);
  await page.locator('#tabs [data-view="quiz"]').tap();
  await page.locator('[data-mode="lesion"]').tap();
  await page.locator('.qopts button').first().tap();
  await expect(page.locator('.qwhy')).toBeVisible();
  expect(errors).toEqual([]);
});

test('kaynaklar ve blok sahnesi', async ({ page }, info) => {
  await open(page);
  await page.evaluate(() => window.__app.select('blk_ianb', { instant: true }));
  await settle(page);
  await shot(page, info, '06-ianb');
  expect(await page.evaluate(() => window.__app.scene.records.get('x_ianb').meshes.every((m) => m.visible))).toBe(true);
  await page.locator('#tabs [data-view="sources"]').tap();
  await expect(page.locator('#sources')).toContainText('CC BY-SA 4.0');
  await expect(page.locator('#sources')).toContainText('BodyParts3D');
  await shot(page, info, '07-kaynaklar');
});

test('PWA: manifest ve çevrimdışı yeniden açılış', async ({ page, context, browserName }) => {
  await open(page);
  const manifest = await page.evaluate(async () => (await fetch('manifest.webmanifest')).json());
  expect(manifest.display).toBe('standalone');
  const hasSW = await page.evaluate(() => 'serviceWorker' in navigator);
  test.skip(!hasSW || browserName === 'webkit', 'Playwright WebKit (Windows) service worker desteklemiyor');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => window.__app?.ready);
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => window.__app?.ready, null, { timeout: 60_000 });
  await context.setOffline(false);
});

// ---------- 3B pin testi ----------
const startPin = async (page, mode) => {
  await page.locator('#tabs [data-view="quiz"]').tap();
  await page.locator('[data-mode="pin"]').tap();
  await page.locator(`[data-pinmode="${mode}"]`).tap();
  await pinsReady(page);
};
// Kamera durmuş ve görünürlük denetimi yapılmış olmalı
const pinsReady = (page) => page.waitForFunction(() => {
  const { pins, scene } = window.__app;
  return pins.state && !scene.tweening && pins.state.pins.every((p) => p.seen !== undefined);
});
const pinState = (page) => page.evaluate(() => window.__app.pins.state);
const hud = async (page) => ({ good: Number(await page.locator('#pin-good').textContent()), bad: Number(await page.locator('#pin-bad').textContent()) });
// Doygun piksellerin renk tonu kümeleri: WebKit ekran görüntüsüne güvenilmediği için gl.readPixels
const hueBuckets = (page) => page.evaluate(() => new Promise((res) => {
  const s = window.__app.scene;
  let done = false;
  s.onFrame(() => {
    if (done) return;
    done = true;
    const gl = s.renderer.getContext();
    const c = s.renderer.domElement;
    const buf = new Uint8Array(4 * c.width * c.height);
    gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    const bins = new Map();
    for (let i = 0; i < buf.length; i += 4) {
      const [r, g, b] = [buf[i], buf[i + 1], buf[i + 2]];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max - min < 70) continue;
      const d = max - min;
      const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      const k = Math.floor(h * 2);
      bins.set(k, (bins.get(k) ?? 0) + 1);
    }
    res([...bins.values()].filter((n) => n > 1500).length);
  });
  s.invalidate();
}));

test('pin testi: dokun modu, renkli kemik, sayaç, takip, ilerleme', async ({ page }, info) => {
  const errors = watchErrors(page);
  await open(page);
  await page.locator('#tabs [data-view="quiz"]').tap();
  await settle(page);
  const plainBuckets = await hueBuckets(page);
  await page.locator('[data-mode="pin"]').tap();
  await page.locator('[data-pinmode="pin-touch"]').tap();
  await pinsReady(page);

  const st = await pinState(page);
  expect(st.pins.length).toBeGreaterThanOrEqual(4);
  expect(st.pins.length).toBeLessThanOrEqual(6);
  await expect(page.locator('.pin')).toHaveCount(st.pins.length);
  await expect(page.locator('.pin:not(.occl)')).toHaveCount(st.pins.length);
  await expect(page.locator('.pin').first()).toHaveText('');
  await expect(page.locator('.qtext')).toContainText('dokun');
  await expect(page.locator('#chips')).toBeHidden();
  expect(await page.locator('.label').count()).toBe(0);
  expect(await page.locator('.pin-tag').count()).toBe(0);
  expect(await page.evaluate(() => window.__app.scene.colorMode)).toBe(true);
  await expect(page.locator('#pin-hud')).toBeVisible();
  expect(await hud(page)).toEqual({ good: 0, bad: 0 });

  // Her pin bugünkü kameradan raycast ile görünür; kemik pini o kemiğin üzerinde
  const check = await page.evaluate(() => {
    const { pins, scene, byId } = window.__app;
    return pins.state.pins.map((p) => ({
      id: p.id,
      visible: scene.pointVisible(p.point, scene.camera.position.toArray(), p.eps),
      onBone: byId.get(p.id).layer !== 'bone' || scene.firstHitId(p.point) === p.id,
    }));
  });
  expect(check.filter((c) => !c.visible || !c.onBone)).toEqual([]);

  // Dokunma alanı 44 px, sahnede ve üst üste binmiyor
  const rects = await page.locator('.pin').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; }));
  const stage = await page.locator('#stage').evaluate((e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; });
  for (const [i, a] of rects.entries()) {
    expect(a.w).toBeGreaterThanOrEqual(43.5);
    expect(a.h).toBeGreaterThanOrEqual(43.5);
    expect(a.l).toBeGreaterThanOrEqual(stage.l);
    expect(a.r).toBeLessThanOrEqual(stage.r);
    expect(a.t).toBeGreaterThanOrEqual(stage.t);
    expect(a.b).toBeLessThanOrEqual(stage.b);
    for (const b of rects.slice(i + 1)) expect(a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5).toBe(false);
  }

  // Renkli kemikler gerçekten çizilir
  const colorBuckets = await hueBuckets(page);
  expect(colorBuckets).toBeGreaterThanOrEqual(4);
  expect(colorBuckets).toBeGreaterThan(plainBuckets);
  await shot(page, info, '20-pin-soru');

  // Hareketsizken çizim durur
  const f0 = await page.evaluate(() => window.__app.scene.frames);
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => window.__app.scene.frames) - f0).toBeLessThanOrEqual(1);

  // Kamera dönünce pinler izler; arkada kalan gizlenir, soluk gösterilmez
  const before = await page.locator('.pin').evaluateAll((els) => els.map((e) => e.style.transform));
  await page.evaluate(() => {
    const { camera, controls } = window.__app.scene;
    const c = controls.target;
    const [dx, dz] = [camera.position.x - c.x, camera.position.z - c.z];
    const a = 0.6;
    camera.position.x = c.x + dx * Math.cos(a) - dz * Math.sin(a);
    camera.position.z = c.z + dx * Math.sin(a) + dz * Math.cos(a);
    controls.update();
    window.__app.scene.invalidate();
  });
  await settle(page);
  await page.waitForTimeout(300);
  const after = await page.locator('.pin').evaluateAll((els) => els.map((e) => e.style.transform));
  expect(after).not.toEqual(before);
  const follow = await page.evaluate(() => {
    const { pins, scene } = window.__app;
    const els = [...document.querySelectorAll('.pin')];
    return pins.state.pins.map((p, i) => {
      const s = scene.projectPoint(p.point);
      const m = els[i].style.transform.match(/translate3d\(([-\d.]+)px, ([-\d.]+)px/);
      return { dx: Math.abs(Number(m[1]) + 22 - s.x), dy: Math.abs(Number(m[2]) + 38 - s.y), vis: scene.pointVisible(p.point, scene.camera.position.toArray(), p.eps), hidden: els[i].classList.contains('occl') };
    });
  });
  for (const f of follow) {
    expect(f.dx).toBeLessThan(1);
    expect(f.dy).toBeLessThan(1);
    expect(f.hidden).toBe(!f.vis);
  }
  await page.locator('#q-view').tap();
  await page.waitForFunction(() => !window.__app.scene.tweening);
  await page.waitForTimeout(300);
  await expect(page.locator('.pin:not(.occl)')).toHaveCount(st.pins.length);

  // Yanlış: doğru pin yeşil, seçilen kırmızı, etiket ve spot[0]
  const wrongIdx = st.pins.findIndex((_, i) => i !== st.target);
  await page.locator('.pin').nth(wrongIdx).tap();
  await expect(page.locator('.pin.right')).toHaveCount(1);
  await expect(page.locator('.pin.wrong')).toHaveCount(1);
  await expect(page.locator('.pin').nth(st.target)).toHaveClass(/right/);
  await expect(page.locator('.pin').nth(wrongIdx)).toHaveClass(/wrong/);
  const target = await page.evaluate((id) => { const s = window.__app.byId.get(id); return { name: s.name, spot: s.spot[0] }; }, st.pins[st.target].id);
  await expect(page.locator('.pin-tag')).toHaveText(target.name);
  await expect(page.locator('.qwhy.bad')).toContainText(target.spot);
  expect(await hud(page)).toEqual({ good: 0, bad: 1 });
  // Cevapta seçili olmayan dişler soluklaşmaz
  const tooth = await page.evaluate((tid) => {
    const id = tid === 't_11' ? 't_21' : 't_11';
    return window.__app.scene.records.get(id).meshes[0].material.opacity;
  }, st.pins[st.target].id);
  expect(tooth).toBe(1);
  const prog = await page.evaluate(() => JSON.parse(localStorage.getItem('dusnoro3d.v1')));
  const pinKey = Object.keys(prog.wrong)[0];
  expect(pinKey.startsWith(`pin:touch:${st.pins[st.target].id}:`)).toBe(true);
  await settle(page);
  await shot(page, info, '21-pin-yanlis');

  // Sonraki: doğru pin
  await page.locator('#q-next').tap();
  await pinsReady(page);
  const st2 = await pinState(page);
  await expect(page.locator('.pin-tag')).toHaveCount(0);
  await page.locator('.pin').nth(st2.target).tap();
  await expect(page.locator('.qwhy.good')).toBeVisible();
  await expect(page.locator('.pin.wrong')).toHaveCount(0);
  expect(await hud(page)).toEqual({ good: 1, bad: 1 });

  // Menüye dönünce renkler ve katmanlar eski haline gelir, yanlış listede görünür
  await page.locator('#q-exit').tap();
  await expect(page.locator('.pin')).toHaveCount(0);
  expect(await page.evaluate(() => window.__app.scene.colorMode)).toBe(false);
  await expect(page.locator('#chips')).toBeVisible();
  await expect(page.locator('.wronglist button').first()).toContainText('Pin:');
  await page.waitForFunction(() => !window.__app.scene.tweening);
  await settle(page);
  expect(await hueBuckets(page)).toBeLessThan(colorBuckets);
  await page.evaluate(() => localStorage.clear());
  expect(errors).toEqual([]);
});

test('pin testi: "Bu pin nedir?" tek pin, 4 şık, yanlışı tekrar', async ({ page }, info) => {
  const errors = watchErrors(page);
  await open(page);
  await startPin(page, 'pin-name');
  const st = await pinState(page);
  expect(st.pins.length).toBe(1);
  expect(st.pins[0].seen).toBe(true);
  await expect(page.locator('.qopts button')).toHaveCount(4);
  expect(await page.locator('.label').count()).toBe(0);
  const q = await page.evaluate(() => { const s = window.__app.quiz.session; const c = s.list[s.i]; return { key: c.key, correct: c.correct, options: c.options }; });
  expect(new Set(q.options).size).toBe(4);
  expect(q.options).toContain(q.correct);
  expect(q.key.startsWith('pin:name:')).toBe(true);
  await shot(page, info, '22-pin-nedir');

  const opts = page.locator('.qopts button');
  for (let i = 0; i < 4; i++) {
    if ((await opts.nth(i).textContent()) !== q.correct) { await opts.nth(i).tap(); break; }
  }
  await expect(page.locator('.qwhy.bad')).toBeVisible();
  await expect(page.locator('.qopts button.right')).toHaveText(q.correct);
  await expect(page.locator('.pin.right')).toHaveCount(1);
  await expect(page.locator('.pin-tag')).toBeVisible();
  expect(await hud(page)).toEqual({ good: 0, bad: 1 });
  await settle(page);
  await shot(page, info, '23-pin-nedir-cevap');

  // Kalıcı: yeniden yüklemeden sonra yanlışlar listesi bu soruyu aynı türde sorar
  await page.reload();
  await page.waitForFunction(() => window.__app?.ready);
  await page.locator('#tabs [data-view="quiz"]').tap();
  await page.locator('#q-wrong').tap();
  await pinsReady(page);
  const again = await page.evaluate(() => { const s = window.__app.quiz.session; const c = s.list[s.i]; return { key: c.key, correct: c.correct }; });
  expect(again.key).toBe(q.key);
  await page.locator('.qopts button', { hasText: again.correct }).first().tap();
  await expect(page.locator('.qwhy.good')).toBeVisible();
  expect(await page.evaluate((k) => JSON.parse(localStorage.getItem('dusnoro3d.v1')).wrong[k] ?? null, q.key)).toBeNull();
  await page.locator('#q-next').tap();
  await expect(page.locator('h2', { hasText: 'Oturum bitti' })).toBeVisible();
  expect(await page.evaluate(() => window.__app.scene.colorMode)).toBe(false);
  await page.evaluate(() => localStorage.clear());
  expect(errors).toEqual([]);
});

test('pin testi: renk modu çıkışta döner, saydamlık ve kesit bozulmaz, atlas düğmesi çalışır', async ({ page }, info) => {
  const errors = watchErrors(page);
  await open(page);
  const boneMat = () => page.evaluate(() => {
    const m = window.__app.scene.records.get('b_maxilla').meshes[0].material;
    return { color: m.color.getHex(), opacity: m.opacity, transparent: m.transparent };
  });
  const plain = await boneMat();

  // Saydam kemik ve açık kesit: pin testinde kemik opak, kesit kapalı; dönünce saydamlık geri gelir
  await page.locator('#bone-range').evaluate((el) => { el.value = 70; el.dispatchEvent(new Event('input')); });
  await page.locator('#btn-clip').tap();
  await slide(page, 'z', 54);
  expect(await page.evaluate(() => window.__app.scene.renderer.clippingPlanes.length)).toBe(1);
  await startPin(page, 'pin-touch');
  expect(await page.evaluate(() => window.__app.scene.renderer.clippingPlanes.length)).toBe(0);
  await expect(page.locator('#clip-panel')).toBeHidden();
  const inPin = await boneMat();
  expect(inPin).toMatchObject({ opacity: 1, transparent: false });
  expect(inPin.color).not.toBe(plain.color);
  await page.locator('#tabs [data-view="atlas"]').tap();
  await expect(page.locator('.pin')).toHaveCount(0);
  await expect(page.locator('#pins')).toBeHidden();
  const back = await boneMat();
  expect(back.color).toBe(plain.color);
  expect(back.transparent).toBe(true);
  expect(back.opacity).toBeCloseTo(0.3, 5);
  await page.locator('#bone-range').evaluate((el) => { el.value = 0; el.dispatchEvent(new Event('input')); });

  // Atlas: Renkli kemik düğmesi
  const btn = page.locator('#btn-color');
  await expect(btn).toHaveAttribute('aria-pressed', 'false');
  await btn.tap();
  await expect(btn).toHaveAttribute('aria-pressed', 'true');
  expect((await boneMat()).color).not.toBe(plain.color);
  await settle(page);
  expect(await hueBuckets(page)).toBeGreaterThanOrEqual(4);
  await shot(page, info, '24-atlas-renkli');

  // Renkli modda seçim ve kesit yüzeyi çalışır
  await page.evaluate(() => window.__app.select('b_zygomatic', { instant: true }));
  await settle(page);
  const sel = await page.evaluate(() => {
    const r = window.__app.scene.records;
    return { sel: r.get('b_zygomatic').meshes[0].material.emissive.getHex(), other: r.get('b_maxilla').meshes[0].material.emissive.getHex() };
  });
  expect(sel.sel).not.toBe(0);
  expect(sel.other).toBe(0);
  await page.locator('#btn-clip').tap();
  await slide(page, 'z', 54);
  await settle(page);
  expect((await capPixels(page)).bone).toBeGreaterThan(1000);
  await page.locator('#clip-reset').tap();

  // Tercih kalıcıdır; quizden dönünce atlas tercihi korunur, ilerleme sıfırlama silmez
  await page.reload();
  await page.waitForFunction(() => window.__app?.ready);
  await expect(page.locator('#btn-color')).toHaveAttribute('aria-pressed', 'true');
  await startPin(page, 'pin-name');
  await page.locator('#tabs [data-view="atlas"]').tap();
  expect(await page.evaluate(() => window.__app.scene.colorMode)).toBe(true);
  await page.locator('#tabs [data-view="quiz"]').tap();
  await page.locator('#q-reset').tap();
  await page.reload();
  await page.waitForFunction(() => window.__app?.ready);
  await expect(page.locator('#btn-color')).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => localStorage.clear());
  expect(errors).toEqual([]);
});

test('pin havuzu: yalnız diş hekimliği yapıları, her yapı görünür açıyla yerleşir', async ({ page }) => {
  const errors = watchErrors(page);
  await open(page);
  await page.locator('#tabs [data-view="quiz"]').tap();
  await page.locator('[data-mode="pin"]').tap();
  await page.locator('[data-pinmode="pin-touch"]').tap();
  await pinsReady(page);
  const res = await page.evaluate(async () => {
    const { pins, scene, byId } = window.__app;
    const fails = [];
    let maxMs = 0;
    let onAnchor = 0;
    let total = 0;
    const cats = new Set();
    for (const id of pins.pool.familyOf.keys()) {
      cats.add(byId.get(id).cat);
      for (const side of ['R', 'L', 'M']) {
        let touch;
        const t0 = performance.now();
        try { touch = pins.place(id, side, 5); } catch { continue; }
        maxMs = Math.max(maxMs, performance.now() - t0);
        const single = pins.place(id, side, 1);
        total++;
        if (!touch || touch.pins.length < 4 || !single) { fails.push(`${id}:${side}`); continue; }
        if (touch.pins.find((p) => p.id === id).onAnchor) onAnchor++;
        // Son place() aynı yapının görünümünü bıraktığı için engeller bu yerleşimle aynıdır
        for (const p of touch.pins) {
          if (!pins.pool.familyOf.has(p.id) || !scene.pointVisible(p.point, touch.cam.pos, p.eps)) fails.push(`${id}:${side} -> ${p.id} görünmüyor`);
        }
      }
    }
    return { fails, cats: [...cats], maxMs, onAnchor, total, ids: [...pins.pool.familyOf.keys()] };
  });
  console.log(`[${test.info().project.name}] yerleşim: ${res.total} yapı/yan, çapa (a) kullanan ${res.onAnchor}, en uzun ${Math.round(res.maxMs)} ms`);
  expect(res.fails).toEqual([]);
  expect(res.cats.sort()).toEqual(['attach', 'bones', 'foramina', 'mastication', 'teeth', 'tmj', 'vbr'].sort());
  for (const id of ['b_maxilla', 'b_mandible', 'b_palatine', 'b_zygomatic', 'b_nasal', 'b_lacrimal', 'b_vomer', 'b_sphenoid', 'b_temporal', 'f_mandibular', 'f_mental', 'f_infraorbital', 'f_incisive', 'f_gpf', 'f_lpf', 'm_masseter', 'ao_masseter', 'j_disc', 'n_ian', 't_16']) expect(res.ids).toContain(id);
  expect(res.ids).not.toContain('a_ica');
  expect(errors).toEqual([]);
});

test('pin testi: yön değişince pinler sahnede kalır', async ({ page }, info) => {
  await open(page);
  await startPin(page, 'pin-touch');
  const size = page.viewportSize();
  await page.setViewportSize({ width: size.height, height: size.width });
  await page.waitForTimeout(400);
  await page.waitForFunction(() => !window.__app.scene.tweening);
  await page.waitForTimeout(400);
  const res = await page.evaluate(() => {
    const stage = document.querySelector('#stage').getBoundingClientRect();
    return [...document.querySelectorAll('.pin:not(.occl)')].map((e) => {
      const r = e.getBoundingClientRect();
      return r.left >= stage.left && r.right <= stage.right && r.top >= stage.top && r.bottom <= stage.bottom;
    });
  });
  expect(res.length).toBeGreaterThanOrEqual(1);
  expect(res.every(Boolean)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await shot(page, info, '25-pin-yon');
});

test('pin testi: localStorage bozuksa sayaç ve soru çalışır', async ({ page }) => {
  const errors = watchErrors(page);
  await page.addInitScript(() => {
    const boom = () => { throw new DOMException('kota', 'QuotaExceededError'); };
    Object.defineProperty(window, 'localStorage', { get: boom });
  });
  await open(page);
  await startPin(page, 'pin-touch');
  const st = await pinState(page);
  await page.locator('.pin').nth(st.target).tap();
  await expect(page.locator('.qwhy.good')).toBeVisible();
  expect(await hud(page)).toEqual({ good: 1, bad: 0 });
  expect(errors).toEqual([]);
});

test('pin görevi, tanıma modu: yapışma ve FDI şıkları cevabı ele vermez, etiket yok', async ({ page }) => {
  await open(page);
  const res = await page.evaluate(() => {
    const { items, quiz, byId } = window.__app;
    const bad = [];
    const check = (st) => {
      const q = quiz.identifyQuestion(st);
      if (new Set(q.options).size !== 4) bad.push(`${st.id}: şık sayısı ${q.options.length}`);
      if (!q.options.includes(q.correct)) bad.push(`${st.id}: doğru şık yok`);
      if (st.cat === 'teeth') {
        if (!q.options.every((o) => /^\d\d$/.test(o))) bad.push(`${st.id}: FDI dışı şık ${q.options}`);
      } else {
        const attach = q.options.filter((o) => /– (origo|insersiyo)$/.test(o)).length;
        if (attach !== (st.cat === 'attach' ? 4 : 0)) bad.push(`${st.id}: yapışma şıkları ${q.options}`);
        if (q.options.some((o) => /^\d\d – /.test(o))) bad.push(`${st.id}: diş şıkkı ${q.options}`);
      }
    };
    for (let k = 0; k < 5; k++) for (const st of items) if (st.layer !== 'block' && st.layer !== 'context') check(st);
    return { bad, t16: quiz.identifyQuestion(byId.get('t_16')), masseter: quiz.identifyQuestion(byId.get('ao_masseter')) };
  });
  expect(res.bad).toEqual([]);
  expect(res.t16.correct).toBe('16');
  expect(res.t16.q).toContain('FDI');
  expect(res.masseter.options).toContain('M. masseter – insersiyo');

  // Atlasta seçili yapı varken soru sırasında etiket görünmez
  await page.evaluate(() => window.__app.select('t_16', { instant: true }));
  await expect(page.locator('.label.main')).toHaveCount(1);
  await page.locator('#tabs [data-view="quiz"]').tap();
  await page.evaluate(() => window.__app.quiz.start('wrong', ['id:t_16']));
  await expect(page.locator('.qopts button')).toHaveCount(4);
  await expect(page.locator('.qtext')).toContainText('FDI');
  expect(await page.locator('.label').count()).toBe(0);
  await page.locator('.qopts button', { hasText: '16' }).first().tap();
  await expect(page.locator('.qwhy.good')).toContainText('16 – Üst sağ birinci molar');
  await page.evaluate(() => localStorage.clear());
});

// ---------- Çene hareketi ----------
const motionSettle = async (page) => {
  await page.waitForFunction(() => !window.__app.scene.tweening && !window.__app.motion.busy);
  await page.waitForTimeout(200);
};
const motionOpen = async (page) => {
  await page.locator('#btn-motion').tap();
  await motionSettle(page);
};
const motionSet = async (page, key, t) => {
  await page.evaluate(([k, x]) => {
    const m = window.__app.motion;
    if (m.key !== k) m.choose(k);
    m.setT(x);
  }, [key, t]);
  await motionSettle(page);
};
const jawElements = (page) => page.evaluate(() => {
  const rec = window.__app.scene.records;
  const pick = (id) => Array.from(rec.get(id).meshes[0].matrixWorld.elements);
  return { mandible: pick('b_mandible'), tooth: pick('t_46'), disc: pick('j_disc') };
});
const softPositions = (page, id) => page.evaluate((i) => {
  const a = window.__app.scene.records.get(i).meshes[0].geometry.attributes.position;
  return Array.from({ length: 60 }, (_, k) => a.getX(k * 4) + a.getY(k * 4) + a.getZ(k * 4));
}, id);

test('çene hareketi: panel, 44 px hedefler, kas listeleri ve vurgu', async ({ page }) => {
  const errors = watchErrors(page);
  await open(page);
  await motionOpen(page);
  await expect(page.locator('#motion-panel')).toBeVisible();
  const rects = await page.evaluate(() => {
    const r = (s) => document.querySelector(s).getBoundingClientRect().toJSON();
    return { panel: r('#motion-panel'), chips: r('#chips'), tools: r('#stage-tools'), stage: r('#stage') };
  });
  expect(rects.panel.top).toBeGreaterThanOrEqual(rects.chips.bottom);
  expect(rects.panel.bottom).toBeLessThanOrEqual(rects.tools.top);
  expect(rects.panel.left).toBeGreaterThanOrEqual(rects.stage.left);
  expect(rects.panel.right).toBeLessThanOrEqual(rects.stage.right);
  const expected = {
    dep: ['m_latpt', 'm_digastric', 'm_mylohyoid', 'm_geniohyoid'],
    ele: ['m_masseter', 'm_temporalis', 'm_medpt'],
    pro: ['m_latpt', 'm_medpt', 'm_masseter'],
    ret: ['m_temporalis'],
    latR: ['m_latpt', 'm_medpt', 'm_temporalis'],
    latL: ['m_latpt', 'm_medpt', 'm_temporalis'],
  };
  for (const [key, ids] of Object.entries(expected)) {
    await page.locator(`[data-motion="${key}"]`).tap();
    await motionSettle(page);
    const shown = await page.locator('.motion-muscles [data-goto]').evaluateAll((els) => els.map((e) => e.dataset.goto));
    expect(shown).toEqual(ids);
    const small = await page.evaluate(() => [...document.querySelectorAll('#motion-panel button, #motion-panel input, #btn-motion')]
      .filter((e) => e.offsetParent !== null)
      .map((e) => { const r = e.getBoundingClientRect(); return { t: e.textContent.trim() || e.id, w: r.width, h: r.height }; })
      .filter((r) => r.h < 43.5 || r.w < 43.5));
    expect(small).toEqual([]);
    const overflow = await page.evaluate(() => { const p = document.querySelector('#motion-panel'); return document.documentElement.scrollWidth > window.innerWidth || p.scrollWidth > p.clientWidth + 1; });
    expect(overflow).toBe(false);
  }
  // Lateral harekette taraf ayrımı: sağa harekette sol pterygoidler ve sağ temporalis çalışır
  await page.locator('[data-motion="latR"]').tap();
  await motionSettle(page);
  const vis = await page.evaluate(() => {
    const on = (id, side) => window.__app.scene.records.get(id).meshes.find((m) => m.userData.side === side).visible;
    return { latL: on('m_latpt', 'L'), latR: on('m_latpt', 'R'), medL: on('m_medpt', 'L'), medR: on('m_medpt', 'R'), temR: on('m_temporalis', 'R'), temL: on('m_temporalis', 'L'), disc: on('j_disc', 'R') };
  });
  expect(vis).toEqual({ latL: true, latR: false, medL: true, medR: false, temR: true, temL: false, disc: true });
  // Kas bağlantısı seçime gider
  await page.locator('.motion-muscles [data-goto="m_medpt"]').tap();
  expect(await page.evaluate(() => window.__app.current)).toBe('m_medpt');
  await expect(page.locator('#detail h2')).toHaveText('M. pterygoideus medialis');
  expect(errors).toEqual([]);
});

test('çene hareketi: ölçülen kondil, iki fazlı açılma, disk ve lateral biyomekanik', async ({ page }) => {
  await open(page);
  await motionOpen(page);
  const joint = await page.evaluate(() => {
    const j = window.__app.motion.joint;
    const s = (t) => ({ c: j.sides[t].condyle.c, top: j.sides[t].condyle.top, disc: j.sides[t].disc.c, crest: j.sides[t].eminence });
    return { R: s('R'), L: s('L'), D: j.intercondylar };
  });
  // Kondil merkezi diskin kutu merkezine yakın, eminentia kondilin önünde ve daha aşağıda
  for (const t of ['R', 'L']) {
    expect(Math.hypot(...joint[t].c.map((v, i) => v - joint[t].disc[i]))).toBeLessThan(4);
    expect(joint[t].crest.z).toBeGreaterThan(joint[t].c[2]);
    expect(joint[t].crest.y).toBeLessThan(joint[t].top[1]);
  }
  expect(joint.R.c[0]).toBeLessThan(0);
  expect(joint.L.c[0]).toBeGreaterThan(0);
  const at = async (key, t) => {
    await motionSet(page, key, t);
    return page.evaluate(() => {
      const m = window.__app.motion.metrics();
      return { opening: m.opening, lateral: m.lateral, theta: m.theta, R: m.condyle.R, L: m.condyle.L, discR: m.disc.R, discL: m.disc.L };
    });
  };
  const len = (v) => Math.hypot(...v);
  const quarter = await at('dep', 0.25);
  const rot = await at('dep', 0.5);
  const three = await at('dep', 0.75);
  const full = await at('dep', 1);
  // Rotasyon fazı: kondil ve disk yerinde, ilk yaklaşık 20-25 mm
  expect(len(quarter.R)).toBe(0);
  expect(len(rot.R)).toBe(0);
  expect(len(rot.discR)).toBeLessThan(1e-3);
  expect(rot.opening).toBeGreaterThan(20);
  expect(rot.opening).toBeLessThan(25);
  // Translasyon fazı: kondil öne-aşağı, disk daha az
  expect(three.R[2]).toBeGreaterThan(0);
  expect(three.R[1]).toBeLessThan(0);
  expect(full.opening).toBeGreaterThan(40);
  expect(full.opening).toBeLessThan(50);
  expect(full.R[2]).toBeGreaterThan(6);
  expect(full.discR[2]).toBeGreaterThan(0);
  expect(full.discR[2]).toBeLessThan(full.R[2] * 0.75);
  expect(full.theta).toBeGreaterThan(rot.theta);
  // Sağa lateral: sağ kondil döner, sol kondil öne-içe; hasta sağı x<0
  const lat = await at('latR', 1);
  expect(lat.lateral).toBeLessThan(-7);
  expect(len(lat.R)).toBeLessThan(2.5);
  expect(lat.L[2]).toBeGreaterThan(5);
  expect(lat.L[0]).toBeLessThan(0);
  expect(len(lat.discR)).toBeLessThan(1);
  const latL = await at('latL', 1);
  expect(latL.lateral).toBeGreaterThan(7);
  expect(latL.R[0]).toBeGreaterThan(0);

  // Mesh gerçekten duruşu izliyor: dişler ve mandibula aynı dönüşüm, disk ayrı
  await motionSet(page, 'dep', 1);
  const sameJaw = await page.evaluate(() => {
    const rec = window.__app.scene.records;
    const p = [-30, -60, 40];
    const apply = (e, v) => [e[0] * v[0] + e[4] * v[1] + e[8] * v[2] + e[12], e[1] * v[0] + e[5] * v[1] + e[9] * v[2] + e[13], e[2] * v[0] + e[6] * v[1] + e[10] * v[2] + e[14]];
    const world = (m) => apply(m.matrixWorld.clone().multiply(m.userData.restWorld.clone().invert()).elements, p);
    return { a: world(rec.get('b_mandible').meshes[0]), b: world(rec.get('t_46').meshes[0]), d: world(rec.get('j_disc').meshes[0]) };
  });
  expect(Math.hypot(...sameJaw.a.map((v, i) => v - sameJaw.b[i]))).toBeLessThan(1e-3);
  expect(Math.hypot(...sameJaw.a.map((v, i) => v - sameJaw.d[i]))).toBeGreaterThan(5);

  // Mesafe ölçümü: alt ve üst diş köşeleri ile kondil-temporal köşeleri
  const clearance = () => page.evaluate(() => {
    const rec = window.__app.scene.records;
    const verts = (ids) => ids.flatMap((id) => rec.get(id).meshes.flatMap((m) => {
      const a = m.geometry.attributes.position;
      const e = m.matrixWorld.elements;
      const out = [];
      for (let i = 0; i < a.count; i++) {
        const x = a.getX(i);
        const y = a.getY(i);
        const z = a.getZ(i);
        out.push([e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]]);
      }
      return out;
    }));
    const near = (A, B) => {
      const CELL = 6;
      const g = new Map();
      const key = (c) => `${Math.floor(c[0] / CELL)},${Math.floor(c[1] / CELL)},${Math.floor(c[2] / CELL)}`;
      for (const q of B) {
        const k = key(q);
        if (!g.has(k)) g.set(k, []);
        g.get(k).push(q);
      }
      let best = Infinity;
      for (const p of A) {
        const cx = Math.floor(p[0] / CELL);
        const cy = Math.floor(p[1] / CELL);
        const cz = Math.floor(p[2] / CELL);
        for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
          for (const q of g.get(`${cx + i},${cy + j},${cz + k}`) ?? []) best = Math.min(best, Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]));
        }
      }
      return best;
    };
    const quad = (a, b) => [1, 2, 3, 4, 5, 6, 7].flatMap((n) => [`t_${a}${n}`, `t_${b}${n}`]);
    const cond = verts(['b_mandible']).filter((p) => p[1] > -24 && p[2] < 22);
    return { teeth: near(verts(quad(3, 4)), verts(quad(1, 2))), joint: near(cond, verts(['b_temporal'])) };
  });
  await motionSet(page, 'dep', 0);
  const rest = await clearance();
  for (const [key, t] of [['dep', 0.5], ['dep', 1], ['pro', 1], ['ret', 1], ['latR', 1], ['latL', 1]]) {
    await motionSet(page, key, t);
    const c = await clearance();
    expect(c.teeth, `${key} diş`).toBeGreaterThanOrEqual(Math.min(rest.teeth, 0.2));
    expect(c.joint, `${key} eklem`).toBeGreaterThan(0);
  }
});

test('çene hareketi: oynarken çizer, duraklayınca kare durur, sıfırlanınca matris başa döner', async ({ page }) => {
  const errors = watchErrors(page);
  await open(page);
  const start = await jawElements(page);
  await motionOpen(page);
  const softStart = await softPositions(page, 'm_masseter');
  const frames = () => page.evaluate(() => window.__app.scene.frames);
  const f0 = await frames();
  await page.locator('#motion-play').tap();
  await expect(page.locator('#motion-play')).toHaveText(/Durdur/);
  await page.waitForTimeout(700);
  const f1 = await frames();
  // Yazılım GL'inde boyun modelleriyle kare süresi uzadı; burada yalnız oynarken çizildiği denetlenir
  expect(f1 - f0).toBeGreaterThan(1);
  expect(await page.evaluate(() => window.__app.motion.t)).toBeGreaterThan(0);

  await page.locator('#motion-play').tap();
  await expect(page.locator('#motion-play')).toHaveText(/Oynat/);
  await page.waitForTimeout(150);
  const f2 = await frames();
  await page.waitForTimeout(1300);
  expect((await frames()) - f2).toBe(0);
  const paused = await jawElements(page);
  expect(paused.mandible).not.toEqual(start.mandible);

  // Kaydırıcı elle sürülür; çizim sürmez
  await page.locator('#motion-range').evaluate((el) => { el.value = 100; el.dispatchEvent(new Event('input')); });
  await motionSettle(page);
  await expect(page.locator('#motion-pct')).toHaveText('%100');
  expect(await page.evaluate(() => window.__app.motion.metrics().opening)).toBeGreaterThan(40);
  expect(await softPositions(page, 'm_masseter')).not.toEqual(softStart);
  const f3 = await frames();
  await page.waitForTimeout(800);
  expect((await frames()) - f3).toBe(0);

  await page.locator('#motion-reset').tap();
  await motionSettle(page);
  let now = await jawElements(page);
  expect(now.mandible).toEqual(start.mandible);
  expect(now.tooth).toEqual(start.tooth);
  expect(now.disc).toEqual(start.disc);
  expect(await softPositions(page, 'm_masseter')).toEqual(softStart);

  // Panel kapanınca çene döner, katmanlar eski haline gelir, çizim durur
  await motionSet(page, 'latR', 1);
  await page.locator('#motion-play').tap();
  await page.waitForTimeout(200);
  await page.locator('#motion-close').tap();
  await expect(page.locator('#motion-panel')).toBeHidden();
  await motionSettle(page);
  now = await jawElements(page);
  expect(now.mandible).toEqual(start.mandible);
  expect(now.disc).toEqual(start.disc);
  expect(await page.evaluate(() => window.__app.scene.layerOn.nerve)).toBe(true);
  const f4 = await frames();
  await page.waitForTimeout(800);
  expect((await frames()) - f4).toBe(0);
  expect(errors).toEqual([]);
});

test('çene hareketi: seçim, kesit yüzeyi, radyolojik panel ve quiz sıfırlaması', async ({ page }) => {
  const errors = watchErrors(page);
  await open(page);
  const start = await jawElements(page);
  await motionOpen(page);
  await motionSet(page, 'dep', 1);
  // Seçim yeni konumdaki çeneyi bulur: pogonionun hareketli izdüşümü mandibula veya alt yapılara çarpar
  const picked = await page.evaluate(() => {
    const { scene, motion } = window.__app;
    const pog = motion.joint.pogonion;
    const m = scene.records.get('b_mandible').meshes[0];
    const e = m.matrixWorld.clone().multiply(m.userData.restWorld.clone().invert()).elements;
    const p = [e[0] * pog[0] + e[4] * pog[1] + e[8] * pog[2] + e[12], e[1] * pog[0] + e[5] * pog[1] + e[9] * pog[2] + e[13], e[2] * pog[0] + e[6] * pog[1] + e[10] * pog[2] + e[14]];
    const r = scene.renderer.domElement.getBoundingClientRect();
    const a = scene.projectPoint(p);
    const b = scene.projectPoint(pog);
    return { moved: scene.pickAt(r.left + a.x, r.top + a.y), old: scene.pickAt(r.left + b.x, r.top + b.y) };
  });
  expect(picked.moved).toMatch(/^(b_mandible|t_[34]\d|m_digastric|m_mylohyoid|m_geniohyoid)$/);
  expect(picked.old).not.toBe('b_mandible');

  // Kesit yüzeyi: iki disk ayrı parça, lateral harekette farklı dönüşüm izler
  await page.evaluate(() => document.querySelector('#btn-clip').click());
  await expect(page.locator('#motion-panel')).toBeHidden();
  expect(await page.evaluate(() => window.__app.motion.isOpen)).toBe(true);
  await slide(page, 'x', -44);
  await page.evaluate(() => document.querySelector('#btn-section').click());
  await sectionReady(page, 'x', -44);
  const draws0 = await page.evaluate(() => window.__app.section.stats.draws);
  await motionSet(page, 'latR', 1);
  await capPixels(page);
  const caps = await page.evaluate(() => {
    const out = {};
    const soft = [];
    for (const part of window.__app.scene.capParts) {
      if (part.soft) soft.push(part.layer);
      if (part.ref.userData.id !== 'j_disc') continue;
      const want = part.ref.matrixWorld.clone().multiply(part.ref.userData.restWorld.clone().invert());
      out[part.ref.userData.side] = { n: part.ranges.length, cap: Array.from(part.meshes[0].matrixWorld.elements), want: Array.from(want.elements) };
    }
    return { out, soft };
  });
  const close = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-3);
  expect(caps.out.R.n).toBe(1);
  expect(caps.out.L.n).toBe(1);
  expect(close(caps.out.R.cap, caps.out.R.want)).toBe(true);
  expect(close(caps.out.L.cap, caps.out.L.want)).toBe(true);
  // Sağa harekette sol disk gider, sağ disk neredeyse yerinde kalır
  expect(Math.abs(caps.out.L.want[14])).toBeGreaterThan(1);
  expect(Math.abs(caps.out.R.want[14])).toBeLessThan(1);
  expect(caps.soft).toEqual(expect.arrayContaining(['muscle', 'joint']));
  const capN = await capPixels(page);
  expect(capN.bone + capN.muscle).toBeGreaterThan(50);

  // Radyolojik panel hareketle yeniden çizer
  await page.waitForFunction((d) => window.__app.section.stats.draws > d, draws0);
  expect(await page.evaluate(() => window.__app.section.stats.loops)).toBeGreaterThan(0);
  const redraw = await page.evaluate(async () => {
    const s = window.__app.section;
    const before = s.stats.draws;
    window.__app.motion.setT(0.3);
    await new Promise((r) => setTimeout(r, 500));
    return s.stats.draws - before;
  });
  expect(redraw).toBeGreaterThan(0);
  await page.evaluate(() => document.querySelector('#section-close').click());
  await page.locator('#clip-x').evaluate((el) => { el.value = el.max; el.dispatchEvent(new Event('input')); });

  // GL gerçekten çiziyor: WebKit'te ekran görüntüsü yerine readPixels
  const glCount = () => page.evaluate(() => new Promise((res) => {
    const s = window.__app.scene;
    let done = false;
    s.onFrame(() => {
      if (done) return;
      done = true;
      const gl = s.renderer.getContext();
      const c = s.renderer.domElement;
      const buf = new Uint8Array(4 * c.width * c.height);
      gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      let n = 0;
      for (let i = 3; i < buf.length; i += 4) if (buf[i] > 0) n++;
      res(n);
    });
    s.invalidate();
  }));
  await motionSet(page, 'dep', 1);
  expect(await glCount()).toBeGreaterThan(5000);

  // Quiz'e geçince anında sıfır; pin yerleşimi geo_index konumunda çalışır
  await page.locator('#tabs [data-view="quiz"]').tap();
  const after = await jawElements(page);
  expect(after.mandible).toEqual(start.mandible);
  expect(after.disc).toEqual(start.disc);
  expect(await page.evaluate(() => window.__app.motion.isOpen)).toBe(false);
  await expect(page.locator('#btn-motion')).toBeHidden();
  const pin = await page.evaluate(() => {
    const pl = window.__app.pins.place('t_46', 'R', 1);
    window.__app.scene.setQuizView(null);
    return { placed: !!pl, point: pl?.pins[0].point };
  });
  expect(pin.placed).toBe(true);
  // Çapa dinlenme konumundaki t_46 kutusu içinde kalır
  expect(pin.point[1]).toBeGreaterThan(-78);
  expect(pin.point[1]).toBeLessThan(-55);
  await page.locator('#tabs [data-view="atlas"]').tap();
  await expect(page.locator('#btn-motion')).toBeVisible();
  expect(errors).toEqual([]);
});

test('çene hareketi: yandan ve lateral görüntüler', async ({ page, browserName }, info) => {
  await open(page);
  await motionOpen(page);
  const glReads = [];
  const pixelSum = () => page.evaluate(() => new Promise((res) => {
    const s = window.__app.scene;
    let done = false;
    s.onFrame(() => {
      if (done) return;
      done = true;
      const gl = s.renderer.getContext();
      const c = s.renderer.domElement;
      const buf = new Uint8Array(4 * c.width * c.height);
      gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      let n = 0;
      for (let i = 0; i < buf.length; i += 4) n += buf[i] + buf[i + 1] + buf[i + 2];
      res(n);
    });
    s.invalidate();
  }));
  for (const [key, t, name] of [['dep', 0, '60-cene-kapali'], ['dep', 0.5, '61-cene-yuzde50'], ['dep', 1, '62-cene-tam-acik'], ['latR', 1, '63-cene-saga-lateral'], ['latL', 1, '64-cene-sola-lateral'], ['pro', 1, '65-cene-protruzyon']]) {
    await motionSet(page, key, t);
    glReads.push(await pixelSum());
    if (browserName === 'chromium') await shot(page, info, name);
  }
  // Duruşlar farklı piksel üretir (WebKit'te de)
  expect(glReads[0]).not.toBe(glReads[2]);
  expect(glReads[2]).not.toBe(glReads[3]);
});

test('boyun: yeni kemik, bez, kas ve üçgenler yüklü; üçgende sınır ve içerik modları', async ({ page }, info) => {
  await open(page);
  const counts = await page.evaluate(() => Object.fromEntries(['b_c7', 'b_clavicle', 'k_trachea', 'gl_parotid', 'gl_thyroid', 'm_scm', 'm_procerus', 'r_carotid', 'r_occipital', 'n_phrenic', 'v_ejv'].map((id) => [id, window.__app.scene.records.get(id)?.meshes.length ?? 0])));
  for (const [id, n] of Object.entries(counts)) expect(n, id).toBeGreaterThan(0);
  const mode = async (k) => {
    await page.evaluate((m) => document.querySelector(`[data-region="${m}"]`).click(), k);
    await settle(page);
    return page.evaluate(() => {
      const r = window.__app.scene.records;
      const m = (id) => r.get(id).meshes[0];
      return { scmVis: m('m_scm').visible, scmOp: m('m_scm').material.opacity, ccaOp: m('a_cca').material.opacity, tri: m('r_carotid').material.color.getHex(), ijv: m('v_ijv').material.opacity };
    });
  };
  await page.evaluate(() => window.__app.select('r_carotid', { instant: true }));
  await expect(page.locator('[data-region]')).toHaveCount(3);
  const bounds = await mode('bounds');
  expect(bounds.tri).toBe(0xff2bd6);
  expect(bounds.scmVis).toBe(true);
  expect(bounds.scmOp).toBeLessThan(0.5);
  expect(bounds.ccaOp).toBeLessThan(0.2);
  const contents = await mode('contents');
  expect(contents.scmVis).toBe(false);
  expect(contents.ccaOp).toBe(1);
  expect(contents.ijv).toBe(1);
  await shot(page, info, '40-ucgen-icerik');
  await mode('all');
  // Ense üçgeninin içeriği n. accessorius
  expect(await page.evaluate(() => window.__app.relatedOf('r_occipital').includes('n_xi'))).toBe(true);
});

test('gizleme: panel düğmesi, uzun basış menüsü, yalnız göster ve hepsini göster', async ({ page }) => {
  await open(page);
  const vis = (id) => page.evaluate((i) => window.__app.scene.records.get(i).meshes[0].visible, id);
  await page.evaluate(() => window.__app.select('b_mandible', { instant: true }));
  await page.evaluate(() => document.querySelector('[data-act="hide"]').click());
  expect(await vis('b_mandible')).toBe(false);
  await expect(page.locator('#hidden-bar')).toBeVisible();
  await expect(page.locator('#hidden-text')).toHaveText('1 yapı gizli');
  await page.locator('#hidden-show').click();
  expect(await vis('b_mandible')).toBe(true);
  await expect(page.locator('#hidden-bar')).toBeHidden();

  // Uzun basış: parmak kalkmadan menü açılır; parmak kalkınca seçim yapılmaz
  await page.evaluate(() => window.__app.scene.home());
  await settle(page);
  const p = await page.evaluate(() => window.__app.scene.project('b_frontal'));
  await page.evaluate(({ x, y }) => {
    const c = document.querySelector('#canvas');
    const o = { clientX: x, clientY: y, pointerId: 7, isPrimary: true, pointerType: 'touch', button: 0, bubbles: true };
    c.dispatchEvent(new PointerEvent('pointerdown', o));
    window.__lp = () => c.dispatchEvent(new PointerEvent('pointerup', o));
  }, p);
  await page.waitForTimeout(800);
  await expect(page.locator('#ctx-menu')).toBeVisible();
  const before = await page.evaluate(() => window.__app.current);
  await page.evaluate(() => window.__lp());
  expect(await page.evaluate(() => window.__app.current)).toBe(before);
  expect((await page.locator('#ctx-title').textContent()).length).toBeGreaterThan(2);
  await page.locator('#ctx-menu [data-menu="hide"]').click();
  await expect(page.locator('#ctx-menu')).toBeHidden();
  await expect(page.locator('#hidden-text')).toHaveText('1 yapı gizli');
  const hiddenId = await page.evaluate(() => window.__app.scene.hidden[0]);
  expect(await vis(hiddenId)).toBe(false);
  // Gizli yapı listeden seçilince yeniden görünür
  await page.evaluate((id) => window.__app.select(id, { instant: true }), hiddenId);
  expect(await vis(hiddenId)).toBe(true);

  // Yalnız bunu ve ilişkilileri göster
  await page.evaluate(() => window.__app.select('n_ian', { instant: true }));
  await page.evaluate(() => document.querySelector('[data-act="solo"]').click());
  expect(await vis('n_ian')).toBe(true);
  expect(await vis('n_lingual')).toBe(true);
  expect(await vis('b_frontal')).toBe(false);
  await expect(page.locator('#hidden-bar')).toBeVisible();
  await page.locator('#hidden-show').click();
  expect(await vis('b_frontal')).toBe(true);
});

test('delikler: halka delikten geçen yapıya göre döner, delik adları yalnız görünenlerde', async ({ page }, info) => {
  await open(page);
  const rings = await page.evaluate(() => [...window.__app.scene.records.values()].filter((r) => r.layer === 'foramen').map((r) => ({ id: r.id, ring: r.meshes[0].geometry.type, axis: !!r.meshes[0].userData.axis })));
  expect(rings.every((r) => r.ring === 'TorusGeometry')).toBe(true);
  // Sinir veya damarı modelde olan başlıca delikler yönlenmiş olmalı
  for (const id of ['f_ovale', 'f_rotundum', 'f_mental', 'f_infraorbital', 'f_mandibular', 'f_stylomastoid']) expect(rings.find((r) => r.id === id).axis, id).toBe(true);
  await page.evaluate(() => { window.__app.select('f_ovale', { instant: true }); window.__app.scene.setView('bottom'); });
  await page.locator('#btn-holes').click();
  await settle(page);
  await page.waitForTimeout(400);
  const visible = () => page.evaluate(() => [...document.querySelectorAll('.hole-label')].filter((l) => l.style.visibility === 'visible').map((l) => l.dataset.goto));
  const shown = await visible();
  expect(shown.length).toBeGreaterThan(2);
  expect(shown).toContain('f_ovale');
  await shot(page, info, '41-delik-adlari');
  // Önden bakınca kafa tabanı delikleri kemiğin arkasında kalır
  await page.evaluate(() => window.__app.scene.setView('front'));
  await settle(page);
  await page.waitForTimeout(400);
  expect(await visible()).not.toContain('f_jugular');
  await page.locator('#btn-holes').click();
  await expect(page.locator('.hole-label')).toHaveCount(0);
});

test('sinirler: çıkış notu, chorda tympani fasiyal gövdeden ayrı yoldan çatallanır', async ({ page }) => {
  await open(page);
  const missing = await page.evaluate(() => window.__app.items.filter((s) => s.layer === 'nerve' && !s.exit).map((s) => s.id));
  expect(missing).toEqual([]);
  await page.evaluate(() => window.__app.select('n_chorda', { instant: true }));
  await expect(page.locator('#detail .par.exit')).toContainText('foramen stylomastoideum');
  const g = await page.evaluate(() => {
    const pts = (id) => {
      const out = [];
      for (const m of window.__app.scene.records.get(id).meshes) {
        if (m.userData.side !== 'R') continue;
        m.updateWorldMatrix(true, false);
        const a = m.geometry.attributes.position;
        const e = m.matrixWorld.elements;
        for (let i = 0; i < a.count; i++) {
          const x = a.getX(i); const y = a.getY(i); const z = a.getZ(i);
          out.push([e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]]);
        }
      }
      return out;
    };
    const ch = pts('n_chorda');
    const vii = pts('n_vii');
    const near = (p) => {
      let b = Infinity;
      for (const q of vii) b = Math.min(b, Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]));
      return b;
    };
    // Çatal noktası (Z-Anatomy [-45.4, 11, 1573.8] sahne koordinatında)
    const fork = [-45.4, -16.2, -16];
    const d = ch.map(near);
    const far = ch.map((p, i) => [Math.hypot(p[0] - fork[0], p[1] - fork[1], p[2] - fork[2]), d[i]]).filter(([f]) => f > 5);
    return { touch: Math.min(...d), parallel: far.filter(([, x]) => x < 2).length / far.length };
  });
  // Çatal noktasında birleşir; oradan 5 mm sonra fasiyal gövdeye paralel seyretmez
  expect(g.touch).toBeLessThan(1.5);
  expect(g.parallel).toBeLessThan(0.02);
});

test('iPad gezinme: yakınlaştır/uzaklaştır, kaydırma modu, iki kez dokunma', async ({ page }) => {
  await open(page);
  await settle(page);
  const dist = () => page.evaluate(() => window.__app.scene.camera.position.distanceTo(window.__app.scene.controls.target));
  const d0 = await dist();
  await page.locator('#nav [data-nav="in"]').click();
  await settle(page);
  expect(await dist()).toBeLessThan(d0 * 0.8);
  await page.locator('#nav [data-nav="out"]').click();
  await settle(page);
  expect(Math.abs((await dist()) - d0)).toBeLessThan(d0 * 0.05);
  await page.locator('#nav [data-nav="pan"]').click();
  await expect(page.locator('#nav [data-nav="pan"]')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.__app.scene.controls.touches.ONE)).toBe(1);
  await page.locator('#nav [data-nav="pan"]').click();
  expect(await page.evaluate(() => window.__app.scene.controls.touches.ONE)).toBe(0);
  // İki kez dokunma kafatasındaki noktaya yaklaşır
  const p = await page.evaluate(() => window.__app.scene.project('b_frontal'));
  await page.evaluate(({ x, y }) => {
    const c = document.querySelector('#canvas');
    const o = { clientX: x, clientY: y, pointerId: 3, isPrimary: true, pointerType: 'touch', button: 0, bubbles: true };
    for (let i = 0; i < 2; i++) {
      c.dispatchEvent(new PointerEvent('pointerdown', o));
      c.dispatchEvent(new PointerEvent('pointerup', o));
    }
  }, p);
  await settle(page);
  expect(await dist()).toBeLessThan(d0 * 0.7);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('#stage')).userSelect)).toBe('none');
});

test('geri al: her dokunuş bir adım, seçim, katman, gizleme ve kamera önceki hâline döner', async ({ page }) => {
  await open(page);
  await settle(page);
  const undo = page.locator('#nav [data-nav="undo"]');
  await expect(undo).toBeDisabled();
  const cam = () => page.evaluate(() => window.__app.scene.camera.position.toArray());
  const cam0 = await cam();
  await page.evaluate(() => window.__app.select('n_vii', { instant: true }));
  await settle(page);
  await page.locator('#chips [data-layer="muscle"]').click();
  await page.evaluate(() => document.querySelector('[data-act="hide"]').click());
  expect(await page.evaluate(() => window.__app.current)).toBe(null);
  await page.locator('#stage-tools [data-view-preset="bottom"]').click();
  await settle(page);
  expect(await page.evaluate(() => window.__app.undoDepth)).toBe(4);

  // Alt görünüm geri alınır: kamera gizlemeden önceki yere döner, gizleme sürer
  await undo.click();
  await settle(page);
  expect(await page.evaluate(() => window.__app.scene.hidden)).toEqual(['n_vii']);
  // Gizleme geri alınır: n. facialis yeniden görünür ve seçili
  await undo.click();
  await settle(page);
  expect(await page.evaluate(() => window.__app.scene.hidden)).toEqual([]);
  expect(await page.evaluate(() => window.__app.current)).toBe('n_vii');
  expect(await page.evaluate(() => window.__app.scene.layerOn.muscle)).toBe(true);
  // Kas katmanı geri alınır
  await undo.click();
  expect(await page.evaluate(() => window.__app.scene.layerOn.muscle)).toBe(false);
  await expect(page.locator('#chips [data-layer="muscle"]')).toHaveAttribute('aria-pressed', 'false');
  // Seçim geri alınır: hiçbir şey seçili değil, kamera başlangıçta
  await undo.click();
  await settle(page);
  expect(await page.evaluate(() => window.__app.current)).toBe(null);
  const c = await cam();
  expect(Math.hypot(c[0] - cam0[0], c[1] - cam0[1], c[2] - cam0[2])).toBeLessThan(2);
  await expect(undo).toBeDisabled();
});

test('paneller: yatayda liste ve açıklama gizlenir, sahne genişler, tercih hatırlanır', async ({ page }) => {
  await open(page);
  const w = () => page.evaluate(() => document.querySelector('#stage').clientWidth);
  if (portrait(page)) {
    // Dikeyde açıklama alttaki sayfa olarak kalır, ayrı gizleme düğmesi yok
    await expect(page.locator('#btn-detail')).toBeHidden();
    return;
  }
  const w0 = await w();
  await page.locator('#btn-detail').click();
  await expect(page.locator('#detail-panel')).toBeHidden();
  await expect(page.locator('#btn-detail')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#btn-list').click();
  await expect(page.locator('#list-panel')).toBeHidden();
  await expect.poll(w).toBeGreaterThan(w0 + 500);
  // Panel gizliyken seçim çalışır ve sahne çizer
  await page.evaluate(() => window.__app.select('n_vii', { instant: true }));
  expect(await page.evaluate(() => window.__app.current)).toBe('n_vii');
  await page.reload();
  await page.waitForFunction(() => window.__app?.ready, null, { timeout: 90_000 });
  await expect(page.locator('#detail-panel')).toBeHidden();
  await expect(page.locator('#list-panel')).toBeHidden();
  await page.locator('#btn-detail').click();
  await page.locator('#btn-list').click();
  await expect(page.locator('#detail-panel')).toBeVisible();
  await expect(page.locator('#list-panel')).toBeVisible();
  await expect.poll(w).toBeLessThan(w0 + 5);
});
