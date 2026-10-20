# Puantaj Merkezi — Kurulum

Uygulama, Firebase'de (giriş + veritabanı) çalışan bir web uygulamasıdır. Kimin neyi göreceğini `firestore.rules` dosyasındaki kurallar **sunucuda** kontrol eder.

| Rol | Görebildiği |
|---|---|
| Şube müdürü | Sadece kendi şubesinin çizelgesi, personeli ve "Ay sonu" ekranı. Puantaja ve maaşlara hiç erişemez. |
| Bölge müdürü | Sorumlu olduğu şubelerin çizelgesi, personeli ve puantajı (muhasebe + ödemeler). Onay verir ya da geri gönderir. |
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

## Ay sonu akışı
1. **Şube müdürü** → Ay sonu → *Ayı kapat → bölge müdürüne gönder*. O ayın çizelgesi kilitlenir.
2. **Bölge müdürü** → Puantaj → şube → *Muhasebe* (rapor, ücretsiz izin, yıllık izin, part gün, bayram, giriş/çıkış) ve *Ödemeler*.
   *Onayla ve kilitle* → muhasebe tarafı dondurulur, işverene hazır olur. *Şubeye geri gönder* → not ile iade.
3. Muhasebe çıktısı: *Muhasebe çıktısı (PDF)* → *Yazdır / PDF olarak kaydet*.
4. Bordro gelince: Ödemeler → *Bordro PDF yükle* → net ödenen tutarlar "bankaya yatan" olarak işlenir.
   Eşleşme önce isimle (Türkçe karakter farkı yok sayılır), tutmazsa kayıtlı TC ile yapılır ve uyarı gösterilir.

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
