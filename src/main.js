import './style.css';
import structures from '../data/structures.json';
import index from '../data/geo_index.json';
import bank from '../data/quiz.json';
import { createScene } from './scene.js';
import { createQuiz } from './quiz.js';
import { createPins } from './pins.js';
import { renderSources } from './sources.js';
import { createSection } from './section.js';
import { createMotion } from './motion.js';
import { getBoneTransparency, getColorBones, saveBoneTransparency, saveColorBones } from './store.js';

const { cats, items } = structures;
const byId = new Map(items.map((s) => [s.id, s]));
const $ = (s) => document.querySelector(s);
const app = $('#app');
const main = $('#main');

const scene = createScene({ canvas: $('#canvas'), stage: $('#stage'), labelsEl: $('#labels'), index, byId });

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// Metindeki yapı kimliklerini dokunulabilir bağlantıya çevirir
const linkify = (text) =>
  esc(text).replace(/\b[a-z]{1,3}_[a-z0-9_]+\b/g, (m) => {
    const st = byId.get(m);
    return st ? `<button class="ilink" data-goto="${m}">${esc(st.name)}</button>` : m;
  });
const norm = (s) => s.toLocaleLowerCase('tr').replace(/ı/g, 'i').normalize('NFD').replace(/[̀-ͯ]/g, '');

// ---------- Katman filtreleri ----------
const CHIPS = [
  ['bone', 'Kemik', 'lay-bone'],
  ['foramen', 'Delik', 'lay-foramen'],
  ['nerve', 'Sinir', 'lay-nerve'],
  ['artery', 'Arter', 'lay-artery'],
  ['vein', 'Ven', 'lay-vein'],
  ['tooth', 'Diş', 'lay-tooth'],
  ['muscle', 'Kas/TME', 'lay-muscle'],
  ['attachment', 'Yapışma', 'lay-attach_o'],
  ['context', 'Dura/Beyin sapı', 'lay-context'],
];
$('#chips').innerHTML = CHIPS.map(([k, n, c]) => `<button class="chip ${c} ${scene.layerOn[k] ? 'on' : ''}" data-layer="${k}" aria-pressed="${scene.layerOn[k]}"><i class="dot"></i>${n}</button>`).join('');
function setLayerChip(layer, on) {
  const b = $(`#chips [data-layer="${layer}"]`);
  b.classList.toggle('on', on);
  b.setAttribute('aria-pressed', on);
  scene.setLayer(layer, on);
}
$('#chips').addEventListener('click', (e) => {
  const b = e.target.closest('[data-layer]');
  if (b) setLayerChip(b.dataset.layer, !scene.layerOn[b.dataset.layer]);
});

// Kemik varsayılan olarak opaktır; kaydırıcı içeriyi görmek için saydamlaştırır
const boneRange = $('#bone-range');
const applyBone = (t) => scene.setBoneOpacity(1 - t / 100);
$('#chips').append($('#bone-op'));
boneRange.value = getBoneTransparency();
applyBone(Number(boneRange.value));
boneRange.addEventListener('input', () => {
  const t = Number(boneRange.value);
  applyBone(t);
  saveBoneTransparency(t);
});

// Renkli kemik tercihi atlasa aittir; pin testi bitince bu tercihe dönülür
const colorBtn = document.createElement('button');
colorBtn.id = 'btn-color';
colorBtn.className = 'chip lay-bone';
colorBtn.innerHTML = '<i class="dot"></i>Renkli kemik';
const applyColorPref = (on) => {
  colorBtn.classList.toggle('on', on);
  colorBtn.setAttribute('aria-pressed', on);
  scene.setColorMode(on);
};
applyColorPref(getColorBones());
colorBtn.addEventListener('click', () => {
  const on = !colorBtn.classList.contains('on');
  saveColorBones(on);
  applyColorPref(on);
});
$('#chips').append(colorBtn);

// ---------- Yapı listesi ----------
const listEl = $('#list');
function renderList(filter = '') {
  const q = norm(filter.trim());
  const match = (s) => !q || norm(`${s.name} ${s.id} ${(s.route ?? []).join(' ')}`).includes(q);
  listEl.innerHTML = cats
    .map((c) => {
      const rows = items.filter((s) => s.cat === c.id && match(s));
      if (!rows.length) return '';
      const open = q || c.id === 'foramina' || rows.some((s) => s.id === current) ? 'open' : '';
      return `<details ${open} data-cat="${c.id}"><summary>${esc(c.name)} (${rows.length})</summary>${rows
        .map((s) => `<button class="item lay-${s.layer} ${s.id === current ? 'on' : ''}" data-id="${s.id}"><i class="dot"></i><span>${esc(s.name)}</span></button>`)
        .join('')}</details>`;
    })
    .join('') || '<p class="empty" style="padding:0 8px">Sonuç bulunamadı.</p>';
}
$('#search').addEventListener('input', (e) => renderList(e.target.value));
listEl.addEventListener('click', (e) => {
  const b = e.target.closest('[data-id]');
  if (!b) return;
  select(b.dataset.id);
  app.classList.remove('list-open');
});
$('#btn-list').addEventListener('click', () => app.classList.toggle('list-open'));
// Liste açıkken sahneye dokunmak listeyi kapatsın
$('#stage').addEventListener('pointerdown', () => app.classList.remove('list-open'));

// ---------- Seçim ve ayrıntı paneli ----------
let current = null;
let detailTab = 'route';
const TABS = [
  ['route', 'Topografik Rota'],
  ['through', 'İçinden Geçenler / Dallar'],
  ['spot', 'DUS Spot'],
  ['clinic', 'Klinik Lezyon'],
];
const detailEl = $('#detail');
const listHtml = (arr) => (arr?.length ? `<ul>${arr.map((t) => `<li>${linkify(t)}</li>`).join('')}</ul>` : '<p class="empty">Bu yapı için ayrı bir madde yok.</p>');

function renderDetail() {
  const s = byId.get(current);
  if (!s) {
    detailEl.innerHTML = `<h2>Yapı seçin</h2><p class="empty">Listeden veya sahneden bir yapıya dokunun. Tek parmak döndürür, iki parmak yakınlaştırır ve kaydırır.</p>`;
    return;
  }
  const geo = index.items[s.id];
  const badges = [`<span class="badge">${esc(cats.find((c) => c.id === s.cat).name)}</span>`];
  if (geo?.marker) badges.push('<span class="badge">Konum işaretçisi</span>');
  else if (geo?.schematic) badges.push('<span class="badge warn">Şematik yol</span>');
  else if (geo) badges.push('<span class="badge ok">Gerçek model</span>');
  const parRows = s.pre
    ? [['Preganglioner kaynak', s.pre], ['Postganglioner hedef', s.post], ['Geçtiği yol', s.path]]
    : s.origin
      ? [['Sinir', s.nerve], ['Hareket', s.action]]
      : [];
  const par = parRows.length ? `<div class="par">${parRows.map(([k, v]) => `<div><b>${k}</b>${linkify(v)}</div>`).join('')}</div>` : '';
  const body = {
    route: listHtml(s.route) + par,
    through: listHtml([...(s.through ?? []), ...(s.branches ?? [])]),
    spot: listHtml(s.spot),
    clinic: listHtml(s.clinic),
  }[detailTab];
  detailEl.innerHTML = `
    <h2>${esc(s.name)}</h2>
    <div class="badges">${badges.join('')}</div>
    <div class="dtabs" role="tablist">${TABS.map(([k, n]) => `<button role="tab" data-tab="${k}" class="${k === detailTab ? 'on' : ''}">${n}</button>`).join('')}</div>
    <div id="dbody">${body}</div>
    <div class="rel-title">Komşu yapılar</div>
    <div class="rel-row">${(s.rel ?? []).map((id) => `<button data-goto="${id}">${esc(byId.get(id).name)}</button>`).join('')}</div>
    <p class="ref">Kaynak notu: ${esc(s.ref)}</p>`;
  detailEl.scrollTop = 0;
}
detailEl.addEventListener('click', (e) => {
  const t = e.target.closest('[data-tab]');
  if (t) {
    detailTab = t.dataset.tab;
    renderDetail();
    return;
  }
  const g = e.target.closest('[data-goto]');
  if (g) select(g.dataset.goto);
});

function select(id, { instant = false } = {}) {
  const s = byId.get(id);
  if (!s) return;
  current = id;
  const rel = s.rel ?? [];
  if (s.layer === 'block') {
    scene.highlight({ sel: s.focus, rel: [], needle: s.needle, primary: s.focus[0], relLabels: s.focus.slice(1, 4), labelTap: select });
    scene.focusOn(s.focus.filter((f) => byId.get(f).layer !== 'bone'), { instant });
  } else {
    scene.highlight({ sel: [id], rel: rel.slice(0, 3), primary: id, labelTap: select });
    scene.focusOn([id], { instant });
  }
  listEl.querySelectorAll('.item.on').forEach((b) => b.classList.remove('on'));
  const row = listEl.querySelector(`.item[data-id="${id}"]`);
  if (row) {
    row.classList.add('on');
    row.closest('details').open = true;
    row.scrollIntoView({ block: 'nearest' });
  }
  $('#detail-panel').classList.remove('closed');
  $('#btn-sheet').setAttribute('aria-expanded', 'true');
  renderDetail();
}

function clearSelection() {
  current = null;
  scene.highlight({});
  listEl.querySelectorAll('.item.on').forEach((b) => b.classList.remove('on'));
  renderDetail();
}

scene.onPick((id) => {
  if (main.dataset.view !== 'atlas') return;
  if (id) select(id);
  else clearSelection();
});

$('#btn-sheet').addEventListener('click', () => {
  const closed = $('#detail-panel').classList.toggle('closed');
  $('#btn-sheet').setAttribute('aria-expanded', String(!closed));
});

// ---------- Görünüm düğmeleri ve kesit ----------
$('#stage-tools').addEventListener('click', (e) => {
  const b = e.target.closest('[data-view-preset]');
  if (b) scene.setView(b.dataset.viewPreset);
});
$('#btn-home').addEventListener('click', () => scene.home());
const clipBtn = $('#btn-clip');
const section = createSection({
  scene,
  panel: $('#section-panel'),
  canvas: $('#section-canvas'),
  title: $('#section-title'),
  zoomBtn: $('#section-zoom'),
  stage: $('#stage'),
  chips: $('#chips'),
  tools: $('#stage-tools'),
  clipPanel: $('#clip-panel'),
  motionPanel: $('#motion-panel'),
});
const motion = createMotion({
  scene,
  stage: $('#stage'),
  button: $('#btn-motion'),
  panel: $('#motion-panel'),
  chips: $('#chips'),
  tools: $('#stage-tools'),
  clipPanel: $('#clip-panel'),
  section,
  byId,
  index,
  onSelectMuscle: (id) => select(id),
  setLayerChip,
});
clipBtn.addEventListener('click', () => {
  const panel = $('#clip-panel');
  panel.hidden = !panel.hidden;
  clipBtn.setAttribute('aria-expanded', String(!panel.hidden));
  // Çene paneliyle aynı alanı kullanır; çene yerinde kalır, kesit hareketli duruşta incelenebilir
  if (panel.hidden) motion.showPanel();
  else motion.hidePanel();
  section.layout();
});
const sectionBtn = $('#btn-section');
const showSection = (on) => {
  section.show(on);
  sectionBtn.setAttribute('aria-expanded', String(on));
};
sectionBtn.addEventListener('click', () => showSection(!section.open));
$('#section-close').addEventListener('click', () => showSection(false));

// Kaydırıcı en sağda iken kesit yoktur; sola çekildikçe düzlem ilerler
const CLIP = { x: [-80, 80], y: [-210, 120], z: [-115, 105] };
const AXES = ['x', 'y', 'z'];
// Eksen düğmesi ilk açılışta kafatasının ortasına yakın bir düzlem kullanır
const lastClip = { x: 0, y: -20, z: 20 };
let sectionAxis = null;

function markPreset(key = null) {
  document.querySelectorAll('#clip-presets [data-preset]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === key)));
  if (!key) presetHint(null);
}
function setAxis(axis, target) {
  const hi = CLIP[axis][1];
  const input = $(`#clip-${axis}`);
  input.value = target;
  // Kaydırıcı adımına yuvarlanan değer düzlemde ve kesit görüntüsünde aynen kullanılır
  const v = Number(input.value);
  const on = v < hi;
  if (on) lastClip[axis] = v;
  scene.setClip(axis, on ? v : null);
  $(`.axis-btn[data-axis="${axis}"]`).setAttribute('aria-pressed', String(on));
  // Kesit görüntüsü son dokunulan düzlemi izler; kapanırsa açık kalan başka düzleme geçer
  if (on) sectionAxis = axis;
  else if (sectionAxis === axis) sectionAxis = AXES.find((a) => Number($(`#clip-${a}`).value) < CLIP[a][1]) ?? null;
  section.setPlane(sectionAxis, sectionAxis ? Number($(`#clip-${sectionAxis}`).value) : 0);
}
for (const axis of AXES) {
  const input = $(`#clip-${axis}`);
  const [lo, hi] = CLIP[axis];
  input.min = lo;
  input.max = hi;
  input.step = 1;
  input.value = hi;
  input.setAttribute('aria-label', `${axis} kesit düzlemi`);
  input.addEventListener('input', () => {
    markPreset();
    setAxis(axis, Number(input.value));
  });
}
document.querySelectorAll('.axis-btn').forEach((b) => b.addEventListener('click', () => {
  const axis = b.dataset.axis;
  const isOn = Number($(`#clip-${axis}`).value) < CLIP[axis][1];
  markPreset();
  setAxis(axis, isOn ? CLIP[axis][1] : lastClip[axis]);
}));
function clearClip() {
  for (const axis of AXES) setAxis(axis, CLIP[axis][1]);
  markPreset();
  section.setRoi(null);
}
$('#clip-reset').addEventListener('click', clearClip);

// Hazır kesitler: koordinatlar geo_index içindeki yapı konumlarından türetilir, elle yazılmaz
const sideOf = (id, tag = 'R') => index.items[id].sides.find((s) => s.tag === tag) ?? index.items[id].sides[0];
const PRESETS = {
  mandibular: {
    name: 'Mandibular kanal', axis: 'z', focus: 'n_ian', half: 30, radius: 62,
    // Sağ alt 1. molar hizası; kanal foramen mandibulare ile mentale arasındadır
    at: () => { const t = sideOf('t_46').c; return { value: t[2], center: [t[0], t[1], t[2]] }; },
  },
  sinus: {
    name: 'Maksiller sinüs', axis: 'z', focus: null, half: 38, radius: 68,
    hint: 'Modelde maksilla dolu kemiktir, sinüs boşluğu ayrı modellenmemiştir. Kesit, üst molar köklerinin sinüs tabanı hizasını gösterir.',
    // Üst 1. molar kökleri sinüs tabanına komşudur
    at: () => { const t = sideOf('t_16').c; const m = sideOf('b_maxilla').c; return { value: t[2], center: [t[0], (t[1] + m[1]) / 2 + 8, t[2]] }; },
  },
  tme: {
    name: 'TME', axis: 'x', focus: 'j_disc', half: 26, radius: 48,
    at: () => { const d = sideOf('j_disc').c; return { value: d[0], center: d }; },
  },
  palate: {
    name: 'Damak', axis: 'y', focus: null, half: 48, radius: 70,
    // Foramen incisivum damağın ön alt ucundadır; damak plağı arkada 7 mm yukarıda (maxilla ve palatinum içinden ışın ölçümü: y -42 ile -37 arası)
    at: () => { const f = sideOf('f_incisive').c; const t = sideOf('t_16').c; return { value: f[1] + 7, center: [0, f[1] + 7, (t[2] + f[2]) / 2] }; },
  },
};
function presetHint(text) {
  const el = $('#clip-hint');
  if (el.textContent === (text ?? '')) return;
  el.textContent = text ?? '';
  el.hidden = !text;
  section.layout();
}
$('#clip-presets').innerHTML = Object.entries(PRESETS).map(([k, p]) => `<button class="tool" data-preset="${k}" aria-pressed="false">${esc(p.name)}</button>`).join('');
function applyPreset(key) {
  const p = PRESETS[key];
  const { value, center } = p.at();
  for (const axis of AXES) if (axis !== p.axis) setAxis(axis, CLIP[axis][1]);
  setAxis(p.axis, value);
  markPreset(key);
  presetHint(p.hint);
  section.setRoi({ center, half: p.half });
  // Quizde seçim değiştirilmez, cevap açığa çıkmasın
  if (main.dataset.view === 'atlas') {
    if (p.focus) select(p.focus);
    else clearSelection();
  }
  scene.frameSection(p.axis, center, p.radius);
}
$('#clip-presets').addEventListener('click', (e) => {
  const b = e.target.closest('[data-preset]');
  if (b) applyPreset(b.dataset.preset);
});

// ---------- Quiz ----------
const pins = createPins({ layer: $('#pins'), stage: $('#stage'), scene, index, items, byId });
const quiz = createQuiz({
  el: $('#quiz-panel'),
  items,
  byId,
  bank,
  pins,
  api: {
    get ready() { return hooks.ready; },
    sidesOf: (id) => index.items[id].sides.map((x) => x.tag),
    // Pin testinde kemik opak ve renklidir, kesit kapalıdır; çıkınca eski hale dönülür
    pinMode(on) {
      $('#stage').classList.toggle('pin-mode', on);
      if (on) {
        motion.closeNow();
        clearClip();
        showSection(false);
        $('#clip-panel').hidden = true;
        clipBtn.setAttribute('aria-expanded', 'false');
        scene.setBoneOpacity(1);
        scene.setColorMode(true);
      } else {
        scene.setQuizView(null);
        applyBone(Number(boneRange.value));
        scene.setColorMode(getColorBones());
      }
    },
    home: () => scene.home(),
    // Diğer yapılar soluklaşmaz: pinlerin durduğu dişler ve kaslar görünür kalır
    showPinAnswer(id) {
      scene.highlight({ sel: [id], showLabels: false, keepBase: true });
    },
    clear() {
      scene.highlight({});
    },
    // Soru sırasında yapı etiketsiz vurgulanır, cevap gizli kalır
    showHidden(id) {
      scene.highlight({ sel: [id], showLabels: false });
      scene.focusOn([id]);
    },
    showAnswer(id) {
      const s = byId.get(id);
      scene.highlight({ sel: [id], rel: (s.rel ?? []).slice(0, 2), primary: id });
      scene.focusOn([id]);
    },
  },
});

// ---------- Sekmeler ----------
function setView(view) {
  // Pin yerleşimi ve quiz sıfır konumundaki çeneye göre çalışır
  if (view !== 'atlas') motion.closeNow();
  quiz.leave();
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.view === view));
  const isSources = view === 'sources';
  main.hidden = isSources;
  $('#sources').hidden = !isSources;
  app.classList.remove('list-open');
  $('#btn-list').style.visibility = view === 'atlas' ? 'visible' : 'hidden';
  if (isSources) return;
  main.dataset.view = view;
  $('#quiz-panel').hidden = view !== 'quiz';
  if (view === 'quiz') {
    quiz.showMenu();
  } else if (current) {
    select(current);
  } else {
    scene.highlight({});
  }
  scene.invalidate();
}
$('#tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-view]');
  if (b) setView(b.dataset.view);
});

// ---------- Başlangıç ----------
renderList();
renderDetail();
renderSources($('#sources'), { items, index });

const loaderEl = $('#loader');
window.__quizBank = bank;
const hooks = (window.__app = { ready: false, select, scene, section, motion, byId, items, setView, PRESETS, quiz, pins, get current() { return current; } });
scene
  .load(({ ratio, label, finished, file }) => {
    $('#loader-bar').style.width = `${Math.round(ratio * 100)}%`;
    $('#loader-text').textContent = `${label} katmanı ${finished ? 'hazır' : 'yükleniyor'}… %${Math.round(ratio * 100)}`;
    if (finished && file === 'bones') hooks.bonesReady = true;
  })
  .then(() => {
    loaderEl.hidden = true;
    hooks.ready = true;
    $('#btn-motion').hidden = false;
    // Quiz sırasında yeniden seçim yapılmaz: etiket cevabı açığa çıkarır
    if (current && main.dataset.view === 'atlas') select(current);
    quiz.onReady();
  })
  .catch((err) => {
    console.error(err);
    loaderEl.classList.add('err');
    $('#loader-text').textContent = 'Modeller yüklenemedi. Bağlantıyı kontrol edip sayfayı yenileyin.';
  });

// ---------- PWA ----------
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('sw.js', document.baseURI).href, { scope: './' }).catch(() => {});
  });
}
