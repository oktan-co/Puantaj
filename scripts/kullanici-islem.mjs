// İşverenin uygulamadan verdiği yeni şifreleri uygular (sifreIstek/{uid} → Firebase giriş hesabı + sifreler/{uid}).
// İstek sadece aktif bir işveren hesabından geldiyse uygulanır; başarılı istek silinir, hatalıysa nedeni yazılır.
import admin from 'firebase-admin';

const anahtar = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!anahtar) { console.log('FIREBASE_SERVICE_ACCOUNT tanımlı değil; yapılacak iş yok.'); process.exit(0); }
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(anahtar)) });
const db = admin.firestore();
const auth = admin.auth();

const q = await db.collection('sifreIstek').get();
if (q.empty) { console.log('Bekleyen istek yok.'); process.exit(0); }
let tamam = 0, hata = 0;
for (const d of q.docs) {
  const uid = d.id; const x = d.data() || {};
  const yaz = async m => { hata++; console.log(uid, 'HATA:', m); await d.ref.set({ hata: m, hataZaman: new Date().toISOString() }, { merge: true }); };
  try {
    const ist = x.isteyen ? await db.doc(`kullanicilar/${x.isteyen}`).get() : null;
    if (!ist || !ist.exists || ist.data().aktif !== true || !['isveren', 'bolge'].includes(ist.data().rol)) { await yaz('İstek bir işveren ya da bölge müdürü hesabından gelmedi.'); continue; }
    if (typeof x.sifre !== 'string' || x.sifre.length < 6) { await yaz('Şifre en az 6 karakter olmalı.'); continue; }
    const k = await db.doc(`kullanicilar/${uid}`).get();
    if (!k.exists) { await yaz('Kullanıcı bulunamadı.'); continue; }
    // Bölge müdürü sadece kendi yönettiği şube müdürlerinin şifresini değiştirebilir.
    if (ist.data().rol === 'bolge' && !(k.data().rol === 'sube' && (k.data().bolgeler || []).includes(x.isteyen))) { await yaz('Bölge müdürü bu kullanıcının şifresini değiştiremez.'); continue; }
    await auth.updateUser(uid, { password: x.sifre });
    await auth.revokeRefreshTokens(uid); // açık oturumlar kapanır, kullanıcı yeni şifreyle girer
    await db.doc(`sifreler/${uid}`).set({ kullaniciAdi: k.data().kullaniciAdi || '', sifre: x.sifre, guncellendi: new Date().toISOString(), guncelleyen: x.isteyenAd || '' });
    await d.ref.delete();
    tamam++; console.log(uid, 'şifre güncellendi');
  } catch (e) { await yaz(String((e && (e.message || e.code)) || e)); }
}
console.log(`Bitti: ${tamam} uygulandı, ${hata} hatalı.`);
