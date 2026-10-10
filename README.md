# Medera Akademi — Saha Eğitim Platformu

Saha ekipleri için sınav, müfredat, ürün kütüphanesi, yapay zekâ asistanı ve hekim etkileşim takibi. Yöneticiler için ayrı bir panel içerir.

## Mimari

| Parça | Nerede çalışır | Görevi |
|---|---|---|
| `index.html`, `admin.html`, `assets/` | GitHub Pages (statik) | Kullanıcı uygulaması ve yönetim paneli |
| `supabase/schema.sql` | Supabase (PostgreSQL) | Tablolar, satır düzeyi güvenlik, sunucuda sınav puanlama |
| `supabase/functions/ai` | Supabase Edge Function | Claude API çağrıları; API anahtarı yalnızca burada durur |

Güvenlik notları: Cevap anahtarları ayrı tabloda tutulur ve kullanıcılar atanmış sınavların anahtarını göremez. Puanlama sunucuda yapılır. Kullanıcılar kendi rollerini değiştiremez. Her temsilci yalnızca kendi hekim kayıtlarını görür; yöneticiler hepsini okuyabilir.

---

## Kurulum (yaklaşık 20 dakika)

### 1. Supabase projesi
1. https://supabase.com adresinde ücretsiz hesap açın ve **New project** ile proje oluşturun.
2. Sol menüden **SQL Editor → New query** açın, `supabase/schema.sql` dosyasının tamamını yapıştırıp **Run**'a basın. Ardından aynı şekilde `supabase/upgrade_v2.sql` dosyasını çalıştırın. Ardından `supabase/hardening.sql` dosyasını çalıştırın. (`schema.sql` yalnızca bir kez çalıştırılır; yükseltme ve güvenlik dosyaları birlikte tekrar çalıştırılabilir.)

### 2. GitHub deposu ve Pages
1. GitHub'da yeni bir depo oluşturun (örn. `medera-akademi`).
2. Bu klasördeki tüm dosyaları yükleyin. Web üzerinden: **Add file → Upload files**. Komut satırından:
   ```bash
   git init && git add . && git commit -m "İlk sürüm"
   git branch -M main
   git remote add origin https://github.com/KULLANICI/medera-akademi.git
   git push -u origin main
   ```
3. Depoda **Settings → Pages → Build and deployment → Source: Deploy from a branch**, dal olarak `main` ve klasör olarak `/ (root)` seçin.
4. Birkaç dakika sonra siteniz `https://KULLANICI.github.io/medera-akademi/` adresinde yayında olur.

> Özel (private) depodan GitHub Pages yayını için ücretli GitHub planı gerekir. Kod herkese açık olsa bile veriler Supabase'de korunur, çünkü `config.js` içinde gizli bilgi yoktur.

### 3. Yapay zekâ fonksiyonu
Anthropic Console'dan (https://console.anthropic.com) bir API anahtarı alın. Ardından [Supabase CLI](https://supabase.com/docs/guides/cli) ile şunları çalıştırın:
```bash
supabase login
supabase link --project-ref PROJE_REF        # Project Settings → General'da yazar
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set ALLOWED_ORIGIN=https://KULLANICI.github.io   # isteğe bağlı, önerilir
supabase functions deploy ai
```
CLI kullanmak istemezseniz: Supabase panelinde **Edge Functions → Deploy a new function → Via Editor** ile `ai` adında fonksiyon oluşturun ve `supabase/functions/ai/index.ts` içeriğini yapıştırın. Ardından **Edge Functions → Secrets** bölümüne `ANTHROPIC_API_KEY` ekleyin.

Varsayılan model `claude-sonnet-5-5`. Değiştirmek için `ANTHROPIC_MODEL` gizli değişkenini tanımlayın. Yapay zekâ yalnızca etkin hesaplara açıktır ve hesap başına günlük 50 istek sınırı uygular.

### 4. config.js
Supabase panelinde **Project Settings → API** bölümünden Project URL ve anon (public/publishable) anahtarı kopyalayıp `config.js` dosyasına yazın, sonra GitHub'a yeniden yükleyin. Bu anahtarın herkese açık olması güvenlidir. Anthropic anahtarını **asla** buraya yazmayın.

### 5. Giriş ayarları
Supabase panelinde **Authentication → URL Configuration**:
- **Site URL:** `https://KULLANICI.github.io/medera-akademi/`
- **Redirect URLs:** aynı adresi ve `https://KULLANICI.github.io/medera-akademi/admin.html` adresini ekleyin.

Supabase'in yerleşik e-posta servisi saatte birkaç e-postayla sınırlıdır. Ekip kullanımı için **Authentication → Emails → SMTP Settings** bölümünden kendi SMTP sunucunuzu tanımlayın.

Yalnızca şirket e-postalarına izin vermek için `schema.sql` içindeki `handle_new_user` fonksiyonundaki yorum satırlarını açıp alan adınızı yazın ve fonksiyonu SQL Editor'de yeniden çalıştırın.

### 6. İlk yönetici
Siteden **Kayıt ol** sekmesiyle hesabınızı oluşturun. Ardından SQL Editor'de şunu çalıştırın:
```sql
update public.profiles set role = 'admin', status = 'active' where email = 'sizin@epostaniz.com';
```
Sayfayı yenilediğinizde üst menüde **Yönetim paneli** bağlantısı görünür. Diğer yöneticileri panelden atayabilirsiniz.

---

## Roller ve hesaplar

Kullanıcılar e-posta, şifre ve rolleriyle kayıt olur. Yeni hesaplar **onay bekliyor** durumunda başlar ve yönetici onaylayana kadar hiçbir içeriğe erişemez. Rol kullanıcı tarafından seçildiği için yönetici onay sırasında rolü kontrol etmeli, gerekirse düzeltmelidir.

| Rol | Ne görür / ne yapar |
|---|---|
| **PJP** | Sınavlar, kütüphane ve yapay zekâ asistanı, müfredat, hekim ve etkileşim kaydı (Hekimlerim) |
| **Ürün Müdürü** | Sınavlar, müfredat ve **Ekip raporu**: kendi ürünlerine atanmış PJP'lerin sınav başarısı ve etkileşim sayıları. Hekim adlarını görmez. |
| **Avukat** | Sınavlar, müfredat ve **Hukuk incelemesi**: yayın öncesi içerikleri onaylar ya da gerekçeyle reddeder. |
| **Yönetici** (ayrı yetki) | Yönetim paneli. Herhangi bir iş rolündeki kullanıcı yönetici yapılabilir. |

**Hukuk onayı (MLR):** Sınavlar ve müfredatlar taslak → hukuk incelemesi → onay akışından geçer. Onaysız sınav atanamaz, onaysız müfredat yayımlanamaz; bu kurallar veritabanında zorunludur. Onaylı içerik düzenlenirse onay otomatik düşer. Henüz avukat yoksa yönetici de onay verebilir.

**E-posta doğrulaması:** Supabase varsayılan olarak kayıtta doğrulama e-postası gönderir. Yerleşik e-posta servisi saatte birkaç e-postayla sınırlıdır; ekibe açmadan önce kendi SMTP sunucunuzu tanımlayın (Authentication → Emails → SMTP Settings).

## Yönetim paneli

- **Genel bakış:** Bekleyen işler (onay bekleyen kullanıcılar, hukuk incelemesindeki içerikler), rol dağılımı, tamamlama ve başarı oranları, geciken atamalar.
- **Kullanıcılar:** Onay bekleyen / etkin / devre dışı filtreleri, rol değiştirme, onaylama, erişimi kapatma, ürün atama, yönetici yetkisi.
- **Hekimler:** Tüm temsilcilerin kaydettiği hekimler; temsilci, uzmanlık ve şehir filtresi; birden fazla temsilcinin kaydettiği hekimleri işaretleme; CSV.
- **Duyurular:** Herkese ya da belirli bir role duyuru, sabitleme.
- **Ürünler:** Ürün ekleme, düzenleme, silme. Ürün notları yapay zekâ asistanına bağlam olarak gider.
- **Sınavlar:** Yapay zekâyla taslak, soru düzenleyici, hukuk incelemesine gönderme, role göre toplu atama ("Tüm PJP"), son tarih, sonuçlar ve CSV.
- **Müfredat:** Yapay zekâyla taslak, modül düzenleme, hukuk incelemesi, yayımlama.
- **Saha aktivitesi:** Tüm temsilcilerin hekim etkileşimleri, temsilci filtresi, CSV dışa aktarma.

## Kullanıcı uygulaması

- **Sınavlarım:** Kişisel ve ekip istatistikleri, atanan sınavlar, yapay zekâyla pratik sınavı oluşturma, sonuç inceleme.
- **Kütüphane:** Atanan ürünler ve konu bağlamı seçilebilen, akışlı yanıt veren yapay zekâ asistanı.
- **Müfredat:** Yayımlanmış eğitim planları.
- **Hekimlerim** (eski adı Paydaşlar): Hekim kaydı, arama ve filtreler, etkileşim geçmişi, ürün bazında dağılım.

## Uyumluluk

Hekim adları ve etkileşim notları kişisel veridir (KVKK). Gerçek verilerle kullanmadan önce şirketinizin bilgi güvenliği ve uyum ekibinden onay alın. Supabase projenizin bölgesini (ör. AB) buna göre seçin. Etkileşim notlarına hasta bilgisi yazılmamalıdır.

## Dosya yapısı

## Yeni özelliklerin kurulumu

Mevcut kurulumda `supabase/features_v3.sql` dosyasını `hardening.sql` sonrasında tek bir veritabanı işlemi içinde çalıştırın. Yeni kurulum sırası: `schema.sql`, `upgrade_v2.sql`, `hardening.sql`, `features_v3.sql`. Daha sonra yapay zekâ Edge Function dosyasını yeniden yayımlayın.

- Atanan sınavların soruları, cevap anahtarları ve açıklamaları atama anında korunur. Daha sonraki düzenlemeler eski sonuçları değiştirmez. Bu özellik kurulduğu tarihten önce kaybolmuş sürümleri geri oluşturamaz.
- Sınav ve müfredatların önceki sürümleri yönetim panelindeki **Sürümler** düğmesinden görüntülenir. **İşlem geçmişi** kullanıcı, içerik, atama ve hukuk onayı işlemlerini gösterir.
- **Kaynak belgeleri** bölümünde ürün belgelerinin metinlerini özgün sayfa numaralarıyla ekleyin veya TXT dosyası içeriğini aktarın. Taslağı hukuk incelemesine gönderin; avukat veya yönetici onayladıktan sonra kaynaklı asistan belgeyi kullanabilir. PDF metnini sayfa sayfa aktarın; bu sürüm PDF OCR işlemi yapmaz. Kaynak bulunmadığında asistan bunu açıkça bildirir.
- **Öğrenme planım**, tamamlanan resmi sınavların yanlış ve boş cevaplarından en fazla 100 tekrar sorusu oluşturur; kısa alıştırmalarda anında geri bildirim verir.
- Hekim kaydında Türkiye'nin 81 ili seçilebilir. Başlangıç için 26 şehir hastanesi eklenmiştir; şehir seçtikten sonra listede olmayan bir kurum yazılarak yeni kurum da kaydedilebilir.
- Şehir ve hastane başlangıç listeleri: [İçişleri Bakanlığı](https://www.icisleri.gov.tr/valilikler), [Sağlık Bakanlığı şehir hastaneleri listesi](https://camsakurasehir.saglik.gov.tr/TR-1203506/sehir-hastaneleri.html).

```
index.html                 Kullanıcı uygulaması
admin.html                 Yönetim paneli
config.js                  Supabase adresi ve anon anahtar (siz doldurursunuz)
assets/style.css           Ortak stiller
assets/shared.js           Giriş, Supabase istemcisi, yapay zekâ yardımcıları
assets/app.js              Kullanıcı uygulaması mantığı
assets/admin.js            Yönetim paneli mantığı
supabase/schema.sql        Veritabanı şeması ve güvenlik kuralları
supabase/upgrade_v2.sql    Roller, onay, hukuk incelemesi, duyurular, ekip raporu
supabase/functions/ai/     Claude API aracısı (Edge Function)
.nojekyll                  GitHub Pages'in dosyaları işlememesi için
```



## PJP bölge düelloları

Mevcut veritabanına supabase/duels_v4.sql dosyasını eatures_v3.sql sonrasında tek işlem içinde uygulayın. PJP kullanıcıları **Pratik → Bilgi yarışması** menüsünden Karadeniz, Akdeniz, Marmara, İç Anadolu veya Ege bölgelerini seçer.

- Aylık sezon; her düelloda rakip analizi, ürün bilgisi, ilaç bilgisi, hekim görüşmesi ve saha planlama kategorilerinden birer soru.
- Soru başına 30 saniye; doğru cevap 100 + kalan süreye göre en fazla 50 hız puanı. Yanlış/süre aşımı 0.
- İki taraf da tamamladığında en az 3 doğru yapan kazanana 100 bonus; beraberlikte en az 3 doğru yapanlara 50 bonus.
- Aynı PJP ile günde bir, kişi başına günde en fazla beş düello. Davet/oyun 24 saat veya sezon sonuna kadar açık.
- Puan, süre, cevap anahtarı ve ödül hesapları sunucudadır. Kabul anında soruların sürümü korunur.
- Bireysel sıralama puan, doğru sayısı ve süreye göre; bölge sıralaması katılan PJP başına ortalama puana göre hesaplanır.
- Başlangıçta 10 **taslak** soru bulunur. Yönetim panelindeki **Düello soruları** bölümünden güncel şirket materyallerine göre kontrol edip hukuk incelemesine gönderin. Avukat veya yönetici onayı gerekir. Beş kategorinin tamamında onaylı soru olmadan maç açılamaz. Bankayı ürünlere ve rakiplere özel sorularla genişletin.
- **Prim ve ödüller** bölümünde puan eşikleri, TL tutarı ve ödül tanımı belirlenir. Başlangıç eşikleri Bronz 1000, Gümüş 2500, Altın 5000 puandır; TL tutarları sıfırdır. Her eşik ayrı hak ediş oluşturur; yönetici onayı/teslim kaydı vardır, banka transferi yapılmaz.


## Sesli hekim simülasyonu (v5)

PJP menüsündeki **Hekim simülasyonu**: ürün ve hekim karakteri seçimi, Türkçe mikrofonla yazıya çevirme, düzeltilebilir metin, sesli hekim yanıtı, sesi kesme ve indirilebilir görüşme raporu. Tarayıcı ses tanımasını desteklemezse yazılı akış çalışır. Oturum sayfadan ayrılınca silinir; ham ses kaydedilmez. Tarayıcı sağlayıcısı ses tanımayı kendi hizmetinde işleyebilir.

Mevcut `ai` Edge Function kullanılır; yeni SQL kurulumu gerekmez. Etkin hesap, atanmış ürün ve çalışan AI servisi gerekir. Tıbbi iddialar `search_sources` üzerinden erişilebilir onaylı belgelerle incelenir. Kaynak yoksa doğruluk doğrulanmış sayılmaz. İletişim ve itiraz karşılama puanları metne dayalı eğitim geri bildirimidir. Ses tonu / akustik analiz ve gerçek zamanlı otomatik söz kesme bu sürümde yoktur; hekimin sesli yanıtı düğmeyle kesilebilir.

Kontrol: `node tests/roleplay.test.cjs`.

## Saha çalışma merkezi (v6)

Sekiz geliştirme aynı modülde birleşir: yazılı itiraz kartları ve isteğe bağlı kaynaklı AI geri bildirimi; seçimlere göre dallanan hekim görüşmeleri; hatalı sunum alıştırmaları; kaynaklı ürün karşılaştırmaları; uzmanlığa göre üç mesaj/üç soruluk ziyaret hazırlık kartları; kişisel gelişim rotası; belge değişikliği bildirimleri ve kontrol çalışmaları; ürün bazında ekip beceri haritası.

### Mevcut projeyi etkinleştirme

Supabase **SQL Editor** içinde `supabase/field_training_v6.sql` dosyasının tamamını çalıştırın. Önce `features_v3.sql` uygulanmış olmalıdır. Yeni dosya kendi işlemini açar ve başarıyla bitince tamamlar; tekrar uygulanabilir. Tarayıcı ekranlarının yayını tek başına veritabanı kurulumunu tamamlamaz. 8 Ekim 2026 tarihinde `field_training_v6` migration'ı canlı Medera Supabase projesine başarıyla uygulandı. Beş yeni tabloda RLS, özel cevap anahtarlarının erişim yasağı ve etkin yönetici bağlamında liste/geçmiş/beceri haritası/bildirim çağrıları doğrulandı. Mevcut kayıtlar korundu. Kurulum anında ürün ataması ve onaylı kaynak belgesi yoktu; içerikleri yayımlamak için aşağıdaki hazırlık adımları gerekir.

1. Ürün Müdürüne yönetici panelinden ürün atayın. Kaynak belgeleri bölümüne güncel ürün/rakip materyallerini sayfalarıyla ekleyip onaylatın.
2. Ürün Müdürü **İçerik atölyesi** bölümünde tür, ürün, uzmanlık, hedef beceri, içerik ve kaynak sayfalarını seçer. Alıştırma adımlarına seçenek, puan ve açıklama girer. Dallanan görüşmelerde sonraki adımı seçer; diğer türlerde adımlar sırayla tamamlanır.
3. Taslağı hukuk incelemesine gönderin. Avukat veya Yönetici içerik, kaynak ve cevap/puan anahtarını inceler; onaylar ya da gerekçeyle reddeder. Ürün Müdürü yönetici değilse kendi içeriğini onaylayamaz. Ayrı medikal onay rolü yoktur; kurumunuzun medikal kontrolünü ayrıca yürütün.
4. PJP yalnızca kendisine atanmış ürünlerdeki onaylı, güncel kaynaklı çalışmaları görür. Sonuçlar ve içerik sürümü sunucuda saklanır. Puan önceden onaylanan seçenek anahtarından hesaplanır; yazılı AI koçluğu puana dahil edilmez.
5. **Gelişim rotam**, son beş puanlı çalışmada 70 altındaki becerileri, sınav hatalarının tedavi alanlarını ve yeni içerik sürümlerini önceliklendirir. Okuma kartları beceri ortalamasına dahil edilmez.
6. Yeni belge onayları **Ürün değişiklikleri** ekranında eklenen/değişen/kaldırılan sayfaları gösterir. Yönetici ilgili **Ürün güncellemeleri** türünde kontrol soruları hazırlar. Bildirim ve “okudum” kayıtları modül etkinleştikten sonra oluşur.
7. **Beceri haritası** yöneticinin ürünlerindeki PJP/beceri sonuçlarını, deneme sayısını ve CSV çıktısını gösterir. Çalışma puanı satış sonucu veya çalışan performans değerlendirmesi değildir.

Kaynak sayfasının metni değişirse o sayfaya bağlı çalışmalar PJP ekranından kapanır; güncel kaynağı seçip yeniden onaylatın. İçerik düzenlenirse taslağa döner. Devam eden eski sürüm tamamlanamaz; tamamlanan eski sonuçlar korunur. Gerçek şirket tıbbi materyalleri olmadan örnek klinik iddia veya hazır onaylı içerik eklenmedi.

### Kontroller

`npm install` ve `npm run test:field`. Veritabanı testleri PGlite ile izole PostgreSQL üzerinde çalışır; canlı Supabase projesine bağlanmaz. Yetki izolasyonu, hukuk onayı, altı içerik türü, kaynak değişikliği, sunucuda puanlama, eski cevap anahtarlarının saklanması ve okundu kayıtları doğrulanır. Mevcut testler ayrıca `node tests/features.test.cjs` ve `node tests/roleplay.test.cjs` ile çalışır.

---

## Kullanıcı arayüzü

Uygulama dört sekmeden oluşur; telefonda alt menüde, bilgisayarda üstte görünür:

| Sekme | İçindekiler |
|---|---|
| **Bugün** | Sıradaki adım (en yakın tarihli sınav ya da bekleyen inceleme), bugün yapılacaklar, duyurular |
| **Öğren** | Eğitim, ürün, belge ve notlarda tek arama; yapay zekâ asistanı; müfredat, kütüphane ve kaynak belgeleri |
| **Pratik** | Sınavlar, hekim görüşmesi, bilgi yarışması (Düello), yanlışlarım, tekrar soruları, saha senaryoları |
| **Ben** | İlerleme, hekimlerim, rol görevleri (hukuk incelemesi, ekip raporu, içerik atölyesi), notlar ve favoriler, profil, tema, çıkış |

### Saha itirazları ve yan etki bildirimi

Mevcut veritabanına `supabase/field_signals_v7.sql` dosyasını SQL Editor'de bir kez çalıştırın (tekrar çalıştırılabilir).

- **İtiraz etiketleri:** Temsilci ziyaret kaydederken (Bugün → Ziyaret kaydet veya Hekimlerim) karşılaştığı itirazları tek dokunuşla etiketler: #YanEtki, #Fiyat, #Etkinlik, #RakipÜrün (rakip ürün adıyla), #Uygulama, #KanıtYetersiz, #Erişim. Bölge, hekimin şehrinden otomatik bulunur.
- **Isı haritası:** Ürün müdürleri (yalnızca kendi ürünleri) ve yöneticiler Ben → Saha itirazları sayfasında bölge × itiraz haritasını ve en çok anılan rakip ürünleri görür. Hekim adı gösterilmez; yalnızca sayılar döner.
- **İtiraz dalgası uyarısı:** Bir bölgede bir itiraz türü son 7 günde en az 5 kez kaydedildiyse ve önceki 4 haftanın haftalık ortalamasının en az 2 katıysa, ürün müdürünün ve yöneticinin Bugün listesinde uyarı çıkar. "Mikro eğitim hazırla" düğmesi İçerik atölyesinde hazır başlıklı bir itiraz kartı taslağı açar; taslak her zamanki gibi hukuk onayından geçer.
- **Yan etki bildir:** Üst çubuktaki düğme her sayfada görünür. Temsilci ne olduğunu, ilacı ve ciddiyeti girer; hasta için yalnızca yaş grubu ve cinsiyet istenir. Bildirim bir takip numarası alır, yalnızca bildiren kişi ve yöneticiler görebilir. Tıbbi birim yönetim panelindeki **Yan etki bildirimleri** sayfasından bildirimi incelemeye alır, not yazar ve kapatır; temsilci durumu Ben → Yan etki bildirimlerim bölümünde izler.
- **E-posta ile anında haber almak için (önerilir):** Supabase panelinde **Database → Webhooks** bölümünden `pv_reports` tablosundaki `INSERT` olayları için tıbbi birimin kullandığı e-posta veya bildirim servisine bir webhook tanımlayın. Uygulama bu ayar olmadan da çalışır; bildirimler yönetim panelinde bekler.

### Demo

`demo.html` giriş gerektirmeyen bir tanıtım sürümüdür: https://sfunder2.github.io/medera-akademi/demo.html
Kurgusal ürün, hekim, sınav ve eğitim verileriyle tarayıcıda çalışır; veritabanına bağlanmaz ve hiçbir şey kaydetmez. Yapay zekâ yanıtları hazır örnek metinlerdir. Üstteki şeritten PJP, ürün müdürü ve avukat rolleri arasında geçilebilir; doğrudan bir role bağlantı vermek için `demo.html?rol=urun_muduru` veya `demo.html?rol=avukat` kullanın.

---

## Mobil uygulama

- **Telefona yükleme (en kolay):** Site bir PWA'dır. Android'de Chrome ile açıp menüden **Uygulamayı yükle**, iPhone'da Safari'de **Paylaş → Ana Ekrana Ekle** seçin.
- **Android APK:** `android/` klasöründe siteyi tam ekran açan bir Android uygulaması vardır. Yükleme, adres çubuğunu gizleme ve yeniden derleme adımları `android/README.md` içindedir.
