# DUS Nöro 3D

DUS için diş hekimliği odaklı 3B baş-boyun anatomi atlası.

**Uygulama:** https://abdulkadircoban.github.io/dus-noro-3d/

> Eğitim amaçlıdır, klinik karar aracı değildir. Metinler ders kitaplarıyla sayfa sayfa karşılaştırılmadı; sınavdan önce kendi kaynağınızla kontrol edin.

## Neler var

- **Atlas:** Kafadan klavikulaya kadar kemik, diş, kas, bez, sinir, arter ve ven modelleri. Her yapı için topografik rota, içinden geçenler ve dallar, DUS spotu ve klinik lezyon bilgisi.
- **Sinirler ve delikler:** Her sinirin çıkış yeri; delikler, içinden geçen sinirin yönünde halka olarak gösterilir.
- **Boyun üçgenleri:** Sınır, tavan, taban ve içerik ayrı ayrı gösterilebilir.
- **Bloklar:** Dört diş bloğu sahnesi.
- **Kesit ve çene hareketi:** Dolu kesit yüzeyi, şematik kesit görüntüsü ve çene açılma canlandırması.
- **Testler:** 3B pin testi ve quiz; ilerleme cihazda saklanır.

## iPad'de kullanım

1. Adresi iPad'de **Safari** ile açın ve yükleme bitene kadar bekleyin.
2. Paylaş düğmesine, ardından **Ana Ekrana Ekle**'ye dokunun.
3. Uygulamayı bir kez internet varken açın; sonra internetsiz de açılır.

Kontroller:

- Tek parmak döndürür, iki parmak yakınlaştırır ve kaydırır. İki kez dokunmak o noktaya yaklaşır.
- Bir yapıya uzun basınca seçme, gizleme ve "yalnız bunu göster" menüsü açılır.
- Sağdaki düğmeler: yakınlaştır, uzaklaştır, tek parmakla kaydırma ve geri al (↶).
- Yatay ekranda sol üstteki ☰ listeyi, sağ üstteki ◨ açıklama panelini gizler.

## Geliştirme

Node.js 22 veya üstü gerekir.

```bash
npm install
```

```bash
npm run dev
```

Testler `dist` klasörünü `/dus-noro-3d/` alt dizininde servis eder ve dört iPad görünümünde (Chromium ve WebKit, yatay ve dikey) çalışır:

```bash
npx playwright install chromium webkit
```

```bash
npm test
```

`main` dalına gönderilen her değişiklik GitHub Actions ile GitHub Pages'e yayınlanır.

### İçerik

| Dosya | İçerik |
|---|---|
| `scripts/content/text-a.mjs` | Kemikler, delikler, sinirler, gangliyonlar |
| `scripts/content/text-b.mjs` | Arterler, venler, bloklar |
| `scripts/content/text-dental.mjs` | Dişler, çiğneme kasları, TME |
| `scripts/content/text-neck.mjs` | Boyun, bezler, yüz kasları, üçgenler, sinir çıkış yerleri |
| `scripts/content/quiz.mjs` | Quiz soruları |
| `scripts/content/geo.mjs` | Her yapının geometri tarifi |

Metin değişince `data/` dosyalarını yeniden üretin. Komut kırık bağlantıları ve eksik alanları da denetler:

```bash
npm run data
```

### Modeller

Hazır GLB dosyaları `public/models` içindedir. Yalnız `geo.mjs` içindeki geometri değişirse yeniden üretmek gerekir. Kaynak veriler büyük olduğu için depoda değildir (`.model-src/`):

1. [BodyParts3D](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html) `isa_BP3D_4.0_obj_99.zip` dosyasından gereken OBJ'leri `.model-src/bp3d/` içine çıkarın.
2. [Z-Anatomy](https://github.com/Z-Anatomy/Models-of-human-anatomy) `Startup.blend` dosyasını Python 3.11 ve `bpy==4.5.0` ile dışa aktarın:

```bash
python scripts/prep/za_splines.py Startup.blend .model-src/za/splines.json
```

```bash
python scripts/prep/za_meshes.py Startup.blend .model-src/za/mesh
```

3. GLB dosyalarını üretin:

```bash
npm run models
```

## Lisans

- **3B modeller** (`public/models`): Z-Anatomy ve BodyParts3D'den türetilmiştir, CC BY-SA 4.0. Atıflar `public/models/LICENSE.txt` dosyasında ve uygulamanın Kaynaklar sekmesindedir.
- **Bağımlılıklar:** Three.js, Vite, meshoptimizer ve glTF Transform (MIT).
