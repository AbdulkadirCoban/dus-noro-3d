const LINKS = {
  bp: 'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html',
  za: 'https://github.com/Z-Anatomy/Models-of-human-anatomy',
  bySa: 'https://creativecommons.org/licenses/by-sa/4.0/',
};
const a = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

export function renderSources(el, { items, index }) {
  const schematic = items.filter((s) => index.items[s.id]?.schematic).map((s) => s.name);
  el.innerHTML = `<article>
    <h2>Kaynaklar</h2>
    <p>Bu uygulama DUS hazırlığı için bir çalışma aracıdır; tıbbi veya klinik karar aracı değildir.</p>

    <h3>Bilgilerin doğruluğu</h3>
    <p>Metinler standart anatomi bilgisine göre hazırlandı, ancak ders kitaplarıyla sayfa sayfa karşılaştırılmadı. Her yapının altındaki “Karşılaştırmak için” satırı, o konuyu kontrol edebileceğiniz kaynağı gösterir: Moore <i>Clinically Oriented Anatomy</i>, <i>Gray’s Anatomy</i>, Netter <i>Atlas of Human Anatomy</i>; bloklar için Malamed <i>Handbook of Local Anesthesia</i>; dişler ve TME için <i>Wheeler’s Dental Anatomy</i> ve Okeson. Kendi ders kitabınızla çelişen bir bilgi görürseniz kitabınızı esas alın.</p>

    <h3>3B modeller</h3>
    <ul>
      <li>${a(LINKS.za, 'Z-Anatomy')} (${a(LINKS.bySa, 'CC BY-SA 4.0')}): kemikler, dişler, kaslar, bezler, sinir ve damar yolları. Z-Anatomy, BodyParts3D ve University of Dundee CAHID’in “Cranial Nerves and Foramina” modellerini kullanır.</li>
      <li>${a(LINKS.bp, 'BodyParts3D')}, © The Database Center for Life Science, CC BY 4.0: Willis poligonu ve beyin arterleri, orbita sinirleri, a. subclavia, m. tensor veli palatini.</li>
    </ul>
    <p>Modeller uygulama için sadeleştirildi ve birleştirildi; sol taraf çoğunlukla sağın aynasıdır. Değiştirilmiş modeller ${a(LINKS.bySa, 'CC BY-SA 4.0')} ile paylaşılır.</p>

    <h3>Modelde dikkat edilecekler</h3>
    <ul>
      ${schematic.length ? `<li><b>Elle çizilen yollar:</b> ${schematic.join(', ')}. Modelde karşılığı olmadığı için yaklaşık olarak çizildi; seyri doğrudur ama milimetrik değildir.</li>` : ''}
      <li><b>Delikler</b> halka ile işaretlidir. Foramen spinosum gibi küçük delikler kemikte açık görünmeyebilir.</li>
      <li><b>Dişler:</b> Üçüncü molarlar ve süt dişleri yoktur.</li>
      <li><b>Eksik kaslar:</b> m. buccinator, m. styloglossus, m. palatoglossus, m. levator labii superioris alaeque nasi ve kulak kasları.</li>
      <li><b>Maksiller sinüs</b> modelde boşluk olarak yoktur; kesitlerde dolu görünür.</li>
      <li><b>Kesit görüntüsü</b> 3B modelden çizilmiş bir şemadır, gerçek BT değildir.</li>
      <li><b>Çene hareketi</b> yaklaşık bir canlandırmadır; kondil hareketi klinik alt sınıra yakındır.</li>
      <li>Blok sahnelerindeki iğne çizgisi yalnız hedefi gösterir, teknik rehberi değildir.</li>
    </ul>

    <h3>Yazılım</h3>
    <p>Three.js, Vite, meshoptimizer ve glTF Transform (MIT lisansı).</p>
  </article>`;
}
