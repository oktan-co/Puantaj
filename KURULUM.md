# Puantaj Merkezi — Kurulum

Uygulama, Firebase'de (giriş + veritabanı) çalışan bir web uygulamasıdır. Kimin neyi göreceğini `firestore.rules` dosyasındaki kurallar **sunucuda** kontrol eder.

| Rol | Görebildiği |
|---|---|
| Şube müdürü | Sadece kendi şubesinin **açık** haftaları ve personeli. Biten haftayı kapatır; kapattığı haftayı bir daha göremez. Puantaja ve maaşlara hiç erişemez. |
| Bölge müdürü | Sorumlu olduğu şubelerin bütün haftaları, personeli ve puantajı (muhasebe + ödemeler). Haftaları onaylar, geri gönderir, kilidini açar, şube adına kapatır. Kişiye kendi şubelerinden "diğer çalıştığı şube" ekler/çıkarır. |
| İşveren | Her şey. Şube ve kullanıcı yönetimi, kilit açma. |

## 1. Firebase projesi
1. console.firebase.google.com → **Proje oluştur** → ad: `puantaj-merkezi` → Google Analytics kapalı. Plan: **Spark (ücretsiz)**.
2. **Authentication → Başlayın → Sign-in method → E-posta/Şifre → Etkinleştir.**
3. **Firestore Database → Veritabanı oluştur** → konum: `eur3 (Europe)` → **Üretim modunda başlat**.
4. **Firestore Database → Kurallar** sekmesi: içindekileri silin, `firestore.rules` dosyasının tamamını yapıştırın → **Yayınla**.
5. Dişli → **Proje ayarları → Uygulamalarınız → Web (</>)** → takma ad `puantaj` → kaydedin. Çıkan `firebaseConfig` değerlerini `config.js` dosyasına yapıştırın.

## 2. Siteyi yayınlama (GitHub Pages, ücretsiz)
1. github.com'da hesap açın → **New repository** → ad: `puantaj` → Public → Create.
2. **Add file → Upload files** → şu dosyaları sürükleyin: `index.html, app.js, config.js, style.css, manifest.json, icon-192.png, icon-512.png` → **Commit**.
3. Depoda **Settings → Pages → Branch: main / (root) → Save**. Birkaç dakika sonra adres çıkar: `https://KULLANICIADINIZ.github.io/puantaj/`
4. Firebase'de **Authentication → Settings → Authorized domains → Add domain** → `KULLANICIADINIZ.github.io` ekleyin.

Telefonda adresi açın → tarayıcı menüsü → **Ana ekrana ekle**.

## 3. İlk işveren hesabı
1. Firebase → **Authentication → Users → Kullanıcı ekle**
   - E-posta: `admin@puantaj-merkezi.app` (kullanıcı adınız `admin` olur)
   - Şifre: güçlü bir şifre (işveren tüm maaşları görür)
2. Uygulamayı açın, `admin` ve şifrenizle girin. **İlk kurulum** ekranı çıkar → adınızı yazıp **İşveren olarak kur**.
   Bu ekran yalnızca bir kez çalışır; kurulum yapıldıktan sonra kimse kendini işveren yapamaz.
3. **Yönetim → Şubeler** ile şubeleri, **Yönetim → Kullanıcılar** ile şube ve bölge müdürlerini ekleyin.
   Kullanıcılar kullanıcı adı + şifreyle girer; e-posta görmezler. Şifresini unutan kullanıcının hesabını kapatıp yeni kullanıcı adıyla açın.

## Hafta ve ay sonu akışı
1. **Şube müdürü** → hafta bitince (pazartesiden itibaren) 2 gün içinde Çizelge → *Haftayı kapat → bölge müdürüne gönder*. Boş gün varsa ya da izin günü kullanmadan 7 gün çalışan teyit edilmediyse kapatılamaz. Kapatılan hafta şube müdürüne görünmez.
2. **Bölge müdürü / işveren** → Puantaj → *Haftalar*: şubelerin son 4 haftası (Açık, Gecikti, Onay bekliyor, Onaylı). Hücreye dokunup çizelgeyi açar, *Onayla*, *Geri gönder* (notla, hafta şubeye yeniden açılır), *Kilidi aç* ya da şube adına *Kapat / Kapat ve onayla*. Her işlem haftanın kaydına yazılır.
3. Bir ayın bütün haftaları onaylanınca Puantaj → *Aylık puantaj* → şube → *Muhasebe* (rapor, ücretsiz izin, yıllık izin, part gün, bayram, giriş/çıkış) ve *Ödemeler* → *Onayla ve kilitle* → muhasebe tarafı dondurulur, işverene hazır olur.
3. Muhasebe çıktısı: *Muhasebe çıktısı (PDF)* → *Yazdır / PDF olarak kaydet*.
4. Bordro gelince: Ödemeler → *Bordro PDF yükle* → net ödenen tutarlar "bankaya yatan" olarak işlenir.
   Eşleşme önce isimle (Türkçe karakter farkı yok sayılır), tutmazsa kayıtlı TC ile yapılır ve uyarı gösterilir.

## Çok şubeli çalışma
- Kişinin kartında: SGK şubesi, çalıştığı şube, **diğer çalıştığı şubeler** (sadece işveren / bölge müdürü değiştirir) ve aya göre maaş şubesi.
- Kişi bütün bu şubelerin çizelgesinde görünür. **Aynı gün tek şube:** bir şubede vardiya yazılı günde başka şubeye vardiya (ya da rapor/izin) yazılamaz; o gün diğer şubede "LEGENDS 11:00–19:30" gibi gri görünür.
- Fazla mesai günü kimde çalışıldıysa o şubede: günün normal saati (8,5) çalışılan şubede beklenir. Boş gün (eksi mesai) sadece maaş şubesinde sayılır.
- İzin günü kullanmadan 7 gün çalışılan haftanın fazlası (7 × 8,5 − 51 = 8,5 sa): maaş şubesi dışında çalışılan son günün şubesine, yoksa maaş şubesine.
- Şubeden çıkarmak geçmiş haftaları silmez; kişi sadece yeni haftalara önerilmez.

## Saat seçimi
- Saatler yarım saatlik listeden seçilir. İleri tarihli günlerde açılış – kapanış + 30 dk (örn. 11:00 – 02:30); bugün ve geçmiş günlerde iki uçta birer saat pay (10:00 – 03:30), bunlar turuncu çerçeveyle işaretlenir. Listeye uymayan eski kayıtlar kırmızı çerçeveyle görünür.

Hesaplar:
- Maaş farkı = anlaşılan net × bordro günü / 30 − bankaya yatan
- Bordro günü = 30 − rapor − ücretsiz izin (ay içinde giriş/çıkış varsa çalışılan takvim günü)
- Kalan ödeme = maaş farkı + fazla mesai ₺ + paket primi + ciro primi + geçen aydan eksi devir − avans
- Esnaf kurye: paket sayısı × paket başı ücret

## Kuralları elle doğrulama (Firestore → Kurallar → Kurallar Oyun Alanı)
Önce Firestore'da örnek belgeler oluşturun: `kullanicilar/SUBE_UID {rol:"sube", subeler:["altinkale"], aktif:true}`, `kullanicilar/BOLGE_UID {rol:"bolge", subeler:["altinkale"], aktif:true}`.
Oyun alanında "Kimliği doğrulanmış" seçip UID girerek şunları deneyin:

| Kimlik | İşlem | Yol | Beklenen |
|---|---|---|---|
| SUBE_UID | get | `subeler/altinkale/haftalar/2026-10-19` | İzin verildi |
| SUBE_UID | get | `puantaj/altinkale/aylar/2026-10` | **Reddedildi** |
| SUBE_UID | get | `maaslar/altinkale` | **Reddedildi** |
| SUBE_UID | get | `subeler/baska-sube` | **Reddedildi** |
| BOLGE_UID | get | `puantaj/altinkale/aylar/2026-10` | İzin verildi |
| BOLGE_UID | get | `puantaj/baska-sube/aylar/2026-10` | **Reddedildi** |
| SUBE_UID | update | `kullanicilar/SUBE_UID` `{rol:"isveren"}` | **Reddedildi** |
| Kimliksiz | get | `subeler/altinkale` | **Reddedildi** |

### Haftalık kapatma ve çok şubeli çalışma kuralları
Örnek belgeler: `subeler/altinkale/haftalar/2026-10-12 {hd:"kapali"}`, `subeler/altinkale/haftalar/2026-10-19 {hd:"acik"}`, `personel/P1 {anaSube:"legends", sgkSube:"kumkoy", ekSubeler:["altinkale"], gorunurSubeler:["legends","kumkoy","altinkale"]}`.

| Kimlik | İşlem | Yol | Beklenen |
|---|---|---|---|
| SUBE_UID | get | `subeler/altinkale/haftalar/2026-10-19` | İzin verildi |
| SUBE_UID | get | `subeler/altinkale/haftalar/2026-10-12` | **Reddedildi** (kapalı hafta) |
| SUBE_UID | update | `subeler/altinkale/haftalar/2026-10-12` | **Reddedildi** |
| SUBE_UID | update | `subeler/altinkale/haftalar/2026-10-19` `{hd:"onay"}` | **Reddedildi** (şube onaylayamaz) |
| SUBE_UID | update | `subeler/altinkale/haftalar/2026-10-19` `{hd:"kapali"}` | İzin verildi |
| BOLGE_UID | get / update | `subeler/altinkale/haftalar/2026-10-12` | İzin verildi |
| SUBE_UID | get | `personel/P1` | İzin verildi (diğer çalıştığı şube) |
| SUBE_UID | update | `personel/P1` `{ekSubeler:[]}` | **Reddedildi** |
| BOLGE_UID | update | `personel/P1` `{ekSubeler:[], gorunurSubeler:[aynı]}` | İzin verildi |

## Yedek ve veri kontrolü (işveren)
- **Yönetim → Yedek → Yedek indir**: bütün veritabanı tek dosya (JSON) olarak iner. Ücretsiz Firebase planında otomatik yedek yoktur; **haftada en az bir** ve her ay sonu onayından sonra alın. Dosyada maaş, TC ve IBAN var; güvenli yerde saklayın.
- **Veri kontrolü**: bütün şubelerin haftalarını tarar; şubeyle bağı olmayan ya da silinmiş kişilere ait hücreleri listeler. Hiçbir şeyi değiştirmez.

## Kayıt güvenliği
- Kayıtlar cihazda da saklanır: internet yokken girilenler uygulama kapanıp açılsa da internet gelince gönderilir. Altta "İnternet yok · N değişiklik bekliyor" yazarken uygulamayı silmeyin / tarayıcı verisini temizlemeyin.
- Veri girişi satır satır kaydedilir (veriM / veriSil). Eski "veri" listesi okunurken birleştirilir.
- Personeli sadece işveren silebilir; çizelge kaydı olan kişi silinmez, çıkış tarihi girilir.
- Şube ayarlarındaki mesai / ücret değişikliği o aydan itibaren geçerlidir; önceki aylar eski ayarla hesaplanır.

## Güncelleme yayınlarken
- `app.js` içindeki `APP_SURUM` sayısını ve `index.html` içindeki `app.js?v=` sayısını bir artırın.
- İşveren yeni sürümü açınca `sistem/surum` yükselir; eski sürümle açık kalan cihazlar kayıt yapamaz, "Uygulama güncellendi" ekranında Yenile'ye basar.
- `firestore.rules` değiştiyse Firebase → Firestore → Kurallar'a yapıştırıp **Yayınla**.
- Eski bir sürüme geri dönülürse önce Firestore'da `sistem/surum.min` değerini o sürümün `APP_SURUM` sayısına indirin; yoksa herkes "güncellendi" ekranında kalır.
