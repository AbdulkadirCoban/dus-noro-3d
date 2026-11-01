// Dişler, çiğneme ve perioral kaslar, ağız tabanı, TME ve kas yapışmaları.
const REF = {
  tooth: "Nelson, Wheeler's Dental Anatomy, Physiology and Occlusion; Malamed, Handbook of Local Anesthesia (innervasyon).",
  mus: "Moore COA, İnfratemporal fossa ve Yüz; Gray's Anatomy, Baş-boyun kasları; Netter Atlas.",
  tmj: "Okeson, Management of Temporomandibular Disorders and Occlusion; Moore COA, TME.",
};

// ---------- DİŞLER ----------
const TYPE = [
  { n: 'santral kesici', U: { roots: '1', erupt: '7–8 yaş' }, L: { roots: '1', erupt: '6–7 yaş' } },
  { n: 'lateral kesici', U: { roots: '1', erupt: '8–9 yaş' }, L: { roots: '1', erupt: '7–8 yaş' } },
  { n: 'kanin', U: { roots: '1', erupt: '11–12 yaş' }, L: { roots: '1', erupt: '9–10 yaş' } },
  { n: 'birinci premolar', U: { roots: 'Çoğunlukla 2 (bukkal, palatal)', erupt: '10–11 yaş' }, L: { roots: '1', erupt: '10–12 yaş' } },
  { n: 'ikinci premolar', U: { roots: 'Çoğunlukla 1', erupt: '10–12 yaş' }, L: { roots: '1', erupt: '11–12 yaş' } },
  { n: 'birinci molar', U: { roots: '3 (MB, DB, palatal)', erupt: '6–7 yaş' }, L: { roots: '2 (mezial, distal)', erupt: '6–7 yaş' } },
  { n: 'ikinci molar', U: { roots: 'Çoğunlukla 3 (MB, DB, palatal)', erupt: '12–13 yaş' }, L: { roots: 'Çoğunlukla 2 (mezial, distal)', erupt: '11–13 yaş' } },
];

const UPPER_NERVE = [
  { pulp: 'N. alveolaris superior anterior (n_infraorbital dalı)', buccal: 'Labial dişeti: n_infraorbital', inner: 'Palatal: n_nasopalatine', blocks: ['blk_infraorbital', 'blk_nasopalatine'] },
  { pulp: 'N. alveolaris superior anterior (n_infraorbital dalı)', buccal: 'Labial dişeti: n_infraorbital', inner: 'Palatal: n_nasopalatine', blocks: ['blk_infraorbital', 'blk_nasopalatine'] },
  { pulp: 'N. alveolaris superior anterior (n_infraorbital dalı)', buccal: 'Labial dişeti: n_infraorbital', inner: 'Palatal: n_nasopalatine', blocks: ['blk_infraorbital', 'blk_nasopalatine'] },
  { pulp: 'N. alveolaris superior medius; yoksa anterior dalı', buccal: 'Bukkal dişeti: n_infraorbital', inner: 'Palatal: n_gpn, n_nasopalatine ile örtüşebilir', blocks: ['blk_infraorbital'] },
  { pulp: 'N. alveolaris superior medius; yoksa anterior dalı', buccal: 'Bukkal dişeti: n_infraorbital', inner: 'Palatal: n_gpn, n_nasopalatine ile örtüşebilir', blocks: ['blk_infraorbital'] },
  { pulp: 'n_psa; mezyobukkal kök bazı kişilerde N. alveolaris superior medius', buccal: 'Bukkal dişeti: n_psa', inner: 'Palatal: n_gpn', blocks: ['blk_psa'] },
  { pulp: 'n_psa', buccal: 'Bukkal dişeti: n_psa', inner: 'Palatal: n_gpn', blocks: ['blk_psa'] },
];
const LOWER_NERVE = (i) => ({
  pulp: i < 3 ? 'n_ian (n. incisivus dalı)' : 'n_ian',
  buccal: i < 5 ? 'Labial/bukkal dişeti: n_mental' : 'Bukkal dişeti: n_buccal',
  inner: 'Lingual dişeti: n_lingual',
  blocks: ['blk_ianb'],
});

const SPOT = {
  U: [
    ['Üst kesiciler içinde meziodistal olarak en geniş olanıdır.', 'Yeni sürmüş dişte kesici kenarda mamelonlar görülebilir.'],
    ['Palatinal radiküler oluk ve dens invaginatus en çok bu dişte görülür.', 'Çivi (peg) lateral biçim anomalisi bu dişin tipik varyasyonudur.'],
    ['Tüm dişler içinde en uzun kök genellikle üst kanindedir.', 'Kanin çıkıntısı labial kortikali yükseltir.'],
    ['Mezial kök yüzeyinde belirgin çöküntü vardır; bu bölge periodontal temizlikte zordur.', 'İki kanallı olması beklenir.'],
    ['Birinci premolardan farklı olarak genellikle tek köklüdür.', 'Kökü sinüs tabanına yakın olabilir.'],
    ['Oblik sırt ve meziopalatal tüberkül üzerindeki Carabelli tüberkülü bu dişin ayırt ettirici özelliğidir.', 'En kalın kök palatal köktür. MB kökünde ikinci kanal (MB2) sık aranır.'],
    ['Kökleri birinci molara göre birbirine daha yakındır, kaynaşma görülebilir.', 'Kökleri maksiller sinüs tabanına yakındır.'],
  ],
  L: [
    ['Ağızdaki en küçük daimi diştir ve iki yarısı simetriktir.', 'Çoğunlukla ilk sürer.'],
    ['Santral kesiciden biraz daha geniştir; kesici kenarı distale doğru hafif döner.'],
    ['Alt çenedeki en uzun kök genellikle bu dişindir.'],
    ['Lingual tüberkül küçük ve işlevsel olmayan niteliktedir.', 'Kök ucu foramen mentaleye yakın olabilir.'],
    ['Çiğneme yüzeyinde Y, U veya H oluk düzeni görülebilir.', 'Üçüncü molarlardan sonra en sık konjenital eksik diş gruplarındandır.', 'Foramen mentale çoğunlukla bu dişin apeks bölgesine yakındır.'],
    ['Beş tüberküllü ve Y5 oluk düzenlidir; ilk sürdüğü için 6 yaş dişi olarak bilinir.', 'Mezial kökte genellikle iki kanal bulunur.'],
    ['Dört tüberküllü ve artı biçimli oluk düzeni tipiktir.', 'C biçimli kanal varyasyonu bu dişte tanınır.'],
  ],
};
const CLINIC = {
  U: [
    ['Ön diş travmalarında en sık etkilenen dişlerdendir.'],
    ['Oluk bakteri birikimi ve lokalize periodontal cep yapabilir.'],
    ['Gömülü kaldığında palatal konum sık görülür, ortodontik sürdürme gerekebilir.'],
    ['Çekimde iki ince kök kırılmaya yatkındır.'],
    ['Enfeksiyon ve çekimde sinüs komşuluğu göz önünde tutulur.'],
    ['Çekim sonrası oroantral iletişim riski taşıyan dişlerdendir.', 'Blokta MB kök için ek infiltrasyon gerekebilir (blk_psa).'],
    ['Çekim sonrası oroantral iletişim riski taşır. Blok hedefi tuber maxillae arkasıdır (blk_psa).'],
  ],
  L: [
    ['İnce labial kemik nedeniyle periodontal yıkıma duyarlıdır.'],
    ['Anestezi için bazen karşı taraftan çapraz lif nedeniyle ek infiltrasyon gerekir.'],
    ['Kök uzunluğu nedeniyle çekimde kuvvetli destek sağlar.'],
    ['Foramen mentale yakınlığı cerrahide sinir hasarı riski taşır.'],
    ['Radyografide foramen mentale periapikal lezyonla karışabilir (f_mental).'],
    ['Çekiminde n_buccal için ek blok gerekir.', 'Kökleri m_mylohyoid hattına göre apse yayılımı açısından değerlendirilir.'],
    ['Apeksleri canalis mandibulaeye yakın olabilir (n_ian).', 'Apeksleri linea mylohyoidea altındaysa enfeksiyon submandibular boşluğa yayılabilir.'],
  ],
};

const QUAD = { 1: ['U', 'Üst sağ'], 2: ['U', 'Üst sol'], 3: ['L', 'Alt sol'], 4: ['L', 'Alt sağ'] };
const teeth = [];
for (const q of [1, 2, 3, 4]) {
  const [arch, label] = QUAD[q];
  TYPE.forEach((t, i) => {
    const nerve = arch === 'U' ? UPPER_NERVE[i] : LOWER_NERVE(i);
    const fdi = `${q}${i + 1}`;
    const facts = t[arch];
    const near = i === 0 ? `t_${q}${i + 2}` : `t_${q}${i}`;
    teeth.push({
      id: `t_${fdi}`,
      name: `${fdi} – ${label} ${t.n}`,
      fdi,
      cat: 'teeth',
      layer: 'tooth',
      route: [`FDI ${fdi}. Kök sayısı: ${facts.roots}.`, `Daimi diş sürme zamanı: ${facts.erupt} (ortalama aralık).`],
      through: [`Pulpa ve periodonsiyum: ${nerve.pulp}`, nerve.buccal, nerve.inner],
      spot: SPOT[arch][i],
      clinic: CLINIC[arch][i],
      rel: [...nerve.blocks.slice(0, 1), near, arch === 'U' ? 'b_maxilla' : 'b_mandible'],
      ref: REF.tooth,
    });
  });
}

// ---------- KASLAR ----------
const M = (id, name, cat, origin, insertion, nerve, action, spot, clinic, rel) => ({
  id, name, cat, layer: 'muscle', origin, insertion, nerve, action,
  route: [`Origo: ${origin}`, `İnsersiyo: ${insertion}`],
  branches: [`Sinir: ${nerve}`],
  spot, clinic, rel, ref: REF.mus,
});

const muscles = [
  M('m_masseter', 'M. masseter', 'mastication', 'Arcus zygomaticus', 'Ramus mandibulae dış yüzü ve angulus', 'N. massetericus (n_v3 ön gövde)', 'Elevasyon; yüzeyel bölüm protrüzyona katkı verir',
    ['Çiğneme kaslarının yüzeyel olanıdır.', 'Ductus parotideus kasın üzerinden geçip ön kenarında içe döner.'],
    ['Bruksizmde hipertrofi görülebilir.', 'Trismus nedenlerindendir.'], ['ai_masseter', 'n_v3', 'b_mandible']),
  M('m_temporalis', 'M. temporalis', 'mastication', 'Fossa temporalis ve fascia temporalis', 'Processus coronoideus ve ramus ön kenarı', 'Nn. temporales profundi (n_v3 ön gövde)', 'Elevasyon; arka lifler retrüzyon',
    ['Mandibulanın başlıca retrüzyon kasıdır (arka lifler).'],
    ['Gerilim tipi baş ağrısı ve miyofasiyal ağrıda tetik noktalar içerebilir.'], ['ai_temporalis', 'a_deeptemporal', 'b_mandible']),
  M('m_medpt', 'M. pterygoideus medialis', 'mastication', 'Derin baş: lamina lateralis processus pterygoidei medial yüzü. Yüzeyel baş: tuber maxillae ve os palatinum processus pyramidalis', 'Ramus mandibulae iç yüzü, angulus yakını', 'N. pterygoideus medialis (n_v3 ana gövde)', 'Elevasyon, protrüzyon, karşı tarafa lateral hareket',
    ['M. masseter ile angulus etrafında kas askısı yapar.'],
    ['IANB sırasında iğne travması trismusun klasik nedenidir (blk_ianb).'], ['ai_medpt', 'blk_ianb', 'n_v3']),
  M('m_latpt', 'M. pterygoideus lateralis', 'mastication', 'Üst baş: ala major infratemporal yüzü. Alt baş: lamina lateralis processus pterygoidei dış yüzü', 'Fovea pterygoidea, eklem kapsülü ve j_disc', 'N. pterygoideus lateralis (n_v3 ön gövde)', 'Ağız açma (depresyon), protrüzyon, karşı tarafa lateral hareket',
    ['Çiğneme kasları içinde ağız açmaya katılan kastır.', 'A. maxillaris bu kasa göre üç bölüme ayrılır.', 'Modelde bu kasın insersiyo yapışma bölgesi yoktur.'],
    ['Tek taraflı V3 lezyonunda çene ağız açarken lezyon tarafına kayar.', 'Kondil boynu kırığında proksimal parça bu kasın çekmesiyle öne-içe yer değiştirir.'], ['j_disc', 'a_maxillary', 'n_buccal']),

  M('m_digastric', 'M. digastricus', 'oralfloor', 'Arka karın: incisura mastoidea. Ön karın: fossa digastrica (mandibula)', 'Ara tendon, os hyoideum', 'Arka karın: n_vii. Ön karın: n_mylohyoid', 'Hyoidi kaldırır, hyoid sabitken mandibulayı aşağı çeker',
    ['İki karnı iki farklı siniri (V3 ve VII) alır; embriyolojik köken farkını gösterir.'],
    ['Submandibular üçgenin sınırlarından birini yapar.'], ['ai_digastric', 'n_mylohyoid', 'b_hyoid']),
  M('m_mylohyoid', 'M. mylohyoideus', 'oralfloor', 'Linea mylohyoidea (mandibula)', 'Orta hat rafe ve os hyoideum gövdesi', 'n_mylohyoid', 'Ağız tabanını yükseltir, hyoidi kaldırır',
    ['Ağız tabanının kas diyaframıdır.', 'Sublingual boşluğu altındaki submandibular boşluktan ayırır.'],
    ['Kök uçları linea mylohyoidea üstündeyse apse sublingual, altındaysa submandibular boşluğa yayılır.', 'Ludwig anjini: bilateral yayılım ve havayolu tehlikesi; sıklıkla alt molar kaynaklıdır.'], ['ao_mylohyoid', 'n_mylohyoid', 't_47']),
  M('m_geniohyoid', 'M. geniohyoideus', 'oralfloor', 'Spina mentalis inferior', 'Os hyoideum gövdesi', 'C1 lifleri (n_xii ile taşınır)', 'Hyoidi öne-yukarı çeker, mandibula depresyonuna yardım eder',
    ['Ağız tabanı içinde C1 ile beslenen kastır.'],
    ['Dil kökü ile birlikte havayolu açıklığına katkı verir.'], ['ao_geniohyoid', 'n_xii', 'b_hyoid']),
  M('m_stylohyoid', 'M. stylohyoideus', 'oralfloor', 'Processus styloideus', 'Os hyoideum', 'n_vii', 'Yutkunmada hyoidi yukarı-arkaya çeker',
    ['Stilomastoid delikten hemen sonra CN VII’den dal alır.'],
    ['Eagle sendromunda stiloid çıkıntı komşuluğu ağrı yapabilir.'], ['n_vii', 'm_digastric', 'b_hyoid']),
  M('m_genioglossus', 'M. genioglossus', 'oralfloor', 'Spina mentalis superior', 'Dil alt yüzü ve os hyoideum', 'n_xii', 'Dili öne çıkarır (protrüzyon)',
    ['CN XII felcinde dilin lezyon tarafına sapmasını bu kasın güçsüzlüğü açıklar.'],
    ['Genel anestezide gevşediğinde dil kökü geri düşerek havayolunu kapatabilir.'], ['n_xii', 'm_tongue', 'b_mandible']),
  M('m_hyoglossus', 'M. hyoglossus', 'oralfloor', 'Os hyoideum cornu majus ve gövdesi', 'Dilin yan bölümü', 'n_xii', 'Dili aşağı ve geri çeker',
    ['A. lingualis bu kasın derininden, CN XII ve n. lingualis yüzeyinden geçer.'],
    ['Ağız tabanı cerrahisinde önemli bir yol göstericidir.'], ['a_lingual', 'n_xii', 'n_lingual']),
  M('m_tensor', 'M. tensor veli palatini', 'oralfloor', 'Fossa scaphoidea, spina ossis sphenoidalis ve tuba auditiva kıkırdağı', 'Hamulus pterygoideus çevresinden döner, aponeurosis palatina', 'N. pterygoideus medialis dalı (n_v3)', 'Yumuşak damağı gerer, östaki borusunu açar',
    ['Yumuşak damak kasları içinde CN X dışından (V3) beslenen kastır.'],
    ['Damak yarığında işlev bozukluğu orta kulak efüzyonuna eğilim yaratır.'], ['n_v3', 'g_otic', 'b_sphenoid']),
  M('m_tongue', 'Dil (lingua)', 'oralfloor', 'İç ve dış dil kaslarının oluşturduğu kas kütlesi', 'Mukoza ve dil septumu', 'Motor: n_xii (m. palatoglossus hariç). Duyu: ön 2/3 n_lingual, arka 1/3 n_ix. Tat: ön 2/3 n_chorda, arka 1/3 n_ix', 'Çiğneme, yutma ve konuşma',
    ['Ön 2/3 ve arka 1/3 ayrımı sulcus terminalis iledir.', 'M. palatoglossus CN X’tan beslenir.'],
    ['N. lingualis hasarında ön 2/3 uyuşur ve tat bozulur.'], ['n_lingual', 'n_xii', 'n_chorda']),

  M('m_orbicularis', 'M. orbicularis oris', 'perioral', 'Modiolus ve komşu mimik kasları; mandibula ve maxilla bağlantıları', 'Dudak derisi ve mukozası', 'n_vii (bukkal ve marjinal mandibular dallar)', 'Ağzı kapatır, dudakları büzer',
    ['Dudak kapanışının ana kasıdır.'],
    ['CN VII felcinde ağız köşesinden sıvı kaçar.'], ['n_vii', 'ao_orbicularis', 'a_facial']),
  M('m_mentalis', 'M. mentalis', 'perioral', 'Mandibula fossa incisiva', 'Çene ucu derisi', 'n_vii (marjinal mandibular dal)', 'Çene derisini ve alt dudağı yükseltir',
    ['Dudak hipertonisitesinde alt ön bölge protezine ve ortodontik dengeye etki eder.'],
    ['Alt ön cerrahide insizyon bu kasa göre planlanır.'], ['ao_mentalis', 'n_mental', 'n_vii']),
  M('m_dao', 'M. depressor anguli oris', 'perioral', 'Linea obliqua (mandibula)', 'Modiolus', 'n_vii (marjinal mandibular dal)', 'Ağız köşesini aşağı çeker',
    ['Marjinal mandibular dal alt çene kenarı boyunca seyreder.'],
    ['Submandibular insizyonda dal hasarı ağız köşesinde asimetri yapar.'], ['ao_dao', 'n_vii', 'b_mandible']),
  M('m_dli', 'M. depressor labii inferioris', 'perioral', 'Linea obliqua (mandibula)', 'Alt dudak derisi', 'n_vii (marjinal mandibular dal)', 'Alt dudağı aşağı ve dışa çeker',
    ['Foramen mentale bu bölgeye yakındır.'],
    ['Alt ön ve premolar bölge cerrahisinde kas ve n. mentalis birlikte korunur.'], ['ao_dli', 'n_mental', 'f_mental']),
  M('m_lao', 'M. levator anguli oris', 'perioral', 'Fossa canina (foramen infraorbitale altı)', 'Modiolus', 'n_vii (zigomatik ve bukkal dallar)', 'Ağız köşesini kaldırır',
    ['N. infraorbitalis bu kas ile m. levator labii superioris arasında yüze çıkar.'],
    ['Üst kanin apeks enfeksiyonunun yayılımı bu kasın tutunma düzeyine göre değerlendirilir.'], ['ao_lao', 'f_infraorbital', 't_13']),
  M('m_lls', 'M. levator labii superioris', 'perioral', 'Margo infraorbitalis altı', 'Üst dudak', 'n_vii (zigomatik ve bukkal dallar)', 'Üst dudağı kaldırır',
    ['Foramen infraorbitale bu kasın altındadır.'],
    ['İnfraorbital blok bölgesinde palpasyonla aşılan yumuşak doku düzeyindedir (blk_infraorbital).'], ['ao_lls', 'f_infraorbital', 'blk_infraorbital']),
  M('m_zygmaj', 'M. zygomaticus major', 'perioral', 'Os zygomaticum dış yüzü', 'Modiolus', 'n_vii (zigomatik ve bukkal dallar)', 'Ağız köşesini yukarı-dışa çeker (gülme)',
    ['Gülme hareketinin ana kasıdır.'],
    ['CN VII felcinde gülümseme asimetrisi belirgindir.'], ['ao_zygmaj', 'n_vii', 'b_zygomatic']),
  M('m_zygmin', 'M. zygomaticus minor', 'perioral', 'Os zygomaticum', 'Üst dudak', 'n_vii (zigomatik ve bukkal dallar)', 'Üst dudağı kaldırır',
    ['Nazolabial oluğun derinleşmesine katkı verir.'],
    ['CN VII felcinde üst dudak yüksekliği azalır.'], ['ao_zygmin', 'n_vii', 'b_zygomatic']),
  M('m_risorius', 'M. risorius', 'perioral', 'Fascia parotidea ve masseterica', 'Modiolus', 'n_vii (bukkal dal)', 'Ağız köşesini yana çeker',
    ['Kemik origosu yoktur; fasyadan başlar.'],
    ['Değişkenliği yüksek bir mimik kasıdır.'], ['n_vii', 'm_masseter', 'm_orbicularis']),
];

// ---------- TME ----------
const J = (id, name, route, spot, clinic, rel, through) => ({ id, name, cat: 'tmj', layer: 'joint', route, through, spot, clinic, rel, ref: REF.tmj });
const joints = [
  J('j_disc', 'Discus articularis (TME)', ['Kondil ile fossa mandibularis arasında bikonkav fibröz disk.', 'Ekleme üst (kayma) ve alt (rotasyon) iki boşluk verir.'],
    ['Ağız açılırken alt boşlukta rotasyon, üst boşlukta öne kayma olur.', 'Orta bölümü damarsız ve sinirsizdir; arka bölümde retrodiskal doku vardır.'],
    ['Redüksiyonlu disk deplasmanı: açılırken ve kapanırken klik.', 'Redüksiyonsuz deplasman: kilitlenme ve kısıtlı ağız açıklığı.'], ['m_latpt', 'j_capsule', 'b_mandible']),
  J('j_capsule', 'Capsula articularis (TME)', ['Fossa mandibularis ve tuberculum articulare kenarından collum mandibulae’ye uzanır.'],
    ['TME sinoviyal eklemdir; yüzeyi hiyalin yerine fibröz kıkırdakla örtülüdür.', 'Duyusu ağırlıkla n_auriculotemporal, ayrıca masseterik ve derin temporal dallardan gelir.'],
    ['Artrosentez ve TME girişimlerinde n_auriculotemporal ve yüzeyel temporal damarlar komşudur.'], ['n_auriculotemporal', 'j_disc', 'j_latlig']),
  J('j_latlig', 'Lig. laterale (TME)', ['Tuberculum articulare ve arcus zygomaticus kökünden collum mandibulae arka-yan yüzüne.'],
    ['Eklemin ana stabilizatörüdür; kondilin arkaya ve aşağı aşırı hareketini sınırlar.', 'Gerçek eklem kapsülü kalınlaşmasıdır.'],
    ['Çene travmalarında hasar görerek eklem instabilitesine katkı verebilir.'], ['j_capsule', 'j_smlig', 'j_stlig']),
  J('j_smlig', 'Lig. sphenomandibulare', ['Spina ossis sphenoidalis’ten lingula mandibulae’ye.'],
    ['Aksesuar bağdır; ilk faringeal yay (Meckel) kıkırdağı kalıntısıdır.', 'N. alveolaris inferior ile ramus arasında kalır.'],
    ['IANB’de iğne lig. sphenomandibulare önünde, lingula üstünde tutulur (blk_ianb).'], ['f_mandibular', 'n_ian', 'blk_ianb']),
  J('j_stlig', 'Lig. stylomandibulare', ['Processus styloideus’tan angulus mandibulae arka kenarına.'],
    ['Aksesuar bağdır; protrüzyonu sınırlar.', 'Parotis ile submandibular bezi ayıran fasya kalınlaşmasıdır.'],
    ['Eagle sendromu ile komşuluğu nedeniyle ağrı değerlendirmesinde düşünülür.'], ['j_capsule', 'b_mandible', 'm_stylohyoid']),
];

// ---------- KAS YAPIŞMALARI ----------
const A = (id, muscleId, kind, where) => {
  const m = muscles.find((x) => x.id === muscleId);
  const label = kind === 'o' ? 'origo' : 'insersiyo';
  return {
    id,
    name: `${m.name} – ${label}`,
    cat: 'attach',
    layer: kind === 'o' ? 'attach_o' : 'attach_i',
    route: [`Kemik üzerindeki bölge: ${where}`],
    through: [`Kas: ${muscleId}`, `Sinir: ${m.nerve}`],
    spot: [`Hareket: ${m.action}`],
    clinic: m.clinic,
    rel: [muscleId],
    ref: REF.mus,
  };
};
const attachments = [
  A('ao_masseter', 'm_masseter', 'o', 'Arcus zygomaticus alt kenarı ve iç yüzü'),
  A('ai_masseter', 'm_masseter', 'i', 'Ramus dış yüzü ve angulus'),
  A('ao_temporalis', 'm_temporalis', 'o', 'Fossa temporalis'),
  A('ai_temporalis', 'm_temporalis', 'i', 'Processus coronoideus ve ramus ön kenarı'),
  A('ao_medpt', 'm_medpt', 'o', 'Fossa pterygoidea, processus pterygoideus'),
  A('ai_medpt', 'm_medpt', 'i', 'Ramus iç yüzü, angulus yakını'),
  A('ao_latpt', 'm_latpt', 'o', 'Lamina lateralis processus pterygoidei (alt baş)'),
  A('ai_digastric', 'm_digastric', 'i', 'Fossa digastrica (ön karın; bazı kitaplarda origo olarak anılır)'),
  A('ao_geniohyoid', 'm_geniohyoid', 'o', 'Spina mentalis inferior'),
  A('ai_geniohyoid', 'm_geniohyoid', 'i', 'Os hyoideum gövdesi'),
  A('ao_mylohyoid', 'm_mylohyoid', 'o', 'Linea mylohyoidea'),
  A('ao_mentalis', 'm_mentalis', 'o', 'Fossa incisiva'),
  A('ao_dao', 'm_dao', 'o', 'Linea obliqua'),
  A('ao_dli', 'm_dli', 'o', 'Linea obliqua, foramen mentale önü'),
  A('ao_orbicularis', 'm_orbicularis', 'o', 'Mandibula kesici bölgesi'),
  A('ao_lao', 'm_lao', 'o', 'Fossa canina'),
  A('ao_lls', 'm_lls', 'o', 'Margo infraorbitalis altı'),
  A('ao_zygmaj', 'm_zygmaj', 'o', 'Os zygomaticum dış yüzü'),
  A('ao_zygmin', 'm_zygmin', 'o', 'Os zygomaticum'),
];

export const TEXT_DENTAL = [...teeth, ...muscles, ...joints, ...attachments];
