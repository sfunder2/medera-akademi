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
2. Sol menüden **SQL Editor → New query** açın, `supabase/schema.sql` dosyasının tamamını yapıştırıp **Run**'a basın. (Bu dosyayı yalnızca bir kez çalıştırın.)

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

Varsayılan model `claude-sonnet-5-5`. Değiştirmek için `ANTHROPIC_MODEL` gizli değişkenini tanımlayın.

### 4. config.js
Supabase panelinde **Project Settings → API** bölümünden Project URL ve anon (public/publishable) anahtarı kopyalayıp `config.js` dosyasına yazın, sonra GitHub'a yeniden yükleyin. Bu anahtarın herkese açık olması güvenlidir. Anthropic anahtarını **asla** buraya yazmayın.

### 5. Giriş ayarları
Supabase panelinde **Authentication → URL Configuration**:
- **Site URL:** `https://KULLANICI.github.io/medera-akademi/`
- **Redirect URLs:** aynı adresi ve `https://KULLANICI.github.io/medera-akademi/admin.html` adresini ekleyin.

Supabase'in yerleşik e-posta servisi saatte birkaç e-postayla sınırlıdır. Ekip kullanımı için **Authentication → Emails → SMTP Settings** bölümünden kendi SMTP sunucunuzu tanımlayın.

Yalnızca şirket e-postalarına izin vermek için `schema.sql` içindeki `handle_new_user` fonksiyonundaki yorum satırlarını açıp alan adınızı yazın ve fonksiyonu SQL Editor'de yeniden çalıştırın.

### 6. İlk yönetici
Siteye kendi e-postanızla bir kez giriş yapın. Ardından SQL Editor'de şunu çalıştırın:
```sql
update public.profiles set role = 'admin' where email = 'sizin@epostaniz.com';
```
Sayfayı yenilediğinizde üst menüde **Yönetim paneli** bağlantısı görünür. Diğer yöneticileri panelden atayabilirsiniz.

---

## Yönetim paneli

- **Genel bakış:** Kullanıcı ve sınav sayıları, tamamlama ve başarı oranları, son tamamlananlar, geciken atamalar.
- **Kullanıcılar:** Arama, kullanıcı başına sınav ve puan özeti, ürün atama, yönetici yetkisi verme ya da kaldırma.
- **Ürünler:** Ürün ekleme, düzenleme, silme. Ürün notları yapay zekâ asistanına bağlam olarak gider.
- **Sınavlar:** Yapay zekâyla taslak üretme ya da boş başlama, soru düzenleyici (sıralama, doğru şık, açıklama), son tarihli toplu atama, sonuçlar, sıfırlama ve CSV dışa aktarma.
- **Müfredat:** Yapay zekâyla taslak üretme, modülleri düzenleme, yayımlama ya da yayından kaldırma.
- **Saha aktivitesi:** Tüm temsilcilerin hekim etkileşimleri, temsilci filtresi, CSV dışa aktarma.

## Kullanıcı uygulaması

- **Sınavlarım:** Kişisel ve ekip istatistikleri, atanan sınavlar, yapay zekâyla pratik sınavı oluşturma, sonuç inceleme.
- **Kütüphane:** Atanan ürünler ve konu bağlamı seçilebilen, akışlı yanıt veren yapay zekâ asistanı.
- **Müfredat:** Yayımlanmış eğitim planları.
- **Paydaşlar:** Hekim kaydı, arama ve filtreler, etkileşim geçmişi, ürün bazında dağılım.

## Uyumluluk

Hekim adları ve etkileşim notları kişisel veridir (KVKK). Gerçek verilerle kullanmadan önce şirketinizin bilgi güvenliği ve uyum ekibinden onay alın. Supabase projenizin bölgesini (ör. AB) buna göre seçin. Etkileşim notlarına hasta bilgisi yazılmamalıdır.

## Dosya yapısı
```
index.html                 Kullanıcı uygulaması
admin.html                 Yönetim paneli
config.js                  Supabase adresi ve anon anahtar (siz doldurursunuz)
assets/style.css           Ortak stiller
assets/shared.js           Giriş, Supabase istemcisi, yapay zekâ yardımcıları
assets/app.js              Kullanıcı uygulaması mantığı
assets/admin.js            Yönetim paneli mantığı
supabase/schema.sql        Veritabanı şeması ve güvenlik kuralları
supabase/functions/ai/     Claude API aracısı (Edge Function)
.nojekyll                  GitHub Pages'in dosyaları işlememesi için
```
