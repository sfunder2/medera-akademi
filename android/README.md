# Medera Akademi — Android uygulaması

Bu klasör, siteyi (https://sfunder2.github.io/medera-akademi/) Android'de tam ekran açan küçük bir uygulamadır. Uygulama bir **Trusted Web Activity**'dir: içeriği telefondaki Chrome gösterir. Bu sayede sesli hekim simülasyonu, dosya indirme ve giriş gibi tüm özellikler sitedekiyle aynı çalışır. Siteye yapılan her güncelleme uygulamaya da kendiliğinden gelir; yeni APK gerekmez.

## Yükleme (Play Store olmadan)
1. `app-release.apk` dosyasını telefona gönderin (e-posta, Drive vb.).
2. Dosyayı açın. Telefon "bilinmeyen kaynaklardan yükleme" izni isterse bu dosya için izin verin.
3. "Medera Akademi" simgesiyle açın.

Daha basit bir yol: Telefonda Chrome ile siteyi açın, menüden **Uygulamayı yükle** (veya **Ana ekrana ekle**) seçin. Bu, APK olmadan aynı deneyimi verir.

## Adres çubuğunu gizlemek (önerilir)
Android, uygulamanın siteye ait olduğunu doğrulayana kadar üstte ince bir adres çubuğu gösterir. Doğrulama için `assetlinks.json` dosyası **alan adının kökünde** durmalıdır:

`https://sfunder2.github.io/.well-known/assetlinks.json`

Bu adres `medera-akademi` deposundan yayınlanamaz; ayrı bir depo gerekir:
1. GitHub'da `sfunder2.github.io` adında herkese açık bir depo oluşturun.
2. Bu klasördeki `assetlinks.json` dosyasını o depoda `.well-known/assetlinks.json` yoluna yükleyin.
3. Depoya boş bir `.nojekyll` dosyası ekleyin (yoksa GitHub Pages `.well-known` klasörünü yayınlamaz).
4. Birkaç dakika sonra uygulamayı kapatıp açın; adres çubuğu kaybolur.

## Yeniden derleme
Gerekenler: JDK 17+, Android SDK (platform 35, build-tools 35).

```bash
cd android
export ANDROID_HOME=/android/sdk/yolu
export MEDERA_KEYSTORE=/guvenli/yer/medera-release.jks
export MEDERA_KEYSTORE_PASSWORD='...'
./gradlew assembleRelease
# çıktı: app/build/outputs/apk/release/app-release.apk
```

Her yeni sürümde `app/build.gradle` içindeki `versionCode` değerini bir artırın.

**İmza anahtarı (`medera-release.jks`) depoda tutulmaz.** Güvenli bir yerde saklayın. Anahtar kaybolursa telefonlara yüklü uygulama güncellenemez ve `assetlinks.json` içindeki parmak izi geçersiz olur. Play Store'a yüklemek için de aynı anahtar kullanılır (`./gradlew bundleRelease` ile `.aab` üretilir).
