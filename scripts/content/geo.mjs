// Her yapının geometri tarifi. Koordinatlar Z-Anatomy dünya uzayında mm'dir ve hasta SAĞ tarafı (x<0) için yazılır.
// Kaynak türleri:
//   za(ad)        Z-Anatomy mesh'i (Startup.blend'den dışa aktarılan)
//   bp(id)        BodyParts3D OBJ (FJ kimliği); Z-Anatomy uzayına BP_OFFSET ile taşınır
//   cv(ad, i, {from,to,minZ})  Z-Anatomy eğrisinin i. dalı; from/to en yakın noktadan kesilir
//   pth([...])    Elle çizilmiş yol: modelde karşılığı olmayan yapılar. Bunlar `schematic` olarak işaretlenir.
//   marker        Delik/ganglion işaretçisi; uygulama çalışırken üretilir
// side: 'both' (sağ + ayna sol), 'mid' (orta hat), 'R' (yalnız sağ), 'L' (yalnız sol)

export const za = (name, ratio = 1) => ({ kind: 'za', name, ratio });
export const bp = (id, ratio = 1) => ({ kind: 'bp', id, ratio });
export const cv = (name, spline = 0, opt = {}) => ({ kind: 'cv', name, spline, ...opt });
export const pth = (pts) => ({ kind: 'pth', pts });

const bone = (src, side = 'both') => ({ file: 'bones', side, src });
const dura = (src, side = 'mid') => ({ file: 'context', side, src });
const nerve = (src, o = {}) => ({ file: 'nerves', side: 'both', radius: 0.55, src, ...o });
const art = (src, o = {}) => ({ file: 'arteries', side: 'both', radius: 0.8, src, ...o });
const vein = (src, o = {}) => ({ file: 'veins', side: 'both', radius: 1.3, src, ...o });
const hole = (p, r = 2.2, o = {}) => ({ marker: p, r, side: 'both', ...o });
const gang = (p, r = 1.8, o = {}) => ({ marker: p, r, side: 'both', ganglion: true, ...o });

const all = (name, n) => Array.from({ length: n }, (_, i) => cv(name, i));

// Sık kullanılan kesişim noktaları
export const P = {
  ovale: [-23.5, -12.8, 1582],
  spinosum: [-27, -8.2, 1576],
  lacerum: [-14, -7.5, 1582],
  rotundum: [-17, -17.5, 1591.7],
  iac: [-20.6, 4.6, 1583.3],
  geniculate: [-43.2, 1.5, 1584.5],
  jugular: [-36.5, 9.2, 1570.5],
  ppf: [-22.5, -40, 1578],
  ptcanalAnt: [-20, -36, 1576],
  otic: [-20.3, -15.6, 1573.5],
  submand: [-11.8, -41.6, 1516.8],
  mandFor: [-36.4, -22.4, 1540.5],
  mental: [-21.3, -69.4, 1512.4],
  infraorb: [-27, -70, 1568],
  incisive: [-1.2, -78.5, 1543.5],
  gpf: [-15.2, -51.3, 1549.3],
  lpf: [-17.5, -47.5, 1549.5],
  sphpal: [-17.3, -37.5, 1572],
};

export const GEO = {
  // ---------------- KEMİKLER ----------------
  b_sphenoid: bone([za('Sphenoid bone')], 'mid'),
  b_temporal: bone([za('Temporal bone.r', 0.75)]),
  b_occipital: bone([za('Occipital bone')], 'mid'),
  b_frontal: bone([za('Frontal bone')], 'mid'),
  b_ethmoid: bone([za('Ethmoid bone', 0.6)], 'mid'),
  b_parietal: bone([za('Parietal bone.r', 0.7)]),
  b_maxilla: bone([za('Maxilla.r')]),
  b_palatine: bone([za('Palatine bone.r')]),
  b_zygomatic: bone([za('Zygomatic bone.r')]),
  b_nasal: bone([za('Nasal bone.r')]),
  b_lacrimal: bone([za('Lacrimal bone.r')]),
  b_concha: bone([za('Inferior nasal concha bone.r')]),
  b_vomer: bone([za('Vomer')], 'mid'),
  b_mandible: bone([za('Mandible', 0.55)], 'mid'),
  b_atlas: bone([za('Atlas (C1)')], 'mid'),
  b_axis: bone([za('Axis (C2)')], 'mid'),
  b_hyoid: bone([za('Hyoid bone')], 'mid'),

  // ---------------- DELİKLER ----------------
  f_cribriform: hole([-3.2, -55, 1603], 2.6),
  f_optic: hole([-12, -31, 1603], 2.2),
  f_sof: hole([-21, -39, 1601], 2.8),
  f_iof: hole([-29.5, -45, 1578], 2.4),
  f_rotundum: hole(P.rotundum, 1.9),
  f_ovale: hole(P.ovale, 2.5),
  f_spinosum: hole(P.spinosum, 1.5),
  f_lacerum: hole(P.lacerum, 2.2),
  f_carotid: hole([-24.1, 1.7, 1570.5], 2.4),
  f_iac: hole(P.iac, 2.2),
  f_jugular: hole(P.jugular, 3),
  f_hypoglossal: hole([-17, 14, 1558.5], 1.8),
  f_magnum: hole([0, 29, 1553], 4, { side: 'mid' }),
  f_stylomastoid: hole([-46.6, 11.1, 1568.6], 1.6),
  f_pterygoid: hole(P.ptcanalAnt, 1.4),
  f_sphenopalatine: hole(P.sphpal, 1.8),
  f_ppf: hole(P.ppf, 3.2),
  f_incisive: hole(P.incisive, 1.7, { side: 'mid', x0: true }),
  f_gpf: hole(P.gpf, 1.6),
  f_lpf: hole(P.lpf, 1.2),
  f_infraorbital: hole(P.infraorb, 1.8),
  f_mental: hole(P.mental, 1.6),
  f_mandibular: hole(P.mandFor, 2),

  // ---------------- KRANİYAL SİNİRLER ----------------
  n_i: nerve(all('Olfactory nerve (I).r', 23), { radius: 0.3 }),
  n_ii: nerve([bp('FJ1364')]),
  n_chiasm: nerve([bp('FJ1818')]),
  n_iii: nerve(all('Oculomotor nerve (III).r', 4)),
  n_iv: nerve([cv('Trochlear nerve (IV).r', 0)], { radius: 0.4 }),
  n_v: nerve([cv('Trigeminal nerve (V).r', 0)], { radius: 1.3 }),
  n_v1: nerve([bp('FJ1363'), cv('Ophthalmic nerve.r', 0, { to: [-18.6, -14, 1597] })], { radius: 0.8 }),
  n_frontal: nerve([bp('FJ1341'), bp('FJ1376'), bp('FJ1377')]),
  n_lacrimal: nerve([bp('FJ1351')]),
  n_nasociliary: nerve([bp('FJ1361'), bp('FJ1333'), bp('FJ1366'), bp('FJ1347'), bp('FJ1369'), bp('FJ1362')]),
  n_v2: nerve([cv('Maxillary nerve.r', 0, { to: P.ppf })], { radius: 0.9 }),
  n_infraorbital: nerve([cv('Maxillary nerve.r', 0, { from: P.ppf }), cv('Maxillary nerve.r', 1), cv('Maxillary nerve.r', 2), cv('Maxillary nerve.r', 3), cv('Maxillary nerve.r', 4)], { radius: 0.6 }),
  n_psa: nerve([pth([P.ppf, [-28, -36, 1574], [-33.5, -32, 1570]]), cv('Posterior superior alveolar artery.r', 0)], { radius: 0.35, schematic: true }),
  n_nasopalatine: nerve([pth([P.ppf, P.sphpal, [-5.5, -33, 1569.8]]), cv('?x.r', 0), pth([[-0.7, -81.2, 1566.6], [-1, -80.5, 1555], P.incisive])], { radius: 0.35, schematic: true }),
  n_gpn: nerve([pth([P.ppf, [-18.5, -41, 1568], [-16.5, -44.5, 1558], P.gpf, [-13, -63, 1546.5], [-7, -74, 1544.5]])], { radius: 0.4, schematic: true }),
  n_v3: nerve([cv('Trigeminal nerve (V).r', 1), cv('Anterior division of mandibular nerve.r', 0), cv('Posterior division of mandibular nerve.r', 0)], { radius: 1 }),
  n_buccal: nerve([cv('Buccal nerve.r', 0), cv('Buccal nerve.r', 1)], { radius: 0.4 }),
  n_ian: nerve([cv('Inferior alveolar nerve.r', 0), cv('Inferior alveolar nerve.r', 1), ...[2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => cv('Inferior alveolar nerve.r', i))], { radius: 0.5 }),
  n_mental: nerve(all('Mental nerve.r', 3), { radius: 0.4 }),
  n_mylohyoid: nerve(all('Nerve to mylohyoid muscle.r', 2), { radius: 0.3 }),
  n_lingual: nerve([cv('Lingual nerve.r', 0)], { radius: 0.6 }),
  // Z-Anatomy bu yolu "meningeal branch of maxillary nerve" diye adlandırmış; seyri foramen ovale altından
  // TME arkasından şakağa çıkan auriculotemporal sinirle örtüşüyor.
  n_auriculotemporal: nerve([cv('Meningeal branch of maxillary nerve.r', 0), cv('Meningeal branch of maxillary nerve.r', 1)], { radius: 0.4 }),
  n_vi: nerve([cv('Abducens nerve (VI).r', 0), cv('Abducens nerve (VI).r', 1)], { radius: 0.4 }),
  n_vii: nerve([cv('Facial nerve (VII).r', 0), ...[1, 2, 3, 4, 5, 6, 7, 8].map((i) => cv('Facial nerve (VII).r', i))], { radius: 0.6 }),
  n_gsp: nerve([pth([P.geniculate, [-34, -1.5, 1584.5], [-24, -4.8, 1584], [-17, -6.8, 1583], P.lacerum])], { radius: 0.4, schematic: true }),
  n_vidian: nerve([pth([P.lacerum, [-15.5, -14, 1579.5], [-17.5, -26, 1577.5], P.ptcanalAnt, P.ppf])], { radius: 0.4, schematic: true }),
  // N. tympanicus CN IX'un alt gangliyonundan (foramen jugulare altı, IX eğrisi üzerindeki nokta) başlar
  n_lsp: nerve([pth([[-31.7, 10.6, 1565.4], [-35, 9, 1567.5], [-37.5, 7, 1571], [-40, 5, 1578], [-36, -2.5, 1584], [-30, -8, 1584], P.ovale, P.otic])], { radius: 0.35, schematic: true }),
  // Chorda fasiyal gövdeden foramen stylomastoideum'un ~5 mm üstünde ayrılır (çatal noktası gövde eğrisi üzerindedir),
  // öne-yukarı orta kulağa girer, fissura petrotympanica'dan çıkıp n. lingualis'e katılır.
  // Kaynaktaki 9. eğri gövdeye 3 mm paralel yükseldiği için kullanılmaz: iki sinir aynı kanalda gibi görünüyordu.
  n_chorda: nerve([pth([[-45.4, 11, 1573.8], [-46.3, 8.5, 1577.5], [-45.6, 4.8, 1580.6], [-43, 1, 1580.3], [-39.6, -1.8, 1577.6], [-35.8, -3.2, 1574.2], [-31.6, -4.2, 1571.4]]), cv('Chorda tympani.r', 0, { from: [-29.8, -4.9, 1570.9] })], { radius: 0.35, schematicPart: true }),
  n_viii: nerve([cv('Vestibulocochlear nerve (VIII).r', 0), cv('Vestibular nerve.r', 0)], { radius: 0.8 }),
  n_ix: nerve(all('Glossopharyngeal nerve (IX).r', 7).map((c) => ({ ...c, minZ: 1440 })), { radius: 0.5 }),
  n_x: nerve([cv('Vagus nerve (X).r', 2, { minZ: 1385 }), cv('Vagus nerve (X).r', 1), cv('Vagus nerve (X).r', 17), cv('Vagus nerve (X).r', 18), cv('Vagus nerve (X).r', 19)], { radius: 0.7 }),
  n_sln: nerve([cv('Vagus nerve (X).r', 1)], { radius: 0.4 }),
  n_rln: nerve([pth([[-17.8, 2.8, 1401], [-22, 2.5, 1391], [-18, -5, 1392], [-13, -4, 1410], [-10.5, -6.5, 1435], [-8, -8, 1462]])], { side: 'R', radius: 0.45, schematic: true, extra: [{ side: 'L', pts: [[18, 1, 1355], [12, 6, 1345], [8, 0, 1370], [9, -5, 1410], [9, -7, 1440], [8, -8, 1462]] }] }),
  n_xi: nerve(all('Accessory nerve (XI).r', 6).map((c) => ({ ...c, minZ: 1400 })), { radius: 0.5 }),
  n_xii: nerve(all('Hypoglossal nerve (XII).r', 8), { radius: 0.55 }),

  // ---------------- GANGLİONLAR ----------------
  g_trigeminal: gang([-14.8, -7.5, 1593.5], 3.6, { scale: [1.5, 0.8, 0.9] }),
  g_geniculate: gang(P.geniculate, 1.5),
  g_ciliary: { file: 'nerves', side: 'both', src: [bp('FJ1339')] },
  g_pterygopalatine: gang(P.ppf, 2),
  g_otic: gang(P.otic, 1.7),
  g_submandibular: gang(P.submand, 1.7),

  // ---------------- ARTERLER ----------------
  // Sağ CCA truncus brachiocephalicus'tan, sol CCA arcus aortae'den çıkar: ayna değil iki gerçek eğri
  a_cca: art([cv('Right common carotid artery', 0), cv('Left common carotid artery', 0)], { side: 'mid', radius: 2.8 }),
  a_ica: art([cv('Internal carotid artery.r', 0, { to: [-27.8, 0.7, 1508] }), bp('FJ1682')], { radius: 2 }),
  a_ophthalmic: art([bp('FJ1695')]),
  a_aca: art([bp('FJ1654')]),
  a_acom: art([bp('FJ1655')], { side: 'mid' }),
  a_mca: art([bp('FJ1692'), bp('FJ1660'), bp('FJ1694')]),
  a_pcom: art([bp('FJ1713')]),
  a_pca: art([bp('FJ1723'), bp('FJ1714')]),
  a_antchoroid: art([bp('FJ1658')]),
  a_basilar: art([bp('FJ1672')], { side: 'mid' }),
  a_vertebral: art([cv('Vertebral artery.r', 0, { to: [-33.7, 3, 1469.8] }), bp('FJ1725')], { radius: 1.5 }),
  a_sca: art([bp('FJ1726')]),
  a_aica: art([bp('FJ1656')]),
  a_pica: art([bp('FJ1715')]),
  a_antspinal: art([bp('FJ1657')]),
  a_labyrinthi: art([pth([[-1.6, -1.5, 1583.5], [-9, 2, 1583], [-16, 4, 1583], P.iac, [-27, 4.8, 1583.5]])], { radius: 0.3, schematic: true }),
  a_subclavian: art([cv('Right subclavian artery', 0), cv('Left subclavian artery', 0)], { side: 'mid', radius: 2.6 }),
  a_eca: art([cv('External carotid artery.r', 0)], { radius: 1.6 }),
  a_supthyroid: art([pth([[-31.6, -0.5, 1491], [-28, -13, 1486], [-21, -22, 1472], [-16, -21, 1459]])], { radius: 0.7, schematic: true }),
  a_ascpharyngeal: art([cv('Ascending pharyngeal artery.r', 0)], { radius: 0.5 }),
  a_lingual: art([pth([[-32.4, -1.5, 1498], [-27, -20, 1503], [-17, -35, 1509], [-9, -50, 1517], [-3.5, -66, 1522]])], { radius: 0.8, schematic: true }),
  a_facial: art([cv('Facial artery.r', 0), cv('Angular artery.r', 0), cv('Inferior labial artery.r', 0), cv('Superior labial artery.r', 0)], { radius: 0.8 }),
  a_occipital: art([cv('Occipital artery.r', 0)], { radius: 0.7 }),
  a_postauricular: art([pth([[-43.2, -2.5, 1556], [-50, 8, 1566], [-60, 20, 1590]])], { radius: 0.5, schematic: true }),
  a_sta: art([cv('Superficial temporal artery.r', 0), cv('Frontal branch of superficial temporal artery.r', 0)], { radius: 0.7 }),
  a_transversefacial: art([cv('Transverse facial artery.r', 0)], { radius: 0.4 }),
  a_maxillary: art(all('Maxillary artery.r', 1).concat([cv('Maxillary artery.r', 4)]), { radius: 1 }),
  a_mma: art([cv('Middle meningeal artery.r', 0), pth([[-24.96, -7.17, 1589.91], [-37, -9, 1592], [-49, -15, 1605], [-58, -22, 1625], [-60, -30, 1648]]), pth([[-37, -9, 1592], [-52, 2, 1600], [-64, 18, 1622], [-65, 40, 1645]])], { radius: 0.65, schematicPart: true }),
  a_accmeningeal: art([cv('Accessory branch of middle meningeal artery.r', 0)], { radius: 0.4 }),
  a_ial: art(all('Inferior alveolar artery.r', 1), { radius: 0.5 }),
  a_deeptemporal: art([cv('Anterior deep temporal artery.r', 0), cv('Posterior deep temporal artery.r', 0)], { radius: 0.45 }),
  a_buccal: art([cv('Buccal artery.r', 0)], { radius: 0.4 }),
  a_psa: art([cv('Posterior superior alveolar artery.r', 0)], { radius: 0.4 }),
  a_infraorbital: art([cv('Infra-orbital artery.r', 0)], { radius: 0.5 }),
  a_descpalatine: art([cv('Descending palatine artery.r', 0), cv('Greater palatine artery.r', 0)], { radius: 0.45 }),
  a_sphenopalatine: art([cv('Artery of pterygoid canal.r', 0), cv('Posterior septal branches of sphenopalatine artery.r', 0)], { radius: 0.45 }),

  // ---------------- VENLER ve SİNÜSLER ----------------
  v_sss: vein([cv('Superior sagittal sinus', 0, { centerline: true })], { side: 'mid', radius: 2.2 }),
  v_iss: vein([cv('Inferior sagittal sinus', 0)], { side: 'mid', radius: 0.9 }),
  v_straight: vein([cv('Straight sinus', 0)], { side: 'mid', radius: 1.5 }),
  v_transverse: vein([cv('Transverse sinus.r', 0)], { radius: 2.2 }),
  v_sigmoid: vein([cv('Sigmoid sinus.r', 0), pth([[-45.6, 21.8, 1567.7], [-41, 15, 1568], P.jugular])], { radius: 2.2 }),
  v_occipital: vein([cv('Occipital sinus', 0)], { side: 'mid', radius: 0.9 }),
  v_cavernous: { file: 'veins', side: 'both', src: [za('Cavernous sinus.r', 0.35)] },
  v_intercav: vein([cv('Anterior intercavernous sinus', 0), cv('Posterior intercavernous sinus', 0)], { side: 'mid', radius: 0.6 }),
  v_sps: vein([cv('Superior petrosal sinus.r', 0)], { radius: 0.8 }),
  v_ips: vein([cv('Inferior petrosal sinus.r', 0)], { radius: 0.8 }),
  v_basilarplexus: { file: 'veins', side: 'mid', src: [za('Basilar venous plexus', 0.07)] },
  v_ijv: vein([cv('Internal jugular vein.r', 0)], { radius: 2.6 }),
  v_sov: vein([cv('Superior ophthalmic vein.r', 0)], { radius: 0.6 }),
  v_iov: vein([cv('Inferior ophthalmic vein.r', 0)], { radius: 0.5 }),
  v_facial: vein([cv('Facial vein.r', 0), cv('Angular vein.r', 0)], { radius: 0.7 }),
  v_retromandibular: vein([cv('Retromandibular vein.r', 0), cv('Anterior division of retromandibular vein.r', 0), cv('Posterior division of retromandibular vein.r', 0), cv('Common facial vein.r', 0)], { radius: 0.8 }),
  v_ptplexus: { marker: [-30, -28, 1565], r: 4.5, side: 'both', veinMarker: true, scale: [0.9, 1.5, 1.1] },

  // ---------------- BAĞLAM ----------------
  c_falx: dura([za('Falx cerebri', 0.25)]),
  c_tentorium: dura([za('Tentorium cerebelli.r', 0.5)], 'both'),
  c_midbrain: dura([za('Midbrain.r', 0.45)], 'both'),
  c_pons: dura([za('Pons.r', 0.35)], 'both'),
  c_medulla: dura([za('Medulla oblongata.r', 0.5)], 'both'),

  // ---------------- BLOK SAHNELERİ (iğne yolu) ----------------
  // İğne çizgisi şematiktir: kemiğe göre hedefi gösterir, milimetrik teknik rehberi değildir.
  x_ianb: { file: 'nerves', side: 'R', needle: true, radius: 0.6, schematic: true, src: [pth([[16, -66, 1531], [-36.4, -22.4, 1541]])] },
  x_psa: { file: 'nerves', side: 'R', needle: true, radius: 0.6, schematic: true, src: [pth([[-36, -60, 1548], [-31, -38, 1565]])] },
  x_infraorbital: { file: 'nerves', side: 'R', needle: true, radius: 0.6, schematic: true, src: [pth([[-24, -90, 1535], [-27, -70, 1568]])] },
  x_nasopalatine: { file: 'nerves', side: 'R', needle: true, radius: 0.6, schematic: true, src: [pth([[-3, -85, 1525], [-1.2, -78.5, 1543.5]])] },
};

// ---------------- DİŞ HEKİMLİĞİ KATMANLARI ----------------
// Dişler FDI numarasıyla ayrı yapılardır. Sol taraf, sağ mesh'in aynasıdır.
// Z-Anatomy'de üçüncü molar yoktur, bu yüzden 18/28/38/48 eklenmedi.
const TOOTH_TYPES = ['medial incisor', 'lateral incisor', 'canine', 'first premolar', 'second premolar', 'first molar tooth', 'second molar tooth'];
const TOOTH_QUADRANTS = [[1, 'Upper', 'R'], [2, 'Upper', 'L'], [3, 'Lower', 'L'], [4, 'Lower', 'R']];
for (const [q, arch, side] of TOOTH_QUADRANTS) {
  TOOTH_TYPES.forEach((type, i) => {
    GEO[`t_${q}${i + 1}`] = { file: 'teeth', side, src: [za(`${arch} ${type}.r`)], movesWithMandible: arch === 'Lower' };
  });
}
// Kaynak modelde üst ikinci premolar iki köklüdür; beklenen anatomi tek kök olduğu için kök yeniden örülür
GEO.t_15.singleRoot = true;
GEO.t_25.singleRoot = true;

const muscle = (src, o = {}) => ({ file: 'muscles', side: 'both', src, ...o });
const attach = (names, o = {}) => ({ file: 'attachments', side: 'both', src: names.map((n) => za(n, 0.3)), ...o });
const jaw = { movesWithMandible: true };

Object.assign(GEO, {
  m_masseter: muscle([za('Superficial part of masseter.r'), za('Deep part of masseter.r')]),
  m_temporalis: muscle([za('Temporalis muscle.r', 0.3)]),
  m_medpt: muscle([za('Medial pterygoid muscle.r')]),
  m_latpt: muscle([za('Inferior head of lateral pterygoid muscle.r'), za('Superior head of lateral pterygoid muscle.r')]),
  m_digastric: muscle([za('Anterior belly of digastric muscle.r'), za('Intermediate tendon of digastric muscle.r'), za('Posterior belly of digastric muscle.r')]),
  m_mylohyoid: muscle([za('Mylohyoid muscle.r')]),
  m_geniohyoid: muscle([za('Geniohyoid muscle.r')]),
  m_stylohyoid: muscle([za('Stylohyoid muscle.r')]),
  m_genioglossus: muscle([za('Genioglossus muscle.r', 0.4)]),
  m_hyoglossus: muscle([za('Hyoglossus muscle.r')]),
  m_tensor: muscle([bp('FJ2760', 0.15)]),
  m_tongue: muscle([za('Tongue')], { side: 'mid' }),
  m_orbicularis: muscle([za('Orbicularis oris muscle.r')]),
  m_mentalis: muscle([za('Mentalis muscle.r')]),
  m_dao: muscle([za('Depressor anguli oris.r')]),
  m_dli: muscle([za('Depressor labii inferioris.r')]),
  m_lao: muscle([za('Levator anguli oris.r')]),
  m_lls: muscle([za('Levator labii superioris.r')]),
  m_zygmaj: muscle([za('Zygomaticus major muscle.r')]),
  m_zygmin: muscle([za('Zygomaticus minor muscle.r')]),
  m_risorius: muscle([za('Risorius muscle.r')]),

  j_disc: muscle([za('Articular disc of temporomandibular joint.r')], jaw),
  j_capsule: muscle([za('Articular capsule of temporomandibular joint.r')]),
  j_latlig: muscle([za('Lateral temporomandibular ligament.l')]),
  j_smlig: muscle([za('Sphenomandibular ligament.r')]),
  j_stlig: muscle([za('Stylomandibular ligament.r')]),

  // Kemik üzerindeki kas yapışmaları: ao_ origo, ai_ insersiyo. Kaynakta karşılığı olmayan yapışma yoktur.
  ao_masseter: attach(['Masseter.or', 'Masseter.o1r']),
  ai_masseter: attach(['Masseter.er'], jaw),
  ao_temporalis: attach(['Temporalis muscle.o1r', 'Temporalis muscle.o2r', 'Temporalis muscle.o3r', 'Temporalis muscle.o4r']),
  ai_temporalis: attach(['Temporalis muscle.er'], jaw),
  ao_medpt: attach(['Medial pterygoid muscle.or']),
  ai_medpt: attach(['Medial pterygoid muscle.er'], jaw),
  ao_latpt: attach(['Lateral pterygoid muscle.or', 'Lateral pterygoid muscle.o1r']),
  ai_digastric: attach(['Anterior belly of digastric muscle.er'], jaw),
  ao_geniohyoid: attach(['Geniohyoid muscle.or'], jaw),
  ai_geniohyoid: attach(['Geniohyoid muscle.er']),
  ao_mylohyoid: attach(['Mylohyoid muscle.or'], jaw),
  ao_mentalis: attach(['Mentalis muscle.or'], jaw),
  ao_dao: attach(['Depressor anguli oris.or'], jaw),
  ao_dli: attach(['Depressor labii inferioris.or'], jaw),
  ao_orbicularis: attach(['Orbicularis oris muscle.or'], jaw),
  ao_lao: attach(['Levator anguli oris.or']),
  ao_lls: attach(['Levator labii superioris.or']),
  ao_zygmaj: attach(['Zygomaticus major muscle.or']),
  ao_zygmin: attach(['Zygomaticus minor muscle.or']),
});

// ---------------- BOYUN, BEZLER, MİMİK KASLARI, BOYUN ÜÇGENLERİ ----------------
const gland = (src, o = {}) => ({ file: 'glands', side: 'both', src, ...o });
const cart = (src) => ({ file: 'glands', side: 'mid', src });
const region = (src, o = {}) => ({ file: 'regions', side: 'both', src, ...o });
// Ense üçgeninin kaynakta bölge mesh'i yoktur: SCM arka kenarı, trapez ön kenarı ve omohyoid alt karnı arasında deri düzeyinde çizilir
const OCCIPITAL_TRIANGLE = [[-58, 48, 1565], [-57, 25, 1538], [-54, 0, 1492], [-52, -12, 1442], [-76, 6, 1426], [-62, 20, 1460], [-48, 42, 1505]];
// Erb noktası: SCM arka kenarının ortası; yüzeyel servikal pleksus dalları buradan çıkar (ölçüm: SCM mesh'i)
const ERB = [-43, 5, 1490];

Object.assign(GEO, {
  b_c3: bone([za('Vertebra C3', 0.7)], 'mid'),
  b_c4: bone([za('Vertebra C4', 0.7)], 'mid'),
  b_c5: bone([za('Vertebra C5', 0.7)], 'mid'),
  b_c6: bone([za('Vertebra C6', 0.7)], 'mid'),
  b_c7: bone([za('Vertebra C7', 0.7)], 'mid'),
  b_clavicle: bone([za('Clavicle.r')]),
  b_rib1: bone([za('First rib.r', 0.6), za('Costal cartilage of first rib.r', 0.5)]),
  b_manubrium: bone([za('Manubrium of sternum', 0.7)], 'mid'),

  k_thyroid: cart([za('Thyroid cartilage', 0.5)]),
  k_cricoid: cart([za('Cricoid cartilage', 0.7)]),
  k_epiglottis: cart([za('Epiglottis', 0.5)]),
  k_trachea: cart([za('Trachea', 0.5)]),

  gl_parotid: gland([za('Parotid gland.r'), za('(Accessory parotid gland).r'), cv('Parotid duct.r', 0)], { radius: 0.8 }),
  gl_submand: gland([za('Submandibular gland.r')]),
  gl_subling: gland([za('Sublingual gland.r')]),
  gl_thyroid: { file: 'glands', side: 'mid', src: [za('Thyroid gland', 0.6)] },
  gl_parathyroid: gland([za('Superior parathyroid gland.r'), za('Inferior parathyroid gland.r')]),
  gl_adenohyp: { file: 'glands', side: 'mid', src: [za('Adenohypophysis')] },
  gl_neurohyp: { file: 'glands', side: 'mid', src: [za('Neurohypophysis')] },
  gl_pineal: { file: 'glands', side: 'mid', src: [za('Pineal gland')] },
  gl_lacrimal: gland([za('Lacrimal gland.r', 0.6)]),

  m_scm: muscle([za('Sternocleidomastoid muscle.r', 0.6)]),
  m_platysma: muscle([za('Platysma.r', 0.4)]),
  m_omohyoid: muscle([za('Omohyoid muscle.r', 0.6)]),
  m_sternohyoid: muscle([za('Sternohyoid muscle.r')]),
  m_sternothyroid: muscle([za('Sternothyroid muscle.r')]),
  m_thyrohyoid: muscle([za('Thyrohyoid muscle.r')]),
  m_scalant: muscle([za('Scalenus anterior muscle.r')]),
  m_scalmed: muscle([za('Scalenus medius muscle.r')]),
  m_scalpost: muscle([za('Scalenus posterior muscle.r')]),
  m_trapezius: muscle([za('Ascending part of trapezius muscle.r', 0.5)]),
  m_levscap: muscle([za('Levator scapulae.r', 0.6)]),
  m_splenius: muscle([za('Splenius capitis muscle.r', 0.4)]),
  m_longuscolli: muscle([za('Longus colli muscle.r', 0.3), za('Longus capitis muscle.r', 0.5)]),
  m_constrictor: muscle([za('Superior pharyngeal constrictor.r', 0.4), za('Middle pharyngeal constrictor.r', 0.5), za('Inferior pharyngeal constrictor.r', 0.5)]),
  m_stylopharyngeus: muscle([za('Stylopharyngeus muscle.r', 0.12)]),

  m_frontalis: muscle([za('Frontalis muscle.r', 0.4)]),
  m_occipitalis: muscle([za('Occipitalis muscle.r', 0.5)]),
  m_galea: muscle([za('Epicranial aponeurosis.r', 0.12)]),
  m_temporoparietalis: muscle([za('Temporoparietalis muscle.r', 0.2)]),
  m_procerus: muscle([za('Procerus muscle.r')]),
  m_corrugator: muscle([za('Corrugator supercilii.r')]),
  m_orboculi: muscle([za('Orbital part of orbicularis oculi.r', 0.6), za('Palpebral part of orbicularis oculi.r')]),
  m_nasalis: muscle([za('Nasalis muscle.r')]),
  m_depsepti: muscle([za('Depressor septi nasi.r')]),
  m_levpalp: muscle([za('Levator palpebrae superioris.r', 0.6)]),

  ao_scm: attach(['Sternocleidomastoid muscle.or', 'Sternocleidomastoid muscle.o1r']),
  ai_scm: attach(['Sternocleidomastoid muscle.er']),

  r_submental: region([za('Submental triangle.r')]),
  r_submand: region([za('Submandibular triangle.r')]),
  r_carotid: region([za('Carotid triangle.r')]),
  r_muscular: region([za('Muscular triangle.r')]),
  r_occipital: region([{ kind: 'poly', pts: OCCIPITAL_TRIANGLE }], { schematic: true }),
  r_omoclav: region([za('Greater supraclavicular fossa.r')]),

  a_brachiocephalic: art([cv('Brachiocephalic trunk', 0)], { side: 'mid', radius: 3.4 }),
  a_thyrocervical: art([cv('Thyrocervical trunk.r', 0)], { radius: 1.4 }),
  a_infthyroid: art(all('Inferior thyroid artery.r', 2), { radius: 0.8 }),
  a_transcervical: art(all('Transverse cervical artery.r', 3), { radius: 0.7 }),
  a_suprascapular: art([cv('Suprascapular artery.r', 0, { minZ: 1380 })], { radius: 0.8 }),
  a_costocervical: art([cv('Costocervical trunk.r', 0)], { radius: 1 }),
  a_supraorbital: art(all('Supra-orbital artery.r', 2), { radius: 0.4 }),
  a_supratrochlear: art(all('Supratrochlear artery.r', 4), { radius: 0.35 }),

  v_ejv: vein([cv('External jugular vein.r', 0)], { radius: 1.3 }),
  v_ajv: vein([cv('Anterior jugular vein.r', 0)], { radius: 0.9 }),
  v_subclavian: vein([cv('Right subclavian vein', 0), cv('Left subclavian vein', 0)], { side: 'mid', radius: 2.6 }),
  v_brachiocephalic: vein([cv('Right brachiocephalic vein', 0), cv('Left brachiocephalic vein', 0)], { side: 'mid', radius: 3.2 }),
  v_supthyroid: vein([cv('Superior thyroid vein.r', 0)], { radius: 0.7 }),

  n_plexus: nerve([0, 1, 2, 3, 4, 5, 6].map((i) => cv('Roots of brachial plexus.r', i)).concat(['Superior', 'Middle', 'Inferior'].map((t) => cv(`${t} trunk of brachial plexus.r`, 0))), { radius: 1 }),
  n_symp: nerve([cv('Sympathetic trunk.r', 0, { minZ: 1380 })], { radius: 0.6 }),
  // Kaynakta yok: m. scalenus anterior ön yüzünde (ölçülen yüzeyin 3 mm içi), yukarıdan aşağı lateralden mediale
  n_phrenic: nerve([pth([[-21, 2, 1490], [-29.5, -4, 1470], [-34, -9, 1448], [-40, -10.5, 1431], [-44, -9.5, 1416], [-35, -7, 1398]])], { radius: 0.45, schematic: true }),
  n_cervplexus: nerve([
    pth([ERB, [-49, 7, 1512], [-55, 7, 1535], [-62, 4, 1555], [-67, 2, 1566]]),
    pth([ERB, [-45, 15, 1515], [-50, 26, 1540], [-56, 40, 1560], [-55, 55, 1585]]),
    pth([ERB, [-40, -8, 1488], [-30, -24, 1486], [-15, -38, 1484]]),
    pth([ERB, [-50, 0, 1465], [-58, -10, 1440], [-62, -20, 1418]]),
    pth([[-50, 0, 1465], [-40, -20, 1432], [-30, -35, 1412]]),
  ], { radius: 0.4, schematic: true }),
});

// Mandibula hareketinde kemikle birlikte taşınacak mevcut yapılar
for (const id of ['b_mandible', 'n_ian', 'n_mental', 'n_mylohyoid', 'a_ial', 'f_mandibular', 'f_mental']) GEO[id].movesWithMandible = true;
