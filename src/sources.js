const LINKS = {
  bp: 'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html',
  bpLic: 'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html',
  za: 'https://github.com/Z-Anatomy/Models-of-human-anatomy',
  byCc: 'https://creativecommons.org/licenses/by/4.0/',
  bySa: 'https://creativecommons.org/licenses/by-sa/4.0/',
};
const a = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

export function renderSources(el, { items, index }) {
  const schematic = items.filter((s) => index.items[s.id]?.schematic).map((s) => s.name);
  const markers = items.filter((s) => index.items[s.id]?.marker).length;
  el.innerHTML = `<article>
    <h2>Kaynaklar ve lisans</h2>
    <p>Bu uygulama eğitim amaçlıdır; tıbbi veya klinik karar aracı değildir.</p>

    <h3>3B modeller</h3>
    <table>
      <tr><th>Kaynak</th><th>Kullanıldığı yer</th><th>Lisans ve atıf</th></tr>
      <tr><td>${a(LINKS.za, 'Z-Anatomy')}</td><td>Kafatası kemikleri, dişler, çiğneme, ağız tabanı ve perioral kaslar, kas yapışma bölgeleri, TME diski, kapsülü ve bağları, kavernöz sinüs, baziler pleksus, falx, tentorium, beyin sapı; sinir, arter ve sinüs eğrileri (bu eğrilerin etrafına tüp mesh örüldü)</td><td>${a(LINKS.bySa, 'CC BY-SA 4.0')}. “Z-Anatomy”. Z-Anatomy kendi atıflarında BodyParts3D ve “Cranial Nerves and Foramina” (University of Dundee, CAHID, CC BY 4.0) modellerini de bildirir.</td></tr>
      <tr><td>${a(LINKS.bp, 'BodyParts3D 4.0')}</td><td>Willis poligonu ve serebral arterler, orbita sinirleri, optik sinir ve chiasma, ganglion ciliare, a. subclavia, m. tensor veli palatini</td><td>“BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International”. ${a(LINKS.bpLic, 'Güncel lisans sayfası')} (son güncelleme 27.02.2025) CC BY 4.0 belirtir; 2013 tarihli OBJ dosyalarının başlıkları ise CC BY-SA 2.1 Japonya der. Eski başlığa da uyulması için türev modeller aşağıdaki gibi BenzerPaylaşım ile dağıtılır.</td></tr>
    </table>
    <p><b>Yapılan değişiklikler:</b> Modeller hizalandı (BodyParts3D, Z-Anatomy uzayına 0/+90/+71,5 mm ötelendi), eksen değiştirildi, sol taraf çoğunlukla sağın aynası olarak üretildi, poligon sayısı azaltıldı (meshoptimizer), eğrilerden tüp üretildi, üst ikinci premoların (15, 25) kaynakta iki olan kökü tek köke indirilerek yeniden örüldü, meshopt ile sıkıştırıldı. Türev GLB dosyaları ${a(LINKS.bySa, 'CC BY-SA 4.0')} ile paylaşılır.</p>
    <p><b>Kullanılmayanlar:</b> Z-Anatomy’nin iç kulak parçaları, kaynağı ticari olmayan (CC BY-NC-SA) olduğu için bilerek dışarıda bırakıldı.</p>

    <h3>Modelin sınırları</h3>
    <ul>
      <li><b>Şematik yollar (${schematic.length}):</b> ${schematic.join(', ')}. Modelde karşılığı olmadığı için kemiğe göre elle çizildi; anatomik seyir doğru hedeflenmiştir ama milimetrik değildir. A. meningea media’nın kafa içi dalları da şematiktir.</li>
      <li><b>${markers} konum işaretçisi:</b> Delikler ve bazı gangliyonlar küre ile gösterilir. Konumlar, sinir ve damar yollarının gerçek kemikten geçtiği yerden ve kemik izdüşümünden okundu. İndirgenmiş kemikte bazı küçük delikler (ör. foramen spinosum) mesh olarak açık görünmez.</li>
      <li><b>Dişler:</b> Üçüncü molarlar (18, 28, 38, 48) ve süt dişleri modelde yoktur. Sol dişler sağın aynasıdır.</li>
      <li><b>Kaslar:</b> M. buccinator, m. styloglossus ve m. palatoglossus modelde yoktur. M. pterygoideus lateralis insersiyosu ve üst başının origosu için yapışma bölgesi yoktur.</li>
      <li><b>Maksiller sinüs:</b> Modelde sinüs boşluğu yoktur, maxilla dolu görünür. Bu nedenle kesitlerde sinüs hava olarak gösterilemez.</li>
      <li><b>Kesit görüntüsü:</b> 3B modelden üretilmiş şematik bir çizimdir, gerçek BT verisi değildir.</li>
      <li><b>Çene hareketi:</b> Açıklık ve kondil yolu modelden ölçülerek kurulan bir yaklaşımdır. Kaslar basit gerdirmeyle izler, kısalma ve şişme modellenmez. Modelde eminentia sığ olduğu için kondil translasyonu (yaklaşık 9 mm) klinik olarak alt sınıra yakındır.</li>
      <li>Blok sahnelerindeki yeşil iğne çizgisi yalnızca hedefi anlatır, klinik teknik rehberi değildir.</li>
      <li>Z-Anatomy eğri adlarının ikisi seyre göre yeniden yorumlandı: “meningeal branch of maxillary nerve” → n. auriculotemporalis; “artery of pterygoid canal” → a. sphenopalatina. Adsız “?x” eğrisi n. nasopalatinus olarak kullanıldı.</li>
    </ul>

    <h3>Klinik içerik</h3>
    <p>Her yapının altındaki kaynak notu, bilginin karşılaştırılacağı standart kaynağı gösterir: Moore <i>Clinically Oriented Anatomy</i>, <i>Gray’s Anatomy</i>, Netter <i>Atlas of Human Anatomy</i>; bloklar için Malamed <i>Handbook of Local Anesthesia</i>, StatPearls ve PMC5722639; dişler ve TME için <i>Wheeler’s Dental Anatomy</i> ve Okeson.</p>
    <p><b>Doğrulama durumu:</b> Basılı kitaplara ve Türkçe DUS kaynaklarına erişilemedi, bu nedenle notlarda sayfa numarası yoktur. Yalnızca blokların bir bölümü ve gangliyon eşleşmeleri çevrimiçi kaynaklarla karşılaştırıldı. Sınavdan önce içeriği kendi kaynağınızla (ör. Arıncı-Elhan veya DUS ders kitabınız) kontrol edin.</p>

    <h3>Yazılım</h3>
    <p>Three.js (MIT), meshoptimizer (MIT), glTF Transform (MIT), Vite (MIT), Blender Python modülü (yalnızca dışa aktarmada, GPL).</p>
  </article>`;
}
