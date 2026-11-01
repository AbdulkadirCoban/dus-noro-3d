import { getProgress, saveProgress, resetProgress } from './store.js';

const MODES = [
  { id: 'mixed', name: 'Karışık' },
  { id: 'identify', name: '3B: Bu yapı nedir?' },
  { id: 'foramen', name: 'Delik ve içerik' },
  { id: 'lesion', name: 'Lezyon senaryosu' },
  { id: 'pin', name: '3B pin testi' },
];
const PIN_MODES = [
  { id: 'pin', name: 'Karışık' },
  { id: 'pin-touch', name: 'Dokun' },
  { id: 'pin-name', name: 'Bu pin nedir?' },
];
const SESSION_LEN = 10;

const shuffle = (a) => {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
};

const isAttach = (s) => s.cat === 'attach';
const isTooth = (s) => s.cat === 'teeth';
// "16 – Üst sağ birinci molar": ad konumu söylediğinden şıkta yalnız FDI numarası kullanılır
const fdi = (s) => s.name.split(' – ')[0];

export function createQuiz({ el, items, byId, bank, api, pins }) {
  const identifiable = items.filter((s) => s.layer !== 'block' && s.layer !== 'context');
  const { families, familyOf } = pins.pool;
  const dentalPool = [...familyOf.keys()].map((id) => byId.get(id));
  let session = null;
  let pinOn = false;

  // Şık metinleri: ilk eleman doğru cevaptır. Yapışma yalnız yapışmayla, diş yalnız dişle karşılaştırılır
  function choices(st, pool) {
    const others = pool.filter((o) => o.id !== st.id);
    if (isTooth(st)) {
      const n = Number(fdi(st));
      const [q, p] = [Math.floor(n / 10), n % 10];
      // Aynı dişin diğer çeyrekleri ve aynı çeyrekteki komşuları: konum tek başına cevabı vermez
      const near = others.filter(isTooth).filter((o) => {
        const m = Number(fdi(o));
        return m % 10 === p || (Math.floor(m / 10) === q && Math.abs(m % 10 - p) === 1);
      });
      return [fdi(st), ...shuffle(near).slice(0, 3).map(fdi)];
    }
    if (isAttach(st)) {
      const suffix = st.id.slice(3);
      const group = byId.get(`m_${suffix}`)?.cat;
      const attaches = others.filter(isAttach);
      const twin = attaches.filter((o) => o.id.slice(3) === suffix);
      const sameGroup = attaches.filter((o) => o.id.slice(3) !== suffix && byId.get(`m_${o.id.slice(3)}`)?.cat === group);
      const rest = attaches.filter((o) => o.id.slice(3) !== suffix && byId.get(`m_${o.id.slice(3)}`)?.cat !== group);
      return [st.name, ...[...twin, ...shuffle(sameGroup), ...shuffle(rest)].slice(0, 3).map((o) => o.name)];
    }
    const plain = others.filter((o) => !isAttach(o) && !isTooth(o));
    const sameCat = plain.filter((o) => o.cat === st.cat);
    const sameLayer = plain.filter((o) => o.layer === st.layer && o.cat !== st.cat);
    const anyOther = plain.filter((o) => o.layer !== st.layer && o.cat !== st.cat);
    return [st.name, ...[...shuffle(sameCat), ...shuffle(sameLayer), ...shuffle(anyOther)].slice(0, 3).map((o) => o.name)];
  }

  function identifyQuestion(st) {
    const opts = choices(st, identifiable);
    return {
      key: `id:${st.id}`,
      type: 'identify',
      q: isTooth(st) ? 'Bu dişin FDI numarası nedir?' : isAttach(st) ? 'Bu kas yapışması hangisidir?' : 'Bu yapı nedir?',
      options: shuffle(opts),
      correct: opts[0],
      answerId: st.id,
      show3d: st.id,
      why: st.spot?.[0] ?? '',
    };
  }

  function bankQuestion(b, i) {
    return { key: `b:${i}`, type: b.type, q: b.q, options: shuffle(b.options), correct: b.options[b.answer], answerId: b.answerId, why: b.why };
  }

  function touchPrompt(st) {
    if (isTooth(st)) return `${fdi(st)} numaralı dişe dokun`;
    const m = st.name.match(/^(.+) – (origo|insersiyo)$/);
    if (m) return `${m[1]} ${m[2]}suna dokun`;
    return `${st.name} pinine dokun`;
  }

  function pinQuestion(kind, id, side) {
    const st = byId.get(id);
    if (!st || !familyOf.has(id)) return null;
    const opts = kind === 'name' ? choices(st, dentalPool) : null;
    return {
      key: `pin:${kind}:${id}:${side}`,
      type: 'pin',
      kind,
      side,
      q: kind === 'touch' ? touchPrompt(st) : isTooth(st) ? 'Bu pin hangi diş? (FDI)' : 'Bu pin nedir?',
      options: opts ? shuffle(opts) : null,
      correct: opts ? opts[0] : st.name,
      answerId: id,
      why: st.spot?.[0] ?? '',
    };
  }

  function byKey(key) {
    if (key.startsWith('pin:')) {
      const [, kind, id, side] = key.split(':');
      return pinQuestion(kind, id, side);
    }
    if (key.startsWith('id:')) {
      const st = byId.get(key.slice(3));
      return st ? identifyQuestion(st) : null;
    }
    const i = Number(key.slice(2));
    return bank[i] ? bankQuestion(bank[i], i) : null;
  }

  // Aileler sırayla dolaşılır: oturum kemik, diş, delik, kas, TME ve sinirden karışık gelir
  function pinOrder(mode) {
    const queues = Object.values(families).map(shuffle);
    const out = [];
    while (queues.some((q) => q.length)) for (const q of shuffle(queues)) if (q.length) out.push(q.pop());
    return out.map((st, i) => {
      const kind = mode === 'pin-touch' ? 'touch' : mode === 'pin-name' ? 'name' : i % 2 ? 'name' : 'touch';
      const tags = api.sidesOf(st.id);
      return pinQuestion(kind, st.id, tags[Math.floor(Math.random() * tags.length)]);
    });
  }

  function buildSession(mode, keys) {
    // Modeller yüklenmeden pin yerleştirilemez
    if (keys) return shuffle(keys).map(byKey).filter((q) => q && (q.type !== 'pin' || api.ready));
    if (mode.startsWith('pin')) return pinOrder(mode);
    const ident = () => shuffle(identifiable).slice(0, SESSION_LEN).map(identifyQuestion);
    const fromBank = (type) => shuffle(bank.map((b, i) => [b, i]).filter(([b]) => b.type === type)).slice(0, SESSION_LEN).map(([b, i]) => bankQuestion(b, i));
    if (mode === 'identify') return ident();
    if (mode === 'foramen') return fromBank('foramen');
    if (mode === 'lesion') return fromBank('lesion');
    const mix = [...ident().slice(0, 4), ...fromBank('foramen').slice(0, 3), ...fromBank('lesion').slice(0, 3)];
    return shuffle(mix);
  }

  function start(mode, keys) {
    const all = buildSession(mode, keys);
    const isPin = !keys && mode.startsWith('pin');
    // Yerleştirilemeyen pin sorusunun yerine yedekten soru alınır
    session = { mode, list: isPin ? all.slice(0, SESSION_LEN) : all, spare: isPin ? all.slice(SESSION_LEN) : [], i: 0, score: 0, good: 0, bad: 0, answered: null };
    showQuestion();
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  }

  function scoreBar(p) {
    const pct = p.answered ? Math.round((p.correct / p.answered) * 100) : 0;
    return `<div class="qscore"><span>Toplam: <b>${p.answered}</b></span><span>Doğru: <b>${p.correct}</b></span><span>Başarı: <b>%${pct}</b></span><span>En iyi oturum: <b>${p.best}</b></span></div>`;
  }

  function leavePin(goHome) {
    if (!pinOn) return;
    pinOn = false;
    pins.clear();
    api.clear();
    api.pinMode(false);
    if (goHome) api.home();
  }

  function leave() {
    leavePin(true);
    session = null;
  }

  function showMenu() {
    leave();
    api.clear();
    const p = getProgress();
    const wrongKeys = Object.keys(p.wrong);
    const wrongRows = wrongKeys
      .map(byKey)
      .filter(Boolean)
      .map((q) => `<button data-retry="${esc(q.key)}">${esc(q.type === 'identify' ? `3B: ${byId.get(q.answerId).name}` : q.type === 'pin' ? `Pin: ${byId.get(q.answerId).name}` : q.q)} <small>(${p.wrong[q.key]}×)</small></button>`)
      .join('');
    el.innerHTML = `
      <h2>Quiz</h2>
      ${scoreBar(p)}
      <div class="qmodes">${MODES.map((m) => `<button data-mode="${m.id}" ${m.id === 'pin' && !api.ready ? 'disabled' : ''}>${m.name}</button>`).join('')}</div>
      <div class="qnav"><button id="q-wrong" class="primary" ${wrongKeys.length ? '' : 'disabled'}>Yanlışlarımı tekrar et (${wrongKeys.length})</button></div>
      <h3>Yanlış yapılan sorular</h3>
      ${wrongRows ? `<div class="wronglist">${wrongRows}</div>` : '<p class="empty">Henüz yanlış yok.</p>'}
      <div class="qnav"><button id="q-reset">İlerlemeyi sıfırla</button></div>`;
    el.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => (b.dataset.mode === 'pin' ? showPinMenu() : start(b.dataset.mode))));
    el.querySelectorAll('[data-retry]').forEach((b) => b.addEventListener('click', () => start('wrong', [b.dataset.retry])));
    el.querySelector('#q-wrong').addEventListener('click', () => start('wrong', wrongKeys));
    el.querySelector('#q-reset').addEventListener('click', () => { resetProgress(); showMenu(); });
  }

  function showPinMenu() {
    el.innerHTML = `
      <h2>3B pin testi</h2>
      <p class="empty qhint">Yalnız diş hekimliği yapıları: çene-yüz kemikleri, dişler, delikler, çiğneme kasları, TME ve blok sinirleri.</p>
      <div class="qmodes">${PIN_MODES.map((m) => `<button data-pinmode="${m.id}">${m.name}</button>`).join('')}</div>
      <div class="qnav"><button id="q-exit">Menüye dön</button></div>`;
    el.querySelectorAll('[data-pinmode]').forEach((b) => b.addEventListener('click', () => start(b.dataset.pinmode)));
    el.querySelector('#q-exit').addEventListener('click', showMenu);
  }

  // Görünür kamera açısı bulunamazsa soru atlanır; oturum yedekten tamamlanır
  function placePin() {
    for (;;) {
      const q = session.list[session.i];
      if (!q || q.type !== 'pin') return q ? { q } : null;
      const count = q.kind === 'touch' ? 4 + Math.floor(Math.random() * 3) : 1;
      const layout = pins.place(q.answerId, q.side, count);
      if (layout) return { q, layout };
      const next = session.spare.shift();
      if (next) session.list[session.i] = next;
      else session.list.splice(session.i, 1);
    }
  }

  function showQuestion() {
    // Renk ve görünüm, yerleşim ışınlarından önce açılır
    if (session.list[session.i]?.type === 'pin' && !pinOn) {
      pinOn = true;
      api.pinMode(true);
    }
    const placed = placePin();
    if (!placed) return showEnd();
    const { q, layout } = placed;
    session.answered = null;
    if (q.type === 'pin') return showPinQuestion(q, layout);
    leavePin(false);
    if (q.show3d) api.showHidden(q.show3d);
    else api.clear();
    el.innerHTML = `
      <div class="qscore"><span>Soru <b>${session.i + 1}/${session.list.length}</b></span><span>Skor: <b>${session.score}</b></span></div>
      <div class="qtext">${esc(q.q)}</div>
      ${q.show3d ? '<p class="empty" style="margin:0">Parlayan yapıya bak; döndürüp yakınlaştırabilirsin.</p>' : ''}
      <div class="qopts">${q.options.map((o, i) => `<button data-opt="${i}">${esc(o)}</button>`).join('')}</div>
      <div class="qnav"><button id="q-exit">Menüye dön</button></div>`;
    el.querySelectorAll('[data-opt]').forEach((b) => b.addEventListener('click', () => answer(q, b)));
    el.querySelector('#q-exit').addEventListener('click', showMenu);
    el.scrollTop = 0;
  }

  function showPinQuestion(q, layout) {
    api.clear();
    pins.setScore(session.good, session.bad);
    pins.show(layout, q.kind === 'touch');
    el.innerHTML = `
      <div class="qscore"><span>Soru <b>${session.i + 1}/${session.list.length}</b></span><span>Skor: <b>${session.score}</b></span></div>
      <div class="qtext">${esc(q.q)}</div>
      ${q.options
        ? `<p class="empty qhint">Beyaz pine bak; döndürüp yakınlaştırabilirsin.</p><div class="qopts">${q.options.map((o, i) => `<button data-opt="${i}">${esc(o)}</button>`).join('')}</div>`
        : '<p class="empty qhint">Doğru beyaz pine dokun; döndürüp yakınlaştırabilirsin.</p>'}
      <div class="qnav"><button id="q-view">Soru açısına dön</button><button id="q-exit">Menüye dön</button></div>`;
    el.querySelectorAll('[data-opt]').forEach((b) => b.addEventListener('click', () => answer(q, b)));
    el.querySelector('#q-view').addEventListener('click', () => pins.resetView());
    el.querySelector('#q-exit').addEventListener('click', showMenu);
    el.scrollTop = 0;
  }

  pins.onTap((n) => {
    const q = session?.list[session.i];
    if (!q || q.type !== 'pin' || q.kind !== 'touch' || session.answered) return;
    const right = n === pins.state.target;
    record(q, right);
    pins.reveal(n, byId.get(q.answerId).name);
    api.showPinAnswer(q.answerId);
    showWhy(q, right, el.querySelector('.qhint'));
  });

  function record(q, right) {
    session.answered = { right };
    if (right) session.good += 1;
    else session.bad += 1;
    pins.setScore(session.good, session.bad);
    const p = getProgress();
    p.answered += 1;
    if (right) {
      p.correct += 1;
      session.score += 1;
      delete p.wrong[q.key];
    } else {
      p.wrong[q.key] = (p.wrong[q.key] ?? 0) + 1;
    }
    p.best = Math.max(p.best, session.score);
    saveProgress(p);
  }

  function answer(q, btn) {
    if (session.answered) return;
    const chosen = q.options[Number(btn.dataset.opt)];
    const right = chosen === q.correct;
    record(q, right);

    el.querySelectorAll('[data-opt]').forEach((b) => {
      const text = q.options[Number(b.dataset.opt)];
      if (text === q.correct) b.classList.add('right');
      else if (b === btn) b.classList.add('wrong');
      b.disabled = true;
    });
    // Yanlışta doğru yapı 3B'de etiketli gösterilir; doğruda da pekiştirmek için aynı görünüm kullanılır
    if (q.type === 'pin') {
      pins.reveal(null, byId.get(q.answerId).name);
      api.showPinAnswer(q.answerId);
    } else {
      api.showAnswer(q.answerId);
    }
    showWhy(q, right, el.querySelector('.qopts'));
  }

  function showWhy(q, right, after) {
    const st = byId.get(q.answerId);
    const why = document.createElement('div');
    why.className = `qwhy ${right ? 'good' : 'bad'}`;
    why.innerHTML = `<b>${right ? 'Doğru.' : `Yanlış. Doğru cevap: ${esc(q.correct)}.`}</b><br>${esc(q.why)}<br><small>${q.type === 'pin' ? 'Doğru pin' : '3B’de gösterilen'}: ${esc(st.name)}</small>`;
    const nav = document.createElement('div');
    nav.className = 'qnav';
    const last = session.i === session.list.length - 1;
    nav.innerHTML = `<button id="q-next" class="primary">${last ? 'Sonucu gör' : q.type === 'pin' ? 'Sonraki' : 'Sonraki soru'}</button>`;
    after.after(why, nav);
    el.querySelector('#q-next').addEventListener('click', () => {
      session.i += 1;
      showQuestion();
    });
    why.scrollIntoView({ block: 'nearest' });
  }

  function showEnd() {
    const n = session.list.length;
    leavePin(true);
    el.innerHTML = `<h2>Oturum bitti</h2><p class="qtext">${session.score} / ${n} doğru</p>${scoreBar(getProgress())}<div class="qnav"><button id="q-again" class="primary">Yeni oturum</button><button id="q-menu">Menü</button></div>`;
    const mode = session.mode === 'wrong' ? 'mixed' : session.mode;
    el.querySelector('#q-again').addEventListener('click', () => start(mode));
    el.querySelector('#q-menu').addEventListener('click', showMenu);
    api.clear();
  }

  function onReady() {
    // Menü açıksa pin testi düğmesi artık kullanılabilir
    if (!session && !el.hidden && el.querySelector('[data-mode="pin"]')) showMenu();
  }

  return { showMenu, start, leave, onReady, identifyQuestion, get session() { return session; } };
}
