# DUS Nöro 3D

DUS için diş hekimliği odaklı 3B baş-boyun anatomi atlası. Kafadan klavikulaya kadar gerçek kemik, diş, kas, bez, sinir ve damar modelleri, boyun üçgenleri (sınır, taban ve içerik), sinirlerin çıkış yerleri, yapı başına topografi, DUS spotları ve klinik bilgiler, dört diş bloğu sahnesi, kas yapışma bölgeleri, çene hareketi, dolu kesit yüzeyi ve şematik kesit görüntüsü, 3B pin testi ve quiz içerir. Ağırlıklı olarak iPad için tasarlandı, masaüstünde de çalışır. Kurulduktan sonra internetsiz açılır.

> Eğitim amaçlıdır, klinik karar aracı değildir. Lisans ve doğrulama durumu uygulamadaki **Kaynaklar** sekmesindedir.

## GitHub'a yükleme (yeni başlayanlar için)

Bu adımları bir kez yapmanız yeterli. Sonrasında siteniz her güncellemede kendini yeniler.

### 1. GitHub hesabı ve araçlar

1. [github.com](https://github.com) üzerinden ücretsiz hesap açın.
2. [git-scm.com](https://git-scm.com/downloads) adresinden Git'i kurun. Bu bilgisayarda kurulu olduğu için bu adımı atlayabilirsiniz.

### 2. Depoyu oluşturun

1. GitHub'da sağ üstteki **+** düğmesine, ardından **New repository**'ye basın.
2. **Repository name** alanına bir ad yazın, örneğin `dus-noro-3d`.
3. **Public** seçili kalsın. Ücretsiz planda GitHub Pages herkese açık depolarda çalışır.
4. README, .gitignore veya license kutularını **işaretlemeyin**. Bunlar projede zaten var.
5. **Create repository**'ye basın.

### 3. Kodu gönderin

Proje klasöründe bir terminal açın. Windows'ta klasörde Shift + sağ tık yapıp "Terminalde aç" diyebilirsiniz. Şu komutları sırayla çalıştırın. Son iki komutta `KULLANICIADI` yerine kendi GitHub kullanıcı adınızı yazın.

Git'e kim olduğunuzu söyleyin (ilk seferde bir kez):

```bash
git config --global user.name "Adınız"
```

```bash
git config --global user.email "eposta@adresiniz.com"
```

Dosyaları kaydedin:

```bash
git add .
```

```bash
git commit -m "İlk sürüm"
```

GitHub'a gönderin:

```bash
git remote add origin https://github.com/KULLANICIADI/dus-noro-3d.git
```

```bash
git push -u origin main
```

İlk `git push` sırasında tarayıcıda GitHub girişi istenir.

### 4. Pages'i açın

1. GitHub'da deponuzun sayfasında **Settings** sekmesine girin.
2. Soldaki menüden **Pages**'e tıklayın.
3. **Build and deployment → Source** kısmında **GitHub Actions**'ı seçin.

Yeni bir kaydetme düğmesi çıkmaz, seçim hemen geçerli olur.

### 5. Yayını bekleyin

1. Deponun **Actions** sekmesine girin. "GitHub Pages'e yayınla" işini göreceksiniz.
2. İş listede görünmüyorsa veya 4. adımdan önce başlayıp başarısız olduysa, işi açıp **Re-run all jobs**'a basın.
3. Yeşil tik çıkınca (genellikle 1–2 dakika) siteniz yayındadır:

   `https://KULLANICIADI.github.io/dus-noro-3d/`

### 6. iPad'e kurun

1. Adresi iPad'de **Safari** ile açın ve yükleme çubuğu bitene kadar bekleyin.
2. Paylaş düğmesine, ardından **Ana Ekrana Ekle**'ye dokunun.
3. Uygulamayı ana ekrandan bir kez internet varken açın. Sonra internetsiz de açılır.

## Güncelleme

Dosyalarda değişiklik yaptıktan sonra şu üç komut yeterlidir:

```bash
git add .
```

```bash
git commit -m "Ne değiştiğini yazın"
```

```bash
git push
```

Site birkaç dakika içinde kendini yeniler. iPad'deki uygulama yeni sürümü arka planda alır, genellikle uygulamayı kapatıp yeniden açınca görünür.

## Sık karşılaşılan sorunlar

| Belirti | Çözüm |
|---|---|
| Actions işi `deploy` adımında kırmızı | Settings → Pages → Source'un **GitHub Actions** olduğunu kontrol edip işi yeniden çalıştırın |
| Site açılıyor ama modeller gelmiyor | Tarayıcıda yenileyin; `public/models` klasörünün depoya gönderildiğini kontrol edin |
| `git push` "rejected" hatası | Depoyu boş oluşturmadıysanız `git pull --rebase origin main`, ardından `git push` çalıştırın |
| iPad'de eski sürüm görünüyor | Uygulamayı kapatıp iki kez açın; olmazsa ana ekrandan silip yeniden ekleyin |

## Geliştirme

Node.js 22 veya üstü gerekir. VS Code Live Server bu projeyi açamaz, çünkü kod önce Vite ile işlenmelidir. Bunun yerine `npm run dev` kullanın.

```bash
npm install
```

Geliştirme sunucusu:

```bash
npm run dev
```

Derleme ve önizleme:

```bash
npm run build
```

```bash
npm run preview
```

Testler. İlk seferde tarayıcıları kurun, sonra çalıştırın. Testler `dist` klasörünü `/dus-noro-3d/` alt dizininde servis ederek GitHub Pages'i taklit eder:

```bash
npx playwright install chromium webkit
```

```bash
npm test
```

## İçerik düzenleme

| Dosya | İçerik |
|---|---|
| `scripts/content/text-a.mjs` | Kemikler, delikler, sinirler, gangliyonlar |
| `scripts/content/text-b.mjs` | Arterler, venler, bloklar |
| `scripts/content/quiz.mjs` | Delik ve lezyon soruları |
| `scripts/content/geo.mjs` | Her yapının geometri tarifi |

Metni değiştirdikten sonra aşağıdaki komutla `data/structures.json` ve `data/quiz.json` yeniden üretilir. Komut, kırık bağlantı ve eksik alanları da denetler.

```bash
npm run data
```

## Modelleri yeniden üretme

Hazır GLB dosyaları `public/models` içindedir ve depoya dahildir, bu nedenle normal kullanımda bu bölüm gerekmez. Yalnızca `geo.mjs` içindeki geometriyi değiştirirseniz gerekir. Kaynak veriler büyük olduğu için depoda değildir (`.model-src/`).

1. [BodyParts3D](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html) sayfasından `isa_BP3D_4.0_obj_99.zip` indirin. Gereken OBJ dosyalarını `.model-src/bp3d/` içine çıkarın.
2. [Z-Anatomy](https://github.com/Z-Anatomy/Models-of-human-anatomy) deposundan `Z-Anatomy.zip` indirin ve `Startup.blend`'i çıkarın.
3. Python 3.11 sanal ortamında `pip install bpy==4.5.0` çalıştırın, ardından dosyaları dışa aktarın:

```bash
python scripts/prep/za_splines.py Startup.blend .model-src/za/splines.json
```

```bash
python scripts/prep/za_meshes.py Startup.blend .model-src/za/mesh
```

4. GLB dosyalarını üretin:

```bash
npm run models
```

## Lisans

- **3B modeller** (`public/models`): CC BY-SA 4.0. Atıflar `public/models/LICENSE.txt` dosyasında ve uygulamanın Kaynaklar sekmesindedir.
- **Bağımlılıklar**: kendi lisanslarıyla (Three.js, Vite, meshoptimizer ve glTF Transform MIT lisanslıdır).
