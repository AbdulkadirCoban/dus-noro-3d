// İçerik modüllerini doğrulayıp data/structures.json ve data/quiz.json olarak yazar.
import fs from 'node:fs';
import { TEXT_A } from './content/text-a.mjs';
import { TEXT_B } from './content/text-b.mjs';
import { TEXT_DENTAL } from './content/text-dental.mjs';
import { TEXT_NECK, NERVE_EXIT } from './content/text-neck.mjs';
import { QUIZ } from './content/quiz.mjs';
import { GEO } from './content/geo.mjs';

const CATS = [
  { id: 'bones', name: 'Kafa kemikleri' },
  { id: 'foramina', name: 'Kafa tabanı delikleri ve boşluklar' },
  { id: 'cn', name: 'Kraniyal sinirler (CN I–XII)' },
  { id: 'vbr', name: 'Trigeminal dalları (V1, V2, V3)' },
  { id: 'cn2', name: 'VII, IX ve X dalları' },
  { id: 'ganglia', name: 'Gangliyonlar' },
  { id: 'ica', name: 'ICA ve Willis poligonu' },
  { id: 'vb', name: 'Vertebrobaziler sistem' },
  { id: 'eca', name: 'A. carotis externa ve dalları' },
  { id: 'max', name: 'A. maxillaris dalları' },
  { id: 'sin', name: 'Dural sinüsler ve venler' },
  { id: 'blocks', name: 'DUS: diş blokları' },
  { id: 'teeth', name: 'Dişler (FDI)' },
  { id: 'mastication', name: 'Çiğneme kasları' },
  { id: 'oralfloor', name: 'Ağız tabanı ve dil kasları' },
  { id: 'perioral', name: 'Perioral kaslar' },
  { id: 'tmj', name: 'Temporomandibular eklem' },
  { id: 'attach', name: 'Kas yapışmaları (origo ve insersiyo)' },
  { id: 'neckbones', name: 'Boyun kemikleri ve kıkırdakları' },
  { id: 'neckmus', name: 'Boyun kasları (hyoid altı, skalenler, farinks)' },
  { id: 'facial', name: 'Saçlı deri, alın ve göz çevresi kasları' },
  { id: 'glands', name: 'Baş ve boyun bezleri' },
  { id: 'triangles', name: 'Boyun üçgenleri' },
  { id: 'neckvessels', name: 'Boyun damarları ve sinirleri' },
  { id: 'ctx', name: 'Dura ve beyin sapı' },
];

const items = [...TEXT_A, ...TEXT_B, ...TEXT_DENTAL, ...TEXT_NECK];
// Sinirlerin beyin sapı veya ana sinirden çıkış yeri ve kafatası çıkışı
for (const s of items) if (NERVE_EXIT[s.id]) s.exit = NERVE_EXIT[s.id];
const ids = new Set(items.map((i) => i.id));
const errors = [];
const seen = new Set();
for (const s of items) {
  if (seen.has(s.id)) errors.push(`yinelenen kimlik: ${s.id}`);
  seen.add(s.id);
  if (s.layer !== 'block' && !GEO[s.id]) errors.push(`geometrisi yok: ${s.id}`);
  if (!CATS.find((c) => c.id === s.cat)) errors.push(`kategori yok: ${s.id}`);
  for (const r of s.rel ?? []) if (!ids.has(r)) errors.push(`${s.id}: rel ${r} yok`);
  for (const r of s.focus ?? []) if (!ids.has(r)) errors.push(`${s.id}: focus ${r} yok`);
  for (const f of ['route', 'spot', 'clinic', 'ref']) if (!s[f]?.length) errors.push(`${s.id}: ${f} boş`);
  if (s.layer === 'block' && !GEO[s.needle]) errors.push(`${s.id}: iğne yok`);
  if (s.cat === 'ganglia' && !(s.pre && s.post && s.path)) errors.push(`${s.id}: pre/post/path eksik`);
  if (s.layer === 'nerve' && !s.exit && GEO[s.id] && !GEO[s.id].needle) errors.push(`${s.id}: çıkış notu yok`);
  if (s.layer === 'region' && !(s.bounds?.length && s.contents?.length && s.floor && s.roof)) errors.push(`${s.id}: sınır/içerik eksik`);
}
for (const k of Object.keys(NERVE_EXIT)) if (!ids.has(k)) errors.push(`çıkış notu sahipsiz: ${k}`);
// Metindeki kimlikler gerçek yapılara işaret etmeli
for (const s of items) for (const m of JSON.stringify(s).match(/[a-z]{1,3}_[a-z0-9_]+/g) ?? []) if (!ids.has(m) && /^(a|b|c|f|g|gl|j|k|m|n|r|t|v|ao|ai|blk)_/.test(m)) errors.push(`${s.id}: bilinmeyen kimlik ${m}`);
for (const k of Object.keys(GEO)) if (!k.startsWith('x_') && !ids.has(k)) errors.push(`metni yok: ${k}`);
for (const q of QUIZ) {
  if (!ids.has(q.answerId)) errors.push(`quiz answerId yok: ${q.answerId}`);
  if (q.options.length !== 4) errors.push(`quiz 4 şık değil: ${q.q}`);
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/structures.json', JSON.stringify({ cats: CATS, items }, null, 1));
fs.writeFileSync('data/quiz.json', JSON.stringify(QUIZ, null, 1));
console.log(`${items.length} yapı, ${QUIZ.length} soru yazıldı`);
