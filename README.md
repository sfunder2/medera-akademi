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
| **PJP** | Sınavlar, kütüphane ve yapay zekâ asistanı, müfredat, hekim ve etkileşim kaydı (Paydaşlar) |
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
- **Paydaşlar:** Hekim kaydı, arama ve filtreler, etkileşim geçmişi, ürün bazında dağılım.

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


