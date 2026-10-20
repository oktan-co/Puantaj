import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, createUserWithEmailAndPassword,
  updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, collection, writeBatch, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, GIRIS_ALANI } from "./config.js?v=6";

/* ================= Sabitler ================= */
const AY=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const AYK=['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
const GUN=['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'];
const GUNU=['Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi','Pazar'];
const GRUP={M:'Müdür',K:'Mutfak',S:'Motorcu'}; const GRUP_SIRA=['M','K','S'];
const KOD={HT:{ad:'Haftalık izin',kisa:'İZİN'},R:{ad:'Rapor',kisa:'RAPOR'},UI:{ad:'Ücretsiz izin',kisa:'ÜCR.<br>İZİN'},YI:{ad:'Yıllık izin',kisa:'YILLIK'},B:{ad:'Bayram',kisa:'BAYR.'},D:{ad:'Diğer',kisa:'DİĞER'}};
const KOD_SIRA=['HT','R','UI','YI','B','D'];
const SEKILLER=['Tam','Part','Esnaf kurye','Yarı esnaf'];
// Görev listesi: seçmeli, elle yazılmaz. Görev çizelgedeki bölümü ve esnaf durumunu belirler.
const GOREVLER=[{ad:'R. Müdür',grup:'M'},{ad:'V. Müdür',grup:'M'},{ad:'Mutfak',grup:'K'},{ad:'Kurye',grup:'S'},{ad:'Esnaf Kurye',grup:'S',sekil:'Esnaf kurye'},{ad:'Yarı Esnaf Kurye',grup:'S',sekil:'Yarı esnaf'}];
const SGK_YOK='-';
function gorevBul(ad){return GOREVLER.find(g=>g.ad===ad)||null;}
function gorevTahmin(p){const g=String(p.gorev||'').toLocaleUpperCase('tr-TR');if(gorevBul(p.gorev))return p.gorev;
  if(p.sekil==='Esnaf kurye')return'Esnaf Kurye';if(p.sekil==='Yarı esnaf')return'Yarı Esnaf Kurye';
  if(g.startsWith('R.')||g.includes('RESTORAN'))return'R. Müdür';if(g.startsWith('V.')||g.includes('VARD')||g.includes('MÜDÜR'))return'V. Müdür';
  if(g.includes('SÜRÜCÜ')||g.includes('KURYE')||g.includes('MOTOR')||p.grup==='S')return'Kurye';if(g.includes('MUTFAK')||p.grup==='K')return'Mutfak';return'';}
function subeAdi(id){if(id===SGK_YOK)return'';return(S.subeler[id]&&S.subeler[id].ad)||(S.subeAdlari[id])||id||'';}
const ROL={sube:'Şube müdürü',bolge:'Bölge müdürü',isveren:'İşveren'};
const DURUM={taslak:{ad:'Taslak',c:'mut'},sube_onay:{ad:'Şube onayladı',c:'warn'},geri:{ad:'Geri gönderildi',c:'bad'},bolge_onay:{ad:'Bölge onayladı',c:'ok'}};
const VARSAYILAN={ad:'Şube',acilis:'11:00',kapanis:'00:30',gunluk:8.5,haftalik:51,partSaat:8,fmYontem:'sabit',fmUcret:165,paketUcret:0};

/* ================= Firebase ================= */
const ayarliMi=!String(firebaseConfig.apiKey||'').startsWith('BURAYA');
let app,auth,db;
if(ayarliMi){app=initializeApp(firebaseConfig);auth=getAuth(app);db=getFirestore(app);}

/* ================= Durum ================= */
const S={subeAdlari:{},user:null,me:null,meYuklendi:false,kurulumVar:null,subeler:{},subeIds:[],subeId:null,personel:[],haftalar:{},aylar:{},
  loaded:{personel:false,haftalar:false},tab:'cizelge',hafta:null,ay:null,
  pt:{sube:null,gorunum:'sol',doc:null,maas:null,prev:null,listeAylar:{}},users:[]};
const subs={sube:[],detay:[],liste:[],me:null,users:null,subeDocs:[]};
const undo=[];
const tryLS=(k,v)=>{try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v);}catch(e){return null;}};

/* ================= Yardımcılar ================= */
function today(){const d=new Date();return new Date(d.getFullYear(),d.getMonth(),d.getDate());}
function ymd(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function parse(s){const[y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d);}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x;}
function mondayOf(d){const x=new Date(d);x.setDate(x.getDate()-((x.getDay()+6)%7));return ymd(x);}
function weekDays(wid){const m=parse(wid);return [0,1,2,3,4,5,6].map(i=>addDays(m,i));}
function ayKey(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');}
function ayAdi(k){const[y,m]=k.split('-').map(Number);return AY[m-1]+' '+y;}
function ayKaydir(k,n){const[y,m]=k.split('-').map(Number);return ayKey(new Date(y,m-1+n,1));}
function rangeLabel(wid){const ds=weekDays(wid);const a=ds[0],b=ds[6];
  return a.getMonth()===b.getMonth()?`${a.getDate()} – ${b.getDate()} ${AY[b.getMonth()]} ${b.getFullYear()}`:`${a.getDate()} ${AYK[a.getMonth()]} – ${b.getDate()} ${AYK[b.getMonth()]} ${b.getFullYear()}`;}
function gosterAy(wid){return ayKey(addDays(parse(wid),3));}
const tnum=s=>{const[h,m]=s.split(':').map(Number);return h+m/60;};
const isShift=v=>typeof v==='string'&&/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(v);
function shiftHours(v){const[a,b]=v.split('-');let s=tnum(a),e=tnum(b);if(e<=s)e+=24;return e-s;}
function shiftKind(v,sb){const[a,b]=v.split('-');let s=tnum(a),e=tnum(b);if(e<=s)e+=24;const op=tnum(sb.acilis||'11:00');let cl=tnum(sb.kapanis||'00:30');if(cl<=op)cl+=24;return{o:s<=op+1e-6,k:e>=cl-1e-6};}
function normTime(raw){let s=String(raw||'').trim().replace(/[.,\s]/g,':');if(!s)return null;let h,m;
  if(s.includes(':')){const p=s.split(':');h=+p[0];m=+(p[1]||0);if(p[1]&&p[1].length===1)m*=10;}
  else{const d=s.replace(/\D/g,'');if(!d)return null;if(d.length<=2){h=+d;m=0;}else if(d.length<=4){h=+d.slice(0,-2);m=+d.slice(-2);}else return null;}
  if(!(h>=0&&h<=24&&m>=0&&m<=59))return null;if(h===24)h=0;return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');}
const fmt=x=>(Math.round((x||0)*100)/100).toLocaleString('tr-TR',{maximumFractionDigits:2});
const sg=x=>{const r=Math.round((x||0)*100)/100;return (r>0?'+':r<0?'−':'')+Math.abs(r).toLocaleString('tr-TR',{maximumFractionDigits:2});};
const tl=x=>(Math.round((x||0)*100)/100).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2});
const tl0=x=>Math.round(x||0).toLocaleString('tr-TR')+' ₺';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function kisaAd(ad){const p=String(ad||'').trim().split(/\s+/);return p.length>1?p[0]+' '+p[p.length-1][0]+'.':p[0]||'';}
function bas(ad){const p=String(ad||'').trim().split(/\s+/);return((p[0]||'')[0]||'')+((p.length>1?p[p.length-1][0]:'')||'');}
function ascii(s){return String(s||'').toLocaleLowerCase('tr-TR').replace(/ı/g,'i').replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s').replace(/ö/g,'o').replace(/ç/g,'c').replace(/i̇/g,'i');}
function slug(s){return ascii(s).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40)||'x';}
function isimAnahtar(s){return ascii(s).replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();}
function kadiNorm(s){return ascii(s).replace(/[^a-z0-9._-]/g,'');}
const eposta=k=>`${kadiNorm(k)}@${GIRIS_ALANI}`;
const trTarih=s=>{if(!s)return'';const[y,m,d]=s.split('-');return `${+d}.${m}.${y}`;};
// "8,5", "8.5", "28.075,50", "50.000" hepsini doğru okur: virgül varsa ondalık virgüldür; sadece nokta varsa ve 3'lü gruplarsa binlik ayırıcıdır.
const sayi=v=>{if(v===''||v==null)return 0;if(typeof v==='number')return v;let t=String(v).trim().replace(/[\s₺]/g,'');
  if(t.includes(','))t=t.replace(/\./g,'').replace(',','.');else if(/^-?\d{1,3}(\.\d{3})+$/.test(t))t=t.replace(/\./g,'');const n=+t;return isFinite(n)?n:0;};

/* ================= Rol ================= */
const rol=()=>S.me&&S.me.rol;
const isIsveren=()=>rol()==='isveren', isBolge=()=>rol()==='bolge', isSube=()=>rol()==='sube';
const puantajYetki=()=>isIsveren()||isBolge();

/* ================= Hesaplar ================= */
function sube(id){return Object.assign({},VARSAYILAN,S.subeler[id||S.subeId]||{});}
function cellOf(pid,wid,i,H=S.haftalar){const w=H[wid];const c=w&&w.cells&&w.cells[pid];const v=c?c[String(i)]:null;return v==null?null:v;}
function employed(p,d){const s=ymd(d);if(p.giris&&s<p.giris)return false;if(p.cikis&&s>p.cikis)return false;return true;}
function weekHasEntry(pid,wid,H=S.haftalar){const w=H[wid];const c=w&&w.cells&&w.cells[pid];return !!c&&Object.values(c).some(v=>v!=null&&v!=='');}
function isEsnaf(p){return p.sekil==='Esnaf kurye'||p.sekil==='Yarı esnaf';}
function locked(d){const a=S.aylar[ayKey(d)];return !!a&&(a.durum==='sube_onay'||a.durum==='bolge_onay');}
function aktifHaftada(p,wid){return weekDays(wid).some(d=>employed(p,d));}
function aktifAyda(p,ak){const[y,m]=ak.split('-').map(Number);for(let d=new Date(y,m-1,1);d.getMonth()===m-1;d=addDays(d,1))if(employed(p,d))return true;return false;}
function sirala(list){return list.slice().sort((a,b)=>GRUP_SIRA.indexOf(a.grup||'K')-GRUP_SIRA.indexOf(b.grup||'K')||(a.sira??999)-(b.sira??999)||String(a.ad).localeCompare(String(b.ad),'tr'));}
// Excel kuralı: hafta FM = çalışılan − (gün × günlük); 7 gün çalışılmışsa çalışılan − haftalık. Kaydı olmayan hafta sayılmaz; boş gün beklenen gündür.
function haftaHesap(p,wid,sb=sube(),H=S.haftalar){let h=0,wd=0,bos=0;const kayit=weekHasEntry(p.id,wid,H);
  weekDays(wid).forEach((d,i)=>{if(!employed(p,d))return;const v=cellOf(p.id,wid,i,H);if(isShift(v)){h+=shiftHours(v);wd++;}else if((v==null||v==='')&&kayit)bos++;});
  return{h,wd,bos,fm:!kayit?0:(wd===7?h-sb.haftalik:h-(wd+bos)*sb.gunluk),kayit};}
function ayHesap(p,ak,sb=sube(),H=S.haftalar){const[y,m]=ak.split('-').map(Number);const last=new Date(y,m,0);
  let h=0,fm=0,bos=0,gun=0,istihdam=0;const kod={};
  for(let d=new Date(y,m-1,1);d<=last;d=addDays(d,1)){if(!employed(p,d))continue;istihdam++;const wid=mondayOf(d);const i=(d.getDay()+6)%7;
    const v=cellOf(p.id,wid,i,H);const kayit=weekHasEntry(p.id,wid,H);
    if(isShift(v)){const x=shiftHours(v);h+=x;fm+=x-sb.gunluk;gun++;}else if(v&&KOD[v])kod[v]=(kod[v]||0)+1;else if(kayit){fm-=sb.gunluk;bos++;}
    if(i===6&&kayit&&weekDays(wid).every((dd,j)=>isShift(cellOf(p.id,wid,j,H))))fm+=7*sb.gunluk-sb.haftalik;}
  const part=p.sekil==='Part',esnaf=isEsnaf(p),fmYok=part||esnaf;
  const tamAy=istihdam===last.getDate();
  const bordroGun=Math.max(0,(tamAy?30:Math.min(30,istihdam))-(kod.R||0)-(kod.UI||0));
  return{h,fm:fmYok?0:fm,bos:esnaf?0:bos,gun,kod,part,esnaf,partGun:part?Math.round(h/(sb.partSaat||8)*100)/100:0,bordroGun,tamAy};}
// Haftanın listesi (kadro): o hafta çizelgede görünen kişiler. Kayıtlı değilse önceki haftanın listesi önerilir.
function maasSubesi(p){return p.sgkSube&&p.sgkSube!==SGK_YOK?p.sgkSube:(p.anaSube||'');}
function kadroDoc(wid,H=S.haftalar){const w=H[wid];if(!w)return null;if(Array.isArray(w.kadro))return w.kadro;const c=Object.keys(w.cells||{});return c.length?c:null;}
function kadroOf(wid){const k=kadroDoc(wid);if(k)return{ids:k,oneri:false};const ds=weekDays(wid);
  for(let i=1;i<=8;i++){const kk=kadroDoc(ymd(addDays(parse(wid),-7*i)));if(kk)return{ids:kk.filter(id=>{const p=S.personel.find(x=>x.id===id);return p&&ds.some(d=>employed(p,d));}),oneri:true};}
  return{ids:[],oneri:true};}
function cizelgeKisileri(wid){const ids=kadroOf(wid).ids;const L=ids.map(id=>S.personel.find(p=>p.id===id)).filter(Boolean);
  return L.sort((a,b)=>GRUP_SIRA.indexOf(a.grup||'K')-GRUP_SIRA.indexOf(b.grup||'K')||ids.indexOf(a.id)-ids.indexOf(b.id));}
function ayKadroIds(ak,H=S.haftalar){const[y,m]=ak.split('-').map(Number);const set=new Set();const last=new Date(y,m,0);
  for(let w=parse(mondayOf(new Date(y,m-1,1)));w<=last;w=addDays(w,7)){const k=kadroDoc(ymd(w),H);if(k)k.forEach(id=>set.add(id));}return set;}
function ayKadrosu(ak){const ids=ayKadroIds(ak);return S.personel.filter(p=>ids.has(p.id)&&aktifAyda(p,ak));}
// Bu şubede çalışılan saat ve izinlerin aylık özeti (diğer şubelerin puantajı için kaydedilir).
function subeOzeti(ak,sid=S.subeId){const sb=sube(sid);const out={};ayKadrosu(ak).forEach(p=>{const a=ayHesap(p,ak,sb);
  out[p.id]={saat:Math.round(a.h*100)/100,fm:Math.round(a.fm*100)/100,gun:a.gun,bos:a.bos,R:a.kod.R||0,UI:a.kod.UI||0,YI:a.kod.YI||0,B:a.kod.B||0,D:a.kod.D||0};});return out;}
// Puantaj sol tarafı. Maaş (bordro günü, izinler) kişinin SGK şubesinde; fazla mesai çalıştığı her şubede ayrı.
function solHesap(ak,sid=S.subeId,diger=S.pt.ozetler||{}){const sb=sube(sid);const out={};const burada=subeOzeti(ak,sid);
  const ids=new Set(Object.keys(burada));S.personel.forEach(p=>{if(maasSubesi(p)===sid&&aktifAyda(p,ak))ids.add(p.id);});
  const[y,m]=ak.split('-').map(Number);const last=new Date(y,m,0);
  ids.forEach(pid=>{const p=S.personel.find(x=>x.id===pid);if(!p)return;const o=burada[pid]||{saat:0,fm:0,gun:0,bos:0,R:0,UI:0,YI:0,B:0};const maasBurada=maasSubesi(p)===sid;
    const t={R:o.R,UI:o.UI,YI:o.YI,B:o.B,saat:o.saat,baska:[]};
    if(maasBurada)Object.entries(diger).forEach(([s2,k])=>{if(s2===sid||!k)return;const x=k[pid];if(!x)return;t.R+=x.R||0;t.UI+=x.UI||0;t.YI+=x.YI||0;t.B+=x.B||0;t.saat+=x.saat||0;t.baska.push(subeAdi(s2));});
    let ist=0;for(let d=new Date(y,m-1,1);d<=last;d=addDays(d,1))if(employed(p,d))ist++;
    const gun=Math.max(0,(ist===last.getDate()?30:Math.min(30,ist))-t.R-t.UI);const part=p.sekil==='Part';
    out[pid]={ad:p.ad,maasBurada,sgkSube:p.sgkSube===SGK_YOK?'':p.sgkSube?subeAdi(p.sgkSube):subeAdi(p.anaSube),sekil:p.sekil||'Tam',gorev:p.gorev||'',grup:p.grup||'K',giris:p.giris||'',cikis:p.cikis||'',
      rapor:maasBurada?t.R:0,ucretsiz:maasBurada?t.UI:0,yillik:maasBurada?t.YI:0,bayram:maasBurada?t.B:0,partGun:part&&maasBurada?Math.round(t.saat/(sb.partSaat||8)*100)/100:0,
      fmSaat:o.fm,calisilanSaat:o.saat,gun:maasBurada?gun:0,bosGun:o.bos,baska:t.baska};});
  return out;}
// Puantaj sağ tarafı (ödemeler).
function sagHesap(pid,sol,sag,net,sb,devir){const s=sag||{};const esnaf=sol.sekil==='Esnaf kurye'||sol.sekil==='Yarı esnaf';
  const bankaya=sayi(s.bankaya),paketPrimi=sayi(s.paketPrimi),ciroPrimi=sayi(s.ciroPrimi),avans=sayi(s.avans);
  let hak=0,maasFarki=0,fmTl=0,paketHak=0;
  if(esnaf){paketHak=sayi(s.paketSayisi)*sayi(s.paketUcret!=null&&s.paketUcret!==''?s.paketUcret:sb.paketUcret);hak=paketHak;maasFarki=paketHak-bankaya;}
  else if(sol.maasBurada===false){const n=sayi(net);const fm=Math.max(sol.fmSaat||0,0);fmTl=sb.fmYontem==='maas'?(n?fm*n/30/9:0):fm*sayi(sb.fmUcret);}
  else{const n=sayi(net);hak=n?n*sol.gun/30:0;maasFarki=n?hak-bankaya:0;
    const fm=Math.max(sol.fmSaat||0,0);fmTl=sb.fmYontem==='maas'?(n?fm*n/30/9:0):fm*sayi(sb.fmUcret);}
  const maasYok=!esnaf&&sol.maasBurada===false;const bank2=maasYok?0:bankaya;
  const kalan=maasFarki+fmTl+paketPrimi+ciroPrimi+devir-avans;
  return{esnaf,maasYok,bankaya:bank2,paketPrimi,ciroPrimi,avans,hak,maasFarki,fmTl,paketHak,devir,kalan,netYok:!esnaf&&!maasYok&&!sayi(net)};}

/* ================= Yazma ================= */
const kuyruk={};function sirayla(key,fn){kuyruk[key]=(kuyruk[key]||Promise.resolve()).then(fn).catch(yazmaHatasi);return kuyruk[key];}
function yazmaHatasi(e){console.error(e);const c=e&&e.code||'';
  if(c.includes('permission'))toast('Bu işlem için yetkiniz yok.');else if(c.includes('unavailable'))toast('Bağlantı yok. İnternet gelince tekrar deneyin.');else toast('Kaydedilemedi: '+(e.message||c));}
const weekRef=(wid,sid=S.subeId)=>doc(db,'subeler',sid,'haftalar',wid);
function undoKaydet(wid){const w0=S.haftalar[wid]||{};undo.push({wid,cells:JSON.parse(JSON.stringify(w0.cells||{})),kadro:Array.isArray(w0.kadro)?w0.kadro.slice():null});if(undo.length>40)undo.shift();}
function setCell(pid,wid,i,val){const w0=S.haftalar[wid]||{};const kad=kadroOf(wid).ids.slice();if(!kad.includes(pid))kad.push(pid);undoKaydet(wid);
  const w=S.haftalar[wid]={...w0,kadro:kad,cells:{...(w0.cells||{})}};w.cells[pid]={...(w.cells[pid]||{}),[String(i)]:val};render();
  return sirayla(wid,()=>setDoc(weekRef(wid),{hafta:wid,ay2:ayKey(addDays(parse(wid),6)),kadro:kad,cells:{[pid]:{[String(i)]:val}}},{merge:true}));}
function setWeek(wid,cells,kadro,pushUndo=true){if(pushUndo)undoKaydet(wid);const kad=kadro===undefined?kadroOf(wid).ids:kadro;
  S.haftalar[wid]={hafta:wid,kadro:kad,cells};render();return sirayla(wid,()=>setDoc(weekRef(wid),{hafta:wid,ay2:ayKey(addDays(parse(wid),6)),kadro:kad,cells}));}

/* ================= Başlangıç ve oturum ================= */
function bootstrap(){
  if(!ayarliMi){view(`<div class="login"><div class="card"><h2>Kurulum gerekli</h2><p class="note" style="margin:6px 0 0">config.js dosyasına Firebase proje bilgilerini yapıştırın.</p></div></div>`);top('Puantaj Merkezi','Kurulum');return;}
  S.hafta=mondayOf(today());S.tab=tryLS('pm.tab')||'cizelge';
  onAuthStateChanged(auth,async u=>{S.user=u;temizle();
    if(!u){S.me=null;loginEkrani();return;}
    view(`<div class="empty-state"><b>Hesabınız yükleniyor</b></div>`);
    subs.me=onSnapshot(doc(db,'kullanicilar',u.uid),async s=>{S.meYuklendi=true;S.me=s.exists()?s.data():null;
      if(!S.me){try{const k=await getDoc(doc(db,'sistem','kurulum'));S.kurulumVar=k.exists();}catch(e){S.kurulumVar=true;}return hesapYok();}
      if(S.me.aktif!==true){return view(`<div class="login"><div class="card"><h2>Hesabınız kapalı</h2><p class="note">İşvereninizle görüşün.</p><button class="btn" id="outB">Çıkış yap</button></div></div>`,()=>byId('outB').onclick=()=>signOut(auth));}
      subeleriDinle();},e=>{view(`<div class="banner bad">Hesap bilgisi okunamadı: ${esc(e.message)}</div>`);});});}
function temizle(){[...subs.sube,...subs.detay,...subs.liste,...subs.subeDocs].forEach(u=>u());subs.sube=[];subs.detay=[];subs.liste=[];subs.subeDocs=[];
  if(subs.me){subs.me();subs.me=null;}if(subs.users){subs.users();subs.users=null;}S.subeler={};S.subeIds=[];S.subeId=null;S.personel=[];S.haftalar={};S.aylar={};S.loaded={personel:false,haftalar:false};S.gocBakildi=false;}
function loginEkrani(){top('Puantaj Merkezi','Giriş');byId('tabs').hidden=true;
  view(`<div class="login"><form class="card" id="lf"><h2>Giriş yap</h2><p class="note" style="margin:2px 0 6px">Kullanıcı adınız ve şifrenizle girin.</p>
   <label class="field"><span>Kullanıcı adı</span><input id="lk" autocomplete="username" autocapitalize="none" autocorrect="off" required></label>
   <label class="field"><span>Şifre</span><input id="lp" type="password" autocomplete="current-password" required></label>
   <div id="lerr"></div><div class="row2"><button class="btn primary grow" id="lb" type="submit">Giriş yap</button></div></form></div>`,()=>{
   byId('lf').onsubmit=async e=>{e.preventDefault();const k=byId('lk').value,p=byId('lp').value;const b=byId('lb');b.disabled=true;b.textContent='Giriş yapılıyor';
     try{await signInWithEmailAndPassword(auth,eposta(k),p);}catch(err){const c=err.code||'';
       byId('lerr').innerHTML=`<div class="confirm bad">${c.includes('too-many')?'Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar deneyin.':c.includes('network')?'İnternet bağlantısı yok.':'Kullanıcı adı ya da şifre hatalı.'}</div>`;
       b.disabled=false;b.textContent='Giriş yap';}};});}
function hesapYok(){top('Puantaj Merkezi','Hesap');byId('tabs').hidden=true;
  if(S.kurulumVar===false){view(`<div class="login"><div class="card"><h2>İlk kurulum</h2><p class="note">Sistemde henüz işveren yok. Bu hesap işveren olarak ayarlanacak ve tüm yetkilere sahip olacak.</p>
    <label class="field"><span>Ad soyad</span><input id="kAd" autocomplete="name"></label><div id="kErr"></div>
    <div class="row2"><button class="btn grow" id="kOut">Çıkış</button><button class="btn primary grow" id="kOk">İşveren olarak kur</button></div></div></div>`,()=>{
    byId('kOut').onclick=()=>signOut(auth);
    byId('kOk').onclick=async()=>{const ad=byId('kAd').value.trim();if(!ad){byId('kErr').innerHTML='<div class="confirm">Ad soyad gerekli.</div>';return;}
      const b=writeBatch(db);const uid=S.user.uid;const kadi=S.user.email.split('@')[0];
      b.set(doc(db,'kullanicilar',uid),{kullaniciAdi:kadi,adSoyad:ad,rol:'isveren',subeler:[],aktif:true,olusturma:new Date().toISOString()});
      b.set(doc(db,'sistem','kurulum'),{tarih:new Date().toISOString(),uid});
      try{await b.commit();toast('Kurulum tamamlandı.');}catch(e){byId('kErr').innerHTML=`<div class="confirm bad">Kurulum yapılamadı: ${esc(e.message)}</div>`;}};});return;}
  view(`<div class="login"><div class="card"><h2>Hesabınız tanımlı değil</h2><p class="note">Bu kullanıcı için yetki verilmemiş. İşvereninizden hesabınızı açmasını isteyin.</p><button class="btn" id="outB">Çıkış yap</button></div></div>`,()=>byId('outB').onclick=()=>signOut(auth));}

/* ================= Şubeler ================= */
function subeleriDinle(){subs.subeDocs.forEach(u=>u());subs.subeDocs=[];
  const bitti=()=>{S.subeIds=Object.keys(S.subeler).sort((a,b)=>String(S.subeler[a].ad).localeCompare(String(S.subeler[b].ad),'tr'));if(isIsveren())subeAdSenkron();
    gocKontrol();if(!S.subeId||!S.subeler[S.subeId]){const want=tryLS('pm.sube');const pick=S.subeIds.includes(want)?want:S.subeIds[0];if(pick)selectSube(pick);else render();}else render();};
  if(isIsveren()){subs.subeDocs.push(onSnapshot(collection(db,'subeler'),s=>{S.subeler={};s.docs.forEach(d=>S.subeler[d.id]=d.data());bitti();},e=>toast('Şubeler okunamadı.')));}
  else{const ids=(S.me.subeler||[]);if(!ids.length){S.subeler={};bitti();return;}let gelen=0;
    ids.forEach(id=>subs.subeDocs.push(onSnapshot(doc(db,'subeler',id),s=>{if(s.exists())S.subeler[id]=s.data();else delete S.subeler[id];gelen++;if(gelen>=ids.length)bitti();},()=>{gelen++;if(gelen>=ids.length)bitti();})));}
  subs.subeDocs.push(onSnapshot(collection(db,'personel'),s=>{S.personel=s.docs.map(d=>({id:d.id,...d.data()}));S.loaded.personel=true;S.kuralHata=false;gocKontrol();render();},
    e=>{console.error(e);S.kuralHata=true;S.loaded.personel=true;render();}));
  subs.subeDocs.push(onSnapshot(doc(db,'sistem','subeAdlari'),s=>{S.subeAdlari=s.exists()?(s.data().adlar||{}):{};if(isIsveren())subeAdSenkron();},()=>{}));
  if(isIsveren()&&!subs.users)subs.users=onSnapshot(collection(db,'kullanicilar'),s=>{S.users=s.docs.map(d=>({uid:d.id,...d.data()}));if(S.tab==='yonetim')render();});}
let senkronT;function subeAdSenkron(){clearTimeout(senkronT);senkronT=setTimeout(()=>{const adlar={};Object.entries(S.subeler).forEach(([id,v])=>adlar[id]=v.ad);
  const a=JSON.stringify(Object.entries(adlar).sort()),b=JSON.stringify(Object.entries(S.subeAdlari||{}).sort());if(a!==b&&Object.keys(adlar).length)setDoc(doc(db,'sistem','subeAdlari'),{adlar}).catch(()=>{});},800);}
function tumSubeler(){const m={...S.subeAdlari};Object.entries(S.subeler).forEach(([id,v])=>m[id]=v.ad);return Object.entries(m).sort((a,b)=>String(a[1]).localeCompare(String(b[1]),'tr'));}
// Eski sürümde personel şube altında tutuluyordu; işveren ilk açılışta şirket geneli listeye taşır.
async function gocKontrol(){if(!isIsveren()||S.gocBakildi||!S.subeIds.length)return;S.gocBakildi=true;
  try{const g=await getDoc(doc(db,'sistem','goc'));if(g.exists()&&g.data().v2)return;const var_=new Set(S.personel.map(p=>p.id));let n=0;
    for(const sid of S.subeIds){const q=await getDocs(collection(db,'subeler',sid,'personel'));const b=writeBatch(db);let k=0;
      q.docs.forEach(d=>{if(var_.has(d.id))return;b.set(doc(db,'personel',d.id),{...d.data(),anaSube:sid});k++;n++;});if(k)await b.commit();}
    await setDoc(doc(db,'sistem','goc'),{v2:true,tarih:new Date().toISOString(),tasinan:n});if(n)toast(`${n} personel şirket geneli listeye taşındı.`);}catch(e){console.error(e);S.gocBakildi=false;}}
function selectSube(id){subs.sube.forEach(u=>u());subs.sube=[];S.subeId=id;S.haftalar={};S.aylar={};S.loaded.haftalar=false;undo.length=0;SEL=null;MOD=null;tryLS('pm.sube',id);
  subs.sube.push(onSnapshot(collection(db,'subeler',id,'haftalar'),s=>{const m={};s.docs.forEach(d=>m[d.id]=d.data());S.haftalar=m;S.loaded.haftalar=true;render();},e=>yazmaHatasi(e)));
  subs.sube.push(onSnapshot(collection(db,'subeler',id,'aylar'),s=>{const m={};s.docs.forEach(d=>m[d.id]=d.data());S.aylar=m;render();},()=>{}));
  render();}

/* ================= Çizim çerçevesi ================= */
const byId=id=>document.getElementById(id);
function view(html,after){byId('view').innerHTML=html;after&&after();}
function top(eyebrow,title,right=''){byId('top').innerHTML=`<div class="top-row"><div class="grow"><div class="eyebrow">${eyebrow}</div><h1>${title}</h1></div>${right}</div>`;}
function sekmeler(){if(!S.me)return[];const t=[['cizelge','Çizelge'],['personel','Personel']];
  if(isSube())t.push(['ay','Ay sonu']);if(puantajYetki())t.push(['puantaj','Puantaj']);if(isIsveren())t.push(['yonetim','Yönetim']);return t;}
function renderTabs(){const t=sekmeler();if(!t.some(x=>x[0]===S.tab))S.tab='cizelge';const n=byId('tabs');n.hidden=false;
  byId('tabsIn').innerHTML=t.map(([k,a])=>`<button data-tab="${k}" class="${S.tab===k?'on':''}">${a}</button>`).join('');
  n.querySelectorAll('button').forEach(b=>b.onclick=()=>{S.tab=b.dataset.tab;tryLS('pm.tab',S.tab);if(S.tab==='ay')S.ay=S.ay||gosterAy(S.hafta);if(S.tab==='puantaj'){S.pt.sube=null;}render();window.scrollTo(0,0);});}
function renderTop(){const sb=S.subeId?sube():null;const ak=S.tab==='ay'?S.ay:gosterAy(S.hafta);
  const baslik={cizelge:'Haftalık çizelge',personel:'Personel',ay:'Ay sonu',puantaj:'Puantaj',yonetim:'Yönetim'}[S.tab];
  const d=S.aylar[ak];const chip=sb&&S.tab!=='puantaj'&&S.tab!=='yonetim'?`<span class="chip on-navy">${AYK[+ak.slice(5)-1]} · ${(DURUM[d&&d.durum]||DURUM.taslak).ad}</span>`:'';
  const subeTxt=S.tab==='puantaj'||S.tab==='yonetim'?esc(ROL[rol()]+' · '+(S.me.adSoyad||S.me.kullaniciAdi)):sb?`${esc(sb.ad)} · ${esc(sb.acilis)}–${esc(sb.kapanis)}${S.subeIds.length>1?' ▾':''}`:'Şube yok';
  byId('top').innerHTML=`<div class="top-row"><div class="grow"><button class="sube-btn eyebrow" id="subeBtn">${subeTxt}</button><h1>${baslik}</h1></div>${chip}
   <button class="icon-btn" id="hesapBtn" aria-label="Hesap"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg></button></div>`;
  byId('subeBtn').onclick=()=>{if(S.tab!=='puantaj'&&S.tab!=='yonetim'&&S.subeIds.length>1)subeSec();};byId('hesapBtn').onclick=hesapPanel;}
function render(){if(!S.me||S.me.aktif!==true)return;renderTabs();renderTop();
  if(S.kuralHata)return view(`<div class="banner bad">Personel listesi okunamadı. Firebase kuralları güncel değil. ${isIsveren()?'Firestore → Rules sekmesine son firestore.rules dosyasını yapıştırıp Publish\'e basın.':'İşverene haber verin.'}</div>`);
  if(S.tab==='yonetim')return renderYonetim();
  if(S.tab==='puantaj')return renderPuantaj();
  if(!S.subeIds.length)return view(`<div class="empty-state"><b>Size atanmış şube yok</b>${isIsveren()?'Yönetim sekmesinden şube ekleyin.':'İşvereninizden şube ataması yapmasını isteyin.'}</div>`);
  if(!S.subeId)return;
  if(S.tab==='personel')return renderPersonel();
  if(S.tab==='ay')return renderAy();
  renderCizelge();}

/* ================= Panel ve bildirim ================= */
function openSheet(html,onMount){const r=byId('sheetRoot');r.innerHTML=`<div class="dim" id="dim"></div><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
  byId('dim').onclick=closeSheet;document.addEventListener('keydown',escKapat);onMount&&onMount(r.querySelector('.sheet'));}
function escKapat(e){if(e.key==='Escape')closeSheet();}
function closeSheet(){byId('sheetRoot').innerHTML='';document.removeEventListener('keydown',escKapat);}
let toastT;function toast(m){byId('toastRoot').innerHTML=`<div class="toast" role="status">${esc(m)}</div>`;clearTimeout(toastT);toastT=setTimeout(()=>byId('toastRoot').innerHTML='',3000);}
function subeSec(after){openSheet(`<h2>Şube seç</h2><div class="sub">${S.subeIds.length} şube</div><div class="card list">${S.subeIds.map(id=>`<button class="row" data-id="${esc(id)}"><div class="av">${esc(bas(S.subeler[id].ad))}</div><div class="m"><b>${esc(S.subeler[id].ad)}</b><span>${esc(S.subeler[id].acilis||'')}–${esc(S.subeler[id].kapanis||'')}</span></div>${id===S.subeId?'<span class="chip ok">Seçili</span>':''}</button>`).join('')}</div>`,sh=>{
  sh.querySelectorAll('.row').forEach(b=>b.onclick=()=>{closeSheet();selectSube(b.dataset.id);after&&after();});});}
function hesapPanel(){openSheet(`<h2>${esc(S.me.adSoyad||S.me.kullaniciAdi)}</h2><div class="sub">${esc(ROL[rol()])} · kullanıcı adı: ${esc(S.me.kullaniciAdi||'')}</div>
  <span class="lbl">Şifre değiştir</span><label class="field"><span>Mevcut şifre</span><input id="s1" type="password" autocomplete="current-password"></label>
  <label class="field"><span>Yeni şifre (en az 6 karakter)</span><input id="s2" type="password" autocomplete="new-password"></label><div id="sErr"></div>
  <div class="row2"><button class="btn grow" id="sOk">Şifreyi değiştir</button></div><div class="row2"><button class="btn danger grow" id="outB">Çıkış yap</button></div>`,sh=>{
  byId('outB').onclick=()=>{closeSheet();signOut(auth);};
  byId('sOk').onclick=async()=>{const a=byId('s1').value,b=byId('s2').value;if(b.length<6){byId('sErr').innerHTML='<div class="confirm">Yeni şifre en az 6 karakter olmalı.</div>';return;}
    try{await reauthenticateWithCredential(auth.currentUser,EmailAuthProvider.credential(auth.currentUser.email,a));await updatePassword(auth.currentUser,b);closeSheet();toast('Şifreniz değiştirildi.');}
    catch(e){byId('sErr').innerHTML=`<div class="confirm bad">${(e.code||'').includes('wrong-password')||(e.code||'').includes('invalid-credential')?'Mevcut şifre hatalı.':'Şifre değiştirilemedi.'}</div>`;}};});}

/* ================= Çizelge ================= */
let SEL=null,ROWS=[],MOD=null,ptrTip='mouse',suruk=false,lpT=null,lpOldu=false,lpX=0,lpY=0;
function cizelgeYazabilir(d){return !locked(d)||puantajYetki();}
function renderCizelge(){const sb=sube();const wid=S.hafta;const ds=weekDays(wid);const td=ymd(today());const ak=gosterAy(wid);
  const K=kadroOf(wid);const kisiler=cizelgeKisileri(wid);ROWS=kisiler.map(p=>p.id);if(SEL&&SEL.wid!==wid)SEL=null;
  let h=`<div class="weeknav"><button class="nav-arrow" id="prevW" aria-label="Önceki hafta">‹</button><button class="ttl" id="thisW">${rangeLabel(wid)}<small>${mondayOf(today())===wid?'Bu hafta':'Bu haftaya dön'}</small></button><button class="nav-arrow" id="nextW" aria-label="Sonraki hafta">›</button></div>`;
  if(!(sb.gunluk>0&&sb.gunluk<=16))h+=`<div class="banner bad">Şube ayarlarında günlük mesai ${fmt(sb.gunluk)} saat görünüyor, bu yüzden fazla mesai yanlış hesaplanıyor. ${isIsveren()?'Yönetim → Şubeler\'den 8,5 olarak düzeltin.':'İşverenden şube ayarını düzeltmesini isteyin.'}</div>`;
  if(ds.some(d=>locked(d)))h+=`<div class="banner">${isSube()?'Bu haftanın bir kısmı kapatılmış aya ait, o günler düzenlenemez.':'Bu haftanın bir kısmı kapatılmış aya ait. Yaptığınız değişiklik onaylanmış puantajı değiştirmez.'}</div>`;
  if(K.oneri&&K.ids.length)h+=`<div class="banner ok">Bu haftanın listesi geçen haftadan getirildi. Gelmeyeni ismine dokunup çıkarın, yeni geleni "+ ekle" ile ekleyin.</div>`;
  h+=`<div class="actions"><button class="btn grow" id="copyW">Geçen haftayı kopyala</button><button class="btn" id="undoB" ${undo.length?'':'disabled'}>Geri al</button><button class="btn" id="shareB">Paylaş</button></div>`;
  if(!S.loaded.personel||!S.loaded.haftalar)return view(h+`<div class="empty-state"><b>Vardiyalar yükleniyor</b></div>`,bindWeek);
  h+=`<div class="grid" id="grid"><div></div>${ds.map((d,i)=>`<div class="dh ${ymd(d)===td?'today':''}">${GUN[i]}<span>${d.getDate()}</span></div>`).join('')}`;
  GRUP_SIRA.forEach(g=>{h+=`<div class="gt">${GRUP[g]}<button class="gadd" data-g="${g}">+ ${GRUP[g]} ekle</button></div>`;
    kisiler.filter(p=>(p.grup||'K')===g).forEach(p=>{const r=ROWS.indexOf(p.id);const wk=haftaHesap(p,wid,sb);const ay=ayHesap(p,ak,sb);const ak3=AYK[+ak.slice(5)-1];
      const alt=isEsnaf(p)?`${fmt(wk.h)} sa · esnaf<br>${ak3} <em>${fmt(ay.h)} sa</em>`:p.sekil==='Part'?`${fmt(wk.h)} sa · part<br>${ak3} <em>${fmt(ay.partGun)} gün</em>`:`${fmt(wk.h)} sa · <em>${sg(wk.fm)}</em><br>${ak3} <em>${sg(ay.fm)}</em>`;
      h+=`<button class="nm ${MOD&&MOD.tip==='satir'&&MOD.pid===p.id?'kaynak':''}" data-pe="${esc(p.id)}"><b title="${esc(p.ad)}">${esc(kisaAd(p.ad))}</b><span>${alt}</span></button>`;
      ds.forEach((d,i)=>{if(!employed(p,d)){h+=`<div class="cell out" data-r="${r}" data-c="${i}">—</div>`;return;}
        const lk=!cizelgeYazabilir(d);const val=cellOf(p.id,wid,i);const tag=lk?'div':'button';const at=`data-p="${esc(p.id)}" data-i="${i}" data-r="${r}" data-c="${i}"`;
        if(isShift(val)){const k=shiftKind(val,sb);const[a,b]=val.split('-');h+=`<${tag} class="cell" ${at} aria-label="${esc(p.ad)} ${GUNU[i]} ${a}–${b}"><span class="t ${k.o?'o':''}">${a}</span><span class="t ${k.k?'k':''}">${b}</span></${tag}>`;}
        else if(val&&KOD[val])h+=`<${tag} class="cell code ${val==='HT'?'off':''}" ${at}>${KOD[val].kisa}</${tag}>`;
        else h+=`<${tag} class="cell empty" ${at} aria-label="${esc(p.ad)} ${GUNU[i]} boş">${lk?'':'+'}</${tag}>`;});});});
  h+=`</div>`;
  if(!kisiler.length)h+=`<div class="empty-state"><b>Bu haftanın listesi boş</b>Gruplardaki "+ ekle" ile personel listesinden kişi seçin ya da "Geçen haftayı kopyala"ya basın.</div>`;
  h+=`<div class="legend"><span><i style="background:var(--open)"></i>Açılış saati</span><span><i style="background:var(--close)"></i>Kapanış saati</span><span><i style="background:var(--off)"></i>Haftalık izin</span><span>— İşe giriş öncesi / çıkış sonrası</span></div>
   <p class="note"><b>Kopyala-yapıştır:</b> Bilgisayarda hücreleri fareyle sürükleyerek seçin, Ctrl+C ile kopyalayıp hedef hücrede Ctrl+V yapın; Excel'den kopyaladığınız saatler de yapıştırılır. Delete ile silin, çift tıklayarak düzenleyin. Telefonda hücreye ya da isme basılı tutun.</p>
   <p class="note">İsim altında: hafta saati · hafta fazla mesaisi, sonra ayın birikmiş fazla mesaisi. Hesap: çalışılan − (çalışılan gün × ${fmt(sb.gunluk)} sa); 7 gün çalışılan haftada − ${fmt(sb.haftalik)} sa.</p>`;
  if(MOD)h+=`<div class="modbar"><span>${MOD.tip==='hucre'?`<b>${esc(degerYazi(MOD.val))}</b> kopyalandı. Yapıştırmak için hücrelere dokunun.`:`<b>${esc(kisaAd((S.personel.find(p=>p.id===MOD.pid)||{}).ad))}</b> haftası kopyalandı. Hedef kişinin adına dokunun.`}</span><button class="btn small primary" id="modB">Bitti</button></div>`;
  view(h,()=>{bindWeek();gridBagla();selCiz();const mb=byId('modB');if(mb)mb.onclick=()=>{MOD=null;render();};});}
function degerYazi(v){return isShift(v)?v.replace('-',' – '):v&&KOD[v]?KOD[v].ad:'Boş';}
function bindWeek(){byId('prevW').onclick=()=>{S.hafta=ymd(addDays(parse(S.hafta),-7));SEL=null;render();};byId('nextW').onclick=()=>{S.hafta=ymd(addDays(parse(S.hafta),7));SEL=null;render();};
  byId('thisW').onclick=()=>{S.hafta=mondayOf(today());render();};byId('copyW').onclick=kopyala;byId('undoB').onclick=geriAl;byId('shareB').onclick=paylas;}
function gridBagla(){const G=byId('grid');if(!G)return;
  G.oncontextmenu=e=>{if(e.target.closest('.cell,.nm'))e.preventDefault();};
  G.onpointerdown=e=>{ptrTip=e.pointerType||'mouse';const c=e.target.closest('.cell[data-r]');const n=e.target.closest('[data-pe]');
    if(ptrTip==='mouse'){if(c&&e.button===0){e.preventDefault();const r=+c.dataset.r,cc=+c.dataset.c;
        if(e.shiftKey&&SEL)Object.assign(SEL,{r1:r,c1:cc});else SEL={wid:S.hafta,r0:r,c0:cc,r1:r,c1:cc};suruk=true;selCiz();}return;}
    lpOldu=false;clearTimeout(lpT);lpX=e.clientX;lpY=e.clientY;
    lpT=setTimeout(()=>{lpOldu=true;if(navigator.vibrate)try{navigator.vibrate(15);}catch(_){}
      if(c&&c.dataset.p)hucreKopyaMod(c.dataset.p,+c.dataset.i);else if(n)satirKopyaMod(n.dataset.pe);},480);};
  G.onpointermove=e=>{if(lpT&&(Math.abs(e.clientX-lpX)>8||Math.abs(e.clientY-lpY)>8))clearTimeout(lpT);
    if(suruk&&ptrTip==='mouse'){const c=document.elementFromPoint(e.clientX,e.clientY);const cc=c&&c.closest&&c.closest('.cell[data-r]');if(cc&&SEL){const r=+cc.dataset.r,k=+cc.dataset.c;if(r!==SEL.r1||k!==SEL.c1){SEL.r1=r;SEL.c1=k;selCiz();}}}};
  G.onpointerup=G.onpointercancel=()=>clearTimeout(lpT);
  G.querySelectorAll('button.cell').forEach(b=>{b.onclick=()=>{if(lpOldu){lpOldu=false;return;}if(ptrTip==='mouse')return;
      if(MOD&&MOD.tip==='hucre'){setCell(b.dataset.p,S.hafta,+b.dataset.i,MOD.val);return;}hucre(b.dataset.p,+b.dataset.i);};
    b.ondblclick=()=>{if(ptrTip==='mouse')hucre(b.dataset.p,+b.dataset.i);};});
  G.querySelectorAll('button[data-pe]').forEach(b=>b.onclick=()=>{if(lpOldu){lpOldu=false;return;}if(MOD&&MOD.tip==='satir'){satirYapistir(b.dataset.pe);return;}isimMenu(b.dataset.pe);});
  G.querySelectorAll('.gadd').forEach(b=>b.onclick=()=>kisiSec(b.dataset.g));}
document.addEventListener('pointerup',()=>{suruk=false;});
function selAralik(){if(!SEL)return null;return{r0:Math.min(SEL.r0,SEL.r1),r1:Math.max(SEL.r0,SEL.r1),c0:Math.min(SEL.c0,SEL.c1),c1:Math.max(SEL.c0,SEL.c1)};}
function selCiz(){document.querySelectorAll('.cell.sel').forEach(x=>x.classList.remove('sel'));const A=selAralik();if(!A||SEL.wid!==S.hafta)return;
  document.querySelectorAll('.cell[data-r]').forEach(x=>{const r=+x.dataset.r,c=+x.dataset.c;if(r>=A.r0&&r<=A.r1&&c>=A.c0&&c<=A.c1)x.classList.add('sel');});}
function secimAktif(){if(S.tab!=='cizelge'||!SEL||SEL.wid!==S.hafta||byId('sheetRoot').innerHTML)return false;const a=document.activeElement;return !(a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName));}
const KOD_EXCEL={HT:'HAF. İZİN',UI:'ÜCR. İZİN',YI:'YILLIK İZİN',R:'RAPOR',B:'BAYRAM',D:'DİĞER'};
function secimTSV(){const A=selAralik();const out=[];for(let r=A.r0;r<=A.r1;r++){const row=[];for(let c=A.c0;c<=A.c1;c++){const v=cellOf(ROWS[r],S.hafta,c);
  if(isShift(v))row.push(...v.split('-'));else if(v&&KOD[v])row.push(KOD_EXCEL[v],'');else row.push('','');}out.push(row.join('\t'));}return out.join('\r\n');}
function hucreCoz(a,b){a=String(a??'').trim();b=String(b??'').trim();if(!a&&!b)return null;const ust=a.toLocaleUpperCase('tr-TR').replace(/\s+/g,' ');
  if(XKOD[ust])return XKOD[ust];const kn=Object.keys(KOD).find(k=>KOD[k].ad.toLocaleUpperCase('tr-TR')===ust);if(kn)return kn;
  let m=a.match(/^(\d{1,2}[:.]?\d{0,2})\s*[-–]\s*(\d{1,2}[:.]?\d{0,2})$/);if(m&&!b){const x=normTime(m[1]),y=normTime(m[2]);return x&&y?x+'-'+y:undefined;}
  const x=normTime(a),y=normTime(b);return x&&y?x+'-'+y:undefined;}
function metinMatris(t){let L=String(t||'').replace(/\r/g,'').split('\n');while(L.length&&!L[L.length-1].trim())L.pop();
  return L.map(l=>{let c=l.split('\t');if(c.length===1)return[hucreCoz(c[0],'')];
    if(c.length%2===1){const ilk=hucreCoz(c[0],c[1]);if(ilk===undefined)c=c.slice(1);else c=c.concat(['']);}
    const o=[];for(let j=0;j<c.length;j+=2)o.push(hucreCoz(c[j],c[j+1]));return o;});}
function matrisUygula(M){const A=selAralik();if(!A||!M.length)return;const wid=S.hafta;const ds=weekDays(wid);
  const cells=JSON.parse(JSON.stringify((S.haftalar[wid]&&S.haftalar[wid].cells)||{}));let n=0;
  const yaz=(r,c,v)=>{if(v===undefined||r<0||r>=ROWS.length||c<0||c>6)return;const pid=ROWS[r];const p=S.personel.find(x=>x.id===pid);if(!p||!employed(p,ds[c])||!cizelgeYazabilir(ds[c]))return;
    cells[pid]=cells[pid]||{};cells[pid][String(c)]=v;n++;};
  if(M.length===1&&M[0].length===1&&(A.r1>A.r0||A.c1>A.c0)){for(let r=A.r0;r<=A.r1;r++)for(let c=A.c0;c<=A.c1;c++)yaz(r,c,M[0][0]);}
  else M.forEach((row,i)=>row.forEach((v,j)=>yaz(A.r0+i,A.c0+j,v)));
  if(!n){toast('Yapıştırılacak uygun hücre yok.');return;}setWeek(wid,cells,kadroOf(wid).ids);toast(`${n} hücre yapıştırıldı.`);}
function secimTemizle(){matrisUygula([[null]]);}
document.addEventListener('copy',e=>{if(!secimAktif())return;e.clipboardData.setData('text/plain',secimTSV());e.preventDefault();const A=selAralik();toast(`${(A.r1-A.r0+1)*(A.c1-A.c0+1)} hücre kopyalandı.`);});
document.addEventListener('cut',e=>{if(!secimAktif())return;e.clipboardData.setData('text/plain',secimTSV());e.preventDefault();secimTemizle();});
document.addEventListener('paste',e=>{if(!secimAktif())return;e.preventDefault();matrisUygula(metinMatris(e.clipboardData.getData('text/plain')));});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&(MOD||SEL)&&!byId('sheetRoot').innerHTML){MOD=null;SEL=null;render();return;}if(!secimAktif())return;const A=selAralik();
  if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();secimTemizle();return;}
  if((e.key==='Enter'||e.key==='F2')&&ROWS[SEL.r0]!=null){e.preventDefault();hucre(ROWS[SEL.r0],SEL.c0);return;}
  if(/^[0-9]$/.test(e.key)&&!e.ctrlKey&&!e.metaKey&&ROWS[SEL.r0]!=null){e.preventDefault();hucre(ROWS[SEL.r0],SEL.c0,{ilk:e.key});return;}
  const yon={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]}[e.key];if(yon){e.preventDefault();const r=Math.max(0,Math.min(ROWS.length-1,SEL.r1+yon[0])),c=Math.max(0,Math.min(6,SEL.c1+yon[1]));
    if(e.shiftKey)Object.assign(SEL,{r1:r,c1:c});else SEL={wid:S.hafta,r0:r,c0:c,r1:r,c1:c};selCiz();}});
function hucreKopyaMod(pid,i){const v=cellOf(pid,S.hafta,i);if(!v){toast('Boş hücre kopyalanamaz.');return;}MOD={tip:'hucre',val:v};render();}
function satirKopyaMod(pid){const c=(S.haftalar[S.hafta]&&S.haftalar[S.hafta].cells&&S.haftalar[S.hafta].cells[pid])||{};if(!Object.values(c).some(v=>v)){toast('Bu kişinin haftası boş.');return;}MOD={tip:'satir',pid,gun:{...c}};render();}
function satirYapistir(pid){if(pid===MOD.pid)return;const wid=S.hafta;const ds=weekDays(wid);const p=S.personel.find(x=>x.id===pid);const cells=JSON.parse(JSON.stringify((S.haftalar[wid]&&S.haftalar[wid].cells)||{}));
  cells[pid]=cells[pid]||{};ds.forEach((d,i)=>{if(employed(p,d)&&cizelgeYazabilir(d))cells[pid][String(i)]=MOD.gun[String(i)]??null;});setWeek(wid,cells,kadroOf(wid).ids);toast(`${kisaAd(p.ad)} için yapıştırıldı.`);}
function hucre(pid,i,opt={}){const p=S.personel.find(x=>x.id===pid);if(!p)return;const wid=S.hafta;const d=weekDays(wid)[i];const val=cellOf(pid,wid,i);let[a,b]=isShift(val)?val.split('-'):['',''];if(opt.ilk){a=opt.ilk;b='';}
  openSheet(`<h2>${esc(p.ad)}</h2><div class="sub">${GUNU[i]}, ${d.getDate()} ${AY[d.getMonth()]}</div><label class="lbl" for="tA">Vardiya saati</label>
   <div class="times"><input id="tA" inputmode="numeric" autocomplete="off" placeholder="11:00" value="${a}" aria-label="Başlangıç"><span>–</span><input id="tB" inputmode="numeric" autocomplete="off" placeholder="19:30" value="${b}" aria-label="Bitiş"></div>
   <div class="meta" id="tMeta"></div><div class="row2"><button class="btn primary grow" id="tSave">Kaydet</button><button class="btn grow" id="tNext">Kaydet, sonraki gün</button></div>
   <span class="lbl">Durum</span><div class="codes">${KOD_SIRA.map(k=>`<button data-k="${k}" class="${k==='HT'?'off':''} ${val===k?'sel':''}">${KOD[k].ad}</button>`).join('')}</div>
   <div class="codes" style="margin-top:8px;grid-template-columns:1fr"><button class="clear" data-k="">Hücreyi temizle</button></div>`,sh=>{
   const A=byId('tA'),B=byId('tB'),M=byId('tMeta');
   const upd=()=>{const x=normTime(A.value),y=normTime(B.value);A.classList.toggle('err',!!A.value&&!x);B.classList.toggle('err',!!B.value&&!y);
     if(x&&y){const v=x+'-'+y;const k=shiftKind(v,sube());M.innerHTML=`<span>${fmt(shiftHours(v))} saat</span><span class="chip ${k.o||k.k?'warn':'mut'}">${k.o&&k.k?'Açılış + kapanış':k.o?'Açılış vardiyası':k.k?'Kapanış vardiyası':'Ara vardiya'}</span>`;}
     else M.innerHTML=(A.value||B.value)?'<span>Saati 11:00, 1100 ya da 11 şeklinde yazın</span>':'';};
   const fix=el=>{const n=normTime(el.value);if(n)el.value=n;upd();};A.oninput=upd;B.oninput=upd;A.onblur=()=>fix(A);B.onblur=()=>fix(B);
   A.onkeydown=e=>{if(e.key==='Enter'){fix(A);B.focus();}};B.onkeydown=e=>{if(e.key==='Enter'){fix(B);kaydet(false);}};
   const kaydet=next=>{const x=normTime(A.value),y=normTime(B.value);if(!x||!y){upd();(x?B:A).focus();toast('Başlangıç ve bitiş saatini yazın.');return;}setCell(pid,wid,i,x+'-'+y);if(next)sonraki(pid,i);else closeSheet();};
   byId('tSave').onclick=()=>kaydet(false);byId('tNext').onclick=()=>kaydet(true);
   sh.querySelectorAll('.codes button').forEach(bt=>bt.onclick=()=>{setCell(pid,wid,i,bt.dataset.k||null);closeSheet();});upd();
   setTimeout(()=>{if(opt.ilk){A.focus();A.setSelectionRange(A.value.length,A.value.length);}else if(!a)A.focus();},60);});}
function sonraki(pid,i){const p=S.personel.find(x=>x.id===pid);const ds=weekDays(S.hafta);let j=i+1;while(j<7&&(!employed(p,ds[j])||!cizelgeYazabilir(ds[j])))j++;if(j<7)hucre(pid,j);else{closeSheet();toast('Haftanın son günü kaydedildi.');}}
function geriAl(){const u=undo.pop();if(!u)return;setWeek(u.wid,u.cells,u.kadro,false);S.hafta=u.wid;toast('Son değişiklik geri alındı.');}
function kopyala(){const wid=S.hafta;const prev=ymd(addDays(parse(wid),-7));const pk=kadroDoc(prev);const src=(S.haftalar[prev]&&S.haftalar[prev].cells)||{};
  if(!pk||!pk.length){toast(`${rangeLabel(prev)} haftasında kopyalanacak liste yok.`);return;}
  const dolu=Object.values((S.haftalar[wid]&&S.haftalar[wid].cells)||{}).some(o=>o&&Object.values(o).some(v=>v));
  openSheet(`<h2>Geçen haftayı kopyala</h2><div class="sub">${rangeLabel(prev)} haftasının listesi ve saatleri ${rangeLabel(wid)} haftasına yazılacak.</div>${dolu?'<div class="confirm">Bu haftada girilmiş vardiyalar var, kopyalama üzerine yazar. "Geri al" ile dönebilirsiniz.</div>':''}
   <div class="row2"><button class="btn grow" id="cNo">Vazgeç</button><button class="btn primary grow" id="cYes">Kopyala</button></div>`,()=>{byId('cNo').onclick=closeSheet;
   byId('cYes').onclick=()=>{const ds=weekDays(wid);const out=JSON.parse(JSON.stringify((S.haftalar[wid]&&S.haftalar[wid].cells)||{}));const kad=kadroOf(wid).ids.slice();
     pk.forEach(pid=>{const p=S.personel.find(x=>x.id===pid);if(!p||!ds.some(d=>employed(p,d)))return;if(!kad.includes(pid))kad.push(pid);const s=src[pid];if(!s)return;out[pid]=out[pid]||{};
       ds.forEach((d,i)=>{if(employed(p,d)&&cizelgeYazabilir(d)&&s[String(i)]!=null)out[pid][String(i)]=s[String(i)];});});
     setWeek(wid,out,kad);closeSheet();toast('Geçen haftanın listesi ve saatleri kopyalandı.');};});}
function kadroEkle(pid){const wid=S.hafta;const kad=kadroOf(wid).ids.slice();if(kad.includes(pid))return;kad.push(pid);setWeek(wid,JSON.parse(JSON.stringify((S.haftalar[wid]&&S.haftalar[wid].cells)||{})),kad);}
function kadroCikar(pid){const wid=S.hafta;const kad=kadroOf(wid).ids.filter(x=>x!==pid);const cells=JSON.parse(JSON.stringify((S.haftalar[wid]&&S.haftalar[wid].cells)||{}));delete cells[pid];setWeek(wid,cells,kad);}
function kisiSec(g){const wid=S.hafta;const ds=weekDays(wid);const var_=new Set(kadroOf(wid).ids);
  const L=S.personel.filter(p=>(p.grup||'K')===g&&!var_.has(p.id)&&ds.some(d=>employed(p,d))).sort((a,b)=>((b.anaSube===S.subeId)-(a.anaSube===S.subeId))||String(a.ad).localeCompare(String(b.ad),'tr'));
  const satir=p=>`<button class="row" data-id="${esc(p.id)}" data-ara="${esc(isimAnahtar(p.ad))}"><div class="av">${esc(bas(p.ad))}</div><div class="m"><b>${esc(p.ad)}</b><span>${esc(gorevTahmin(p))}${p.anaSube&&p.anaSube!==S.subeId?' · '+esc(subeAdi(p.anaSube)):''}</span></div></button>`;
  openSheet(`<h2>${GRUP[g]} ekle · ${rangeLabel(wid)}</h2><div class="sub">Personel listesinden seçin. Kişi sadece bu haftanın çizelgesine eklenir.</div>
   <label class="field"><span>Ara</span><input id="kAra" autocomplete="off" placeholder="İsim yazın"></label>
   <div class="card list" id="kList" style="margin-top:10px;max-height:46vh;overflow:auto">${L.map(satir).join('')||'<div class="note" style="padding:12px">Bu bölümde eklenebilecek kişi yok.</div>'}</div>
   <div class="row2"><button class="btn grow" id="kNo">Kapat</button><button class="btn grow" id="kYeni">+ Yeni personel oluştur</button></div>`,sh=>{
   byId('kNo').onclick=closeSheet;byId('kYeni').onclick=()=>personelPanel(null,g,{sonra:pid=>kadroEkle(pid)});
   byId('kAra').oninput=e=>{const q=isimAnahtar(e.target.value);sh.querySelectorAll('#kList .row').forEach(r=>r.hidden=!!q&&!r.dataset.ara.includes(q));};
   sh.querySelectorAll('#kList .row').forEach(r=>r.onclick=()=>{kadroEkle(r.dataset.id);r.remove();toast(`${kisaAd(S.personel.find(p=>p.id===r.dataset.id).ad)} bu haftaya eklendi.`);});});}
function isimMenu(pid){const p=S.personel.find(x=>x.id===pid);if(!p)return;const dolu=Object.values(((S.haftalar[S.hafta]||{}).cells||{})[pid]||{}).some(v=>v);
  openSheet(`<h2>${esc(p.ad)}</h2><div class="sub">${esc(gorevTahmin(p))} · ${rangeLabel(S.hafta)}</div><div class="card list">
   ${personelYazabilir(p)?'<button class="row" id="iDuz"><div class="m"><b>Bilgilerini düzenle</b><span>Görev, SGK şubesi, giriş ve çıkış tarihi</span></div></button>':''}
   <button class="row" id="iKop"><div class="m"><b>Haftasını kopyala</b><span>Sonra hedef kişinin adına dokunarak yapıştırın</span></div></button>
   <button class="row" id="iCik"><div class="m"><b style="color:var(--bad)">Bu haftadan çıkar</b><span>${dolu?'Bu haftaki saatleri de silinir. ':''}Personel listesinde kalır.</span></div></button></div>`,()=>{
   const d=byId('iDuz');if(d)d.onclick=()=>personelPanel(pid);byId('iKop').onclick=()=>{closeSheet();satirKopyaMod(pid);};
   const c=byId('iCik');c.onclick=()=>{if(dolu&&!c.dataset.ok){c.dataset.ok='1';c.querySelector('b').textContent='Çıkarmayı onayla';return;}closeSheet();kadroCikar(pid);toast(`${kisaAd(p.ad)} bu haftadan çıkarıldı.`);};});}

/* ================= Personel (şirket geneli liste) ================= */
function personelYazabilir(p){return isIsveren()||!p.anaSube||(S.me.subeler||[]).includes(p.anaSube);}
function renderPersonel(){const list=sirala(S.personel.filter(p=>p.anaSube===S.subeId));const td=ymd(today());
  let h=`<div class="actions"><button class="btn primary grow" id="addP">Personel ekle</button></div><p class="note" style="margin-top:0">${esc(sube().ad)} şubesine kayıtlı personel. Çizelgeye eklemek için çizelgedeki "+ ekle" butonlarını kullanın; diğer şubelerin personeli de oradan seçilebilir.</p>`;
  if(!list.length)return view(h+`<div class="empty-state"><b>Henüz personel yok</b>"Personel ekle" ile şubenin çalışanlarını girin.</div>`,()=>byId('addP').onclick=()=>personelPanel(null));
  const aktif=list.filter(p=>!p.cikis||p.cikis>=td),cikan=list.filter(p=>p.cikis&&p.cikis<td);
  const row=p=>`<button class="row" data-id="${esc(p.id)}"><div class="av">${esc(bas(p.ad))}</div><div class="m"><b>${esc(p.ad)}</b><span>${esc(gorevTahmin(p)||'Görev seçilmemiş')}${p.sekil==='Part'?' · Part':''} · SGK: ${p.sgkSube===SGK_YOK?'yok':p.sgkSube?esc(subeAdi(p.sgkSube)):'<b style="color:var(--warn)">seçilmemiş</b>'}${p.giris?' · giriş '+trTarih(p.giris):''}</span></div>
    <div class="r">${p.cikis?`<span class="chip ${p.cikis<td?'mut':'warn'}">Çıkış ${trTarih(p.cikis)}</span>`:''}</div></button>`;
  GRUP_SIRA.forEach(g=>{const l=aktif.filter(p=>(p.grup||'K')===g);if(l.length)h+=`<div class="sec">${GRUP[g]} · ${l.length}</div><div class="card list">${l.map(row).join('')}</div>`;});
  if(cikan.length)h+=`<div class="sec">Çıkış yapanlar · ${cikan.length}</div><div class="card list">${cikan.map(row).join('')}</div>`;
  view(h,()=>{byId('addP').onclick=()=>personelPanel(null);document.querySelectorAll('.row[data-id]').forEach(b=>b.onclick=()=>personelPanel(b.dataset.id));});}
function personelPanel(id,gr,opt={}){const p=id?S.personel.find(x=>x.id===id):{ad:'',grup:gr||'K',gorev:'',sekil:'Tam',giris:ymd(today()),cikis:'',anaSube:S.subeId};if(!p)return;
  const yaz=personelYazabilir(p);const gv=id?gorevTahmin(p):'';const sgk=p.sgkSube||'';const subeler=tumSubeler();
  const anaSec=(isIsveren()?S.subeIds:(S.me.subeler||[])).filter(x=>S.subeler[x]);
  const gorevOpt=GOREVLER.filter(g=>id||!gr||g.grup===gr).map(g=>`<option value="${esc(g.ad)}" ${gv===g.ad?'selected':''}>${esc(g.ad)}</option>`).join('');
  openSheet(`<h2>${id?'Personeli düzenle':'Yeni personel · '+GRUP[gr||'K']}</h2><div class="sub">${yaz?'İsim puantaj ve bordro eşleşmesinde kullanılır, bordrodaki gibi yazın.':'Bu kişi başka bir şubeye kayıtlı; bilgilerini o şube düzenler.'}</div>
   <label class="field"><span>Ad soyad</span><input id="pAd" value="${esc(p.ad)}" autocomplete="off" ${yaz?'':'disabled'}></label>
   <label class="field"><span>Görev</span><select id="pGorev" ${yaz?'':'disabled'}><option value="">Seçin</option>${gorevOpt}</select></label>
   <div id="pSekilW"><span class="lbl">Çalışma şekli</span><div class="seg" id="pSekil">${['Tam','Part'].map(x=>`<button data-v="${x}" class="${(p.sekil==='Part'?'Part':'Tam')===x?'on':''}" ${yaz?'':'disabled'}>${x}</button>`).join('')}</div></div>
   <label class="field"><span>SGK şubesi</span><select id="pSgk" ${yaz?'':'disabled'}><option value="" ${!sgk?'selected':''}>Seçin</option><option value="${SGK_YOK}" ${sgk===SGK_YOK?'selected':''}>Boş (SGK şubesi yok)</option>${subeler.map(([sid,ad])=>`<option value="${esc(sid)}" ${sgk===sid?'selected':''}>${esc(ad)}</option>`).join('')}</select></label>
   ${anaSec.length>1?`<label class="field"><span>Kayıtlı olduğu şube</span><select id="pAna" ${yaz?'':'disabled'}>${anaSec.map(x=>`<option value="${esc(x)}" ${(p.anaSube||S.subeId)===x?'selected':''}>${esc(S.subeler[x].ad)}</option>`).join('')}</select></label>`:''}
   <div class="fgrid"><label class="field"><span>İşe giriş</span><input id="pGiris" type="date" value="${esc(p.giris||'')}" ${yaz?'':'disabled'}></label><label class="field"><span>Çıkış (boşsa çalışıyor)</span><input id="pCikis" type="date" value="${esc(p.cikis||'')}" ${yaz?'':'disabled'}></label></div>
   ${id&&!p.cikis&&yaz?'<button class="btn" id="pOut" style="margin-top:8px;width:100%">Bugün itibarıyla çıkış ver</button>':''}
   <div id="pWarn"></div><div class="row2">${id&&yaz?'<button class="btn danger" id="pDel">Personeli sil</button>':''}<button class="btn grow" id="pNo">${yaz?'Vazgeç':'Kapat'}</button>${yaz?'<button class="btn primary grow" id="pOk">Kaydet</button>':''}</div>`,sh=>{
   sh.querySelectorAll('#pSekil button').forEach(bt=>bt.onclick=()=>{sh.querySelectorAll('#pSekil button').forEach(x=>x.classList.remove('on'));bt.classList.add('on');});
   const G=byId('pGorev');const tog=()=>{const g=gorevBul(G.value);byId('pSekilW').hidden=!!(g&&g.sekil);};G.onchange=tog;tog();
   const po=byId('pOut');if(po)po.onclick=()=>{byId('pCikis').value=ymd(today());po.hidden=true;};byId('pNo').onclick=closeSheet;const W=byId('pWarn');if(!yaz)return;
   byId('pOk').onclick=()=>{const ad=byId('pAd').value.trim().replace(/\s+/g,' ');if(!ad){W.innerHTML='<div class="confirm">Ad soyad gerekli.</div>';return;}
     const g=gorevBul(G.value);if(!g){W.innerHTML='<div class="confirm">Görev seçin.</div>';return;}
     const sgkV=byId('pSgk').value;if(!sgkV){W.innerHTML='<div class="confirm">SGK şubesini seçin. SGK şubesi yoksa "Boş" seçeneğini seçin.</div>';return;}
     const ayni=S.personel.find(x=>x.id!==id&&isimAnahtar(x.ad)===isimAnahtar(ad));if(ayni&&!W.dataset.ok){W.dataset.ok='1';W.innerHTML=`<div class="confirm">Bu isimde başka bir personel var (${esc(subeAdi(ayni.anaSube))}). Aynı kişiyse yeni kayıt açmayın, çizelgede "+ ekle" ile seçin. Farklı kişiyse tekrar Kaydet'e basın.</div>`;return;}
     const giris=byId('pGiris').value,cikis=byId('pCikis').value;if(giris&&cikis&&cikis<giris){W.innerHTML='<div class="confirm">Çıkış tarihi girişten önce olamaz.</div>';return;}
     const sekil=g.sekil||sh.querySelector('#pSekil .on').dataset.v;const ana=byId('pAna')?byId('pAna').value:(p.anaSube||S.subeId);
     const body={ad,gorev:g.ad,grup:g.grup,sekil,giris,cikis,sgkSube:sgkV,anaSube:ana};if(p.sira!=null)body.sira=p.sira;const pid=id||(slug(ad)+'-'+Math.random().toString(36).slice(2,6));
     sirayla('p'+pid,()=>setDoc(doc(db,'personel',pid),body));if(!id)S.personel.push({id:pid,...body});closeSheet();toast(id?'Personel güncellendi.':'Personel eklendi.');if(opt.sonra)opt.sonra(pid);};
   const del=byId('pDel');if(del)del.onclick=()=>{if(!del.dataset.ok){del.dataset.ok='1';del.textContent='Evet, sil';W.innerHTML='<div class="confirm">Kişi şirketin personel listesinden silinir. Ayrılan biri için silmek yerine çıkış tarihi girin.</div>';return;}
     sirayla('p'+id,()=>deleteDoc(doc(db,'personel',id)));closeSheet();toast(`${p.ad} silindi.`);};});}

/* ================= Ay sonu (şube müdürü) ================= */
function renderAy(){const ak=S.ay||gosterAy(S.hafta);S.ay=ak;const sb=sube();const kisiler=sirala(ayKadrosu(ak));const R=kisiler.map(p=>({p,a:ayHesap(p,ak,sb)}));
  const d=S.aylar[ak]||{durum:'taslak'};const kilit=d.durum==='sube_onay'||d.durum==='bolge_onay';
  const topFm=R.reduce((s,x)=>s+Math.max(x.a.fm,0),0),rap=R.reduce((s,x)=>s+(x.a.kod.R||0),0),ui=R.reduce((s,x)=>s+(x.a.kod.UI||0),0),bos=R.reduce((s,x)=>s+x.a.bos,0);
  let h=`<div class="weeknav"><button class="nav-arrow" id="prevM">‹</button><div class="ttl">${ayAdi(ak)}<small>${DURUM[d.durum].ad}</small></div><button class="nav-arrow" id="nextM">›</button></div>`;
  if(d.durum==='geri')h+=`<div class="banner bad">Bölge müdürü geri gönderdi${d.not?': "'+esc(d.not)+'"':''}. Düzeltip ayı yeniden kapatın.</div>`;
  if(d.durum==='sube_onay')h+=`<div class="banner">Ay kapatıldı, bölge müdürünün onayı bekleniyor. Bu ayın günleri kilitli.</div>`;
  if(d.durum==='bolge_onay')h+=`<div class="banner ok">Bölge müdürü onayladı. Puantaj işverene gönderildi.</div>`;
  h+=`<div class="kpis"><div class="kpi"><span>Toplam fazla mesai</span><b>${fmt(topFm)} sa</b></div><div class="kpi"><span>Çalışan</span><b>${R.length}</b></div><div class="kpi"><span>Rapor / Ücr. izin</span><b>${rap} / ${ui} gün</b></div><div class="kpi"><span>Boş gün</span><b style="color:${bos?'var(--warn)':'var(--ok)'}">${bos?bos+' gün':'Yok'}</b></div></div>`;
  if(bos)h+=`<p class="note">Boş gün: kişinin o hafta başka kaydı var ama o gün boş. Fazla mesaiden ${fmt(sb.gunluk)} saat düşülür. Ayı kapatmadan önce doldurun.</p>`;
  let son=null;R.forEach(({p,a})=>{const g=p.grup||'K';if(g!==son){if(son)h+='</div>';son=g;h+=`<div class="sec">${GRUP[g]}</div><div class="card list">`;}
    const tags=['R','UI','YI','B'].filter(k=>a.kod[k]).map(k=>`<span class="tag">${a.kod[k]} ${KOD[k].ad.toLocaleLowerCase('tr-TR')}</span>`).join('')+(a.bos?`<span class="tag warn">${a.bos} boş gün</span>`:'');
    const sag=a.esnaf?`<b>${fmt(a.h)} sa</b><span>esnaf</span>`:a.part?`<b>${fmt(a.partGun)} gün</b><span>part · ${fmt(a.h)} sa</span>`:`<b>${sg(a.fm)} sa</b><span>${fmt(a.h)} sa çalıştı</span>`;
    h+=`<div class="row"><div class="av">${esc(bas(p.ad))}</div><div class="m"><b>${esc(p.ad)}</b><span>${esc(p.gorev||GRUP[g])} · ${a.gun} gün</span>${tags?`<div class="tags">${tags}</div>`:''}</div><div class="r">${sag}</div></div>`;});
  if(son)h+='</div>';if(!R.length)h+=`<div class="empty-state"><b>Bu ay için çizelge yok</b></div>`;
  h+=`<div style="margin-top:16px">${d.durum==='sube_onay'?'<button class="btn" style="width:100%" id="cekB">Kapatmayı geri çek</button>':d.durum==='bolge_onay'?'':`<button class="btn primary" style="width:100%" id="kapB">Ayı kapat → bölge müdürüne gönder</button>`}</div>
   <p class="note">Ayı kapatınca bu ayın çalışma günleri, fazla mesaisi, rapor ve izinleri bölge müdürünün puantaj ekranına düşer. Bölge müdürü onaylayınca puantaj işverene hazır olur.</p>`;
  view(h,()=>{byId('prevM').onclick=()=>{S.ay=ayKaydir(ak,-1);render();};byId('nextM').onclick=()=>{S.ay=ayKaydir(ak,1);render();};
    const kb=byId('kapB');if(kb)kb.onclick=()=>{if(!kb.dataset.ok){kb.dataset.ok='1';kb.textContent=bos?`${bos} boş gün var, yine de kapat`:'Kapatmayı onayla';return;}
      const sid=S.subeId;sirayla('ay'+ak,async()=>{const b=writeBatch(db);b.set(doc(db,'subeler',sid,'aylar',ak),{durum:'sube_onay',kapatan:S.user.uid,kapatanAd:S.me.adSoyad||'',kapatma:new Date().toISOString(),not:''},{merge:true});
        b.set(doc(db,'ozetler',ak+'__'+sid),{sube:sid,ay:ak,kisiler:subeOzeti(ak,sid),guncellendi:new Date().toISOString()});await b.commit();});toast(`${ayAdi(ak)} kapatıldı, bölge müdürüne gönderildi.`);};
    const cb=byId('cekB');if(cb)cb.onclick=()=>{sirayla('ay'+ak,()=>setDoc(doc(db,'subeler',S.subeId,'aylar',ak),{durum:'taslak'},{merge:true}));toast('Kapatma geri çekildi.');};});}

/* ================= Puantaj (bölge müdürü + işveren) ================= */
function renderPuantaj(){if(!puantajYetki())return;if(!S.ay)S.ay=ayKaydir(ayKey(today()),today().getDate()<=10?-1:0);
  if(S.pt.sube&&S.subeId===S.pt.sube)return renderPuantajDetay();
  const ak=S.ay;listeDinle(ak);
  let h=`<div class="weeknav"><button class="nav-arrow" id="prevM">‹</button><div class="ttl">${ayAdi(ak)}<small>${S.subeIds.length} şube</small></div><button class="nav-arrow" id="nextM">›</button></div>`;
  if(!S.subeIds.length)h+=`<div class="empty-state"><b>Sorumlu olduğunuz şube yok</b></div>`;
  const say={};h+=`<div class="card list">${S.subeIds.map(id=>{const d=S.pt.listeAylar[id+'|'+ak]||{durum:'taslak'};say[d.durum]=(say[d.durum]||0)+1;const D=DURUM[d.durum]||DURUM.taslak;
    return `<button class="row" data-id="${esc(id)}"><div class="av">${esc(bas(S.subeler[id].ad))}</div><div class="m"><b>${esc(S.subeler[id].ad)}</b><span>${d.kapatma?'Kapatıldı '+new Date(d.kapatma).toLocaleDateString('tr-TR'):'Henüz kapatılmadı'}</span></div><span class="chip ${D.c}">${D.ad}</span></button>`;}).join('')}</div>`;
  h+=`<p class="note">${say.sube_onay?`<b>${say.sube_onay} şube onayınızı bekliyor.</b> `:''}Şubeye dokunup puantajı açın. Muhasebe tarafı çizelgeden hesaplanır; ödemeleri orada işleyin.</p>`;
  view(h,()=>{byId('prevM').onclick=()=>{S.ay=ayKaydir(ak,-1);render();};byId('nextM').onclick=()=>{S.ay=ayKaydir(ak,1);render();};
    document.querySelectorAll('.row[data-id]').forEach(b=>b.onclick=()=>puantajAc(b.dataset.id));});}
let listeAy=null;function listeDinle(ak){if(listeAy===ak+S.subeIds.join())return;listeAy=ak+S.subeIds.join();subs.liste.forEach(u=>u());subs.liste=[];
  S.subeIds.forEach(id=>subs.liste.push(onSnapshot(doc(db,'subeler',id,'aylar',ak),s=>{S.pt.listeAylar[id+'|'+ak]=s.exists()?s.data():{durum:'taslak'};if(S.tab==='puantaj'&&!S.pt.sube)render();},()=>{})));}
function puantajAc(id){if(S.subeId!==id)selectSube(id);S.pt.sube=id;S.pt.doc=null;S.pt.maas=null;S.pt.prev=null;S.pt.ozetler={};subs.detay.forEach(u=>u());subs.detay=[];const ak=S.ay;
  subs.detay.push(onSnapshot(doc(db,'puantaj',id,'aylar',ak),s=>{S.pt.doc=s.exists()?s.data():{};render();},e=>{S.pt.doc={};yazmaHatasi(e);}));
  subs.detay.push(onSnapshot(doc(db,'maaslar',id),s=>{S.pt.maas=s.exists()?s.data():{};render();},()=>{S.pt.maas={};}));
  getDocs(query(collection(db,'ozetler'),where('ay','==',ak))).then(q=>{const m={};q.docs.forEach(d=>{const x=d.data();if(x.sube)m[x.sube]=x.kisiler||{};});S.pt.ozetler=m;render();}).catch(e=>console.error(e));
  getDoc(doc(db,'puantaj',id,'aylar',ayKaydir(ak,-1))).then(s=>{S.pt.prev=s.exists()?s.data():{};render();}).catch(()=>{S.pt.prev={};});render();}
function ptVerisi(){const ak=S.ay;const D=S.pt.doc||{};const kilitli=D.kilitli===true;const sol=kilitli&&D.sol?D.sol:solHesap(ak);const sb=sube();const net=(S.pt.maas&&S.pt.maas.net)||{};
  const prevSag=(S.pt.prev&&S.pt.prev.sag)||{};const sag=D.sag||{};
  const ids=Object.keys(sol).sort((a,b)=>GRUP_SIRA.indexOf(sol[a].grup)-GRUP_SIRA.indexOf(sol[b].grup)||String(sol[a].ad).localeCompare(String(sol[b].ad),'tr'));
  const satir=ids.map(pid=>{const dv=prevSag[pid]&&prevSag[pid].kalan<0?prevSag[pid].kalan:0;return{pid,sol:sol[pid],sag:sag[pid]||{},net:net[pid],hes:sagHesap(pid,sol[pid],sag[pid],net[pid],sb,dv)};});
  return{ak,kilitli,sol,satir,sb,D};}
function renderPuantajDetay(){const ak=S.ay;const sb=sube();const durum=(S.aylar[ak]||{durum:'taslak'}).durum;const D=DURUM[durum]||DURUM.taslak;
  let h=`<div class="weeknav"><button class="nav-arrow" id="geriL" aria-label="Şube listesi">‹</button><div class="ttl">${esc(sb.ad)} · ${ayAdi(ak)}<small>${D.ad}</small></div><span style="width:40px"></span></div>`;
  if(S.pt.doc===null||S.pt.maas===null||!S.loaded.personel||!S.loaded.haftalar)return view(h+`<div class="empty-state"><b>Puantaj yükleniyor</b></div>`,()=>byId('geriL').onclick=listeyeDon);
  const V=ptVerisi();const ad=S.aylar[ak]||{};
  if(durum==='taslak')h+=`<div class="banner">Şube müdürü bu ayı henüz kapatmadı. Rakamlar çizelge değiştikçe güncellenir.</div>`;
  if(durum==='geri')h+=`<div class="banner bad">Şubeye geri gönderildi${ad.not?': "'+esc(ad.not)+'"':''}.</div>`;
  if(durum==='sube_onay')h+=`<div class="banner">Şube müdürü ayı kapattı${ad.kapatanAd?' ('+esc(ad.kapatanAd)+')':''}. Kontrol edip onaylayın ya da geri gönderin.</div>`;
  if(durum==='bolge_onay'&&V.kilitli)h+=`<div class="banner ok">Onaylandı${V.D.onaylayanAd?' · '+esc(V.D.onaylayanAd):''}. Muhasebe tarafı kilitli, ödemeler işlenebilir.</div>`;
  h+=`<div class="seg" style="margin:4px 0 12px" id="ptSeg"><button data-v="sol" class="${S.pt.gorunum==='sol'?'on':''}">Muhasebe</button><button data-v="sag" class="${S.pt.gorunum==='sag'?'on':''}">Ödemeler</button></div>`;
  const cikisMi=s=>s.cikis&&s.cikis<=ayKaydir(ak,1)+'-00';
  if(S.pt.gorunum==='sol'){
    h+=`<div class="tbl-wrap"><table class="pt"><thead><tr><th class="l">SGK şube</th><th class="l">Ad soyad</th><th>Şekil</th><th>Giriş</th><th>Çıkış</th><th>Rapor</th><th>Ücr. izin</th><th>Part gün</th><th>Yıllık izin</th><th>Bayram</th><th>FM saat</th><th>Bordro gün</th></tr></thead><tbody>`;
    V.satir.forEach(({sol})=>{const fo=sol.maasBurada===false;h+=`<tr class="${cikisMi(sol)?'cikis':''}"><td class="l">${esc(sol.sgkSube)}</td><td class="l"><b>${esc(sol.ad)}</b>${fo?' <span class="tag">sadece fazla mesai</span>':''}${sol.baska&&sol.baska.length?` <span class="tag">+ ${esc(sol.baska.join(', '))}</span>`:''}${sol.bosGun?` <span class="tag warn">${sol.bosGun} boş</span>`:''}</td><td>${esc(sol.sekil)}</td><td>${trTarih(sol.giris)}</td><td>${trTarih(sol.cikis)}</td><td>${sol.rapor||''}</td><td>${sol.ucretsiz||''}</td><td>${sol.partGun?fmt(sol.partGun):''}</td><td>${sol.yillik||''}</td><td>${sol.bayram||''}</td><td>${sol.fmSaat?sg(sol.fmSaat):''}</td><td>${fo?'—':sol.gun}</td></tr>`;});
    h+=`</tbody></table></div><div class="legend"><span><i style="background:var(--yel)"></i>Çıkış yapan</span><span>Bordro gün = 30 − rapor − ücretsiz izin (ay ortasında giriş/çıkışta çalışılan takvim günü)</span></div>
    <p class="note">Maaş, rapor ve izinler kişinin SGK şubesinde; fazla mesai çalıştığı her şubede ayrı görünür. Diğer şubelerdeki izin günleri o şubeler ayı kapattıkça eklenir. "+ şube adı" etiketi o şubeden gelen günlerin eklendiğini gösterir.</p>`;
    h+=`<div class="actions" style="margin-top:12px"><button class="btn grow" id="pdfB">Muhasebe çıktısı (PDF)</button></div>`;}
  else{
    const T=V.satir.reduce((t,x)=>{t.hak+=x.hes.hak+x.hes.fmTl+x.hes.paketPrimi+x.hes.ciroPrimi;t.bankaya+=x.hes.bankaya;t.avans+=x.hes.avans;t.nakit+=Math.max(x.hes.kalan,0);return t;},{hak:0,bankaya:0,avans:0,nakit:0});
    h+=`<div class="kpis"><div class="kpi"><span>Toplam hak ediş</span><b>${tl0(T.hak)}</b></div><div class="kpi"><span>Bankaya yatan</span><b>${tl0(T.bankaya)}</b></div><div class="kpi"><span>Avans</span><b>${tl0(T.avans)}</b></div><div class="kpi"><span>İhtiyaç duyulan nakit</span><b>${tl0(T.nakit)}</b></div></div>`;
    h+=`<div class="actions"><button class="btn grow" id="bordroB">Bordro PDF yükle</button></div>`;
    h+=`<div class="tbl-wrap"><table class="pt"><thead><tr><th class="l">Ad soyad</th><th>Gün</th><th>Anlaşılan net</th><th>Hak edilen</th><th>Bankaya yatan</th><th>Maaş farkı</th><th>FM ₺</th><th>Paket primi</th><th>Ciro primi</th><th>Devir</th><th>Avans</th><th>Kalan ödeme</th></tr></thead><tbody>`;
    V.satir.forEach(({pid,sol,net,hes})=>{const cls=hes.kalan<-0.004?'eksi':cikisMi(sol)?'cikis':'';
      h+=`<tr class="click ${cls}" data-pid="${esc(pid)}"><td class="l"><b>${esc(sol.ad)}</b><br><span class="tag">${esc(sol.sekil)}</span>${hes.netYok?' <span class="tag warn">net maaş yok</span>':''}</td><td>${hes.esnaf||hes.maasYok?'—':sol.gun}</td><td>${hes.esnaf?'paket':hes.maasYok?'<span class="tag">sadece FM</span>':net?tl(net):'—'}</td><td>${tl(hes.hak)}</td><td>${tl(hes.bankaya)}</td><td>${tl(hes.maasFarki)}</td><td>${hes.fmTl?tl(hes.fmTl):''}</td><td>${hes.paketPrimi?tl(hes.paketPrimi):''}</td><td>${hes.ciroPrimi?tl(hes.ciroPrimi):''}</td><td>${hes.devir?`<span class="neg">${tl(hes.devir)}</span>`:''}</td><td>${hes.avans?tl(hes.avans):''}</td><td class="${hes.kalan<0?'neg':'pos'}">${tl(hes.kalan)}</td></tr>`;});
    h+=`<tr class="tot"><td class="l">Toplam</td><td></td><td></td><td>${tl(T.hak)}</td><td>${tl(T.bankaya)}</td><td colspan="5"></td><td>${tl(T.avans)}</td><td>${tl(T.nakit)}</td></tr></tbody></table></div>
     <div class="legend"><span><i style="background:var(--yel)"></i>Çıkış yapan</span><span><i style="background:var(--red)"></i>Kalan eksi: sonraki aya devreder</span><span>Satıra dokunup ödemeleri girin</span></div>`;}
  const bolgeIs=durum==='sube_onay'||(isIsveren()&&durum!=='bolge_onay');
  h+=`<div class="row2">${bolgeIs?`<button class="btn danger grow" id="geriB">Şubeye geri gönder</button><button class="btn primary grow" id="onayB">Onayla ve kilitle</button>`:''}${isIsveren()&&durum==='bolge_onay'?'<button class="btn grow" id="acB">Kilidi aç</button>':''}</div>`;
  view(h,()=>{byId('geriL').onclick=listeyeDon;document.querySelectorAll('#ptSeg button').forEach(b=>b.onclick=()=>{S.pt.gorunum=b.dataset.v;render();});
    const pb=byId('pdfB');if(pb)pb.onclick=()=>muhasebeCiktisi(V);const bb=byId('bordroB');if(bb)bb.onclick=()=>bordroPanel(V);
    document.querySelectorAll('tr[data-pid]').forEach(r=>r.onclick=()=>odemePanel(r.dataset.pid));
    const ob=byId('onayB');if(ob)ob.onclick=()=>{if(!ob.dataset.ok){ob.dataset.ok='1';ob.textContent='Onayı kesinleştir';return;}onayla();};
    const gb=byId('geriB');if(gb)gb.onclick=geriGonderPanel;const ab=byId('acB');if(ab)ab.onclick=()=>{if(!ab.dataset.ok){ab.dataset.ok='1';ab.textContent='Kilidi açmayı onayla';return;}kilidiAc();};});}
function listeyeDon(){S.pt.sube=null;subs.detay.forEach(u=>u());subs.detay=[];render();}
function sagSonuclu(V,degisen){const sag=JSON.parse(JSON.stringify((V.D&&V.D.sag)||{}));if(degisen)Object.entries(degisen).forEach(([pid,v])=>sag[pid]={...(sag[pid]||{}),...v});
  const prevSag=(S.pt.prev&&S.pt.prev.sag)||{};const net=(S.pt.maas&&S.pt.maas.net)||{};
  Object.keys(V.sol).forEach(pid=>{const dv=prevSag[pid]&&prevSag[pid].kalan<0?prevSag[pid].kalan:0;const r=sagHesap(pid,V.sol[pid],sag[pid],net[pid],V.sb,dv);sag[pid]={...(sag[pid]||{}),kalan:Math.round(r.kalan*100)/100};});return sag;}
function onayla(){const V=ptVerisi();const ak=S.ay,sid=S.subeId;const sol=solHesap(ak);const b=writeBatch(db);const V2={...V,sol};
  b.set(doc(db,'puantaj',sid,'aylar',ak),{sube:sid,ay:ak,sol,sag:sagSonuclu(V2),kilitli:true,onaylayan:S.user.uid,onaylayanAd:S.me.adSoyad||'',onayTarihi:new Date().toISOString(),guncellendi:new Date().toISOString()},{merge:true});
  b.set(doc(db,'subeler',sid,'aylar',ak),{durum:'bolge_onay',onaylayan:S.user.uid,onayTarihi:new Date().toISOString()},{merge:true});
  b.set(doc(db,'ozetler',ak+'__'+sid),{sube:sid,ay:ak,kisiler:subeOzeti(ak,sid),guncellendi:new Date().toISOString()});
  b.commit().then(()=>toast(`${sube().ad} · ${ayAdi(ak)} onaylandı.`)).catch(yazmaHatasi);}
function kilidiAc(){const ak=S.ay,sid=S.subeId;const b=writeBatch(db);b.set(doc(db,'puantaj',sid,'aylar',ak),{kilitli:false,guncellendi:new Date().toISOString()},{merge:true});
  b.set(doc(db,'subeler',sid,'aylar',ak),{durum:'taslak'},{merge:true});b.commit().then(()=>toast('Kilit açıldı, ay yeniden düzenlenebilir.')).catch(yazmaHatasi);}
function geriGonderPanel(){openSheet(`<h2>Şubeye geri gönder</h2><div class="sub">Şube müdürü notu görür, düzeltip ayı yeniden kapatır.</div><label class="field"><span>Not</span><textarea id="gNot" rows="3" placeholder="Örn: Ali'nin 14 Ekim raporu eksik"></textarea></label>
  <div class="row2"><button class="btn grow" id="gNo">Vazgeç</button><button class="btn danger grow" id="gOk">Geri gönder</button></div>`,()=>{byId('gNo').onclick=closeSheet;
  byId('gOk').onclick=()=>{const not=byId('gNot').value.trim();sirayla('ay'+S.ay,()=>setDoc(doc(db,'subeler',S.subeId,'aylar',S.ay),{durum:'geri',not,geriGonderen:S.user.uid,geriTarih:new Date().toISOString()},{merge:true}));closeSheet();toast('Şubeye geri gönderildi.');};});}
function odemePanel(pid){const V=ptVerisi();const x=V.satir.find(s=>s.pid===pid);if(!x)return;const s=x.sag;const esnaf=x.hes.esnaf;const tc=(S.pt.maas&&S.pt.maas.tc&&S.pt.maas.tc[pid])||'';
  const inp=(id,label,val,ph='')=>`<label class="field"><span>${label}</span><input id="${id}" inputmode="decimal" value="${val??''}" placeholder="${ph}"></label>`;
  openSheet(`<h2>${esc(x.sol.ad)}</h2><div class="sub">${ayAdi(V.ak)} · ${esc(x.sol.sekil)} · ${esnaf?'paket başı':x.sol.gun+' bordro günü'}${x.sol.fmSaat&&!esnaf?' · FM '+sg(x.sol.fmSaat)+' sa':''}</div>
   <div class="fgrid">${esnaf?inp('oPs','Paket sayısı',s.paketSayisi)+inp('oPu','Paket başı ücret (₺)',s.paketUcret,String(V.sb.paketUcret||'')):x.hes.maasYok?'<p class="note" style="grid-column:1/-1">Maaşı SGK şubesinin puantajında. Burada sadece bu şubede yaptığı fazla mesai ve buraya ait primler hesaplanır.</p>':inp('oNet','Anlaşılan aylık net (₺)',x.net,'örn. 50000')}
   ${inp('oBank','Bankaya yatan (₺)',s.bankaya,'bordrodan')}${inp('oPaket','Paket primi (₺)',s.paketPrimi)}${inp('oCiro','Ciro primi (₺)',s.ciroPrimi)}${inp('oAvans','Avans / ara ödeme (₺)',s.avans)}
   <label class="field"><span>TC kimlik no (bordro eşleşmesi için)</span><input id="oTc" inputmode="numeric" maxlength="11" value="${esc(tc)}"></label></div>
   <div class="calc" id="oCalc"></div><div id="oErr"></div><div class="row2"><button class="btn grow" id="oNo">Vazgeç</button><button class="btn primary grow" id="oOk">Kaydet</button></div>`,sh=>{
   const oku=()=>{const v=id=>{const e=byId(id);return e?e.value.trim():undefined;};const o={bankaya:v('oBank'),paketPrimi:v('oPaket'),ciroPrimi:v('oCiro'),avans:v('oAvans')};if(esnaf){o.paketSayisi=v('oPs');o.paketUcret=v('oPu');}return o;};
   const calc=()=>{const o=oku();const n=esnaf?0:byId('oNet')?sayi(byId('oNet').value):sayi(x.net);const r=sagHesap(pid,x.sol,o,n,V.sb,x.hes.devir);
     byId('oCalc').innerHTML=`${esnaf?`<div><span>Paket hak edişi</span><b>${tl(r.paketHak)}</b></div>`:`<div><span>Hak edilen (net × ${x.sol.gun}/30)</span><b>${tl(r.hak)}</b></div>`}<div><span>− Bankaya yatan</span><b>${tl(r.bankaya)}</b></div><div><span>= Maaş farkı</span><b>${tl(r.maasFarki)}</b></div>
       ${r.fmTl?`<div><span>+ Fazla mesai</span><b>${tl(r.fmTl)}</b></div>`:''}${r.paketPrimi?`<div><span>+ Paket primi</span><b>${tl(r.paketPrimi)}</b></div>`:''}${r.ciroPrimi?`<div><span>+ Ciro primi</span><b>${tl(r.ciroPrimi)}</b></div>`:''}${r.devir?`<div><span>+ Geçen aydan devir</span><b class="neg">${tl(r.devir)}</b></div>`:''}${r.avans?`<div><span>− Avans</span><b>${tl(r.avans)}</b></div>`:''}
       <div style="border-top:1px solid var(--line);margin-top:4px;padding-top:4px"><span>Kalan ödeme</span><b class="${r.kalan<0?'neg':'pos'}">${tl(r.kalan)}</b></div>${r.kalan<0?'<div><span class="note" style="margin:0">Eksi tutar sonraki ayın ödemesinden düşülür.</span></div>':''}`;};
   sh.querySelectorAll('input').forEach(i=>i.oninput=calc);calc();byId('oNo').onclick=closeSheet;
   byId('oOk').onclick=async()=>{const o=oku();const tcv=byId('oTc').value.replace(/\D/g,'');if(tcv&&tcv.length!==11){byId('oErr').innerHTML='<div class="confirm">TC kimlik no 11 haneli olmalı.</div>';return;}
     const sid=S.subeId,ak=V.ak;const sag=sagSonuclu(V,{[pid]:o});
     try{const netEl=byId('oNet');if((!esnaf&&netEl)||tcv!==tc){const m={};if(!esnaf&&netEl)m.net={[pid]:sayi(netEl.value)||null};if(tcv!==tc)m.tc={[pid]:tcv||null};
         if(!esnaf&&netEl){S.pt.maas={...S.pt.maas,net:{...((S.pt.maas||{}).net||{}),[pid]:m.net[pid]}};}await setDoc(doc(db,'maaslar',sid),m,{merge:true});}
       const sag2=sagSonuclu({...V,D:{...V.D,sag}});
       await setDoc(doc(db,'puantaj',sid,'aylar',ak),V.kilitli?{sag:sag2,guncellendi:new Date().toISOString()}:{sube:sid,ay:ak,sag:sag2,guncellendi:new Date().toISOString()},{merge:true});closeSheet();toast('Ödeme bilgileri kaydedildi.');}
     catch(e){yazmaHatasi(e);}};});}

/* ================= Muhasebe çıktısı ================= */
function muhasebeCiktisi(V){const w=window.open('','_blank');if(!w){toast('Açılır pencere engellendi. Tarayıcıda izin verin.');return;}const ay=AY[+V.ak.slice(5)-1].toLocaleUpperCase('tr-TR');
  const rows=V.satir.filter(x=>x.sol.sekil!=='Yarı esnaf'&&x.sol.maasBurada!==false).map(({sol})=>`<tr class="${sol.cikis?'c':''}"><td>${esc(sol.sgkSube.toLocaleUpperCase('tr-TR'))}</td><td class="ad">${esc(sol.ad.toLocaleUpperCase('tr-TR'))}</td><td>${trTarih(sol.giris)}</td><td>${trTarih(sol.cikis)}</td><td>${sol.rapor||''}</td><td>${sol.ucretsiz||''}</td><td>${sol.partGun?fmt(sol.partGun):''}</td><td>${sol.yillik||''}</td><td>${sol.bayram||''}</td></tr>`).join('');
  w.document.write(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${esc(V.sb.ad)} ${ay} ${V.ak.slice(0,4)} Puantaj</title><style>
   body{font-family:Calibri,Arial,sans-serif;margin:24px;color:#000}.ay{display:inline-block;border:1.5px solid #000;background:#ffd84d;font-weight:700;padding:4px 22px;margin-bottom:10px}
   table{border-collapse:collapse;width:100%;font-size:11px}th{background:#1aa3e8;color:#fff;border:1px solid #fff;padding:6px 4px;font-weight:700}td{border:1px solid #9ab;padding:3px 4px;text-align:center}
   td.ad{font-weight:700}tr:nth-child(even) td{background:#e8eef6}tr.c td{background:linear-gradient(#fff3a6,#ffd34d)!important}@page{size:A4;margin:12mm}@media print{.bar{display:none}}
   .bar{margin-bottom:12px}.bar button{font-size:14px;padding:8px 14px}</style></head><body><div class="bar"><button onclick="print()">Yazdır / PDF olarak kaydet</button></div>
   <div class="ay">${ay}</div><table><thead><tr><th>SGK ŞUBE</th><th>ADI - SOYADI</th><th>GİRİŞ TARİHİ</th><th>ÇIKIŞ TARİHİ</th><th>RAPOR</th><th>ÜCRETSİZ İZİN</th><th>PART TİME GÜN</th><th>YILLIK İZİN</th><th>BAYRAM</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);w.document.close();}

/* ================= Bordro PDF okuma ================= */
let pdfjsYuklendi=null;function pdfjs(){if(pdfjsYuklendi)return pdfjsYuklendi;pdfjsYuklendi=new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  s.onload=()=>{window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';ok(window.pdfjsLib);};s.onerror=no;document.head.appendChild(s);});return pdfjsYuklendi;}
async function pdfSatirlari(file){const lib=await pdfjs();const pdf=await lib.getDocument({data:await file.arrayBuffer()}).promise;const lines=[];
  for(let p=1;p<=pdf.numPages;p++){const page=await pdf.getPage(p);const tc=await page.getTextContent();const rows=[];
    tc.items.forEach(it=>{if(!it.str.trim())return;const y=it.transform[5],x=it.transform[4];let r=rows.find(r=>Math.abs(r.y-y)<2.5);if(!r){r={y,items:[]};rows.push(r);}r.items.push({x,s:it.str});});
    rows.sort((a,b)=>b.y-a.y).forEach(r=>lines.push(r.items.sort((a,b)=>a.x-b.x).map(i=>i.s).join('  ')));}
  return lines;}
function bordroCoz(lines){const para=/-?\d{1,3}(?:\.\d{3})*,\d{2}/g;const out={isyeri:null,donem:null,kisiler:[],toplam:null};
  lines.forEach((l,i)=>{let m;if(!out.isyeri&&(m=l.match(/İşyeri\s+Adı\s+(.+)/)))out.isyeri=m[1].replace(/\s+/g,' ').trim();if(!out.donem&&(m=l.match(/Ay\s*\/\s*Yıl\s+([A-ZÇĞİÖŞÜ]+)\s*\/\s*(\d{4})/)))out.donem=m[1]+' '+m[2];
    if((m=l.match(/^\s*(\d+)\s+(.+?)\s+(\d{11})\s+(\d{2}\.\d{2}\.\d{4})(.*)$/))){const rest=m[5];const nums=rest.match(para)||[];const g=rest.match(/(\d[\d.]*,\d{2})\s*([GS])\s+(\d+)/);
      const eksik=rest.match(/(\d+)\s+Gün/);const nxt=(lines[i+1]||'').trim();const neden=eksik&&/İzin|Rapor|Devamsız|Diğer/i.test(nxt)?nxt.replace(/\s+/g,' '):'';
      out.kisiler.push({ad:m[2].replace(/\s+/g,' ').trim(),tc:m[3],giris:m[4],sgkGun:g?+g[3]:null,eksikGun:eksik?+eksik[1]:0,neden,net:nums.length?sayi(nums[nums.length-1]):null});}
    if((m=l.match(/Toplamlar:/))){const nums=l.match(para)||[];if(nums.length)out.toplam=sayi(nums[nums.length-1]);}});
  return out;}
function bordroPanel(V){openSheet(`<h2>Bordro PDF yükle</h2><div class="sub">${esc(V.sb.ad)} · ${ayAdi(V.ak)}. Net ödenen tutarlar "bankaya yatan" olarak işlenir.</div>
  <label class="field"><span>Bordro PDF dosyası</span><input id="bF" type="file" accept="application/pdf"></label><div id="bOut"></div>`,()=>{
  byId('bF').onchange=async e=>{const f=e.target.files[0];if(!f)return;const O=byId('bOut');O.innerHTML='<p class="note">PDF okunuyor…</p>';
    let r;try{r=bordroCoz(await pdfSatirlari(f));}catch(err){O.innerHTML='<div class="confirm bad">PDF okunamadı. Taranmış (resim) PDF olabilir; muhasebeden metin içeren PDF isteyin.</div>';return;}
    if(!r.kisiler.length){O.innerHTML='<div class="confirm bad">PDF\'te bordro satırı bulunamadı. Format farklı olabilir.</div>';return;}
    const tcMap=(S.pt.maas&&S.pt.maas.tc)||{};const ids=Object.keys(V.sol);
    const eslesme=r.kisiler.map(k=>{let pid=ids.find(id=>isimAnahtar(V.sol[id].ad)===isimAnahtar(k.ad));let yol='isim';
      if(!pid){pid=ids.find(id=>tcMap[id]&&tcMap[id]===k.tc);yol=pid?'tc':null;}return{...k,pid,yol};});
    const top=r.kisiler.reduce((s,k)=>s+(k.net||0),0);const ok=r.toplam==null||Math.abs(top-r.toplam)<0.05;
    const subeUyar=r.isyeri&&!isimAnahtar(r.isyeri).includes(isimAnahtar(V.sb.ad));
    O.innerHTML=`<div class="tags" style="margin:6px 0 10px"><span class="tag">${esc(r.isyeri||'İşyeri okunamadı')}</span><span class="tag">${esc(r.donem||'')}</span><span class="tag ${ok?'':'warn'}">${r.kisiler.length} kişi · ${tl(top)} ₺ ${ok?'✓ PDF toplamıyla aynı':'⚠ PDF toplamı '+tl(r.toplam)}</span></div>
     ${subeUyar?`<div class="confirm">Bordrodaki işyeri adı "${esc(r.isyeri)}", seçili şube "${esc(V.sb.ad)}". Doğru dosya olduğundan emin olun.</div>`:''}
     <div class="tbl-wrap"><table class="pt"><thead><tr><th class="l">Bordrodaki isim</th><th class="l">Personel</th><th>SGK gün</th><th>Puantaj gün</th><th>Net ödenen</th></tr></thead><tbody>
     ${eslesme.map((k,j)=>{const sol=k.pid&&V.sol[k.pid];const fark=sol&&k.sgkGun!=null&&sol.gun!==k.sgkGun;
       return `<tr><td class="l">${esc(k.ad)}${k.neden?`<br><span class="tag">${k.eksikGun} gün ${esc(k.neden)}</span>`:''}</td><td class="l"><select data-j="${j}" style="max-width:170px">${'<option value="">— eşleşmedi —</option>'+ids.map(id=>`<option value="${esc(id)}" ${id===k.pid?'selected':''}>${esc(V.sol[id].ad)}</option>`).join('')}</select>
         ${k.yol==='tc'?'<br><span class="tag warn">İsim tutmadı, TC ile eşleşti</span>':''}</td><td>${k.sgkGun??''}</td><td>${sol?sol.gun:''}${fark?' <span class="tag warn">gün farkı</span>':''}</td><td><b>${tl(k.net)}</b></td></tr>`;}).join('')}</tbody></table></div>
     <div class="row2"><button class="btn grow" id="bNo">Vazgeç</button><button class="btn primary grow" id="bOk">Bankaya yatanları işle</button></div>`;
    byId('bNo').onclick=closeSheet;O.querySelectorAll('select').forEach(s=>s.onchange=()=>{eslesme[+s.dataset.j].pid=s.value||null;eslesme[+s.dataset.j].yol=s.value?'elle':null;});
    byId('bOk').onclick=async()=>{const deg={},tcYeni={};eslesme.forEach(k=>{if(!k.pid)return;deg[k.pid]={bankaya:k.net};if(!tcMap[k.pid])tcYeni[k.pid]=k.tc;});
      const n=Object.keys(deg).length;if(!n){toast('Eşleşen personel yok.');return;}
      try{if(Object.keys(tcYeni).length)await setDoc(doc(db,'maaslar',S.subeId),{tc:tcYeni},{merge:true});
        const sag=sagSonuclu(V,deg);await setDoc(doc(db,'puantaj',S.subeId,'aylar',V.ak),V.kilitli?{sag,guncellendi:new Date().toISOString()}:{sube:S.subeId,ay:V.ak,sag,guncellendi:new Date().toISOString()},{merge:true});
        closeSheet();toast(`${n} kişinin bankaya yatan tutarı işlendi.`);}catch(e){yazmaHatasi(e);}};};});}

/* ================= Paylaş (görsel) ================= */
async function cizelgeGorseli(withFm){const sb=sube();const wid=S.hafta;const ds=weekDays(wid);const ak=gosterAy(wid);const kisiler=cizelgeKisileri(wid);
  try{await document.fonts.ready;}catch(e){}
  const C={navy:'#1f3a6b',ink:'#152033',mut:'#667287',line:'#d9dee8',open:'#fbe58a',openI:'#4a3a00',close:'#f0b24d',closeI:'#3c2500',code:'#e9edf3',codeI:'#33415a',bg:'#ffffff',soft:'#f3f5f9'};
  const pad=28,nameW=240,dayW=150,fmW=withFm?96:0,rowH=42,groupH=34,headH=92,dayH=50;const groups=new Set(kisiler.map(p=>p.grup||'K'));
  const W=pad*2+nameW+dayW*7+fmW*2,H=headH+dayH+kisiler.length*rowH+groups.size*groupH+70;const cv=document.createElement('canvas');cv.width=W*2;cv.height=H*2;const x=cv.getContext('2d');x.scale(2,2);
  const F=(w,s,n)=>`${w} ${s}px ${n?'"Barlow Semi Condensed","Arial Narrow",sans-serif':'Figtree,system-ui,sans-serif'}`;
  const rr=(X,Y,w,h,r,fill)=>{x.beginPath();x.roundRect?x.roundRect(X,Y,w,h,r):x.rect(X,Y,w,h);x.fillStyle=fill;x.fill();};
  x.fillStyle=C.bg;x.fillRect(0,0,W,H);x.fillStyle=C.navy;x.fillRect(0,0,W,headH-14);x.fillStyle='#fff';x.textBaseline='middle';x.font=F(800,28);x.fillText(`${sb.ad} · Haftalık çizelge`,pad,30);
  x.font=F(600,16);x.globalAlpha=.8;x.fillText(`${rangeLabel(wid)}  ·  Açılış ${sb.acilis}  ·  Kapanış ${sb.kapanis}`,pad,58);x.globalAlpha=1;let y=headH;x.textAlign='center';
  ds.forEach((d,i)=>{const X=pad+nameW+i*dayW;rr(X+3,y,dayW-6,dayH-8,8,C.soft);x.fillStyle=C.ink;x.font=F(800,15);x.fillText(GUNU[i].toLocaleUpperCase('tr-TR'),X+dayW/2,y+15);x.fillStyle=C.mut;x.font=F(600,13);x.fillText(`${d.getDate()} ${AY[d.getMonth()]}`,X+dayW/2,y+32);});
  if(withFm)['Hafta FM',`${AYK[+ak.slice(5)-1]} FM`].forEach((t,j)=>{const X=pad+nameW+7*dayW+j*fmW;rr(X+3,y,fmW-6,dayH-8,8,C.soft);x.fillStyle=C.ink;x.font=F(800,14);x.fillText(t,X+fmW/2,y+(dayH-8)/2);});
  y+=dayH;let son=null;
  kisiler.forEach(p=>{const g=p.grup||'K';if(g!==son){son=g;x.textAlign='left';x.fillStyle=C.navy;x.font=F(800,14);x.fillText(GRUP[g].toLocaleUpperCase('tr-TR'),pad+2,y+groupH/2+2);x.fillStyle=C.line;x.fillRect(pad+90,y+groupH/2+2,W-pad*2-90,1);y+=groupH;}
    x.textAlign='left';x.fillStyle=C.ink;x.font=F(700,16);x.fillText(p.ad.toLocaleUpperCase('tr-TR'),pad+2,y+rowH/2,nameW-10);x.textAlign='center';
    ds.forEach((d,i)=>{const X=pad+nameW+i*dayW+3,Y=y+3,w=dayW-6,hh=rowH-6;if(!employed(p,d)){x.fillStyle=C.mut;x.font=F(600,15);x.fillText('—',X+w/2,Y+hh/2);return;}const v=cellOf(p.id,wid,i);
      if(isShift(v)){const k=shiftKind(v,sb);const[a,b]=v.split('-');const hw=(w-4)/2;rr(X,Y,hw,hh,7,k.o?C.open:C.soft);rr(X+hw+4,Y,hw,hh,7,k.k?C.close:C.soft);x.font=F(700,18,1);x.fillStyle=k.o?C.openI:C.ink;x.fillText(a,X+hw/2,Y+hh/2+1);x.fillStyle=k.k?C.closeI:C.ink;x.fillText(b,X+hw+4+hw/2,Y+hh/2+1);}
      else if(v&&KOD[v]){rr(X,Y,w,hh,7,v==='HT'?C.navy:C.code);x.fillStyle=v==='HT'?'#fff':C.codeI;x.font=F(800,13);x.fillText(KOD[v].ad.toLocaleUpperCase('tr-TR'),X+w/2,Y+hh/2+1);}
      else{x.strokeStyle=C.line;x.setLineDash([4,4]);x.beginPath();x.roundRect?x.roundRect(X+.5,Y+.5,w-1,hh-1,7):x.rect(X,Y,w,hh);x.stroke();x.setLineDash([]);}});
    if(withFm){const wk=haftaHesap(p,wid,sb),ay=ayHesap(p,ak,sb);const vals=isEsnaf(p)?['esnaf',fmt(ay.h)+' sa']:p.sekil==='Part'?['part',fmt(ay.partGun)+' gün']:[sg(wk.fm),sg(ay.fm)];vals.forEach((t,j)=>{x.fillStyle=C.ink;x.font=F(700,17,1);x.fillText(t,pad+nameW+7*dayW+j*fmW+fmW/2,y+rowH/2+1);});}
    y+=rowH;});
  x.textAlign='left';x.font=F(600,12.5);let lx=pad;y+=22;[[C.open,'Açılış saati'],[C.close,'Kapanış saati'],[C.navy,'Haftalık izin']].forEach(([c,t])=>{rr(lx,y-7,14,14,3,c);x.fillStyle=C.mut;x.fillText(t,lx+20,y);lx+=x.measureText(t).width+44;});
  return cv;}
function paylas(){let fm=tryLS('pm.shareFm')!=='0';
  openSheet(`<h2>Çizelgeyi paylaş</h2><div class="sub">${esc(sube().ad)} · ${rangeLabel(S.hafta)}. Görseli paylaşın ya da kaydedip WhatsApp grubuna gönderin.</div>
   <label class="check"><input type="checkbox" id="shFm" ${fm?'checked':''}> Fazla mesai sütunlarını ekle</label><img class="share-prev" id="shImg" alt="Çizelge görseli">
   <div class="row2"><button class="btn grow" id="shNo">Kapat</button><button class="btn grow" id="shSave">Kaydet</button><button class="btn primary grow" id="shShare">Paylaş</button></div>`,async()=>{let blob=null;
   const yap=async()=>{const cv=await cizelgeGorseli(byId('shFm').checked);blob=await new Promise(r=>cv.toBlob(r,'image/png'));const img=byId('shImg');if(img.src)URL.revokeObjectURL(img.src);img.src=URL.createObjectURL(blob);};
   byId('shFm').onchange=e=>{tryLS('pm.shareFm',e.target.checked?'1':'0');yap();};byId('shNo').onclick=closeSheet;
   const ad=`${slug(sube().ad)}-cizelge-${S.hafta}.png`;
   byId('shSave').onclick=()=>{if(!blob)return;const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=ad;a.click();};
   const shb=byId('shShare');if(!navigator.canShare)shb.hidden=true;
   shb.onclick=async()=>{if(!blob)return;const file=new File([blob],ad,{type:'image/png'});try{if(navigator.canShare({files:[file]}))await navigator.share({files:[file],title:'Haftalık çizelge'});else toast('Bu cihaz görsel paylaşmayı desteklemiyor, Kaydet\'i kullanın.');}catch(e){}};
   await yap();});}

/* ================= Yönetim (işveren) ================= */
function renderYonetim(){if(!isIsveren())return;const bolum=S.ynt||'subeler';
  let h=`<div class="seg" style="margin:4px 0 12px" id="ySeg"><button data-v="subeler" class="${bolum==='subeler'?'on':''}">Şubeler</button><button data-v="kullanicilar" class="${bolum==='kullanicilar'?'on':''}">Kullanıcılar</button></div>`;
  if(bolum==='subeler'){h+=`<div class="actions"><button class="btn primary grow" id="ySubeEkle">Şube ekle</button></div>`;
    h+=S.subeIds.length?`<div class="card list">${S.subeIds.map(id=>{const s=sube(id);return `<button class="row" data-sid="${esc(id)}"><div class="av">${esc(bas(s.ad))}</div><div class="m"><b>${esc(s.ad)}</b><span>${esc(s.acilis)}–${esc(s.kapanis)} · günlük ${fmt(s.gunluk)} sa · FM ${s.fmYontem==='maas'?'maaş ÷ 30 ÷ 9':tl0(s.fmUcret)+'/sa'}</span></div></button>`;}).join('')}</div>`:`<div class="empty-state"><b>Henüz şube yok</b>İlk şubeyi ekleyin.</div>`;}
  else{h+=`<div class="actions"><button class="btn primary grow" id="yKulEkle">Kullanıcı ekle</button></div>`;
    const us=S.users.slice().sort((a,b)=>['isveren','bolge','sube'].indexOf(a.rol)-['isveren','bolge','sube'].indexOf(b.rol)||String(a.adSoyad).localeCompare(String(b.adSoyad),'tr'));
    h+=`<div class="card list">${us.map(u=>`<button class="row" data-uid="${esc(u.uid)}"><div class="av">${esc(bas(u.adSoyad||u.kullaniciAdi))}</div><div class="m"><b>${esc(u.adSoyad||u.kullaniciAdi)}</b><span>${esc(u.kullaniciAdi)} · ${u.rol==='isveren'?'Tüm şubeler':(u.subeler||[]).map(s=>S.subeler[s]?S.subeler[s].ad:s).join(', ')||'Şube atanmamış'}</span></div>
      <span class="chip ${u.aktif===false?'mut':u.rol==='isveren'?'warn':u.rol==='bolge'?'ok':'mut'}">${u.aktif===false?'Kapalı':ROL[u.rol]||u.rol}</span></button>`).join('')}</div>`;}
  view(h,()=>{document.querySelectorAll('#ySeg button').forEach(b=>b.onclick=()=>{S.ynt=b.dataset.v;render();});
    const se=byId('ySubeEkle');if(se)se.onclick=()=>subePanel(null);document.querySelectorAll('[data-sid]').forEach(b=>b.onclick=()=>subePanel(b.dataset.sid));
    const ke=byId('yKulEkle');if(ke)ke.onclick=()=>kullaniciPanel(null);document.querySelectorAll('[data-uid]').forEach(b=>b.onclick=()=>kullaniciPanel(b.dataset.uid));});}
function subePanel(id){const s=id?sube(id):{...VARSAYILAN,ad:''};
  openSheet(`<h2>${id?'Şube ayarları':'Yeni şube'}</h2><div class="sub">Vardiya renkleri ve fazla mesai bu ayarlara göre hesaplanır.</div>
   <label class="field"><span>Şube adı</span><input id="sAd" value="${esc(s.ad)}" placeholder="Altınkale"></label>
   <div class="fgrid"><label class="field"><span>Açılış</span><input id="sAc" inputmode="numeric" value="${esc(s.acilis)}"></label><label class="field"><span>Kapanış</span><input id="sKa" inputmode="numeric" value="${esc(s.kapanis)}"></label>
   <label class="field"><span>Günlük mesai (sa)</span><input id="sGu" inputmode="decimal" value="${s.gunluk}"></label><label class="field"><span>Haftalık mesai (sa)</span><input id="sHa" inputmode="decimal" value="${s.haftalik}"></label>
   <label class="field"><span>Part günü (sa)</span><input id="sPa" inputmode="decimal" value="${s.partSaat}"></label><label class="field"><span>Kurye paket başı ücret (₺)</span><input id="sPk" inputmode="decimal" value="${s.paketUcret||''}"></label></div>
   <span class="lbl">Fazla mesai ücreti</span><div class="seg" id="sYon"><button data-v="sabit" class="${s.fmYontem!=='maas'?'on':''}">Sabit saat ücreti</button><button data-v="maas" class="${s.fmYontem==='maas'?'on':''}">Maaş ÷ 30 ÷ 9</button></div>
   <label class="field" id="sUcW"><span>Saat ücreti (₺)</span><input id="sUc" inputmode="decimal" value="${s.fmUcret}"></label><div id="sErr"></div>
   <div class="row2"><button class="btn grow" id="sNo">Vazgeç</button><button class="btn primary grow" id="sOk">Kaydet</button></div>
   ${id?`<div class="row2"><button class="btn grow" id="sX">Excel'den çizelge aktar</button></div>`:''}`,sh=>{
   const sx=byId('sX');if(sx)sx.onclick=()=>{closeSheet();if(S.subeId!==id)selectSube(id);const bekle=()=>{if(S.subeId===id&&S.loaded.personel)excelAktarPanel(id);else setTimeout(bekle,150);};bekle();};
   const yb=sh.querySelectorAll('#sYon button');const tog=()=>byId('sUcW').hidden=sh.querySelector('#sYon .on').dataset.v==='maas';yb.forEach(b=>b.onclick=()=>{yb.forEach(x=>x.classList.remove('on'));b.classList.add('on');tog();});tog();
   byId('sNo').onclick=closeSheet;byId('sOk').onclick=()=>{const ad=byId('sAd').value.trim(),ac=normTime(byId('sAc').value),ka=normTime(byId('sKa').value);
     if(!ad||!ac||!ka){byId('sErr').innerHTML='<div class="confirm">Şube adı, açılış ve kapanış saati gerekli (örn. 11:00 ve 00:30).</div>';return;}
     const gu=sayi(byId('sGu').value),ha=sayi(byId('sHa').value);if(!(gu>0&&gu<=16)||!(ha>0&&ha<=100)){byId('sErr').innerHTML='<div class="confirm">Günlük mesai 1–16 saat, haftalık mesai 1–100 saat arasında olmalı (örn. 8,5 ve 51).</div>';return;}
     const sid=id||slug(ad);if(!id&&S.subeler[sid]){byId('sErr').innerHTML='<div class="confirm">Bu isimde bir şube var.</div>';return;}
     const body={ad,acilis:ac,kapanis:ka,gunluk:sayi(byId('sGu').value)||8.5,haftalik:sayi(byId('sHa').value)||51,partSaat:sayi(byId('sPa').value)||8,paketUcret:sayi(byId('sPk').value),fmYontem:sh.querySelector('#sYon .on').dataset.v,fmUcret:sayi(byId('sUc').value)};
     sirayla('s'+sid,()=>setDoc(doc(db,'subeler',sid),body,{merge:true}));closeSheet();toast(id?'Şube ayarları kaydedildi.':`${ad} şubesi eklendi.`);};});}
/* ================= Excel'den çizelge aktarma (işveren) ================= */
let xlsxYuklendi=null;function xlsxLib(){if(xlsxYuklendi)return xlsxYuklendi;xlsxYuklendi=new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';s.onload=()=>ok(window.XLSX);s.onerror=no;document.head.appendChild(s);});return xlsxYuklendi;}
const XKOD={'HAF. İZİN':'HT','HAF.İZİN':'HT','HAFTALIK İZİN':'HT','HAFTA TATİLİ':'HT','İZİN':'HT','ÜCR. İZİN':'UI','ÜCR.İZİN':'UI','ÜCRETSİZ İZİN':'UI','YILLIK İZİN':'YI','YILLIK':'YI','RAPOR':'R','RAPORLU':'R','BAYRAM':'B','DİĞER':'D'};
function xSerialTarih(v){if(typeof v!=='number'||v<20000)return null;const d=new Date(Date.UTC(1899,11,30)+Math.round(v)*86400000);return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')+'-'+String(d.getUTCDate()).padStart(2,'0');}
function xSaat(v){if(typeof v==='number'){if(v>=1)v=v%1;const m=Math.round(v*1440)%1440;return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');}if(typeof v==='string')return normTime(v);return null;}
function xTarihMetin(v){if(typeof v==='number')return xSerialTarih(v);if(typeof v!=='string')return'';const m=v.trim().match(/^(\d{1,2})[.,/](\d{1,2})[.,/](\d{4})$/);return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:'';}
function xAd(s){return String(s||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('tr-TR').split(' ').map(w=>w?w[0].toLocaleUpperCase('tr-TR')+w.slice(1):w).join(' ');}
function xSekil(s){s=String(s||'').toLocaleUpperCase('tr-TR');return s.includes('PART')?'Part':s.includes('YARI')?'Yarı esnaf':s.includes('ESNAF')?'Esnaf kurye':'Tam';}
function excelCoz(X,wb){const val=(ws,r,c)=>{const x=ws[X.utils.encode_cell({r,c})];return x?x.v:null;};const sayfalar=[];let liste=null;
  wb.SheetNames.forEach(name=>{const ws=wb.Sheets[name];if(!ws['!ref'])return;const R=X.utils.decode_range(ws['!ref']);const maxR=Math.min(R.e.r,400);
    // Personel listesi sayfası
    for(let r=0;r<=Math.min(maxR,12);r++)for(let c=0;c<=Math.min(R.e.c,20);c++){if(String(val(ws,r,c)||'').trim().toLocaleUpperCase('tr-TR')==='ADI SOYADI'){
      const hdr={};for(let cc=c;cc<=Math.min(R.e.c,c+12);cc++)hdr[String(val(ws,r,cc)||'').trim().toLocaleUpperCase('tr-TR')]=cc;
      if(hdr['GİRİŞ TARİHİ']!=null&&!liste){liste={};for(let rr=r+1;rr<=maxR;rr++){const ad=val(ws,rr,c);if(!ad||typeof ad!=='string')continue;
        liste[isimAnahtar(ad)]={sekil:hdr['ÇALIŞMA ŞEKLİ']!=null?xSekil(val(ws,rr,hdr['ÇALIŞMA ŞEKLİ'])):null,giris:xTarihMetin(val(ws,rr,hdr['GİRİŞ TARİHİ'])),cikis:hdr['ÇIKIŞ TARİHİ']!=null?xTarihMetin(val(ws,rr,hdr['ÇIKIŞ TARİHİ'])):''};}}}}
    // Çizelge sayfası: A sütununda "N. HAFTA", bir alt satırda C,E,G… tarihler, altında isimler
    const hafta=[];for(let r=0;r<=maxR;r++){const a=String(val(ws,r,0)||'').toLocaleUpperCase('tr-TR');if(!/HAFTA/.test(a))continue;const mon=xSerialTarih(val(ws,r+1,2));if(!mon)continue;
      const kisiler={};for(let rr=r+2;rr<=Math.min(maxR,r+26);rr++){const a2=String(val(ws,rr,0)||'').toLocaleUpperCase('tr-TR');if(/HAFTA/.test(a2))break;const ad=val(ws,rr,1);if(!ad||typeof ad!=='string'||!ad.trim())continue;
        const key=isimAnahtar(ad);const row=kisiler[key]||(kisiler[key]={ad:xAd(ad),gun:{}});
        for(let k=0;k<7;k++){const s=val(ws,rr,2+2*k),e=val(ws,rr,3+2*k);let v=null;
          if(typeof s==='string'&&!normTime(s)){v=XKOD[s.trim().toLocaleUpperCase('tr-TR').replace(/\s+/g,' ')]||null;}
          else{const a1=xSaat(s),b1=xSaat(e);if(a1&&b1)v=a1+'-'+b1;}
          if(v==null)continue;if(row.gun[k]&&row.gun[k]!=='D'&&v==='D')continue;row.gun[k]=v;}}
      if(Object.keys(kisiler).length)hafta.push({mon,kisiler});}
    if(hafta.length)sayfalar.push({name,hafta,ilk:hafta[0].mon,son:hafta[hafta.length-1].mon});});
  return{sayfalar,liste};}
function excelAktarPanel(sid){const sb=sube(sid);
  openSheet(`<h2>Excel'den çizelge aktar</h2><div class="sub">${esc(sb.ad)} · Mevcut MESAİ ÇİZELGESİ dosyanızı seçin. Personel listesi sayfası varsa giriş/çıkış tarihleri de alınır.</div>
   <label class="field"><span>Excel dosyası (.xlsx)</span><input id="xF" type="file" accept=".xlsx,.xlsm,.xls"></label><div id="xOut"></div>`,()=>{
   byId('xF').onchange=async e=>{const f=e.target.files[0];if(!f)return;const O=byId('xOut');O.innerHTML='<p class="note">Dosya okunuyor…</p>';let X,P;
     try{X=await xlsxLib();P=excelCoz(X,X.read(await f.arrayBuffer(),{type:'array'}));}catch(err){O.innerHTML='<div class="confirm bad">Dosya okunamadı.</div>';return;}
     if(!P.sayfalar.length){O.innerHTML='<div class="confirm bad">Bu dosyada çizelge sayfası bulunamadı.</div>';return;}
     const sirali=P.sayfalar.slice().sort((a,b)=>a.ilk.localeCompare(b.ilk));const son2=sirali.slice(-2).map(s=>s.name);
     O.innerHTML=`<span class="lbl">Aktarılacak aylar (sayfalar)</span><div class="card list">${sirali.map(s=>`<label class="row"><input type="checkbox" value="${esc(s.name)}" ${son2.includes(s.name)?'checked':''} style="width:20px;height:20px"><div class="m"><b>${esc(s.name)}</b><span>${trTarih(s.ilk)} – ${trTarih(ymd(addDays(parse(s.son),6)))} · ${s.hafta.length} hafta</span></div></label>`).join('')}</div>
      <div class="row2"><button class="btn primary grow" id="xOn">Devam</button></div><div id="xOn2"></div>`;
     byId('xOn').onclick=()=>{const sec=[...O.querySelectorAll('input[type=checkbox]:checked')].map(i=>i.value);if(!sec.length){toast('En az bir sayfa seçin.');return;}
       const haftalar={};sirali.filter(s=>sec.includes(s.name)).forEach(s=>s.hafta.forEach(h=>{const w=haftalar[h.mon]||(haftalar[h.mon]={});Object.entries(h.kisiler).forEach(([k,v])=>{w[k]={ad:v.ad,gun:{...((w[k]||{}).gun||{}),...v.gun}};});}));
       const kisi={};Object.values(haftalar).forEach(w=>Object.entries(w).forEach(([k,v])=>{if(!kisi[k])kisi[k]={ad:v.ad,vardiya:0};kisi[k].vardiya+=Object.keys(v.gun).length;}));
       const mevcut={};S.personel.forEach(p=>mevcut[isimAnahtar(p.ad)]=p);
       const keys=Object.keys(kisi).sort((a,b)=>kisi[a].ad.localeCompare(kisi[b].ad,'tr'));
       byId('xOn2').innerHTML=`<span class="lbl">Personel · ${keys.length} kişi</span><p class="note" style="margin:0 0 8px">Yeni kişilerin görevini ve SGK şubesini seçin. Mevcut personel aynen kalır.</p>
        <div class="tbl-wrap"><table class="pt"><thead><tr><th class="l">İsim</th><th>Durum</th><th>Görev</th><th>SGK şubesi</th><th>Giriş</th><th>Çıkış</th></tr></thead><tbody>${keys.map(k=>{const m=mevcut[k],l=(P.liste||{})[k]||{};
          return `<tr><td class="l"><b>${esc(kisi[k].ad)}</b><br><span class="tag">${kisi[k].vardiya} gün</span>${l.sekil&&!m?` <span class="tag">${esc(l.sekil)}</span>`:''}</td><td>${m?'<span class="chip ok">Mevcut</span>':'<span class="chip warn">Yeni</span>'}</td>
          <td>${m?esc(gorevTahmin(m)):`<select data-k="${esc(k)}" data-t="g"><option value="">Seçin</option>${GOREVLER.map(g=>`<option value="${esc(g.ad)}" ${(l.sekil==='Esnaf kurye'&&g.ad==='Esnaf Kurye')||(l.sekil==='Yarı esnaf'&&g.ad==='Yarı Esnaf Kurye')?'selected':''}>${esc(g.ad)}</option>`).join('')}</select>`}</td>
          <td>${m?esc(m.sgkSube===SGK_YOK?'Boş':m.sgkSube?subeAdi(m.sgkSube):'—'):`<select data-k="${esc(k)}" data-t="s"><option value="${SGK_YOK}">Boş</option>${tumSubeler().map(([id2,ad2])=>`<option value="${esc(id2)}" ${id2===sid?'selected':''}>${esc(ad2)}</option>`).join('')}</select>`}</td><td>${trTarih(m?m.giris:l.giris)}</td><td>${trTarih(m?m.cikis:l.cikis)}</td></tr>`;}).join('')}</tbody></table></div>
        <p class="note">${Object.keys(haftalar).length} hafta aktarılacak. Aynı haftada çizelgede daha önce girilmiş günler Excel'deki değerle değiştirilir.</p>
        <div class="row2"><button class="btn grow" id="xNo">Vazgeç</button><button class="btn primary grow" id="xOk">Aktar</button></div>`;
       byId('xNo').onclick=closeSheet;
       byId('xOk').onclick=async()=>{const eksik=keys.filter(k=>!mevcut[k]&&!gorevBul((byId('xOn2').querySelector(`select[data-t="g"][data-k="${CSS.escape(k)}"]`)||{}).value));
         if(eksik.length){toast(`${eksik.length} kişinin görevi seçilmedi.`);return;}
         const btn=byId('xOk');btn.disabled=true;btn.textContent='Aktarılıyor…';const pidOf={};const ops=[];
         keys.forEach(k=>{const m=mevcut[k];if(m){pidOf[k]=m.id;return;}const l=(P.liste||{})[k]||{};const pid=slug(kisi[k].ad)+'-'+Math.random().toString(36).slice(2,6);pidOf[k]=pid;
           const g=gorevBul(byId('xOn2').querySelector(`select[data-t="g"][data-k="${CSS.escape(k)}"]`).value);const sgkV=byId('xOn2').querySelector(`select[data-t="s"][data-k="${CSS.escape(k)}"]`).value;
           ops.push([doc(db,'personel',pid),{ad:kisi[k].ad,grup:g.grup,gorev:g.ad,sekil:g.sekil||(l.sekil==='Part'?'Part':'Tam'),giris:l.giris||'',cikis:l.cikis||'',sgkSube:sgkV,anaSube:sid},false]);});
         Object.entries(haftalar).forEach(([mon,w])=>{const cells={};Object.entries(w).forEach(([k,v])=>{cells[pidOf[k]]=Object.fromEntries(Object.entries(v.gun).map(([i,x])=>[String(i),x]));});
           ops.push([doc(db,'subeler',sid,'haftalar',mon),{hafta:mon,ay2:ayKey(addDays(parse(mon),6)),kadro:Object.keys(cells),cells},true]);});
         try{for(let i=0;i<ops.length;i+=400){const b=writeBatch(db);ops.slice(i,i+400).forEach(([r,d,m])=>m?b.set(r,d,{merge:true}):b.set(r,d));await b.commit();}
           closeSheet();toast(`${Object.keys(haftalar).length} hafta ve ${keys.length} kişi aktarıldı.`);if(S.subeId!==sid)selectSube(sid);}
         catch(e){btn.disabled=false;btn.textContent='Aktar';yazmaHatasi(e);}};};};});}

let ikincil=null;function ikincilAuth(){if(!ikincil)ikincil=getAuth(initializeApp(firebaseConfig,'ikincil'));return ikincil;}
function kullaniciPanel(uid){const u=uid?S.users.find(x=>x.uid===uid):{kullaniciAdi:'',adSoyad:'',rol:'sube',subeler:[],aktif:true};if(!u)return;const ben=uid===S.user.uid;
  openSheet(`<h2>${uid?'Kullanıcıyı düzenle':'Yeni kullanıcı'}</h2><div class="sub">${uid?'Kullanıcı adı: '+esc(u.kullaniciAdi):'Kullanıcı bu ad ve şifreyle giriş yapar.'}</div>
   <label class="field"><span>Ad soyad</span><input id="uAd" value="${esc(u.adSoyad||'')}"></label>
   ${uid?'':`<div class="fgrid"><label class="field"><span>Kullanıcı adı</span><input id="uK" autocapitalize="none" autocorrect="off" placeholder="ornek: ayse.bucak"></label><label class="field"><span>Şifre (en az 6)</span><input id="uP" type="text" autocomplete="new-password"></label></div>`}
   <span class="lbl">Rol</span><div class="seg" id="uRol">${['sube','bolge','isveren'].map(r=>`<button data-v="${r}" class="${u.rol===r?'on':''}" ${ben?'disabled':''}>${ROL[r]}</button>`).join('')}</div>
   <div id="uSubW"><span class="lbl">Şubeler</span><div class="checks">${S.subeIds.map(id=>`<label class="check" style="margin:0"><input type="checkbox" value="${esc(id)}" ${(u.subeler||[]).includes(id)?'checked':''}> ${esc(S.subeler[id].ad)}</label>`).join('')||'<span class="note">Önce şube ekleyin.</span>'}</div></div>
   ${uid&&!ben?`<label class="check"><input type="checkbox" id="uAktif" ${u.aktif!==false?'checked':''}> Hesap açık</label><p class="note">Şifresini unutan kullanıcı için: hesabı kapatın ve yeni bir kullanıcı adıyla yeniden oluşturun. Kullanıcı kendi şifresini sağ üstteki hesap menüsünden değiştirebilir.</p>`:''}
   <div id="uErr"></div><div class="row2"><button class="btn grow" id="uNo">Vazgeç</button><button class="btn primary grow" id="uOk">${uid?'Kaydet':'Kullanıcıyı oluştur'}</button></div>`,sh=>{
   const rb=sh.querySelectorAll('#uRol button');const tog=()=>byId('uSubW').hidden=sh.querySelector('#uRol .on').dataset.v==='isveren';rb.forEach(b=>b.onclick=()=>{rb.forEach(x=>x.classList.remove('on'));b.classList.add('on');tog();});tog();
   byId('uNo').onclick=closeSheet;const E=byId('uErr');
   byId('uOk').onclick=async()=>{const adSoyad=byId('uAd').value.trim();const r=sh.querySelector('#uRol .on').dataset.v;const subeler=[...sh.querySelectorAll('.checks input:checked')].map(i=>i.value);
     if(!adSoyad){E.innerHTML='<div class="confirm">Ad soyad gerekli.</div>';return;}if(r!=='isveren'&&!subeler.length){E.innerHTML='<div class="confirm">En az bir şube seçin.</div>';return;}
     if(r==='sube'&&subeler.length>1&&!E.dataset.ok){E.dataset.ok='1';E.innerHTML='<div class="confirm">Şube müdürüne birden fazla şube seçtiniz. Doğruysa tekrar basın.</div>';return;}
     const btn=byId('uOk');btn.disabled=true;
     try{if(uid){const body={adSoyad,rol:r,subeler:r==='isveren'?[]:subeler};const ak=byId('uAktif');if(ak)body.aktif=ak.checked;await updateDoc(doc(db,'kullanicilar',uid),body);closeSheet();toast('Kullanıcı güncellendi.');}
       else{const k=kadiNorm(byId('uK').value),p=byId('uP').value;if(k.length<3){E.innerHTML='<div class="confirm">Kullanıcı adı en az 3 karakter olmalı (harf, rakam, nokta).</div>';btn.disabled=false;return;}
         if(p.length<6){E.innerHTML='<div class="confirm">Şifre en az 6 karakter olmalı.</div>';btn.disabled=false;return;}
         const a2=ikincilAuth();const cred=await createUserWithEmailAndPassword(a2,eposta(k),p);const nuid=cred.user.uid;await signOut(a2);
         await setDoc(doc(db,'kullanicilar',nuid),{kullaniciAdi:k,adSoyad,rol:r,subeler:r==='isveren'?[]:subeler,aktif:true,olusturma:new Date().toISOString(),olusturan:S.user.uid});
         closeSheet();toast(`${adSoyad} oluşturuldu. Kullanıcı adı: ${k}`);}}
     catch(e){btn.disabled=false;const c=e.code||'';E.innerHTML=`<div class="confirm bad">${c.includes('email-already-in-use')?'Bu kullanıcı adı alınmış.':c.includes('weak-password')?'Şifre çok zayıf.':'Kaydedilemedi: '+esc(e.message)}</div>`;}};});}

bootstrap();
