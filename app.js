import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, createUserWithEmailAndPassword,
  updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, collection, writeBatch, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, GIRIS_ALANI } from "./config.js?v=55";

/* ================= Sabitler ================= */
const AY=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const AYK=['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
const GUN=['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'];
const GUNU=['Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi','Pazar'];
const GRUP={M:'Müdür',K:'Mutfak',S:'Motorcu'}; const GRUP_SIRA=['M','K','S'];
const KOD={HT:{ad:'Haftalık izin',kisa:'İZİN'},R:{ad:'Rapor',kisa:'RAPOR'},UI:{ad:'Ücretsiz izin',kisa:'ÜCR.<br>İZİN'},YI:{ad:'Yıllık izin',kisa:'YILLIK'},B:{ad:'Bayram',kisa:'BAYR.'},D:{ad:'Diğer',kisa:'DİĞER'}};
const KOD_SIRA=['HT','R','UI','YI','B','D'];
// Excel'deki koşullu biçim renkleri: [zemin, yazı]
const KOD_RENK={HT:['#1c1c1c','#ffffff'],R:['#c6e3ab','#24401a'],UI:['#1f3864','#ffffff'],YI:['#4f6a2a','#ffffff'],B:['#e9edf3','#33415a'],D:['#e01e1e','#ffffff']};
const BOS_RENK='#fde2e2';
const kodStil=k=>{const r=KOD_RENK[k];return r?`style="background:${r[0]};border-color:${r[0]};color:${r[1]}"`:'';};
const SEKILLER=['Tam','Part','Esnaf kurye'];
// Görev listesi: seçmeli, elle yazılmaz. Görev çizelgedeki bölümü ve esnaf durumunu belirler.
const GOREVLER=[{ad:'R. Müdür',grup:'M'},{ad:'V. Müdür',grup:'M'},{ad:'Mutfak',grup:'K'},{ad:'Kurye',grup:'S'},{ad:'Esnaf Kurye',grup:'S',sekil:'Esnaf kurye'}];
const SGK_YOK='-';
// Puantaj veri girişi türleri. b: birim, y: hangi tarafa etki eder (sol=muhasebe, sag=ödeme)
const VERI_TUR=[{k:'R',ad:'Rapor',b:'gün',y:'sol'},{k:'UI',ad:'Ücretsiz izin',b:'gün',y:'sol'},{k:'YI',ad:'Yıllık izin',b:'gün',y:'sol'},{k:'B',ad:'Bayram',b:'gün',y:'sol'},{k:'PG',ad:'Part gün',b:'gün',y:'sol'},{k:'FM',ad:'Fazla mesai (saat)',b:'saat',y:'sol',gizli:true},
  {k:'BY',ad:'Bankaya yatan',b:'₺',y:'sag'},{k:'MF',ad:'Maaş farkı (+ / −)',b:'₺',y:'sag'},{k:'SA',ad:'Çalışılan saat',b:'saat',y:'sag'},{k:'FMT',ad:'Fazla mesai tutarı',b:'₺',y:'sag'},{k:'AV',ad:'Avans',b:'₺',y:'sag'},{k:'AO',ad:'Ara ödeme',b:'₺',y:'sag'},{k:'PS',ad:'Paket sayısı',b:'adet',y:'sag',gizli:true},{k:'PP',ad:'Paket primi',b:'₺',y:'sag'},{k:'CP',ad:'Ciro primi',b:'₺',y:'sag'},{k:'EK',ad:'Ek ödeme',b:'₺',y:'sag',gizli:true},{k:'KS',ad:'Kesinti',b:'₺',y:'sag',gizli:true}];
const veriTur=k=>VERI_TUR.find(t=>t.k===k);
function veriOzet(veri){const o={};(veri||[]).forEach(v=>{const t=veriTur(v.tur);if(!t||!v.pid||v.miktar===''||v.miktar==null)return;if(v.tarih&&S.ay&&v.tarih.slice(0,7)!==S.ay)return;const x=o[v.pid]=o[v.pid]||{};x[v.tur]=(x[v.tur]||0)+sayi(v.miktar);});return o;}
// Elle girilen gün/saat verilerini muhasebe tarafına ekle.
function veriUygula(sol,oz){Object.entries(oz).forEach(([pid,e])=>{const r=sol[pid];if(!r)return;const n=k=>e[k]||0;
  if(r.maasBurada!==false||r.muhBurada){r.rapor=(r.rapor||0)+n('R');r.ucretsiz=(r.ucretsiz||0)+n('UI');r.yillik=(r.yillik||0)+n('YI');r.bayram=(r.bayram||0)+n('B');
    r.partGun=Math.round(((r.partGun||0)+n('PG'))*100)/100;if(r.sekil==='Part'){r.gun=r.partGun;r.hakGun=r.partGun;}else{r.gun=Math.max(0,(r.gun||0)-n('R')-n('UI'));if(r.hakGun!=null)r.hakGun=Math.max(0,r.hakGun-n('R')-n('UI'));}}
  r.fmSaat=Math.round(((r.fmSaat||0)+n('FM'))*100)/100;if(['R','UI','YI','B','PG','FM'].some(k=>e[k]))r.elle=true;});return sol;}
function gorevBul(ad){return GOREVLER.find(g=>g.ad===ad)||null;}
function gorevTahmin(p){const g=String(p.gorev||'').toLocaleUpperCase('tr-TR');if(gorevBul(p.gorev))return p.gorev;
  if(p.sekil==='Esnaf kurye')return'Esnaf Kurye';
  if(g.startsWith('R.')||g.includes('RESTORAN'))return'R. Müdür';if(g.startsWith('V.')||g.includes('VARD')||g.includes('MÜDÜR'))return'V. Müdür';
  if(g.includes('SÜRÜCÜ')||g.includes('KURYE')||g.includes('MOTOR')||p.grup==='S')return'Kurye';if(g.includes('MUTFAK')||p.grup==='K')return'Mutfak';return'';}
function subeAdi(id){if(id===SGK_YOK)return'';return(S.subeler[id]&&S.subeler[id].ad)||(S.subeAdlari[id])||id||'';}
const ROL={sube:'Şube müdürü',bolge:'Bölge müdürü',isveren:'İşveren'};
const DURUM={taslak:{ad:'Taslak',c:'mut'},sube_onay:{ad:'Şube onayladı',c:'warn'},geri:{ad:'Geri gönderildi',c:'bad'},bolge_onay:{ad:'Bölge onayladı',c:'ok'}};
const VARSAYILAN={ad:'Şube',acilis:'11:00',kapanis:'00:30',gunluk:8.5,haftalik:51,partSaat:8,fmYontem:'sabit',fmUcret:165,paketUcret:0,fmDonem:'hafta'};

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
// Fiili çalışma: işe başlama (deneme dahil) varsa ondan, yoksa SGK girişinden itibaren.
function ilkGun(p){return p.baslama&&(!p.giris||p.baslama<p.giris)?p.baslama:p.giris;}
function sgkli(p,d){const s=ymd(d);if(p.giris&&s<p.giris)return false;if(p.cikis&&s>p.cikis)return false;return true;}
function employed(p,d){const s=ymd(d);const g=ilkGun(p);if(g&&s<g)return false;if(p.cikis&&s>p.cikis)return false;return true;}
function weekHasEntry(pid,wid,H=S.haftalar){const w=H[wid];const c=w&&w.cells&&w.cells[pid];return !!c&&Object.values(c).some(v=>v!=null&&v!=='');}
function isEsnaf(p){return p.sekil==='Esnaf kurye';}
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
  // Haftalık dönem: pazartesisi bu ayda olan haftalar (örn. Eylül 2026 = 7 Eylül – 4 Ekim)
  if(sb.fmDonem==='hafta'){fm=0;fmHaftalari(ak).forEach(wid=>{fm+=haftaHesap(p,wid,sb,H).fm;});}
  const part=p.sekil==='Part',esnaf=isEsnaf(p),fmYok=part||esnaf;
  const tamAy=istihdam===last.getDate();
  const bordroGun=Math.max(0,(tamAy?30:Math.min(30,istihdam))-(kod.R||0)-(kod.UI||0));
  return{h,fm:fmYok?0:fm,bos:esnaf?0:bos,gun,kod,part,esnaf,partGun:part?Math.round(h/(sb.partSaat||8)*100)/100:0,bordroGun,tamAy};}
function fmHaftalari(ak){const[y,m]=ak.split('-').map(Number);const L=[];let d=new Date(y,m-1,1);while(d.getDay()!==1)d=addDays(d,1);for(;d.getMonth()===m-1;d=addDays(d,7))L.push(ymd(d));return L;}
function fmDonemYazi(ak,sb=sube()){if(sb.fmDonem!=='hafta')return'';const L=fmHaftalari(ak);if(!L.length)return'';const a=parse(L[0]),b=addDays(parse(L[L.length-1]),6);return `${a.getDate()} ${AYK[a.getMonth()]} – ${b.getDate()} ${AYK[b.getMonth()]}`;}
// Çizelgedeki "ay fazla mesai" sütununun ayı: haftalık dönemde haftanın pazartesisinin ayı
function fmAyi(wid,sb=sube()){return sb.fmDonem==='hafta'?ayKey(parse(wid)):gosterAy(wid);}
// Haftanın listesi (kadro): o hafta çizelgede görünen kişiler. Kayıtlı değilse önceki haftanın listesi önerilir.
function maasSubesi(p){return p.sgkSube&&p.sgkSube!==SGK_YOK?p.sgkSube:(p.anaSube||'');}
// Maaşın ödendiği şube: varsayılan SGK şubesi; "çalıştığı şubede" seçildiyse çalıştığı şube. Muhasebe (bordro) her zaman SGK şubesinde.
function odemeSubesi(p){return p.maasYeri==='calistigi'&&p.anaSube?p.anaSube:maasSubesi(p);}
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
function solHesap(ak,sid=S.subeId,diger=S.pt.ozetler||{},ekIds=[]){const sb=sube(sid);const out={};const burada=subeOzeti(ak,sid);
  const ids=new Set(Object.keys(burada));ekIds.forEach(x=>{if(S.personel.some(p=>p.id===x))ids.add(x);});S.personel.forEach(p=>{if((maasSubesi(p)===sid||odemeSubesi(p)===sid)&&aktifAyda(p,ak))ids.add(p.id);});
  // Aynı kişi birden fazla şubenin listesinde ayrı kayıtla olabilir (SGK'sı burada): isimle tek satırda birleşir.
  const esler={};const grp={};[...ids].forEach(pid=>{const p=S.personel.find(x=>x.id===pid);if(p&&maasSubesi(p)===sid)(grp[isimAnahtar(p.ad)]=grp[isimAnahtar(p.ad)]||[]).push(p);});
  Object.values(grp).forEach(L=>{if(L.length<2)return;L.sort((a,b)=>(b.anaSube===sid)-(a.anaSube===sid));esler[L[0].id]=L.map(x=>x.id);L.slice(1).forEach(x=>ids.delete(x.id));});
  const[y,m]=ak.split('-').map(Number);const last=new Date(y,m,0);
  ids.forEach(pid=>{const p=S.personel.find(x=>x.id===pid);if(!p)return;const pids=esler[pid]||[pid];const o={saat:0,fm:0,gun:0,bos:0,R:0,UI:0,YI:0,B:0};
    pids.forEach(q=>{const b=burada[q];if(b)Object.keys(o).forEach(k=>o[k]+=b[k]||0);});const maasBurada=odemeSubesi(p)===sid;const muhBurada=maasSubesi(p)===sid;const tumGun=maasBurada||muhBurada;
    const t={R:o.R,UI:o.UI,YI:o.YI,B:o.B,saat:o.saat,baska:[]};
    if(tumGun)Object.entries(diger).forEach(([s2,k])=>{if(s2===sid||!k)return;let var_=false;pids.forEach(q=>{const x=k[q];if(!x)return;var_=true;t.R+=x.R||0;t.UI+=x.UI||0;t.YI+=x.YI||0;t.B+=x.B||0;t.saat+=x.saat||0;});if(var_)t.baska.push(subeAdi(s2));});
    let ist=0,istF=0;for(let d=new Date(y,m-1,1);d<=last;d=addDays(d,1)){if(sgkli(p,d))ist++;if(employed(p,d))istF++;}
    const gun=Math.max(0,(ist===last.getDate()?30:Math.min(30,ist))-t.R-t.UI);const hakGun=Math.max(0,(istF===last.getDate()?30:Math.min(30,istF))-t.R-t.UI);const part=p.sekil==='Part';
    out[pid]={ad:p.ad,maasBurada,sgkSube:p.sgkSube===SGK_YOK?'':p.sgkSube?subeAdi(p.sgkSube):subeAdi(p.anaSube),sekil:p.sekil||'Tam',gorev:p.gorev||'',grup:p.grup||'K',giris:p.giris||'',cikis:p.cikis||'',
      rapor:tumGun?t.R:0,ucretsiz:tumGun?t.UI:0,yillik:tumGun?t.YI:0,bayram:tumGun?t.B:0,muhBurada,odemeSube:subeAdi(odemeSubesi(p)),partGun:0,// part gün elle, veri girişinden
      muhSekil:p.sekil||'Tam',
      fmSaat:o.fm,calisilanSaat:o.saat,gun:tumGun&&!part?gun:0,hakGun:tumGun&&!part?hakGun:0,// part: bordro günü = part gün (veri girişinden)
      baslama:p.baslama&&p.baslama<(p.giris||'9')?p.baslama:'',bosGun:o.bos,baska:t.baska,sgkYok:p.sgkSube===SGK_YOK};});
  return out;}
// Muhasebeye giden tarafta sadece SGK'sı bu şubede olanlar; başka şubenin SGK'lısı ve SGK'sı olmayanlar sadece ödemelerde.
// Muhasebede görev adı: kuryeler muhasebenin kullandığı şekilde "Sürücü" yazılır
function muhGorev(sol){const g=sol.gorev||'';return /kurye/i.test(g)?'Sürücü':g;}
function muhasebedeMi(sol){return (sol.muhBurada!=null?sol.muhBurada:sol.maasBurada!==false)&&sol.sgkYok!==true;}
// Puantaj sağ tarafı (ödemeler).
function sagHesap(pid,sol,sag,net,sb,devir,ek={},us={}){const e=k=>ek[k]||0;if(typeof us==='boolean')us={tip:us?'paket':'maas'};const tip=us.tip||'maas';let pb=tip==='paket';const saat=tip==='saat'&&!(sol.sekil==='Esnaf kurye');const s0=sag||{};const devirAvans=devir<0?-devir:0;const araOdeme=e('AO');const s={...s0,avans:sayi(s0.avans)+e('AV')+devirAvans,paketPrimi:sayi(s0.paketPrimi)+e('PP'),ciroPrimi:sayi(s0.ciroPrimi)+e('CP'),paketSayisi:sayi(s0.paketSayisi)+e('PS')};const esnaf=sol.sekil==='Esnaf kurye';
  const bankaya=sayi(s.bankaya)+e('BY'),paketPrimi=sayi(s.paketPrimi),ciroPrimi=sayi(s.ciroPrimi),avans=sayi(s.avans);
  let hak=0,maasFarki=0,fmTl=0,paketHak=0;
  if(esnaf){paketHak=sayi(s.paketSayisi)*sayi(s.paketUcret!=null&&s.paketUcret!==''?s.paketUcret:sb.paketUcret);hak=paketHak;maasFarki=paketHak-bankaya;}
  else if(saat){hak=((sol.calisilanSaat||0)+e('SA'))*sayi(us.saatUcret);maasFarki=hak-bankaya;fmTl=0;}
  else if(pb&&sol.maasBurada!==false){hak=0;maasFarki=0;fmTl=0;/* paket başı: kazanç paket primi sütununda; fazla mesai yok */}
  else if(sol.maasBurada===false){const n=sayi(net);const fm=(sol.fmSaat||0)/* eksi mesai de işlenir */;fmTl=sb.fmYontem==='maas'?(n?fm*n/30/9:0):fm*sayi(sb.fmUcret);}
  else{const n=sayi(net);const hg=sol.hakGun!=null?sol.hakGun:sol.gun;hak=n?n*hg/30:0;maasFarki=n?hak-bankaya:0;
    const fm=(sol.fmSaat||0)/* eksi mesai de işlenir */;fmTl=sb.fmYontem==='maas'?(n?fm*n/30/9:0):fm*sayi(sb.fmUcret);}
  const maasYok=!esnaf&&!saat&&sol.maasBurada===false;const bank2=maasYok?0:bankaya;
  fmTl+=e('FMT');maasFarki+=e('MF');const ekOd=e('EK')-e('KS');const pp=paketPrimi;const pbBanka=pb&&!esnaf&&sol.maasBurada!==false?bankaya:0;const kalanHam=maasFarki+fmTl+pp+ciroPrimi-avans-araOdeme+ekOd-pbBanka;const kalan=Math.round(kalanHam/5)*5||0;// kuruş ödenmez: 5 TL'ye yuvarla
  return{esnaf,maasYok,pb:pb&&!esnaf&&sol.maasBurada!==false,saat,saatSayi:(sol.calisilanSaat||0)+e('SA'),cizelgeSaat:sol.calisilanSaat||0,saatUcret:sayi(us.saatUcret),bankaya:bank2,paketPrimi:pp,kalanHam,ciroPrimi,avans,araOdeme,devirAvans,hak,maasFarki,fmTl,paketHak,devir,kalan,ekOd,netYok:!esnaf&&!maasYok&&!pb&&!saat&&!sayi(net)};}

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
  personelDinle();
  subs.subeDocs.push(onSnapshot(doc(db,'sistem','subeAdlari'),s=>{S.subeAdlari=s.exists()?(s.data().adlar||{}):{};if(isIsveren())subeAdSenkron();},()=>{}));
  if(isIsveren()&&!subs.users)subs.users=onSnapshot(collection(db,'kullanicilar'),s=>{S.users=s.docs.map(d=>({uid:d.id,...d.data()}));if(S.tab==='yonetim')render();});}
// Personel şube şube tutulur: herkes sadece kendi şubelerinin listesini okur. Bölge müdürü ayrıca SGK'sı kendi şubelerinde olanları görür (puantaj için).
function personelDinle(){const parca={};const yay=()=>{const m={};Object.values(parca).forEach(L=>L.forEach(p=>m[p.id]=p));S.personel=Object.values(m);S.loaded.personel=true;S.kuralHata=false;gocKontrol();render();};
  const hata=e=>{console.error(e);S.kuralHata=true;S.loaded.personel=true;render();};
  const dinle=(k,q)=>subs.subeDocs.push(onSnapshot(q,s=>{parca[k]=s.docs.map(d=>({id:d.id,...d.data()}));yay();},hata));
  if(isIsveren()){dinle('hepsi',collection(db,'personel'));return;}
  const ids=S.me.subeler||[];if(!ids.length){S.personel=[];S.loaded.personel=true;return;}
  ids.forEach(sid=>{dinle('a:'+sid,query(collection(db,'personel'),where('anaSube','==',sid)));dinle('s:'+sid,query(collection(db,'personel'),where('sgkSube','==',sid)));});}
let senkronT;function subeAdSenkron(){clearTimeout(senkronT);senkronT=setTimeout(()=>{const adlar={};Object.entries(S.subeler).forEach(([id,v])=>adlar[id]=v.ad);
  const a=JSON.stringify(Object.entries(adlar).sort()),b=JSON.stringify(Object.entries(S.subeAdlari||{}).sort());if(a!==b&&Object.keys(adlar).length)setDoc(doc(db,'sistem','subeAdlari'),{adlar}).catch(()=>{});},800);}
function tumSubeler(){const m={...S.subeAdlari};Object.entries(S.subeler).forEach(([id,v])=>m[id]=v.ad);return Object.entries(m).sort((a,b)=>String(a[1]).localeCompare(String(b[1]),'tr'));}
// Eski sürümde personel şube altında tutuluyordu; işveren ilk açılışta şirket geneli listeye taşır.
async function gocKontrol(){if(!isIsveren()||S.gocBakildi||!S.subeIds.length||!S.loaded.personel)return;S.gocBakildi=true;
  try{const g=await getDoc(doc(db,'sistem','goc'));const gd=g.exists()?g.data():{};
    // v3: isimler büyük harf
    if(!gd.v3){const L=S.personel.filter(p=>p.ad&&p.ad!==adBuyuk(p.ad));for(let i=0;i<L.length;i+=400){const b=writeBatch(db);L.slice(i,i+400).forEach(p=>{p.ad=adBuyuk(p.ad);b.set(doc(db,'personel',p.id),{ad:p.ad},{merge:true});});await b.commit();}
      await setDoc(doc(db,'sistem','goc'),{v3:true},{merge:true});if(L.length){toast(`${L.length} personelin adı büyük harfe çevrildi.`);render();}}
    if(gd.v2)return;const var_=new Set(S.personel.map(p=>p.id));let n=0;
    for(const sid of S.subeIds){const q=await getDocs(collection(db,'subeler',sid,'personel'));const b=writeBatch(db);let k=0;
      q.docs.forEach(d=>{if(var_.has(d.id))return;b.set(doc(db,'personel',d.id),{...d.data(),anaSube:sid});k++;n++;});if(k)await b.commit();}
    await setDoc(doc(db,'sistem','goc'),{v2:true,tarih:new Date().toISOString(),tasinan:n},{merge:true});if(n)toast(`${n} personel şirket geneli listeye taşındı.`);}catch(e){console.error(e);S.gocBakildi=false;}}
function selectSube(id){subs.sube.forEach(u=>u());subs.sube=[];S.tcler={};S.subeId=id;S.haftalar={};S.aylar={};S.loaded.haftalar=false;undo.length=0;SEL=null;MOD=null;tryLS('pm.sube',id);
  subs.sube.push(onSnapshot(collection(db,'subeler',id,'haftalar'),s=>{const m={};s.docs.forEach(d=>m[d.id]=d.data());S.haftalar=m;S.loaded.haftalar=true;render();},e=>yazmaHatasi(e)));
  subs.sube.push(onSnapshot(collection(db,'subeler',id,'aylar'),s=>{const m={};s.docs.forEach(d=>m[d.id]=d.data());S.aylar=m;render();},()=>{}));
  render();}

/* ================= Çizim çerçevesi ================= */
const byId=id=>document.getElementById(id);
function subeBar(){if(S.subeIds.length<2||!['cizelge','personel','ay'].includes(S.tab))return'';
  return `<label class="subebar"><span>Şube</span><select id="subeSecim" aria-label="Şube seç">${S.subeIds.map(id=>`<option value="${esc(id)}" ${id===S.subeId?'selected':''}>${esc(S.subeler[id].ad)}</option>`).join('')}</select></label>`;}
function view(html,after){byId('view').innerHTML=subeBar()+html;after&&after();}
document.addEventListener('change',e=>{if(e.target&&e.target.id==='subeSecim'){selectSube(e.target.value);window.scrollTo(0,0);}});
function top(eyebrow,title,right=''){byId('top').innerHTML=`<div class="top-row"><div class="grow"><div class="eyebrow">${eyebrow}</div><h1>${title}</h1></div>${right}</div>`;}
function sekmeler(){if(!S.me)return[];const t=[['cizelge','Çizelge'],['personel','Personel']];
  if(isSube())t.push(['ay','Ay sonu']);if(puantajYetki())t.push(['puantaj','Puantaj']);if(isIsveren())t.push(['yonetim','Yönetim']);return t;}
function renderTabs(){const t=sekmeler();if(!t.some(x=>x[0]===S.tab))S.tab='cizelge';const n=byId('tabs');n.hidden=false;
  byId('tabsIn').innerHTML=t.map(([k,a])=>`<button data-tab="${k}" class="${S.tab===k?'on':''}">${a}</button>`).join('');
  n.querySelectorAll('button').forEach(b=>b.onclick=()=>{if(S.tab==='puantaj'&&S.pt.sube)veriBosTemizle();S.tab=b.dataset.tab;tryLS('pm.tab',S.tab);if(S.tab==='ay')S.ay=S.ay||gosterAy(S.hafta);if(S.tab==='puantaj'){S.pt.sube=null;}render();window.scrollTo(0,0);});}
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
  const akF=fmAyi(wid,sb);const ak3=AYK[+akF.slice(5)-1];
  h+=`<div class="grid" id="grid"><div></div>${ds.map((d,i)=>`<div class="dh ${ymd(d)===td?'today':''}">${GUN[i]}<span>${d.getDate()}</span></div>`).join('')}<div class="dh fmh">Hafta<span>fazla mesai</span></div><div class="dh fmh">${ak3}<span>fazla mesai</span></div>`;
  GRUP_SIRA.forEach(g=>{h+=`<div class="gt">${GRUP[g]}<button class="gadd" data-g="${g}">+ ${GRUP[g]} ekle</button></div>`;
    kisiler.filter(p=>(p.grup||'K')===g).forEach(p=>{const r=ROWS.indexOf(p.id);const wk=haftaHesap(p,wid,sb);const ay=ayHesap(p,akF,sb);
      const alt=`${fmt(wk.h)} sa${isEsnaf(p)?' · esnaf':p.sekil==='Part'?' · part':''}`;
      const fmH=isEsnaf(p)?['—',`${fmt(ay.h)}<small>sa</small>`]:p.sekil==='Part'?['—',`${fmt(ay.h)}<small>sa</small>`]:[sg(wk.fm),sg(ay.fm)];
      h+=`<button class="nm ${MOD&&MOD.tip==='satir'&&MOD.pid===p.id?'kaynak':''}" data-pe="${esc(p.id)}"><b title="${esc(p.ad)}">${esc(kisaAd(p.ad))}</b><span>${alt}</span></button>`;
      ds.forEach((d,i)=>{if(!employed(p,d)){h+=`<div class="cell out" data-r="${r}" data-c="${i}">—</div>`;return;}
        const lk=!cizelgeYazabilir(d);const val=cellOf(p.id,wid,i);const tag=lk?'div':'button';const at=`data-p="${esc(p.id)}" data-i="${i}" data-r="${r}" data-c="${i}"`;
        if(isShift(val)){const k=shiftKind(val,sb);const[a,b]=val.split('-');h+=`<${tag} class="cell" ${at} aria-label="${esc(p.ad)} ${GUNU[i]} ${a}–${b}"><span class="t ${k.o?'o':''}">${a}</span><span class="t ${k.k?'k':''}">${b}</span></${tag}>`;}
        else if(val&&KOD[val])h+=`<${tag} class="cell code" ${kodStil(val)} ${at}>${KOD[val].kisa}</${tag}>`;
        else h+=`<${tag} class="cell empty" ${at} aria-label="${esc(p.ad)} ${GUNU[i]} boş">${lk?'':'+'}</${tag}>`;});
      h+=`<div class="fmc">${fmH[0]}</div><div class="fmc ay">${fmH[1]}</div>`;});});
  h+=`</div>`;
  if(!kisiler.length)h+=`<div class="empty-state"><b>Bu haftanın listesi boş</b>Gruplardaki "+ ekle" ile personel listesinden kişi seçin ya da "Geçen haftayı kopyala"ya basın.</div>`;
  h+=`<div class="legend"><span><i style="background:var(--open)"></i>Açılış saati</span><span><i style="background:var(--close)"></i>Kapanış saati</span>${KOD_SIRA.filter(k=>k!=='B').map(k=>`<span><i style="background:${KOD_RENK[k][0]}"></i>${KOD[k].ad}</span>`).join('')}<span><i style="background:${BOS_RENK}"></i>Boş gün</span><span>— İşe giriş öncesi / çıkış sonrası</span></div>
   <p class="note"><b>Kopyala-yapıştır:</b> Bilgisayarda hücreleri fareyle sürükleyerek seçin, Ctrl+C ile kopyalayıp hedef hücrede Ctrl+V yapın; Excel'den kopyaladığınız saatler de yapıştırılır. Delete ile silin, çift tıklayarak düzenleyin. Telefonda hücreye ya da isme basılı tutun.</p>
   <p class="note">İsim altında haftanın toplam saati. En sağda: haftanın fazla mesaisi ve ayın toplam fazla mesaisi${sb.fmDonem==='hafta'?` (fazla mesai dönemi ${fmDonemYazi(akF,sb)})`:''}. Hesap: çalışılan − (çalışılan gün × ${fmt(sb.gunluk)} sa); 7 gün çalışılan haftada − ${fmt(sb.haftalik)} sa.</p>`;
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
   <span class="lbl">Durum</span><div class="codes">${KOD_SIRA.map(k=>`<button data-k="${k}" class="${val===k?'sel':''}" ${kodStil(k)}>${KOD[k].ad}</button>`).join('')}</div>
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
  const L=subePersoneli().filter(p=>(p.grup||'K')===g&&!var_.has(p.id)&&ds.some(d=>employed(p,d))).sort((a,b)=>String(a.ad).localeCompare(String(b.ad),'tr'));
  const satir=p=>`<button class="row" data-id="${esc(p.id)}" data-ara="${esc(isimAnahtar(p.ad))}"><div class="av">${esc(bas(p.ad))}</div><div class="m"><b>${esc(p.ad)}</b><span>${esc(gorevTahmin(p))}</span></div></button>`;
  openSheet(`<h2>${GRUP[g]} ekle · ${rangeLabel(wid)}</h2><div class="sub">${esc(sube().ad)} personel listesinden seçin. Başka şubeden gelen biri listede yoksa "Yeni personel oluştur" ile bu şubenin listesine ekleyin.</div>
   <label class="field"><span>Ara</span><input id="kAra" autocomplete="off" placeholder="İsim yazın"></label>
   <div class="card list" id="kList" style="margin-top:10px;max-height:46vh;overflow:auto">${L.map(satir).join('')||'<div class="note" style="padding:12px">Bu bölümde eklenebilecek kişi yok.</div>'}</div>
   <div class="row2"><button class="btn grow" id="kNo">Kapat</button><button class="btn grow" id="kYeni">+ Yeni personel oluştur</button></div>`,sh=>{
   byId('kNo').onclick=closeSheet;byId('kYeni').onclick=()=>personelPanel(null,g,{sonra:pid=>kadroEkle(pid)});
   byId('kAra').oninput=e=>{const q=isimAnahtar(e.target.value);sh.querySelectorAll('#kList .row').forEach(r=>r.hidden=!!q&&!r.dataset.ara.includes(q));};
   sh.querySelectorAll('#kList .row').forEach(r=>r.onclick=()=>{kadroEkle(r.dataset.id);r.remove();toast(`${kisaAd(S.personel.find(p=>p.id===r.dataset.id).ad)} bu haftaya eklendi.`);});});}
function kadroTasi(pid,yon){const wid=S.hafta;const ids=kadroOf(wid).ids.slice();const L=cizelgeKisileri(wid);const p=L.find(x=>x.id===pid);if(!p)return false;
  const grup=L.filter(x=>(x.grup||'K')===(p.grup||'K'));const k=grup.findIndex(x=>x.id===pid);const hedef=grup[k+yon];if(!hedef)return false;
  const a=ids.indexOf(pid),b=ids.indexOf(hedef.id);[ids[a],ids[b]]=[ids[b],ids[a]];
  setWeek(wid,JSON.parse(JSON.stringify((S.haftalar[wid]&&S.haftalar[wid].cells)||{})),ids);return true;}
function isimMenu(pid){const p=S.personel.find(x=>x.id===pid);if(!p)return;const dolu=Object.values(((S.haftalar[S.hafta]||{}).cells||{})[pid]||{}).some(v=>v);
  const L=cizelgeKisileri(S.hafta).filter(x=>(x.grup||'K')===(p.grup||'K'));const k=L.findIndex(x=>x.id===pid);
  openSheet(`<h2>${esc(p.ad)}</h2><div class="sub">${rangeLabel(S.hafta)} · ${GRUP[p.grup||'K']} bölümünde ${k+1}. sırada</div>
   <div class="row2" style="margin-top:4px"><button class="btn grow" id="iUp" ${k<=0?'disabled':''}>▲ Yukarı taşı</button><button class="btn grow" id="iDn" ${k>=L.length-1?'disabled':''}>▼ Aşağı taşı</button></div>
   <div class="card list" style="margin-top:12px">
   <button class="row" id="iKop"><div class="m"><b>Haftasını kopyala</b><span>Sonra hedef kişinin adına dokunarak yapıştırın</span></div></button>
   <button class="row" id="iCik"><div class="m"><b style="color:var(--bad)">Bu haftadan çıkar</b><span>${dolu?'Bu haftaki saatleri de silinir. ':''}Personel listesinde kalır.</span></div></button></div>
   <p class="note">Görev, SGK şubesi ve tarihler Personel sekmesinden değiştirilir.</p>`,()=>{
   byId('iUp').onclick=()=>{if(kadroTasi(pid,-1))isimMenu(pid);};byId('iDn').onclick=()=>{if(kadroTasi(pid,1))isimMenu(pid);};
   byId('iKop').onclick=()=>{closeSheet();satirKopyaMod(pid);};
   const c=byId('iCik');c.onclick=()=>{if(dolu&&!c.dataset.ok){c.dataset.ok='1';c.querySelector('b').textContent='Çıkarmayı onayla';return;}closeSheet();kadroCikar(pid);toast(`${kisaAd(p.ad)} bu haftadan çıkarıldı.`);};});}

/* ================= Personel (şirket geneli liste) ================= */
// Kişiyi bir şubenin haftalık listesine ekler (o haftanın listesi yoksa önceki haftanın listesini temel alır).
async function cizelgeyeKoy(sid,wid,pid){if(!erisimVar(sid))return;try{
  if(sid===S.subeId){const kad=kadroOf(wid).ids.slice();if(kad.includes(pid))return;kad.push(pid);
    return sirayla(wid,()=>setDoc(weekRef(wid,sid),{hafta:wid,ay2:ayKey(addDays(parse(wid),6)),kadro:kad},{merge:true}));}
  const ref=weekRef(wid,sid);const s0=await getDoc(ref);let kad=null;
  if(s0.exists()){const d=s0.data();kad=Array.isArray(d.kadro)?d.kadro.slice():Object.keys(d.cells||{});}
  else for(let i=1;i<=8&&!kad;i++){const q=await getDoc(weekRef(ymd(addDays(parse(wid),-7*i)),sid));if(q.exists()){const d=q.data();kad=Array.isArray(d.kadro)?d.kadro.slice():Object.keys(d.cells||{});}}
  kad=kad||[];if(kad.includes(pid))return;kad.push(pid);await setDoc(ref,{hafta:wid,ay2:ayKey(addDays(parse(wid),6)),kadro:kad},{merge:true});}catch(e){console.error(e);}}
/* ================= Personel bilgileri (telefon, acil durum, e-posta, IBAN) ================= */
// Bu bilgiler personel kaydında durur; kayıt sadece kişinin şubesi (ve SGK şubesinin bölge müdürü / işveren) tarafından okunur.
const BILGI=[{k:'tel',ad:'Telefon',tip:'tel',im:'tel',ph:'05xx xxx xx xx'},{k:'acilAd',ad:'Acil durum kişisi',tip:'metin',im:'text',ph:'Örn: Annesi Ayşe'},{k:'acilTel',ad:'Acil durum no',tip:'tel',im:'tel',ph:'05xx xxx xx xx'},
  {k:'eposta',ad:'E-posta',tip:'eposta',im:'email',ph:'ornek@mail.com'},{k:'iban',ad:'IBAN',tip:'iban',im:'text',ph:'TR000000000000000000000000'}];
BILGI.push({k:'tc',ad:'TC kimlik no',tip:'tc',im:'numeric',ph:'11 hane'});
// Sıra: telefon, IBAN, e-posta, acil durum, TC en sonda
{const sira=['tel','iban','eposta','acilAd','acilTel','tc'];BILGI.sort((a,b)=>sira.indexOf(a.k)-sira.indexOf(b.k));}
function ibanGecerli(s){if(!/^TR\d{24}$/.test(s))return false;const r=s.slice(4)+s.slice(0,4);let m=0;for(const ch of r){const n=/\d/.test(ch)?ch:String(ch.charCodeAt(0)-55);for(const d of n)m=(m*10+(+d))%97;}return m===1;}
function tcGecerli(s){if(!/^[1-9]\d{10}$/.test(s))return false;const d=s.split('').map(Number);const t1=((d[0]+d[2]+d[4]+d[6]+d[8])*7-(d[1]+d[3]+d[5]+d[7]))%10;const t2=d.slice(0,10).reduce((a,b)=>a+b,0)%10;return((t1+10)%10)===d[9]&&t2===d[10];}
function bilgiCoz(f,raw){const s=String(raw??'').trim();if(!s)return{v:''};
  if(f.tip==='tel'){let d=s.replace(/\D/g,'');if(d.startsWith('90')&&d.length===12)d=d.slice(2);if(d.length===10&&d[0]==='5')d='0'+d;return /^0\d{10}$/.test(d)?{v:d}:{hata:'11 haneli telefon numarası yazın (05xx xxx xx xx).'};}
  if(f.tip==='iban'){const d=s.toLocaleUpperCase('tr-TR').replace(/[^A-Z0-9]/g,'');return ibanGecerli(d)?{v:d}:{hata:'IBAN hatalı. TR ile başlayan 26 karakterli IBAN\'ı kontrol edin.'};}
  if(f.tip==='eposta'){const d=s.toLocaleLowerCase('tr-TR').replace(/\s/g,'');return /^[^@]+@[^@]+\.[a-z]{2,}$/.test(d)?{v:d}:{hata:'E-posta adresi hatalı.'};}
  if(f.tip==='tc'){const d=s.replace(/\D/g,'');return tcGecerli(d)?{v:d}:{hata:'TC kimlik numarası hatalı.'};}
  return{v:s.replace(/\s+/g,' ').slice(0,80)};}
function bilgiGoster(f,v){v=v||'';if(f.tip==='tel'&&/^0\d{10}$/.test(v))return`${v.slice(0,4)} ${v.slice(4,7)} ${v.slice(7,9)} ${v.slice(9)}`;return v;}
function excelBilgi(o){const out={};BILGI.forEach(f=>{if(o[f.k]==null)return;const r=bilgiCoz(f,typeof o[f.k]==='number'?String(o[f.k]):o[f.k]);if(r.v)out[f.k]=r.v;});return out;}
// TC sadece bölge müdürü / işveren: maaslar/{SGK şubesi}.tc
async function tcYukle(list){if(!puantajYetki())return;S.tcler=S.tcler||{};const need=[...new Set(list.map(maasSubesi))].filter(s=>s&&!(s in S.tcler)&&(isIsveren()||(S.me.subeler||[]).includes(s)));
  if(!need.length)return;await Promise.all(need.map(async s=>{try{const d=await getDoc(doc(db,'maaslar',s));S.tcler[s]=(d.exists()&&d.data().tc)||{};}catch(e){S.tcler[s]=null;}}));render();}
// TC personel kaydında; eski kayıtlarda bordrodan gelen TC maaslar'da durabilir (bölge/işveren görür).
function tcOf(p){if(p.tc)return p.tc;const m=S.tcler&&S.tcler[maasSubesi(p)];return m?m[p.id]||'':'';}
function bilgiKaydet(p,f,v){p[f.k]=v;return sirayla('p'+p.id,()=>setDoc(doc(db,'personel',p.id),{[f.k]:v},{merge:true}));}
// Personel listesi: tek tablo, her şey satır içinde düzenlenir, değişiklik anında kaydedilir.
function sgkCakisma(p,sgkV,ad){if(!sgkV||sgkV===SGK_YOK)return null;const td0=ymd(today());
  return S.personel.find(x=>x.id!==p.id&&x.sgkSube&&x.sgkSube!==SGK_YOK&&x.sgkSube!==sgkV&&(isimAnahtar(x.ad)===isimAnahtar(ad||p.ad)||(p.tc&&x.tc===p.tc))&&(!x.cikis||x.cikis>=td0))||null;}
function renderBilgiListesi(){const T=byId('blTbl');const gor=S.pgor||'calisma';const CAL=gor==='calisma';
  const list=sirala(subePersoneli());const td=ymd(today());const L=[...list.filter(p=>!p.cikis||p.cikis>=td),...list.filter(p=>p.cikis&&p.cikis<td)];
  const F=CAL?[]:BILGI;
  if(T&&T.contains(document.activeElement)&&T.dataset.n===String(L.length))return; // yazarken yeniden çizme
  tcYukle(L);
  const subeler=tumSubeler();const anaSec=(isIsveren()?S.subeIds:(S.me.subeler||[])).filter(x=>S.subeler[x]);
  const eksik=L.filter(p=>!p.cikis||p.cikis>=td).filter(p=>!p.sgkSube||!gorevBul(p.gorev)).length;
  const opt=(v,t,sel)=>`<option value="${esc(v)}" ${sel?'selected':''}>${esc(t)}</option>`;
  const satir=(p,r)=>{const yaz=personelYazabilir(p);const dis=yaz?'':'disabled';const g=gorevBul(gorevTahmin(p));const cik=p.cikis&&p.cikis<td;const ana=p.anaSube||S.subeId;
    return `<tr data-pid="${esc(p.id)}" class="${cik?'mutr':''}">
     <td class="l nmc"><input class="adI" data-x="ad" value="${esc(adBuyuk(p.ad))}" autocomplete="off" spellcheck="false" ${dis}><span>${ana!==S.subeId?'çalıştığı: '+esc(subeAdi(ana)):''}${cik?' çıktı':''}</span></td>
     ${CAL?`     <td class="bi"><select data-x="gorev" ${dis}>${g?'':opt('','Seçin',true)}${GOREVLER.map(x=>opt(x.ad,x.ad,g&&g.ad===x.ad)).join('')}</select></td>
     <td class="bi">${`<select data-x="sekil" ${dis} ${g&&g.sekil?'disabled':''}>${g&&g.sekil?opt(g.sekil,'Esnaf',true):['Tam','Part'].map(x=>opt(x,x,(p.sekil==='Part'?'Part':'Tam')===x)).join('')}</select>`}</td>
     <td class="bi"><select data-x="sgkSube" class="${p.sgkSube?'':'bad'}" ${dis}>${p.sgkSube?'':opt('','Seçin',true)}${opt(SGK_YOK,'Boş',p.sgkSube===SGK_YOK)}${subeler.map(([sid,ad])=>opt(sid,ad,p.sgkSube===sid)).join('')}</select></td>
     <td class="bi"><select data-x="anaSube" ${dis}>${(anaSec.includes(ana)?anaSec:[ana,...anaSec]).map(x=>opt(x,subeAdi(x),ana===x)).join('')}</select></td>
     <td class="bi">${p.sgkSube&&p.sgkSube!==SGK_YOK&&p.sgkSube!==ana?`<select data-x="maasYeri" ${dis} title="Muhasebe ve bordro SGK şubesinde kalır; sadece maaş ödemesi seçilen şubede hesaplanır">${opt('',subeAdi(p.sgkSube)+' (SGK)',p.maasYeri!=='calistigi')}${opt('calistigi',subeAdi(ana)+' (çalıştığı)',p.maasYeri==='calistigi')}</select>`:'<span style="color:var(--mut);padding:0 6px">—</span>'}</td>
     <td class="bi"><input type="date" data-x="giris" class="${p.giris?'':'bos'}" value="${esc(p.giris||'')}" ${dis}></td>
     <td class="bi"><input type="date" data-x="baslama" class="${p.baslama?'':'bos'}" value="${esc(p.baslama||'')}" title="SGK'dan önce deneme için çalıştığı ilk gün. Boşsa SGK girişi." ${dis}></td>
     <td class="bi"><input type="date" data-x="cikis" class="${p.cikis?'':'bos'}" value="${esc(p.cikis||'')}" ${dis}></td>
`:''}
     ${F.map((f,c)=>`<td class="bi"><input data-r="${r}" data-c="${c}" data-f="${f.k}" value="${esc(bilgiGoster(f,f.k==='tc'?tcOf(p):p[f.k]))}" placeholder="${esc(f.ph)}" inputmode="${f.im}" autocomplete="off" spellcheck="false" ${dis}></td>`).join('')}
     <td class="bi"><button class="mini" data-x="menu" title="Sil / çıkış ver" ${dis}>⋯</button></td></tr>`;};
  let body='';let r=0;GRUP_SIRA.forEach(g=>{const l=L.filter(p=>(p.grup||'K')===g&&!(p.cikis&&p.cikis<td));if(!l.length)return;body+=`<tr class="grp"><td class="l nmc">${GRUP[g]} · ${l.length}</td><td colspan="${CAL?10:F.length+2}"></td></tr>`;l.forEach(p=>{body+=satir(p,L.indexOf(p));});});
  const cl=L.filter(p=>p.cikis&&p.cikis<td);if(cl.length){body+=`<tr class="grp"><td class="l nmc">Çıkış yapanlar · ${cl.length}</td><td colspan="${CAL?10:F.length+2}"></td></tr>`;cl.forEach(p=>{body+=satir(p,L.indexOf(p));});}
  const h=`<div class="actions"><button class="btn primary grow" id="addP">Personel ekle</button><button class="btn grow" id="addX">Excel'den yapıştır</button></div>
   <p class="note" style="margin-top:0">${esc(sube().ad)} · ${L.length} kişi${eksik?` · <b style="color:var(--warn)">${eksik} kişide görev ya da SGK şubesi eksik</b>`:''} · ${CAL?'Hücreye tıklayıp değiştirin, anında kaydedilir.':'Excel\'den kopyalayıp yapıştırabilirsiniz; ilk sütun isimse satırlar isimle eşleşir.'}</p>
   <div class="seg" id="pGor" style="margin-bottom:10px"><button data-v="calisma" class="${CAL?'on':''}">Çalışma bilgileri</button><button data-v="iletisim" class="${CAL?'':'on'}">İletişim ve banka</button></div>
   <div class="tbl-wrap" style="scroll-padding-left:165px"><table class="pt bl sade" id="blTbl" data-n="${L.length}"><thead><tr><th class="l">Ad soyad</th>${CAL?`<th>Görev</th><th>Şekil</th><th>SGK şubesi</th><th>Çalıştığı şube</th><th>Maaş ödemesi</th><th>SGK giriş</th><th>Deneme başlangıcı</th><th>Çıkış</th>`:''}${F.map(f=>`<th>${f.ad}</th>`).join('')}<th></th></tr></thead>
   <tbody>${body||`<tr><td class="l" colspan="${CAL?10:F.length+2}">Henüz personel yok. "Personel ekle" ile başlayın.</td></tr>`}</tbody></table></div>`;
  view(h,()=>{byId('addP').onclick=()=>personelPanel(null);byId('addX').onclick=personelYapistirPanel;const tb=byId('blTbl');document.querySelectorAll('#pGor button').forEach(b=>b.onclick=()=>{S.pgor=b.dataset.v;render();});
    const pOf=el=>S.personel.find(x=>x.id===el.closest('tr').dataset.pid);
    const yaz1=(p,body,yenidenCiz)=>{Object.assign(p,body);sirayla('p'+p.id,()=>setDoc(doc(db,'personel',p.id),body,{merge:true}));if(yenidenCiz){document.activeElement&&document.activeElement.blur();render();}};
    const geri=(el,msg,v)=>{toast(msg);el.value=v;el.classList.add('bad');setTimeout(()=>el.classList.remove('bad'),2500);};
    tb.querySelectorAll('[data-x]').forEach(el=>{const x=el.dataset.x;
      if(x==='menu'){el.onclick=()=>personelPanel(el.closest('tr').dataset.pid);return;}
      if(x==='ad')el.oninput=()=>{const a=el.selectionStart,b=el.selectionEnd;el.value=el.value.toLocaleUpperCase('tr-TR');try{el.setSelectionRange(a,b);}catch(_){}};
      const tarihMi=el.type==='date';
      // Tarih alanı yazılırken her rakamda değişiklik gelir; sadece alandan çıkınca ve yıl tamamsa kaydet.
      if(tarihMi){el.onchange=null;el.onkeydown=e=>{if(e.key==='Enter')el.blur();};}
      el[tarihMi?'onblur':'onchange']=()=>{const p=pOf(el);if(!p)return;const v=el.value;if(tarihMi){if(v===(p[x]||''))return;if(v&&(+v.slice(0,4)<1990||+v.slice(0,4)>2100))return geri(el,'Tarih hatalı, yılı 4 haneli yazın.',p[x]||'');}
        if(x==='ad'){const ad=adBuyuk(v);if(!ad)return geri(el,'Ad soyad boş olamaz.',adBuyuk(p.ad));const c=sgkCakisma(p,p.sgkSube,ad);if(c)return geri(el,`${adBuyuk(c.ad)} zaten ${subeAdi(c.sgkSube)} şubesinde SGK'lı.`,adBuyuk(p.ad));el.value=ad;if(ad!==p.ad)yaz1(p,{ad});return;}
        if(x==='gorev'){const g=gorevBul(v);if(!g)return;const body={gorev:g.ad,grup:g.grup,sekil:g.sekil||(p.sekil==='Part'?'Part':'Tam')};yaz1(p,body,true);return;}
        if(x==='sekil'){yaz1(p,{sekil:v});return;}
        if(x==='maasYeri'){yaz1(p,{maasYeri:v},true);toast(v==='calistigi'?`Maaşı ${subeAdi(p.anaSube)} puantajında hesaplanacak; muhasebe ${subeAdi(p.sgkSube)}'de kalır.`:`Maaşı ${subeAdi(p.sgkSube)} puantajında hesaplanacak.`);return;}
        if(x==='sgkSube'){if(!v)return;const c=sgkCakisma(p,v);if(c)return geri(el,`${adBuyuk(c.ad)} zaten ${subeAdi(c.sgkSube)} şubesinde SGK'lı. Bir kişi sadece bir şubede SGK'lı olabilir.`,p.sgkSube||'');
          const eski=p.sgkSube;yaz1(p,{sgkSube:v},true);if(v!==SGK_YOK&&v!==(p.anaSube||S.subeId)&&v!==eski){if(erisimVar(v)){cizelgeyeKoy(v,mondayOf(today()),p.id);toast(`${subeAdi(v)} listesine ve çizelgesine de eklendi.`);}else toast(`${subeAdi(v)} listesinde de görünür, o şubenin müdürü çizelgesine ekleyebilir.`);}return;}
        if(x==='anaSube'){if(!v||v===p.anaSube)return;yaz1(p,{anaSube:v},true);cizelgeyeKoy(v,mondayOf(today()),p.id);toast(`${subeAdi(v)} çizelgesine eklendi.`);return;}
        if(x==='baslama'){if(v&&p.giris&&v>p.giris)return geri(el,'İşe başlama SGK girişinden sonra olamaz. Boş bırakılırsa SGK girişi kullanılır.',p.baslama||'');yaz1(p,{baslama:v},true);return;}
        if(x==='giris'||x==='cikis'){const gi=x==='giris'?v:p.giris,ci=x==='cikis'?v:p.cikis;if(gi&&ci&&ci<gi)return geri(el,'Çıkış tarihi girişten önce olamaz.',p[x]||'');yaz1(p,{[x]:v},x==='cikis');return;}};});
    const inp=(r,c)=>tb.querySelector(`input[data-r="${r}"][data-c="${c}"]`);
    const kaydet=(el,sessiz)=>{const p=L[+el.dataset.r];const f=F[+el.dataset.c];if(!p||!f)return true;const r=bilgiCoz(f,el.value);
      if(r.hata){el.classList.add('bad');el.title=r.hata;if(!sessiz)toast(`${kisaAd(p.ad)} · ${r.hata}`);return false;}
      el.classList.remove('bad');el.title='';el.value=bilgiGoster(f,r.v);const eski=f.k==='tc'?tcOf(p):(p[f.k]||'');if(r.v!==eski)bilgiKaydet(p,f,r.v);return true;};
    const satirSira=[...tb.querySelectorAll('tr[data-pid]')].map(t=>t.querySelector('input[data-c="0"]')).map(i=>i&&+i.dataset.r);
    const asagi=(r,yon)=>{const i=satirSira.indexOf(r);const n=satirSira[i+yon];return n==null?null:n;};
    tb.querySelectorAll('input[data-c]').forEach(el=>{el.onchange=()=>kaydet(el);
      el.onkeydown=e=>{const r=+el.dataset.r,c=+el.dataset.c;let n=null;if(e.key==='Enter'||e.key==='ArrowDown'){const q=asagi(r,1);n=q==null?null:inp(q,c);}else if(e.key==='ArrowUp'){const q=asagi(r,-1);n=q==null?null:inp(q,c);}if(n||e.key==='Enter'){e.preventDefault();if(n){n.focus();n.select();}else el.blur();}};
      el.onpaste=e=>{const t=(e.clipboardData||window.clipboardData).getData('text');if(!/[\t\n]/.test(t.trim()))return;e.preventDefault();
        let M=t.replace(/\r/g,'').split('\n');while(M.length&&!M[M.length-1].trim())M.pop();M=M.map(x=>x.split('\t'));
        const r0=+el.dataset.r,c0=+el.dataset.c;const ad={};L.forEach((p,i)=>ad[isimAnahtar(p.ad)]=i);
        const isimli=M[0].length>1&&M.filter(x=>x[0].trim()).every(x=>ad[isimAnahtar(x[0])]!=null);let n=0,bad=0,yok=0;let rr=r0;
        M.forEach((row,i)=>{const r=isimli?ad[isimAnahtar(row[0])]:(i===0?r0:(rr=asagi(rr,1)));const cells=isimli?row.slice(1):row;if(r==null||r>=L.length){yok++;return;}
          cells.forEach((v,j)=>{const x=inp(r,c0+j);if(!x||x.disabled)return;x.value=v.trim();if(kaydet(x,true))n++;else bad++;});});
        toast(`${n} hücre yapıştırıldı${bad?`, ${bad} hücre hatalı (kırmızı)`:''}${yok?`, ${yok} satır eşleşmedi`:''}.`);};});});}

// Excel'den personel listesi yapıştırma: SGK ŞUBE · ÇALIŞMA ŞEKLİ · ADI SOYADI · GÖREV · GİRİŞ · ÇIKIŞ (başlık varsa sütunlar ona göre bulunur)
function gorevCoz(x){const a=ascii(x).replace(/[^a-z ]/g,' ').replace(/\s+/g,' ').trim();if(!a)return null;if(/esnaf/.test(a))return gorevBul('Esnaf Kurye');if(/surucu|kurye|motor/.test(a))return gorevBul('Kurye');
  if(/^r\b|restoran|^mudur$|^r mudur/.test(a))return gorevBul('R. Müdür');if(/^v\b|vardiya|^v mudur|yardimci/.test(a))return gorevBul('V. Müdür');if(/mutfak|ekip|personel|ekip uyesi/.test(a))return gorevBul('Mutfak');return null;}
function personelYapistirPanel(){const sid=S.subeId;
  openSheet(`<h2>Excel'den personel ekle</h2><div class="sub">${esc(sube().ad)} listesine eklenir. Sütunlar: SGK ŞUBE · ÇALIŞMA ŞEKLİ · ADI SOYADI · GÖREV · GİRİŞ TARİHİ · ÇIKIŞ TARİHİ. Başlık satırını da kopyalarsanız sütun sırası önemli değil.</div>
   <label class="field"><span>Excel'den kopyaladığınız satırlar</span><textarea id="piT" rows="5" placeholder="Excel'de satırları seçip Ctrl+C, buraya Ctrl+V"></textarea></label><div id="piOut"></div>`,()=>{
   const T=byId('piT');let sonuc=[];
   const coz=()=>{let L=T.value.replace(/\r/g,'').split('\n').filter(x=>x.trim()).map(x=>x.split('\t').map(y=>y.trim()));if(!L.length){byId('piOut').innerHTML='';return;}
     let sira={sgk:0,sekil:1,ad:2,gorev:3,giris:4,cikis:5};const bas=L[0].map(x=>ascii(x));
     if(bas.some(x=>/adi|soyad/.test(x))){sira={};bas.forEach((x,j)=>{if(/sgk/.test(x))sira.sgk=j;else if(/calisma|sekil/.test(x))sira.sekil=j;else if(/adi|soyad|isim/.test(x))sira.ad=j;else if(/gorev/.test(x))sira.gorev=j;else if(/giris/.test(x))sira.giris=j;else if(/cikis/.test(x))sira.cikis=j;});L=L.slice(1);}
     const subeAd={};tumSubeler().forEach(([id,a])=>subeAd[isimAnahtar(a)]=id);const mevcut=subePersoneli(sid);const gorulen={};
     sonuc=L.map(r=>{const al=k=>sira[k]!=null?(r[sira[k]]||''):'';const ad=adBuyuk(al('ad'));const o={ad,hata:'',uyari:''};if(!ad){o.hata='İsim yok';return o;}
       const sg=al('sgk');o.sgk=sg?subeAd[isimAnahtar(sg)]:SGK_YOK;if(sg&&!o.sgk)o.hata=`SGK şubesi bulunamadı: ${sg}`;
       const g=gorevCoz(al('gorev'));o.gorev=g;if(!g)o.hata=o.hata||`Görev tanınmadı: ${al('gorev')||'boş'}`;
       const sk=ascii(al('sekil'));o.sekil=g&&g.sekil?g.sekil:(/part/.test(sk)?'Part':'Tam');
       o.giris=al('giris')?trTarihCoz(al('giris')):'';o.cikis=al('cikis')?trTarihCoz(al('cikis')):'';if(al('giris')&&!o.giris)o.hata=o.hata||'Giriş tarihi okunamadı';if(al('cikis')&&!o.cikis)o.hata=o.hata||'Çıkış tarihi okunamadı';
       if(o.giris&&o.cikis&&o.cikis<o.giris)o.hata=o.hata||'Çıkış girişten önce';
       const k=isimAnahtar(ad);const var_=mevcut.find(p=>isimAnahtar(p.ad)===k);if(var_){o.hata=o.hata||'Listede zaten var';}
       if(gorulen[k]){o.uyari='Aynı isim bu yapıştırmada iki kez var';}gorulen[k]=1;
       if(!o.hata&&o.sgk&&o.sgk!==SGK_YOK){const c=S.personel.find(x=>isimAnahtar(x.ad)===k&&x.sgkSube&&x.sgkSube!==SGK_YOK&&x.sgkSube!==o.sgk&&(!x.cikis||x.cikis>=ymd(today())));if(c)o.hata=`Zaten ${subeAdi(c.sgkSube)} şubesinde SGK'lı`;}
       o.sec=!o.hata&&!o.uyari;return o;});
     const iyi=sonuc.filter(x=>!x.hata).length;
     byId('piOut').innerHTML=`<div class="tbl-wrap" style="max-height:46vh;overflow:auto"><table class="pt"><thead><tr><th></th><th class="l">Ad soyad</th><th>Görev</th><th>Şekil</th><th>SGK</th><th>Giriş</th><th>Çıkış</th><th class="l">Durum</th></tr></thead><tbody>${sonuc.map((o,j)=>`<tr class="${o.hata?'oto':''}"><td>${o.hata?'':`<input type="checkbox" data-j="${j}" ${o.sec?'checked':''}>`}</td><td class="l"><b>${esc(o.ad)}</b></td><td>${o.gorev?esc(o.gorev.ad):''}</td><td>${esc(o.sekil||'')}</td><td>${o.sgk===SGK_YOK?'Boş':o.sgk?esc(subeAdi(o.sgk)):''}</td><td>${trTarih(o.giris)}</td><td>${trTarih(o.cikis)}</td><td class="l">${o.hata?`<span class="chip warn">${esc(o.hata)}</span>`:o.uyari?`<span class="chip warn">${esc(o.uyari)}</span>`:'<span class="chip ok">Eklenecek</span>'}</td></tr>`).join('')}</tbody></table></div>
       <div class="row2"><button class="btn grow" id="piNo">Vazgeç</button><button class="btn primary grow" id="piOk" ${iyi?'':'disabled'}>Seçilenleri ekle</button></div>`;
     byId('piNo').onclick=closeSheet;byId('piOut').querySelectorAll('input[data-j]').forEach(c=>c.onchange=()=>{sonuc[+c.dataset.j].sec=c.checked;});
     byId('piOk').onclick=async()=>{const L2=sonuc.filter(o=>!o.hata&&o.sec);if(!L2.length){toast('Seçili kişi yok.');return;}const b=writeBatch(db);const yeni=[];const td=ymd(today());
       L2.forEach(o=>{const pid=slug(o.ad)+'-'+Math.random().toString(36).slice(2,6);const body={ad:o.ad,gorev:o.gorev.ad,grup:o.gorev.grup,sekil:o.sekil,giris:o.giris||'',cikis:o.cikis||'',sgkSube:o.sgk,anaSube:sid};b.set(doc(db,'personel',pid),body);yeni.push({id:pid,...body});});
       try{await b.commit();yeni.forEach(p=>{if(!S.personel.some(x=>x.id===p.id))S.personel.push(p);});
         const hafta=mondayOf(today());const aktif=yeni.filter(p=>(!p.cikis||p.cikis>=td)&&(!p.giris||p.giris<=ymd(addDays(parse(hafta),6))));for(const p of aktif)await cizelgeyeKoy(sid,hafta,p.id);
         closeSheet();toast(`${yeni.length} personel eklendi${aktif.length?`, ${aktif.length} kişi bu haftanın çizelgesine kondu`:''}.`);render();}catch(e){yazmaHatasi(e);}};};
   T.oninput=coz;T.focus();});}
function personelYazabilir(p){const m=S.me.subeler||[];return isIsveren()||!p.anaSube||m.includes(p.anaSube)||m.includes(p.sgkSube);}
function erisimVar(sid){return isIsveren()||(S.me.subeler||[]).includes(sid);}
// Şubenin listesi: o şubede çalışanlar + SGK'sı o şubede olanlar (başka şubede çalışsa da).
function subePersoneli(sid=S.subeId){return S.personel.filter(p=>p.anaSube===sid||p.sgkSube===sid);}
function personelMod(){return `<div class="seg" id="pMod" style="margin-bottom:10px"><button data-v="kart" class="${S.plist?'':'on'}">Kartlar</button><button data-v="liste" class="${S.plist?'on':''}">Bilgi listesi</button></div>`;}
function personelModBagla(){document.querySelectorAll('#pMod button').forEach(b=>b.onclick=()=>{S.plist=b.dataset.v==='liste';tryLS('pm.plist',S.plist?'1':'0');render();});}
function renderPersonel(){return renderBilgiListesi();}
function eskiKartListesi(){const list=sirala(subePersoneli());const td=ymd(today());
  let h=personelMod()+`<div class="actions"><button class="btn primary grow" id="addP">Personel ekle</button></div><p class="note" style="margin-top:0">${esc(sube().ad)} personel listesi. SGK'sı bu şubede olup başka şubede çalışanlar da burada görünür.</p>`;
  if(!list.length)return view(h+`<div class="empty-state"><b>Henüz personel yok</b>"Personel ekle" ile şubenin çalışanlarını girin.</div>`,()=>{personelModBagla();byId('addP').onclick=()=>personelPanel(null);});
  const aktif=list.filter(p=>!p.cikis||p.cikis>=td),cikan=list.filter(p=>p.cikis&&p.cikis<td);
  const row=p=>`<button class="row" data-id="${esc(p.id)}"><div class="av">${esc(bas(p.ad))}</div><div class="m"><b>${esc(p.ad)}</b><span>${esc(gorevTahmin(p)||'Görev seçilmemiş')}${p.sekil==='Part'?' · Part':''} · SGK: ${p.sgkSube===SGK_YOK?'yok':p.sgkSube?esc(subeAdi(p.sgkSube)):'<b style="color:var(--warn)">seçilmemiş</b>'}${p.anaSube&&p.anaSube!==S.subeId?' · çalıştığı: '+esc(subeAdi(p.anaSube)):''}${p.giris?' · giriş '+trTarih(p.giris):''}</span></div>
    <div class="r">${p.cikis?`<span class="chip ${p.cikis<td?'mut':'warn'}">Çıkış ${trTarih(p.cikis)}</span>`:''}</div></button>`;
  GRUP_SIRA.forEach(g=>{const l=aktif.filter(p=>(p.grup||'K')===g);if(l.length)h+=`<div class="sec">${GRUP[g]} · ${l.length}</div><div class="card list">${l.map(row).join('')}</div>`;});
  if(cikan.length)h+=`<div class="sec">Çıkış yapanlar · ${cikan.length}</div><div class="card list">${cikan.map(row).join('')}</div>`;
  view(h,()=>{personelModBagla();byId('addP').onclick=()=>personelPanel(null);document.querySelectorAll('.row[data-id]').forEach(b=>b.onclick=()=>personelPanel(b.dataset.id));});}
function personelPanel(id,gr,opt={}){const p=id?S.personel.find(x=>x.id===id):{ad:'',grup:gr||'K',gorev:'',sekil:'Tam',giris:ymd(today()),cikis:'',anaSube:S.subeId};if(!p)return;
  const yaz=personelYazabilir(p);const gv=id?gorevTahmin(p):'';const sgk=p.sgkSube||'';const subeler=tumSubeler();
  const anaSec=(isIsveren()?S.subeIds:(S.me.subeler||[])).filter(x=>S.subeler[x]);
  const gorevOpt=GOREVLER.filter(g=>id||!gr||g.grup===gr).map(g=>`<option value="${esc(g.ad)}" ${gv===g.ad?'selected':''}>${esc(g.ad)}</option>`).join('');
  openSheet(`<h2>${id?'Personeli düzenle':'Yeni personel · '+GRUP[gr||'K']}</h2><div class="sub">${yaz?'İsim puantaj ve bordro eşleşmesinde kullanılır, bordrodaki gibi yazın.':'Bu kişi başka bir şubeye kayıtlı; bilgilerini o şube düzenler.'}</div>
   <label class="field"><span>Ad soyad (büyük harf)</span><input id="pAd" value="${esc(adBuyuk(p.ad))}" autocomplete="off" autocapitalize="characters" ${yaz?'':'disabled'}></label>
   <label class="field"><span>Görev</span><select id="pGorev" ${yaz?'':'disabled'}><option value="">Seçin</option>${gorevOpt}</select></label>
   <div id="pSekilW"><span class="lbl">Çalışma şekli</span><div class="seg" id="pSekil">${['Tam','Part'].map(x=>`<button data-v="${x}" class="${(p.sekil==='Part'?'Part':'Tam')===x?'on':''}" ${yaz?'':'disabled'}>${x}</button>`).join('')}</div></div>
   <label class="field"><span>SGK şubesi (maaşı bu şubenin puantajında)</span><select id="pSgk" ${yaz?'':'disabled'}><option value="" ${!sgk?'selected':''}>Seçin</option><option value="${SGK_YOK}" ${sgk===SGK_YOK?'selected':''}>Boş (SGK şubesi yok)</option>${subeler.map(([sid,ad])=>`<option value="${esc(sid)}" ${sgk===sid?'selected':''}>${esc(ad)}</option>`).join('')}</select></label>
   <label class="field"><span>Çalıştığı şube (çizelgesinde göründüğü)</span><select id="pAna" ${yaz?'':'disabled'}>${(anaSec.includes(p.anaSube||S.subeId)?anaSec:[p.anaSube||S.subeId,...anaSec]).map(x=>`<option value="${esc(x)}" ${(p.anaSube||S.subeId)===x?'selected':''}>${esc(subeAdi(x))}</option>`).join('')}</select></label>
   <div class="fgrid"><label class="field"><span>İşe giriş</span><input id="pGiris" type="date" value="${esc(p.giris||'')}" ${yaz?'':'disabled'}></label><label class="field"><span>Çıkış (boşsa çalışıyor)</span><input id="pCikis" type="date" value="${esc(p.cikis||'')}" ${yaz?'':'disabled'}></label></div>
   ${id&&!p.cikis&&yaz?'<button class="btn" id="pOut" style="margin-top:8px;width:100%">Bugün itibarıyla çıkış ver</button>':''}
   <div id="pWarn"></div><div class="row2">${id&&yaz?'<button class="btn danger" id="pDel">Personeli sil</button>':''}<button class="btn grow" id="pNo">${yaz?'Vazgeç':'Kapat'}</button>${yaz?'<button class="btn primary grow" id="pOk">Kaydet</button>':''}</div>`,sh=>{
   sh.querySelectorAll('#pSekil button').forEach(bt=>bt.onclick=()=>{sh.querySelectorAll('#pSekil button').forEach(x=>x.classList.remove('on'));bt.classList.add('on');});
   const G=byId('pGorev');const tog=()=>{const g=gorevBul(G.value);byId('pSekilW').hidden=!!(g&&g.sekil);};G.onchange=tog;tog();
   const po=byId('pOut');if(po)po.onclick=()=>{byId('pCikis').value=ymd(today());po.hidden=true;};byId('pNo').onclick=closeSheet;const W=byId('pWarn');if(!yaz)return;
   byId('pAd').oninput=e=>{const el=e.target,a=el.selectionStart,b=el.selectionEnd;el.value=el.value.toLocaleUpperCase('tr-TR');try{el.setSelectionRange(a,b);}catch(_){}};
   byId('pOk').onclick=()=>{const ad=adBuyuk(byId('pAd').value);if(!ad){W.innerHTML='<div class="confirm">Ad soyad gerekli.</div>';return;}
     const g=gorevBul(G.value);if(!g){W.innerHTML='<div class="confirm">Görev seçin.</div>';return;}
     const sgkV=byId('pSgk').value;if(!sgkV){W.innerHTML='<div class="confirm">SGK şubesini seçin. SGK şubesi yoksa "Boş" seçeneğini seçin.</div>';return;}
     // Bir kişi sadece bir şubede SGK'lı olabilir: aynı isim ya da TC'li başka kayıt başka şubede SGK'lıysa kaydetme.
     if(sgkV!==SGK_YOK){const tcK=p.tc||'';const cak=S.personel.find(x=>x.id!==id&&x.sgkSube&&x.sgkSube!==SGK_YOK&&x.sgkSube!==sgkV&&(isimAnahtar(x.ad)===isimAnahtar(ad)||(tcK&&x.tc===tcK))&&(!x.cikis||x.cikis>=ymd(today())));
       if(cak){W.innerHTML=`<div class="confirm bad">${esc(adBuyuk(cak.ad))} zaten ${esc(subeAdi(cak.sgkSube))} şubesinde SGK'lı. Bir kişi sadece bir şubede SGK'lı olabilir. Başka şubede de çalışıyorsa SGK şubesini ${esc(subeAdi(cak.sgkSube))} bırakın, "Çalıştığı şube"yi değiştirin.</div>`;return;}}
     const anaS=byId('pAna').value||S.subeId;const ayni=subePersoneli(anaS).find(x=>x.id!==id&&isimAnahtar(x.ad)===isimAnahtar(ad));if(ayni&&!W.dataset.ok){W.dataset.ok='1';W.innerHTML=`<div class="confirm">${esc(subeAdi(anaS))} listesinde bu isimde biri zaten var. Aynı kişiyse yeni kayıt açmayın. Farklı kişiyse tekrar Kaydet'e basın.</div>`;return;}
     const bilgi={};
     const giris=byId('pGiris').value,cikis=byId('pCikis').value;if(giris&&cikis&&cikis<giris){W.innerHTML='<div class="confirm">Çıkış tarihi girişten önce olamaz.</div>';return;}
     const sekil=g.sekil||sh.querySelector('#pSekil .on').dataset.v;const ana=byId('pAna').value||S.subeId;
     const body={ad,gorev:g.ad,grup:g.grup,sekil,giris,cikis,sgkSube:sgkV,anaSube:ana,...bilgi};if(p.sira!=null)body.sira=p.sira;const pid=id||(slug(ad)+'-'+Math.random().toString(36).slice(2,6));
     const p0={...p};sirayla('p'+pid,()=>setDoc(doc(db,'personel',pid),body,{merge:true}));if(!id)S.personel.push({id:pid,...body});else Object.assign(p,body);closeSheet();
     const ilkHafta=mondayOf(giris&&parse(giris)>today()?parse(giris):today());
     if(opt.sonra)opt.sonra(pid);
     const eskiAna=id?p0.anaSube:null,eskiSgk=id?p0.sgkSube:null;
     const yeniSube=!id||(eskiAna!==ana);if(yeniSube&&!(opt.sonra&&ana===S.subeId))cizelgeyeKoy(ana,ilkHafta,pid);
     let sgkNot='';if(sgkV&&sgkV!==SGK_YOK&&sgkV!==ana&&(!id||eskiSgk!==sgkV)){if(erisimVar(sgkV)){cizelgeyeKoy(sgkV,ilkHafta,pid);sgkNot=`, ${subeAdi(sgkV)} çizelgesine de eklendi`;}else sgkNot=`. ${subeAdi(sgkV)} listesinde de görünür, o şubenin müdürü çizelgesine ekleyebilir`;}
     toast((id?'Personel güncellendi':`Personel eklendi${ana!==S.subeId?', '+subeAdi(ana)+' çizelgesine de eklendi':''}`)+sgkNot+'.');};
   const del=byId('pDel');if(del)del.onclick=()=>{if(!del.dataset.ok){del.dataset.ok='1';del.textContent='Evet, sil';W.innerHTML='<div class="confirm">Kişi şirketin personel listesinden silinir. Ayrılan biri için silmek yerine çıkış tarihi girin.</div>';return;}
     sirayla('p'+id,()=>deleteDoc(doc(db,'personel',id)));closeSheet();toast(`${p.ad} silindi.`);};});}

/* ================= Ay sonu (şube müdürü) ================= */
function renderAy(){const ak=S.ay||gosterAy(S.hafta);S.ay=ak;const sb=sube();const kisiler=sirala(ayKadrosu(ak));const R=kisiler.map(p=>({p,a:ayHesap(p,ak,sb)}));
  const d=S.aylar[ak]||{durum:'taslak'};const kilit=d.durum==='sube_onay'||d.durum==='bolge_onay';
  const topFm=R.reduce((s,x)=>s+x.a.fm,0),rap=R.reduce((s,x)=>s+(x.a.kod.R||0),0),ui=R.reduce((s,x)=>s+(x.a.kod.UI||0),0),bos=R.reduce((s,x)=>s+x.a.bos,0);
  let h=`<div class="weeknav"><button class="nav-arrow" id="prevM">‹</button><div class="ttl">${ayAdi(ak)}<small>${DURUM[d.durum].ad}</small></div><button class="nav-arrow" id="nextM">›</button></div>`;
  if(sb.fmDonem==='hafta'){const L=fmHaftalari(ak);const bitis=ymd(addDays(parse(L[L.length-1]),6));h+=`<div class="banner ${ymd(today())<=bitis&&!kilit?'':'ok'}">Fazla mesai dönemi: ${fmDonemYazi(ak,sb)}.${ymd(today())<=bitis&&!kilit?` Ayı ${trTarih(bitis)} çizelgesi bittikten sonra kapatın.`:''}</div>`;}
  if(d.durum==='geri')h+=`<div class="banner bad">Bölge müdürü geri gönderdi${d.not?': "'+esc(d.not)+'"':''}. Düzeltip ayı yeniden kapatın.</div>`;
  if(d.durum==='sube_onay')h+=`<div class="banner">Ay kapatıldı, bölge müdürünün onayı bekleniyor. Bu ayın günleri kilitli.</div>`;
  if(d.durum==='bolge_onay')h+=`<div class="banner ok">Bölge müdürü onayladı. Puantaj işverene gönderildi.</div>`;
  h+=`<div class="kpis"><div class="kpi"><span>Toplam fazla mesai</span><b>${fmt(topFm)} sa</b></div><div class="kpi"><span>Çalışan</span><b>${R.length}</b></div><div class="kpi"><span>Rapor / Ücr. izin</span><b>${rap} / ${ui} gün</b></div><div class="kpi"><span>Boş gün</span><b style="color:${bos?'var(--warn)':'var(--ok)'}">${bos?bos+' gün':'Yok'}</b></div></div>`;
  if(bos)h+=`<p class="note">Boş gün: kişinin o hafta başka kaydı var ama o gün boş. Fazla mesaiden ${fmt(sb.gunluk)} saat düşülür. Ayı kapatmadan önce doldurun.</p>`;
  let son=null;R.forEach(({p,a})=>{const g=p.grup||'K';if(g!==son){if(son)h+='</div>';son=g;h+=`<div class="sec">${GRUP[g]}</div><div class="card list">`;}
    const tags=['R','UI','YI','B'].filter(k=>a.kod[k]).map(k=>`<span class="tag">${a.kod[k]} ${KOD[k].ad.toLocaleLowerCase('tr-TR')}</span>`).join('')+(a.bos?`<span class="tag warn">${a.bos} boş gün</span>`:'');
    const sag=a.esnaf?`<b>${fmt(a.h)} sa</b><span>esnaf</span>`:a.part?`<b>${fmt(a.h)} sa</b><span>part</span>`:`<b>${sg(a.fm)} sa</b><span>${fmt(a.h)} sa çalıştı</span>`;
    h+=`<div class="row"><div class="av">${esc(bas(p.ad))}</div><div class="m"><b>${esc(p.ad)}</b><span>${esc(p.gorev||GRUP[g])} · ${p.sekil==='Part'?`${a.gun} gün çalıştı`:`${a.bordroGun} gün${a.gun!==a.bordroGun?` <em style="font-style:normal;color:var(--mut)">(${a.gun} gün çalıştı)</em>`:''}`}</span>${tags?`<div class="tags">${tags}</div>`:''}</div><div class="r">${sag}</div></div>`;});
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
  S.pt.temiz=false;subs.detay.push(onSnapshot(doc(db,'puantaj',id,'aylar',ak),s=>{S.pt.doc=s.exists()?s.data():{};if(!S.pt.temiz){S.pt.temiz=true;veriBosTemizle();}render();},e=>{S.pt.doc={};yazmaHatasi(e);}));
  subs.detay.push(onSnapshot(doc(db,'maaslar',id),s=>{S.pt.maas=s.exists()?s.data():{};render();},()=>{S.pt.maas={};}));
  getDocs(query(collection(db,'ozetler'),where('ay','==',ak))).then(q=>{const m={};q.docs.forEach(d=>{const x=d.data();if(x.sube)m[x.sube]=x.kisiler||{};});S.pt.ozetler=m;render();}).catch(e=>console.error(e));
  getDoc(doc(db,'puantaj',id,'aylar',ayKaydir(ak,-1))).then(s=>{S.pt.prev=s.exists()?s.data():{};render();}).catch(()=>{S.pt.prev={};});render();}
function ucretSekli(pid){const m=S.pt.maas||{};const u=m.ucretSekli&&m.ucretSekli[pid];if(u)return u;return m.paketBasi&&m.paketBasi[pid]?'paket':'maas';}
function paketBasiMi(pid){return ucretSekli(pid)==='paket';}
function usOf(pid){const m=S.pt.maas||{};return{tip:ucretSekli(pid),saatUcret:sayi(m.saatUcret&&m.saatUcret[pid])};}
function ptSol(ak,D){const oz=veriOzet(D.veri);return veriUygula(solHesap(ak,S.subeId,S.pt.ozetler||{},Object.keys(oz)),oz);}
function ptVerisi(){const ak=S.ay;const D=S.pt.doc||{};const kilitli=D.kilitli===true;const sol=kilitli&&D.sol?D.sol:ptSol(ak,D);const oz=veriOzet(D.veri);const sb=sube();const net=(S.pt.maas&&S.pt.maas.net)||{};
  const prevSag=(S.pt.prev&&S.pt.prev.sag)||{};const sag=D.sag||{};
  const ids=Object.keys(sol).sort((a,b)=>String(sol[a].ad).localeCompare(String(sol[b].ad),'tr'));
  const satir=ids.map(pid=>{const dv=prevSag[pid]&&prevSag[pid].kalan<0?prevSag[pid].kalan:0;return{pid,sol:sol[pid],sag:sag[pid]||{},net:net[pid],hes:sagHesap(pid,sol[pid],sag[pid],net[pid],sb,dv,oz[pid],usOf(pid))};});
  return{ak,kilitli,sol,satir,sb,D,oz};}
function renderPuantajDetay(){const vg=byId('vGrid');const ae=document.activeElement;if(S.pt.gorunum==='veri'&&vg&&vg.contains(ae)&&/INPUT|SELECT/.test(ae.tagName)&&!S.pt.zorla)return;S.pt.zorla=false;const ak=S.ay;const sb=sube();const durum=(S.aylar[ak]||{durum:'taslak'}).durum;const D=DURUM[durum]||DURUM.taslak;
  let h=`<div class="weeknav"><button class="nav-arrow" id="geriL" aria-label="Şube listesi">‹</button><div class="ttl">${esc(sb.ad)} · ${ayAdi(ak)}<small>${D.ad}</small></div><span style="width:40px"></span></div>`;
  if(S.pt.doc===null||S.pt.maas===null||!S.loaded.personel||!S.loaded.haftalar)return view(h+`<div class="empty-state"><b>Puantaj yükleniyor</b></div>`,()=>byId('geriL').onclick=listeyeDon);
  const V=ptVerisi();const ad=S.aylar[ak]||{};
  if(sb.fmDonem==='hafta')h+=`<div class="banner ok">Fazla mesai dönemi: ${fmDonemYazi(ak,sb)} (haftalık). Rapor, izin ve bordro günü takvim ayına göre.</div>`;
  if(durum==='taslak')h+=`<div class="banner">Şube müdürü bu ayı henüz kapatmadı. Rakamlar çizelge değiştikçe güncellenir.</div>`;
  if(durum==='geri')h+=`<div class="banner bad">Şubeye geri gönderildi${ad.not?': "'+esc(ad.not)+'"':''}.</div>`;
  if(durum==='sube_onay')h+=`<div class="banner">Şube müdürü ayı kapattı${ad.kapatanAd?' ('+esc(ad.kapatanAd)+')':''}. Kontrol edip onaylayın ya da geri gönderin.</div>`;
  if(durum==='bolge_onay'&&V.kilitli)h+=`<div class="banner ok">Onaylandı${V.D.onaylayanAd?' · '+esc(V.D.onaylayanAd):''}. Muhasebe tarafı kilitli, ödemeler işlenebilir.</div>`;
  h+=`<div class="seg" style="margin:4px 0 12px" id="ptSeg"><button data-v="sol" class="${S.pt.gorunum==='sol'?'on':''}">Muhasebe</button><button data-v="sag" class="${S.pt.gorunum==='sag'?'on':''}">Ödemeler</button><button data-v="veri" class="${S.pt.gorunum==='veri'?'on':''}">Veri girişi</button></div>`;
  const cikisMi=s=>s.cikis&&s.cikis<=ayKaydir(ak,1)+'-00';
  const etiketler=x=>{const L=[];if(x.hes.esnaf)L.push('Esnaf kurye');else if(x.hes.pb)L.push('Paket başı');else if(x.hes.saat)L.push('Saatlik');else L.push(x.sol.sekil==='Part'?'Part':'Tam');if(x.hes.netYok)L.push('Net maaş yok');if(cikisMi(x.sol))L.push('Çıkış yapan');if(x.sol.maasBurada===false)L.push('Sadece FM');if(x.hes.kalan<-0.004)L.push('Kalan eksi');if(x.sol.hakGun!=null&&x.sol.hakGun!==x.sol.gun)L.push('Deneme');return L;};
  const durumK={k:'durum',ad:'Durum',vals:etiketler};const n0=v=>v||0;const tlv=v=>Math.abs(v||0)>0.004?tl(v):'';
  if(S.pt.gorunum==='sol'){
    const KS=[{k:'sgk',ad:'SGK şube',v:x=>x.sol.sgkSube,l:1},{k:'ad',ad:'Ad soyad',v:x=>x.sol.ad,ek:durumK,l:1},{k:'gorev',ad:'Görev',v:x=>muhGorev(x.sol)},{k:'sekil',ad:'Şekil',v:x=>x.sol.muhSekil||x.sol.sekil},{k:'giris',ad:'Giriş',v:x=>trTarih(x.sol.giris),n:x=>x.sol.giris||''},{k:'cikis',ad:'Çıkış',v:x=>trTarih(x.sol.cikis),n:x=>x.sol.cikis||''},
      {k:'rapor',ad:'Rapor',v:x=>x.sol.rapor||'',n:x=>n0(x.sol.rapor)},{k:'ui',ad:'Ücr. izin',v:x=>x.sol.ucretsiz||'',n:x=>n0(x.sol.ucretsiz)},{k:'pg',ad:'Part gün',v:x=>x.sol.partGun?fmt(x.sol.partGun):'',n:x=>n0(x.sol.partGun)},{k:'yi',ad:'Yıllık izin',v:x=>x.sol.yillik||'',n:x=>n0(x.sol.yillik)},{k:'b',ad:'Bayram',v:x=>x.sol.bayram||'',n:x=>n0(x.sol.bayram)},{k:'gun',ad:'Bordro gün',v:x=>x.sol.maasBurada===false&&!x.sol.muhBurada?'—':x.sol.gun,n:x=>n0(x.sol.gun)}];
    const tabanS=V.satir.filter(x=>muhasebedeMi(x.sol));const LS=kfUygula('sol',KS,tabanS);S.pt._kf={t:'sol',cols:KS,rows:tabanS};
    if(kfAktifMi('sol'))h+=`<div class="kfbar">Filtre açık · ${LS.length} / ${tabanS.length} kişi gösteriliyor <button class="mini" id="kfHepsi">Filtreleri kaldır</button></div>`;
    h+=`<div class="tbl-wrap"><table class="pt"><thead><tr>${KS.map(c=>kfBaslik('sol',c,c.l?'l':'')).join('')}</tr></thead><tbody>`;
    const gizli=V.satir.filter(({sol})=>!muhasebedeMi(sol));
    LS.forEach(({sol})=>{const fo=sol.maasBurada===false&&!sol.muhBurada;h+=`<tr class="${cikisMi(sol)?'cikis':''}"><td class="l">${esc(sol.sgkSube)}</td><td class="l"><b>${esc(sol.ad)}</b>${fo?' <span class="tag">sadece fazla mesai</span>':''}${sol.muhBurada&&sol.maasBurada===false?` <span class="tag">ödemesi ${esc(sol.odemeSube)}</span>`:''}${sol.baska&&sol.baska.length?` <span class="tag">+ ${esc(sol.baska.join(', '))}</span>`:''}${sol.bosGun?` <span class="tag warn">${sol.bosGun} boş</span>`:''}${sol.elle?' <span class="tag">+ veri girişi</span>':''}${sol.sekil==='Part'&&!sol.partGun?' <span class="tag warn">part gün girilmedi</span>':''}</td><td>${esc(muhGorev(sol))}</td><td>${esc(sol.muhSekil||sol.sekil)}</td><td>${trTarih(sol.giris)}</td><td>${trTarih(sol.cikis)}</td><td>${sol.rapor||''}</td><td>${sol.ucretsiz||''}</td><td>${sol.partGun?fmt(sol.partGun):''}</td><td>${sol.yillik||''}</td><td>${sol.bayram||''}</td><td>${fo?'—':sol.gun}</td></tr>`;});
    h+=`</tbody></table></div><div class="legend"><span><i style="background:var(--yel)"></i>Çıkış yapan</span><span>Bordro gün = 30 − rapor − ücretsiz izin (ay ortasında giriş/çıkışta çalışılan takvim günü); part çalışanlarda bordro gün = part gün</span></div>
    ${gizli.length?`<p class="note"><b>Muhasebede gösterilmeyen ${gizli.length} kişi</b> (SGK'sı başka şubede ya da SGK'sı yok): ${gizli.map(x=>esc(x.sol.ad)).join(', ')}. Bu kişiler sadece Ödemeler tarafında.</p>`:''}
    <p class="note">Maaş, rapor ve izinler kişinin SGK şubesinde. Fazla mesai muhasebeye gitmez; Ödemeler tarafında, çalıştığı her şubede ayrı hesaplanır. Diğer şubelerdeki izin günleri o şubeler ayı kapattıkça eklenir. "+ şube adı" etiketi o şubeden gelen günlerin eklendiğini gösterir.</p>`;
    h+=`<div class="actions" style="margin-top:12px"><button class="btn grow" id="pdfB">Muhasebe çıktısı · PDF / fotoğraf / WhatsApp</button></div>`;}
  else if(S.pt.gorunum==='veri')h+=veriGirisiHtml(V);
  else{
    const T=V.satir.reduce((t,x)=>{t.hak+=x.hes.hak+x.hes.fmTl+x.hes.paketPrimi+x.hes.ciroPrimi;t.bankaya+=x.hes.bankaya;t.avans+=x.hes.avans+x.hes.araOdeme;t.nakit+=Math.max(x.hes.kalan,0);return t;},{hak:0,bankaya:0,avans:0,nakit:0});
    h+=`<div class="kpis"><div class="kpi"><span>Toplam hak ediş</span><b>${tl0(T.hak)}</b></div><div class="kpi"><span>Bankaya yatan</span><b>${tl0(T.bankaya)}</b></div><div class="kpi"><span>Avans + ara ödeme</span><b>${tl0(T.avans)}</b></div><div class="kpi"><span>İhtiyaç duyulan nakit</span><b>${tl0(T.nakit)}</b></div></div>`;
    const netOf=x=>x.hes.esnaf||x.hes.maasYok||x.hes.pb?0:sayi(x.net);
    const KO=[{k:'ad',ad:'Ad soyad',v:x=>x.sol.ad,ek:durumK,l:1},{k:'gorev',ad:'Görev',v:x=>muhGorev(x.sol)},{k:'gun',ad:'Gün',v:x=>x.hes.saat?fmt(x.hes.saatSayi)+' sa':x.hes.esnaf||x.hes.maasYok?'—':(x.sol.hakGun!=null?x.sol.hakGun:x.sol.gun),n:x=>n0(x.sol.hakGun!=null?x.sol.hakGun:x.sol.gun)},
{k:'hak',ad:'Hak edilen',v:x=>x.hes.pb?'':tlv(x.hes.hak),n:x=>n0(x.hes.hak)},{k:'bankaya',ad:'Bankaya yatan',v:x=>tlv(x.hes.bankaya),n:x=>n0(x.hes.bankaya)},{k:'ara',ad:'Ara ödeme',v:x=>tlv(x.hes.araOdeme),n:x=>n0(x.hes.araOdeme)},
      {k:'mf',ad:'Maaş farkı',v:x=>x.hes.pb?'':tlv(x.hes.maasFarki),n:x=>n0(x.hes.maasFarki)},{k:'fm',ad:'Fazla mesai',v:x=>tlv(x.hes.fmTl),n:x=>n0(x.hes.fmTl)},{k:'pp',ad:'Paket primi',v:x=>tlv(x.hes.paketPrimi),n:x=>n0(x.hes.paketPrimi)},{k:'cp',ad:'Ciro primi',v:x=>tlv(x.hes.ciroPrimi),n:x=>n0(x.hes.ciroPrimi)},
      {k:'avans',ad:'Avans',v:x=>tlv(x.hes.avans),n:x=>n0(x.hes.avans)},{k:'kalan',ad:'Kalan ödeme',v:x=>tl(x.hes.kalan),n:x=>n0(x.hes.kalan)}];
    S.pt._kf={t:'sag',cols:KO,rows:V.satir};
    if(kfAktifMi('sag'))h+=`<div class="kfbar">Filtre açık · toplamlar sadece görünen kişiler için <button class="mini" id="kfHepsi">Filtreleri kaldır</button></div>`;
    h+=`<div class="tbl-wrap"><table class="pt"><thead><tr>${KO.map(c=>kfBaslik('sag',c,c.l?'l':'')).join('')}</tr></thead><tbody>`;
    const tbBas=h.length;
    const VS=kfUygula('sag',KO,V.satir);VS.forEach(({pid,sol,net,hes})=>{const cls=hes.kalan<-0.004?'eksi':cikisMi(sol)?'cikis':'';
      h+=`<tr class="click ${cls}" data-pid="${esc(pid)}"><td class="l"><b>${esc(sol.ad)}</b><br><span class="tag">${esc(sol.sekil)}</span>${hes.netYok?' <span class="tag warn">net maaş yok</span>':''}${hes.pb?' <span class="tag">paket başı</span>':''}${hes.saat?` <span class="tag">saatlik ${tl(hes.saatUcret)}</span>`:''}${hes.maasYok?` <span class="tag">${sol.muhBurada&&sol.odemeSube?'maaşı '+esc(sol.odemeSube)+' şubesinde':'sadece fazla mesai'}</span>`:''}</td><td>${esc(muhGorev(sol))}</td><td>${hes.saat?`${fmt(hes.saatSayi)} sa`:hes.esnaf||hes.maasYok?'—':(sol.hakGun!=null&&sol.hakGun!==sol.gun?`${sol.hakGun}<br><span class="tag warn" title="Deneme günleri: SGK ${sol.gun} gün">SGK ${sol.gun}</span>`:sol.gun)}</td><td>${hes.pb?'—':tlv(hes.hak)}</td><td>${tlv(hes.bankaya)}</td><td>${hes.araOdeme?tl(hes.araOdeme):''}</td><td>${hes.pb?'—':tlv(hes.maasFarki)}</td><td>${hes.fmTl?tl(hes.fmTl):''}</td><td>${hes.paketPrimi?tl(hes.paketPrimi):''}</td><td>${hes.ciroPrimi?tl(hes.ciroPrimi):''}</td><td>${hes.avans?tl(hes.avans):''}${hes.devirAvans?`<br><span class="tag" title="Geçen aydan eksi kalan">devir ${tl(hes.devirAvans)}</span>`:''}</td><td class="${hes.kalan<0?'neg':'pos'}">${tl(hes.kalan)}</td></tr>`;});
    const top=k=>VS.reduce((t,x)=>t+(x.hes[k]||0),0);const tt=v=>Math.abs(v)>0.004?tl(v):'';const kalT=top('kalan');const netT=VS.reduce((t,x)=>t+(x.hes.esnaf||x.hes.maasYok||x.hes.pb?0:sayi(x.net)),0);
    const totRow=`<tr class="tot"><td class="l">${kfAktifMi('sag')?`Filtreli toplam · ${VS.length} / ${V.satir.length} kişi`:`Toplam · ${VS.length} kişi`}</td><td></td><td></td><td>${tt(top('hak'))}</td><td>${tt(top('bankaya'))}</td><td>${tt(top('araOdeme'))}</td><td>${tt(top('maasFarki'))}</td><td>${tt(top('fmTl'))}</td><td>${tt(top('paketPrimi'))}</td><td>${tt(top('ciroPrimi'))}</td><td>${tt(top('avans'))}</td><td class="${kalT<0?'neg':'pos'}">${tl(kalT)}</td></tr>`;
    h=h.slice(0,tbBas)+totRow.replace('class="tot"','class="tot ust"')+h.slice(tbBas);
    h+=`</tbody></table></div>
     <div class="legend"><span><i style="background:var(--yel)"></i>Çıkış yapan</span><span><i style="background:var(--red)"></i>Kalan eksi: sonraki aya devreder</span><span>Satıra dokunup ödemeleri girin</span></div>`;}
  const bolgeIs=durum==='sube_onay'||(isIsveren()&&durum!=='bolge_onay');
  h+=`<div class="row2">${bolgeIs?`<button class="btn danger grow" id="geriB">Şubeye geri gönder</button><button class="btn primary grow" id="onayB">Onayla ve kilitle</button>`:''}${isIsveren()&&durum==='bolge_onay'?'<button class="btn grow" id="acB">Kilidi aç</button>':''}</div>`;
  view(h,()=>{byId('geriL').onclick=listeyeDon;document.querySelectorAll('#ptSeg button').forEach(b=>b.onclick=()=>{if(S.pt.gorunum==='veri'&&b.dataset.v!=='veri')veriBosTemizle();S.pt.gorunum=b.dataset.v;S.pt.vsel=null;render();});
    const pb=byId('pdfB');if(pb)pb.onclick=()=>muhasebeCiktisi(V);const bb=byId('bordroB');if(bb)bb.onclick=()=>bordroPanel(V);
    if(S.pt._kf&&S.pt.gorunum!=='veri'){kfBagla(S.pt._kf.t,S.pt._kf.cols,S.pt._kf.rows);const kh=byId('kfHepsi');if(kh)kh.onclick=()=>{kfDurum(S.pt._kf.t).f={};render();};}
    if(S.pt.gorunum==='veri')veriGirisiBagla(V);else document.querySelectorAll('tr[data-pid]').forEach(r=>r.onclick=()=>odemePanel(r.dataset.pid));
    const ob=byId('onayB');if(ob)ob.onclick=()=>{if(!ob.dataset.ok){ob.dataset.ok='1';ob.textContent='Onayı kesinleştir';return;}onayla();};
    const gb=byId('geriB');if(gb)gb.onclick=geriGonderPanel;const ab=byId('acB');if(ab)ab.onclick=()=>{if(!ab.dataset.ok){ab.dataset.ok='1';ab.textContent='Kilidi açmayı onayla';return;}kilidiAc();};});}
/* ================= Excel tarzı sütun filtresi ================= */
const BOS_V='(Boş)';
function kfDurum(t){S.pt.kf=S.pt.kf||{};return S.pt.kf[t]=S.pt.kf[t]||{f:{},sort:null};}
function kfDegerler(c,x){const v=c.vals?c.vals(x):[c.v(x)];return v.map(y=>y==null||y===''?BOS_V:String(y));}
function kfUygula(t,cols,rows){const st=kfDurum(t);const hepsi=[];cols.forEach(c=>{hepsi.push(c);if(c.ek)hepsi.push(c.ek);});
  let R=rows.filter(x=>hepsi.every(c=>{const sel=st.f[c.k];if(!sel)return true;return kfDegerler(c,x).some(v=>sel.includes(v));}));
  if(st.sort){const c=hepsi.find(c=>c.k===st.sort.k);if(c){const key=c.n||(x=>kfDegerler(c,x)[0]);R=R.slice().sort((a,b)=>{const A=key(a),B=key(b);const r=typeof A==='number'&&typeof B==='number'?A-B:String(A).localeCompare(String(B),'tr');return st.sort.d*r;});}}
  return R;}
function kfAktifMi(t){const st=kfDurum(t);return Object.keys(st.f).length>0;}
function kfBaslik(t,c,cls){const st=kfDurum(t);const akt=!!st.f[c.k]||!!(c.ek&&st.f[c.ek.k]);const so=st.sort&&(st.sort.k===c.k);
  return `<th class="${cls||''}"><button class="kfb ${akt?'on':''}" data-kft="${t}" data-kfc="${c.k}" title="Filtrele / sırala">${c.ad}<i>${so?(st.sort.d>0?'▲':'▼'):akt?'⧩':'▾'}</i></button></th>`;}
function kfBagla(t,cols,rows){document.querySelectorAll(`.kfb[data-kft="${t}"]`).forEach(b=>b.onclick=e=>{e.stopPropagation();const c=cols.find(c=>c.k===b.dataset.kfc);if(c)kfAc(t,c,rows,b);});}
function kfAc(t,c,rows,btn){kfKapat();const st=kfDurum(t);const pop=document.createElement('div');pop.className='kfpop';pop.id='kfPop';
  const bolum=(cc,ara)=>{const say={};const ord={};rows.forEach(x=>kfDegerler(cc,x).forEach((v,i)=>{say[v]=(say[v]||0)+1;if(ord[v]==null)ord[v]=cc.n?cc.n(x):v;}));
    const vals=Object.keys(say).sort((a,b)=>a===BOS_V?1:b===BOS_V?-1:typeof ord[a]==='number'&&typeof ord[b]==='number'?ord[a]-ord[b]:String(a).localeCompare(String(b),'tr'));const sel=st.f[cc.k];
    return `<div class="kfsec" data-k="${cc.k}">${cc.baslik?`<div class="kft">${esc(cc.baslik)}</div>`:''}${ara?`<input class="kfara" placeholder="Ara">`:''}
      <label class="kfrow kfall"><input type="checkbox" ${!sel?'checked':''}> (Tümünü seç)</label><div class="kflist">${vals.map(v=>`<label class="kfrow" data-ara="${esc(isimAnahtar(v))}"><input type="checkbox" value="${esc(v)}" ${!sel||sel.includes(v)?'checked':''}> <span>${esc(v)}</span><em>${say[v]}</em></label>`).join('')}</div></div>`;};
  pop.innerHTML=`<button class="kfs" data-d="1">${c.n?'Küçükten büyüğe':'A → Z'} sırala</button><button class="kfs" data-d="-1">${c.n?'Büyükten küçüğe':'Z → A'} sırala</button>
    ${c.ek?bolum({...c.ek,baslik:c.ek.ad},false):''}${bolum({...c,baslik:c.ek?c.ad:''},true)}
    <div class="kfbtns"><button class="btn small" id="kfTem">Filtreyi temizle</button><button class="btn small primary" id="kfOk">Tamam</button></div>`;
  document.body.appendChild(pop);const r=btn.getBoundingClientRect();const w=Math.min(280,window.innerWidth-16);pop.style.width=w+'px';
  pop.style.left=Math.max(8,Math.min(r.left+window.scrollX,window.scrollX+window.innerWidth-w-8))+'px';pop.style.top=(r.bottom+window.scrollY+4)+'px';
  pop.onclick=e=>e.stopPropagation();
  pop.querySelectorAll('.kfsec').forEach(sec=>{const all=sec.querySelector('.kfall input');const boxes=()=>[...sec.querySelectorAll('.kflist input')];
    all.onchange=()=>boxes().forEach(b=>{if(!b.closest('.kfrow').hidden)b.checked=all.checked;});
    sec.querySelectorAll('.kflist input').forEach(b=>b.onchange=()=>{all.checked=boxes().every(x=>x.checked);});
    const ara=sec.querySelector('.kfara');if(ara){ara.oninput=()=>{const q=isimAnahtar(ara.value);sec.querySelectorAll('.kflist .kfrow').forEach(l=>l.hidden=!!q&&!l.dataset.ara.includes(q));};setTimeout(()=>ara.focus(),0);}});
  pop.querySelectorAll('.kfs').forEach(b=>b.onclick=()=>{st.sort={k:c.k,d:+b.dataset.d};kfKapat();render();});
  byId('kfTem').onclick=()=>{delete st.f[c.k];if(c.ek)delete st.f[c.ek.k];if(st.sort&&st.sort.k===c.k)st.sort=null;kfKapat();render();};
  byId('kfOk').onclick=()=>{pop.querySelectorAll('.kfsec').forEach(sec=>{const k=sec.dataset.k;const boxes=[...sec.querySelectorAll('.kflist input')];const ara=sec.querySelector('.kfara');
      // Excel gibi: aramada sadece görünenler seçilir
      const secili=boxes.filter(b=>b.checked&&!(ara&&ara.value&&b.closest('.kfrow').hidden)).map(b=>b.value);
      if(secili.length===boxes.length)delete st.f[k];else st.f[k]=secili;});S.pt.vsel=null;kfKapat();render();};
  setTimeout(()=>document.addEventListener('click',kfKapat,{once:true}),0);}
function kfKapat(){const p=byId('kfPop');if(p)p.remove();}

/* ================= Puantaj veri girişi ================= */
let veriYapistirBagli=false;
function veriKisileri(V){const kisiler=new Map();V.satir.forEach(x=>kisiler.set(x.pid,x.sol.ad));
  subePersoneli().filter(p=>aktifAyda(p,V.ak)).forEach(p=>{if(!kisiler.has(p.id))kisiler.set(p.id,p.ad);});
  return [...kisiler.entries()].sort((a,b)=>String(a[1]).localeCompare(String(b[1]),'tr'));}
// Excel'den gelen veri türü yazısını koda çevir
function turCoz(s){const a=ascii(s).replace(/[^a-z ]/g,' ').replace(/\s+/g,' ').trim();if(!a)return null;
  const L=[['maas fark','MF'],['calisilan saat','SA'],['saat','SA'],['banka','BY'],['net odenen','BY'],['fazla mesai tutar','FMT'],['fazla mesai','FMT'],['ucretsiz','UI'],['yillik','YI'],['rapor','R'],['bayram','B'],['part','PG'],['avans','AV'],['ara odeme','AO'],['paket sayi','PS'],['paket prim','PP'],['ciro','CP'],['prim','CP'],['ek odeme','EK'],['kesinti','KS']];
  const x=L.find(([k])=>a.includes(k));return x?x[1]:null;}
// Veri girişi: Excel gibi tablo. Satır ekle ya da Excel'den yapıştır; isim/tür tutmazsa satır kırmızı.
function trTarihCoz(x){x=String(x||'').trim();let m=x.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);if(m)return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;if(/^\d{4}-\d{2}-\d{2}$/.test(x))return x;
  if(/^\d{5}$/.test(x)){const d=xSerialTarih(+x);if(d)return d;}return null;}
function veriKontrol(v,kL,ak,kilitli){const r={pid:'',tur:'',hata:''};const bos=!String(v.ad||'').trim()&&!v.pid&&!v.tur&&!String(v.miktar??'').toString().trim()&&!String(v.aciklama||'').trim();if(bos)return{...r,bos:true};
  const adT=v.ad!=null&&v.ad!==''?v.ad:(v.pid?((kL.find(([id])=>id===v.pid)||[])[1]||''):'');const k=isimAnahtar(adT);const x=adT?kL.find(([id,a])=>isimAnahtar(a)===k):null;if(x)r.pid=x[0];const t=veriTur(v.tur);if(t)r.tur=t.k;
  if(!adT.trim())r.hata='İsim yok';else if(!x)r.hata='Böyle bir personel yok';else if(!t)r.hata='Veri türü seçin';else if(v.miktar===''||v.miktar==null||String(v.miktar).trim()==='')r.hata='Miktar yok';
  else if(v.tarih&&v.tarih.slice(0,7)!==ak)r.hata='Başka ay';else if(kilitli&&t.y==='sol')r.hata='Muhasebe kilitli';
  if(r.hata){r.pid=r.hata==='Başka ay'||r.hata==='Muhasebe kilitli'||r.hata==='Miktar yok'?'':r.pid;if(r.hata!=='Veri türü seçin')r.tur=r.tur;r.gecersiz=true;}return r;}
function veriGirisiHtml(V){const veri=(V.D&&V.D.veri)||[];const ak=V.ak;const kL=veriKisileri(V);const kisiler=new Map(kL);const adOf=pid=>kisiler.get(pid)||((S.personel.find(p=>p.id===pid)||{}).ad)||'?';
  const turlar=VERI_TUR.filter(t=>!t.gizli);
  // Çizelgeden ve devirden gelenler (salt okunur)
  const oto=[];const sol0=V.kilitli&&V.D.sol?null:solHesap(ak);const kaynak=sol0||V.sol;
  const netM=(S.pt.maas&&S.pt.maas.net)||{};const fmOran=pid=>V.sb.fmYontem==='maas'?(sayi(netM[pid])?sayi(netM[pid])/30/9:null):sayi(V.sb.fmUcret);
  Object.entries(kaynak).forEach(([pid,r])=>{[['R','rapor'],['UI','ucretsiz'],['YI','yillik'],['B','bayram'],['PG','partGun'],['FM','fmSaat']].forEach(([k,f])=>{let v=r[f]||0;if(V.kilitli){const e=(V.oz[pid]||{})[k]||0;v-=e;}if(Math.abs(v)<=0.001)return;
    if(k==='FM'){if(ucretSekli(pid)!=='maas')return;const o=fmOran(pid);oto.push({pid,tur:'FMT',miktar:o==null?null:Math.round(v*o*100)/100,aciklama:`${sg(v)} saat ${v<0?'eksi mesai':'fazla mesai'}${o==null?' · net maaş girilmedi':''}`});return;}oto.push({pid,tur:k,miktar:v});});});
  const ayAralik=(()=>{const L=ymd(new Date(+ak.slice(0,4),+ak.slice(5),0));return `1–${+L.slice(8)} ${AYK[+ak.slice(5)-1]}`;})();
  V.satir.forEach(x=>{if(x.hes.saat&&x.hes.cizelgeSaat)oto.push({pid:x.pid,tur:'SA',miktar:x.hes.cizelgeSaat,aciklama:`çizelgedeki saatler (${ayAralik})`});});
  V.satir.forEach(x=>{if(x.hes.devirAvans)oto.push({pid:x.pid,tur:'AV',miktar:x.hes.devirAvans,aciklama:`devir avans (${ayAdi(ayKaydir(ak,-1))})`});});
  oto.sort((a,b)=>String(adOf(a.pid)).localeCompare(String(adOf(b.pid)),'tr'));
  const opt=(v,t,sel)=>`<option value="${esc(v)}" ${sel?'selected':''}>${esc(t)}</option>`;
  const hataSay=veri.filter(v=>veriKontrol(v,kL,ak,V.kilitli).gecersiz).length;
  const adYazi=v=>v.ad!=null&&v.ad!==''?v.ad:(v.pid?adBuyuk(adOf(v.pid)):'');
  const VC=[{k:'tarih',ad:'Tarih',v:x=>x.v.tarih?trTarih(x.v.tarih):'',n:x=>x.v.tarih||''},{k:'ad',ad:'Ad soyad',v:x=>adYazi(x.v),l:1},{k:'tur',ad:'Veri türü',v:x=>veriTur(x.v.tur)?veriTur(x.v.tur).ad:'',l:1},
    {k:'miktar',ad:'Miktar',v:x=>x.v.miktar===''||x.v.miktar==null?'':fmt(sayi(x.v.miktar)),n:x=>sayi(x.v.miktar)},{k:'ack',ad:'Açıklama',v:x=>x.v.aciklama||'',l:1},{k:'durum',ad:'Durum',v:x=>x.k.bos?'Boş satır':x.k.gecersiz?x.k.hata:'Tamam',l:1}];
  const tumR=veri.map((v,i)=>({v,i,k:veriKontrol(v,kL,ak,V.kilitli)}));let VIS=kfUygula('veri',VC,tumR);tumR.forEach(x=>{if(x.k.bos&&!VIS.includes(x))VIS.push(x);});
  S.pt._vvis=VIS.map(x=>x.i);S.pt._vkf={cols:VC,rows:tumR};
  let h=`<div class="actions" style="margin-top:0"><button class="btn grow" id="bordroB">Bordro PDF yükle</button></div>${hataSay?`<div class="banner bad">${hataSay} satırda veri uyuşmazlığı var (kırmızı). Bu satırlar hesaba katılmaz; ismi ya da türü düzeltin.</div>`:''}
   ${kfAktifMi('veri')?`<div class="kfbar">Filtre açık · ${VIS.length} / ${veri.length} satır gösteriliyor <button class="mini" id="kfHepsiV">Filtreleri kaldır</button></div>`:''}
   <div class="tbl-wrap"><table class="pt vt vg2" id="vGrid"><thead><tr>${VC.map(c=>kfBaslik('veri',c,c.l?'l':'')).join('')}<th></th></tr></thead><tbody>`;
  VIS.forEach((x,r)=>{const v=x.v;const k=x.k;const kil=V.kilitli&&veriTur(v.tur)&&veriTur(v.tur).y==='sol'&&!k.gecersiz;
    h+=`<tr data-vid="${esc(v.id)}" data-r="${r}" class="${k.gecersiz?'hata':''}">
     <td class="bi"><input data-c="0" value="${esc(v.tarih?trTarih(v.tarih):'')}" placeholder="gg.aa.yyyy" ${kil?'disabled':''}></td>
     <td class="bi l"><input data-c="1" list="vKisiL" value="${esc(v.ad!=null?v.ad:adBuyuk(adOf(v.pid)))}" autocomplete="off" ${kil?'disabled':''}></td>
     <td class="bi l"><select data-c="2" ${kil?'disabled':''}>${opt('',v.turYazi&&!veriTur(v.tur)?v.turYazi+' ?':'Seçin',!veriTur(v.tur))}${turlar.map(t=>opt(t.k,t.ad,v.tur===t.k)).join('')}${veriTur(v.tur)&&veriTur(v.tur).gizli?opt(v.tur,veriTur(v.tur).ad,true):''}</select></td>
     <td class="bi"><input data-c="3" value="${esc(v.miktar==null||v.miktar===''?'':fmt(sayi(v.miktar)))}" inputmode="decimal" style="text-align:right" ${kil?'disabled':''}></td>
     <td class="bi l"><input data-c="4" value="${esc(v.aciklama||'')}" ${kil?'disabled':''}></td>
     <td class="l dur">${k.gecersiz?`<span class="chip bad">${esc(k.hata)}</span>`:''}</td><td>${kil?'':`<button class="mini" data-sil="${esc(v.id)}" title="Satırı sil">✕</button>`}</td></tr>`;});
  h+=`<tr class="ekle"><td colspan="7"><button class="mini ekleB" id="vSatir">+ Satır ekle</button><button class="mini ekleB" id="vSatir10">+ 10 satır</button></td></tr></tbody></table></div>
   <datalist id="vKisiL">${kL.map(([id,ad])=>`<option value="${esc(adBuyuk(ad))}">`).join('')}</datalist>
   <p class="note">Excel'deki satırları (TARİH · ŞUBE · AD SOYAD · VERİ TÜRÜ · MİKTAR · AÇIKLAMA) kopyalayıp tablodaki herhangi bir hücreye ya da sayfaya yapıştırın; satırlar kendiliğinden eklenir, şube sütunu atlanır. Yazdıklarınız anında kaydedilir. İsmi ya da türü tutmayan satırlar kırmızı görünür ve hesaba katılmaz.${V.kilitli?' Ay onaylandığı için gün türleri (rapor, izin, part gün) eklenemez.':''}</p>`;
  if(oto.length){const ac=S.pt.otoAcik;h+=`<button class="btn" id="vOto" style="width:100%;margin-top:6px">${ac?'Otomatik gelenleri gizle':'Çizelgeden ve devirden otomatik gelenler'} · ${oto.length}</button>`;
    if(ac)h+=`<div class="tbl-wrap" style="margin-top:8px"><table class="pt"><thead><tr><th>Kaynak</th><th class="l">Ad soyad</th><th class="l">Veri türü</th><th>Miktar</th><th class="l">Açıklama</th></tr></thead><tbody>${oto.map(v=>{const t=veriTur(v.tur);const mk=v.miktar==null?'—':t&&t.b==='₺'?tl(sayi(v.miktar)):fmt(sayi(v.miktar))+' '+(t?t.b:'');
      return`<tr class="oto"><td><span class="tag">${v.tur==='AV'?'devir':'çizelge'}</span></td><td class="l"><b>${esc(adBuyuk(adOf(v.pid)))}</b></td><td class="l">${esc(t?t.ad:v.tur)}</td><td>${mk}</td><td class="l">${esc(v.aciklama||'Mesai çizelgesinden')}</td></tr>`;}).join('')}</tbody></table></div>`;}
  return h;}
function veriGirisiBagla(V){const ak=V.ak,sid=S.subeId;const kL=veriKisileri(V);
  const veri0=()=>((S.pt.doc&&S.pt.doc.veri)||[]);let kT=null;
  const kaydetSimdi=yeni=>sirayla('pt'+sid+ak,()=>setDoc(doc(db,'puantaj',sid,'aylar',ak),{sube:sid,ay:ak,veri:yeni,guncellendi:new Date().toISOString()},{merge:true}));
  const ayarla=(yeni,ciz)=>{S.pt.doc={...(S.pt.doc||{}),veri:yeni};clearTimeout(kT);if(ciz){kaydetSimdi(yeni);S.pt.zorla=true;render();}else kT=setTimeout(()=>kaydetSimdi(veri0()),500);};
  const coz=v=>{const k=veriKontrol(v,kL,ak,V.kilitli);return{...v,pid:k.gecersiz&&k.hata!=='Veri türü seçin'&&k.hata!=='Muhasebe kilitli'&&k.hata!=='Başka ay'&&k.hata!=='Miktar yok'?'':k.pid,_k:k};};
  const temiz=v=>{const k=veriKontrol(v,kL,ak,V.kilitli);const o={...v,pid:k.gecersiz?'':k.pid,tur:v.tur||''};return o;};
  const yeniSatir=(o={})=>{const son=veri0()[veri0().length-1]||{};const bugun=ymd(today()).slice(0,7)===ak?ymd(today()):ymd(new Date(+ak.slice(0,4),+ak.slice(5),0));
    return{id:Math.random().toString(36).slice(2,10),tarih:son.tarih||bugun,ad:'',pid:'',tur:'',miktar:'',aciklama:'',kim:S.me.adSoyad||S.me.kullaniciAdi||'',zaman:new Date().toISOString(),...o};};
  const grid=byId('vGrid');
  const durumGuncelle=(tr,v)=>{const k=veriKontrol(v,kL,ak,V.kilitli);tr.classList.toggle('hata',!!k.gecersiz);tr.querySelector('.dur').innerHTML=k.gecersiz?`<span class="chip bad">${esc(k.hata)}</span>`:'';};
  const hucreYaz=(v,c,val)=>{if(c===0){const d=trTarihCoz(val);v.tarih=d||'';v._tarihYazi=d?'':val;}else if(c===1){v.ad=adBuyuk(val);v.pid='';}else if(c===2){const t=veriTur(val)?val:turCoz(val);v.tur=t||'';v.turYazi=t?'':val;}else if(c===3)v.miktar=String(val).trim()===''?'':sayi(val);else if(c===4)v.aciklama=String(val).trim();return temiz(v);};
  grid.querySelectorAll('tr[data-vid]').forEach(tr=>{const id=tr.dataset.vid;
    tr.querySelectorAll('[data-c]').forEach(el=>{const c=+el.dataset.c;
      if(c===1)el.oninput=()=>{const a=el.selectionStart,b=el.selectionEnd;el.value=el.value.toLocaleUpperCase('tr-TR');try{el.setSelectionRange(a,b);}catch(_){}};
      el.onchange=()=>{const L=veri0().map(v=>v.id===id?hucreYaz({...v},c,el.value):v);const v=L.find(x=>x.id===id);if(c===0&&v.tarih)el.value=trTarih(v.tarih);if(c===3&&v.miktar!=='')el.value=fmt(v.miktar);durumGuncelle(tr,v);ayarla(L,false);};
      el.onkeydown=e=>{if(e.key==='Enter'||e.key==='ArrowDown'||e.key==='ArrowUp'){if(el.tagName==='SELECT'&&e.key!=='Enter')return;e.preventDefault();el.onchange&&el.dispatchEvent(new Event('change'));
        const r=+tr.dataset.r+(e.key==='ArrowUp'?-1:1);const n=grid.querySelector(`tr[data-r="${r}"] [data-c="${c}"]`);if(n){n.focus();n.select&&n.select();}else if(e.key==='Enter'){S.pt.odak={c};ayarla([...veri0(),yeniSatir()],true);}}};
      el.onpaste=e=>{const t=(e.clipboardData||window.clipboardData).getData('text');if(!/[\t\n]/.test(t.trim()))return;e.preventDefault();yapistir(t,+tr.dataset.r,c);};});});
  const sutunlar=M=>{// şube sütununu ve başlık satırını at
    if(M.length&&M[0].some(x=>/TAR[İI]H|ADI|VER[İI] T[ÜU]R|M[İI]KTAR/i.test(x)))M=M.slice(1);
    const sb=tumSubeler().map(([i,a])=>isimAnahtar(a));const w=Math.max(...M.map(r=>r.length));const at=[];
    for(let j=0;j<w;j++){const col=M.map(r=>r[j]||'').filter(x=>x.trim());if(col.length&&col.every(x=>sb.includes(isimAnahtar(x))))at.push(j);}
    return M.map(r=>r.filter((x,j)=>!at.includes(j)));};
  const vis=()=>S.pt._vvis||veri0().map((v,i)=>i);
  const yapistir=(t,r0,c0)=>{let M=t.replace(/\r/g,'').split('\n');while(M.length&&!M[M.length-1].trim())M.pop();M=sutunlar(M.map(x=>x.split('\t')));if(!M.length)return;
    const L=veri0().slice();const VI=vis();const dok=[];M.forEach((row,i)=>{const pos=r0+i;let r=pos<VI.length?VI[pos]:null;if(r==null){L.push(yeniSatir());r=L.length-1;}let v={...L[r]};row.forEach((val,j)=>{const c=c0+j;if(c<=4)v=hucreYaz(v,c,val);});L[r]=v;dok.push(r);});
    const hata=dok.filter(r=>veriKontrol(L[r],kL,ak,V.kilitli).gecersiz).length;ayarla(L,true);toast(`${M.length} satır yapıştırıldı${hata?`, ${hata} satırda uyuşmazlık var (kırmızı)`:''}.`);};
  byId('vSatir').onclick=()=>{S.pt.odak={c:1};ayarla([...veri0(),yeniSatir()],true);};
  byId('vSatir10').onclick=()=>{const L=veri0().slice();for(let i=0;i<10;i++)L.push(yeniSatir());S.pt.odak={c:1,ilkBos:true};ayarla(L,true);};
  const ob=byId('vOto');if(ob)ob.onclick=()=>{S.pt.otoAcik=!S.pt.otoAcik;render();};
  if(S.pt._vkf)kfBagla('veri',S.pt._vkf.cols,S.pt._vkf.rows);const kv=byId('kfHepsiV');if(kv)kv.onclick=()=>{kfDurum('veri').f={};kfDurum('veri').sort=null;S.pt.vsel=null;render();};
  document.querySelectorAll('[data-sil]').forEach(b=>b.onclick=()=>{const v=veri0().find(x=>x.id===b.dataset.sil);const bos=v&&veriKontrol(v,kL,ak,V.kilitli).bos;if(!bos&&!b.dataset.ok){b.dataset.ok='1';b.textContent='Sil?';return;}ayarla(veri0().filter(x=>x.id!==b.dataset.sil),true);});
  if(!veriYapistirBagli){veriYapistirBagli=true;document.addEventListener('paste',e=>{if(S.tab!=='puantaj'||!S.pt.sube||S.pt.gorunum!=='veri'||byId('sheetRoot').innerHTML)return;const a=document.activeElement;if(a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName))return;
    const t=(e.clipboardData||window.clipboardData).getData('text');if(!t||!/[\t\n]/.test(t))return;e.preventDefault();const L=veri0();const VI=S.pt._vvis||L.map((v,i)=>i);const bosP=VI.findIndex(i=>L[i]&&veriKontrol(L[i],kL,ak,V.kilitli).bos);(window.__vYapistir||(()=>{}))(t,bosP>=0?bosP:VI.length,0);});}
  window.__vYapistir=yapistir;
  // Excel gibi hücre seçimi: sürükle ya da Shift+tıkla; Ctrl+C / Ctrl+V / Delete seçili hücrelerde çalışır, tek değer seçili tüm hücrelere yapıştırılır.
  const hucreEl=(r,c)=>grid.querySelector(`tr[data-r="${r}"] [data-c="${c}"]`);const tdOf=el=>el&&el.closest('td');
  const konum=el=>{const tr=el.closest('tr[data-r]');const x=el.closest('td')&&el.closest('td').querySelector('[data-c]');return tr&&x?{r:+tr.dataset.r,c:+x.dataset.c}:null;};
  const aralik=()=>{const A=S.pt.vsel;if(!A)return null;return{r0:Math.min(A.r0,A.r1),r1:Math.max(A.r0,A.r1),c0:Math.min(A.c0,A.c1),c1:Math.max(A.c0,A.c1)};};
  const selCiz=()=>{grid.querySelectorAll('td.vsel').forEach(t=>t.classList.remove('vsel'));const A=aralik();if(!A||(A.r0===A.r1&&A.c0===A.c1))return;for(let r=A.r0;r<=A.r1;r++)for(let c=A.c0;c<=A.c1;c++){const t=tdOf(hucreEl(r,c));if(t)t.classList.add('vsel');}};
  const cokluMu=()=>{const A=aralik();return A&&(A.r0!==A.r1||A.c0!==A.c1);};
  let surukle=null;
  grid.querySelectorAll('tr[data-vid] td.bi').forEach(td=>{const el=td.querySelector('[data-c]');if(!el)return;
    td.addEventListener('mousedown',e=>{const k=konum(el);if(!k)return;if(e.shiftKey&&S.pt.vsel){e.preventDefault();S.pt.vsel={...S.pt.vsel,r1:k.r,c1:k.c};selCiz();return;}S.pt.vsel={r0:k.r,c0:k.c,r1:k.r,c1:k.c};surukle=k;selCiz();});
    td.addEventListener('mouseenter',e=>{if(!surukle||!(e.buttons&1))return;const k=konum(el);if(!k||(k.r===S.pt.vsel.r1&&k.c===S.pt.vsel.c1))return;S.pt.vsel={...S.pt.vsel,r1:k.r,c1:k.c};if(cokluMu()){document.activeElement&&document.activeElement.blur&&document.activeElement.blur();window.getSelection&&window.getSelection().removeAllRanges();}selCiz();});});
  document.addEventListener('mouseup',()=>{surukle=null;},{once:true});
  grid.addEventListener('focusin',e=>{if(surukle)return;const k=e.target.closest('[data-c]')&&konum(e.target);if(k&&cokluMu()){S.pt.vsel={r0:k.r,c0:k.c,r1:k.r,c1:k.c};selCiz();}});
  const degerOf=el=>el.tagName==='SELECT'?(el.value?el.selectedOptions[0].text:''):el.value;
  grid.oncopy=null;
  if(!S.pt.vgDinle){S.pt.vgDinle=true;
    document.addEventListener('copy',e=>{const g=byId('vGrid');if(!g||S.pt.gorunum!=='veri')return;const ae=document.activeElement;const icinde=ae&&g.contains(ae);
      const A=aralik();if(!A)return;const tekSelect=icinde&&ae.tagName==='SELECT';if(!cokluMu()&&!tekSelect)return;
      const R=[];for(let r=A.r0;r<=A.r1;r++){const row=[];for(let c=A.c0;c<=A.c1;c++){const x=g.querySelector(`tr[data-r="${r}"] [data-c="${c}"]`);row.push(x?degerOf(x):'');}R.push(row.join('\t'));}
      e.clipboardData.setData('text/plain',R.join('\n'));e.preventDefault();toast(`${(A.r1-A.r0+1)*(A.c1-A.c0+1)} hücre kopyalandı.`);});
    document.addEventListener('paste',e=>{const g=byId('vGrid');if(!g||S.pt.gorunum!=='veri'||byId('sheetRoot').innerHTML)return;const ae=document.activeElement;const A=aralik();
      const t=(e.clipboardData||window.clipboardData).getData('text');if(t==null)return;const tek=!/[\t\n]/.test(t.replace(/[\r\n]+$/,''));
      if(tek&&A&&(cokluMu()||(ae&&ae.tagName==='SELECT'&&g.contains(ae)))){e.preventDefault();e.stopPropagation();(window.__vDoldur||(()=>{}))(t.replace(/[\r\n]+$/,''),A);}},true);
    document.addEventListener('keydown',e=>{const g=byId('vGrid');if(!g||S.pt.gorunum!=='veri')return;if((e.key==='Delete'||e.key==='Backspace')&&cokluMuG()){const ae=document.activeElement;if(ae&&/INPUT|SELECT|TEXTAREA/.test(ae.tagName))return;e.preventDefault();(window.__vDoldur||(()=>{}))('',aralikG());}});}
  const cokluMuG=()=>cokluMu();const aralikG=()=>aralik();window.cokluMuG=cokluMuG;window.aralikG=aralikG;
  window.__vDoldur=(val,A)=>{const L=veri0().slice();const VI=vis();let n=0;for(let p=A.r0;p<=A.r1;p++){const r=VI[p];if(r==null||!L[r])continue;let v={...L[r]};for(let c=A.c0;c<=A.c1;c++){if(c>4)continue;v=hucreYaz(v,c,val);n++;}L[r]=v;}
    ayarla(L,true);toast(val===''?`${n} hücre temizlendi.`:`${n} hücreye yapıştırıldı.`);};
  selCiz();
  // odak
  if(S.pt.odak){const o=S.pt.odak;S.pt.odak=null;const rows=[...grid.querySelectorAll('tr[data-vid]')];let tr=o.ilkBos?rows.find(t=>{const v=veri0().find(x=>x.id===t.dataset.vid);return v&&veriKontrol(v,kL,ak,V.kilitli).bos;}):rows[rows.length-1];
    const el=tr&&tr.querySelector(`[data-c="${o.c}"]`);if(el)el.focus();}}

// Boş satırlar: sekme değişince, şubeden çıkınca ve sayfa açılınca silinir.
function bosSatirMi(v){return !String(v.ad||'').trim()&&!v.pid&&!v.tur&&(v.miktar===''||v.miktar==null)&&!String(v.aciklama||'').trim();}
function veriBosTemizle(){const D=S.pt.doc;if(!D||!Array.isArray(D.veri)||!S.pt.sube)return;const yeni=D.veri.filter(v=>!bosSatirMi(v));if(yeni.length===D.veri.length)return;
  const sid=S.pt.sube,ak=S.ay;S.pt.doc={...D,veri:yeni};sirayla('pt'+sid+ak,()=>setDoc(doc(db,'puantaj',sid,'aylar',ak),{veri:yeni,guncellendi:new Date().toISOString()},{merge:true}));}
function listeyeDon(){veriBosTemizle();S.pt.sube=null;subs.detay.forEach(u=>u());subs.detay=[];render();}
function sagSonuclu(V,degisen){const sag=JSON.parse(JSON.stringify((V.D&&V.D.sag)||{}));if(degisen)Object.entries(degisen).forEach(([pid,v])=>sag[pid]={...(sag[pid]||{}),...v});
  const prevSag=(S.pt.prev&&S.pt.prev.sag)||{};const net=(S.pt.maas&&S.pt.maas.net)||{};
  Object.keys(V.sol).forEach(pid=>{const dv=prevSag[pid]&&prevSag[pid].kalan<0?prevSag[pid].kalan:0;const r=sagHesap(pid,V.sol[pid],sag[pid],net[pid],V.sb,dv,veriOzet(V.D&&V.D.veri)[pid],usOf(pid));sag[pid]={...(sag[pid]||{}),kalan:Math.round(r.kalan*100)/100};});return sag;}
function onayla(){const V=ptVerisi();const ak=S.ay,sid=S.subeId;const sol=ptSol(ak,V.D||{});const b=writeBatch(db);const V2={...V,sol};
  b.set(doc(db,'puantaj',sid,'aylar',ak),{sube:sid,ay:ak,sol,sag:sagSonuclu(V2),kilitli:true,onaylayan:S.user.uid,onaylayanAd:S.me.adSoyad||'',onayTarihi:new Date().toISOString(),guncellendi:new Date().toISOString()},{merge:true});
  b.set(doc(db,'subeler',sid,'aylar',ak),{durum:'bolge_onay',onaylayan:S.user.uid,onayTarihi:new Date().toISOString()},{merge:true});
  b.set(doc(db,'ozetler',ak+'__'+sid),{sube:sid,ay:ak,kisiler:subeOzeti(ak,sid),guncellendi:new Date().toISOString()});
  b.commit().then(()=>toast(`${sube().ad} · ${ayAdi(ak)} onaylandı.`)).catch(yazmaHatasi);}
function kilidiAc(){const ak=S.ay,sid=S.subeId;const b=writeBatch(db);b.set(doc(db,'puantaj',sid,'aylar',ak),{kilitli:false,guncellendi:new Date().toISOString()},{merge:true});
  b.set(doc(db,'subeler',sid,'aylar',ak),{durum:'taslak'},{merge:true});b.commit().then(()=>toast('Kilit açıldı, ay yeniden düzenlenebilir.')).catch(yazmaHatasi);}
function geriGonderPanel(){openSheet(`<h2>Şubeye geri gönder</h2><div class="sub">Şube müdürü notu görür, düzeltip ayı yeniden kapatır.</div><label class="field"><span>Not</span><textarea id="gNot" rows="3" placeholder="Örn: Ali'nin 14 Ekim raporu eksik"></textarea></label>
  <div class="row2"><button class="btn grow" id="gNo">Vazgeç</button><button class="btn danger grow" id="gOk">Geri gönder</button></div>`,()=>{byId('gNo').onclick=closeSheet;
  byId('gOk').onclick=()=>{const not=byId('gNot').value.trim();sirayla('ay'+S.ay,()=>setDoc(doc(db,'subeler',S.subeId,'aylar',S.ay),{durum:'geri',not,geriGonderen:S.user.uid,geriTarih:new Date().toISOString()},{merge:true}));closeSheet();toast('Şubeye geri gönderildi.');};});}
function odemePanel(pid){const V=ptVerisi();const x=V.satir.find(s=>s.pid===pid);if(!x)return;const s=x.sag;const esnaf=x.hes.esnaf;const ekToplam=k=>{const v=(V.oz[pid]||{})[k]||0;return v?tl(v):'';};const us0=usOf(pid);let tip=us0.tip;const maasDisi=x.sol.maasBurada===false;const kuryeMi=(x.sol.grup||'')==='S';const partMi=x.sol.sekil==='Part';if((maasDisi||!kuryeMi)&&tip==='paket')tip='maas';if(!partMi&&tip==='saat'&&!maasDisi)tip=us0.tip==='saat'?'saat':tip;const tc=(S.pt.maas&&S.pt.maas.tc&&S.pt.maas.tc[pid])||((S.personel.find(q=>q.id===pid)||{}).tc)||'';
  const inp=(id,label,val,ph='')=>`<label class="field"><span>${label}</span><input id="${id}" inputmode="decimal" value="${val??''}" placeholder="${ph}"></label>`;
  openSheet(`<h2>${esc(x.sol.ad)}</h2><div class="sub">${ayAdi(V.ak)} · ${esc(x.sol.sekil)} · ${esnaf?'paket başı':x.sol.gun+' bordro günü'+(x.sol.hakGun!=null&&x.sol.hakGun!==x.sol.gun?` · ${x.sol.hakGun} çalışılan gün`:'')}${x.sol.fmSaat&&!esnaf?' · fazla mesai '+sg(x.sol.fmSaat)+' sa':''}${x.sol.sekil==='Part'?` · çizelgede ${fmt(x.sol.calisilanSaat||0)} sa`:''}</div>
   <div class="fgrid">${esnaf?inp('oPs','Paket sayısı',s.paketSayisi)+inp('oPu','Paket başı ücret (₺)',s.paketUcret,String(V.sb.paketUcret||'')):`<div style="grid-column:1/-1"><span class="lbl">Ücret şekli</span><div class="seg" id="oSekil">${(maasDisi?[['maas','Maaşı başka şubede'],...(partMi||tip==='saat'?[['saat','Saatlik']]:[])]:[['maas','Maaşlı'],...(kuryeMi?[['paket','Paket başı']]:[]),...(partMi||tip==='saat'?[['saat','Saatlik']]:[])]).map(([k,a])=>`<button data-v="${k}" class="${tip===k?'on':''}">${a}</button>`).join('')}</div></div>
     <div id="oNetW" style="grid-column:1/-1" ${tip==='maas'&&!maasDisi?'':'hidden'}>${inp('oNet','Anlaşılan aylık net (₺)',x.net,'örn. 50000')}</div>
     <p class="note" id="oMdNot" style="grid-column:1/-1" ${tip==='maas'&&maasDisi?'':'hidden'}>Maaşı ${esc(x.sol.odemeSube||'SGK şubesinin')} puantajında. Burada sadece bu şubede yaptığı fazla mesai ve buraya ait primler hesaplanır.</p>
     <p class="note" id="oPbNot" style="grid-column:1/-1" ${tip==='paket'?'':'hidden'}>Paket başı: kazanç paket primleridir. Paket primlerini Veri girişinden "Paket primi" olarak girin; bankaya yatan, ara ödeme ve avans düşülür, kalan elden ödenir. Fazla mesai hesaplanmaz.</p>
     <div id="oSaatW" style="grid-column:1/-1" ${tip==='saat'?'':'hidden'}>${inp('oSaat','Saat ücreti (₺)',us0.saatUcret||'','örn. 120')}<p class="note" style="margin-top:0">Saatler mesai çizelgesinden ayın 1'i ile son günü arasında otomatik alınır (bu ay ${fmt(x.sol.calisilanSaat||0)} sa, sadece bu şubedeki saatler). Eksik ya da fazla varsa Veri girişine "Çalışılan saat" türüyle + ya da − saat girin. Hak ediş = saat × ücret; bankaya yatan, ara ödeme ve avans düşülür. Fazla mesai hesaplanmaz.</p></div>`}
   ${inp('oPaket','Paket primi ekle (₺)','')}${inp('oCiro','Ciro primi ekle (₺)','')}
   <p class="note" style="grid-column:1/-1;margin-top:0">Buraya yazdığınız primler veri girişine ayın son günü tarihli satır olarak eklenir. Avans ve ara ödemeyi veri girişinden girin.${ekToplam('PP')||ekToplam('CP')?` Bu ay girilmiş: ${ekToplam('PP')?'paket primi '+ekToplam('PP'):''}${ekToplam('PP')&&ekToplam('CP')?', ':''}${ekToplam('CP')?'ciro primi '+ekToplam('CP'):''}.`:''}</p>
   <label class="field"><span>TC kimlik no (bordro eşleşmesi için)</span><input id="oTc" inputmode="numeric" maxlength="11" value="${esc(tc)}"></label></div>
   <div class="calc" id="oCalc"></div><div id="oErr"></div><div class="row2"><button class="btn grow" id="oNo">Vazgeç</button><button class="btn primary grow" id="oOk">Kaydet</button></div>`,sh=>{
   const oku=()=>{const v=id=>{const e=byId(id);return e?e.value.trim():undefined;};const o={};if(esnaf){o.paketSayisi=v('oPs');o.paketUcret=v('oPu');}return o;};
   const ekV=V.oz[pid]||{};
   sh.querySelectorAll('#oSekil button').forEach(b=>b.onclick=()=>{tip=b.dataset.v;sh.querySelectorAll('#oSekil button').forEach(q=>q.classList.toggle('on',q===b));byId('oNetW').hidden=!(tip==='maas'&&!maasDisi);byId('oMdNot').hidden=!(tip==='maas'&&maasDisi);byId('oPbNot').hidden=tip!=='paket';byId('oSaatW').hidden=tip!=='saat';calc();});
   const usSimdi=()=>({tip,saatUcret:byId('oSaat')?sayi(byId('oSaat').value):0});
   const calc=()=>{const o=oku();const n=esnaf?0:byId('oNet')?sayi(byId('oNet').value):sayi(x.net);const ek2={...ekV,PP:(ekV.PP||0)+sayi(byId('oPaket').value),CP:(ekV.CP||0)+sayi(byId('oCiro').value)};const r=sagHesap(pid,x.sol,{...s,...o},n,V.sb,x.hes.devir,ek2,esnaf?{}:usSimdi());const pb=r.pb;
     byId('oCalc').innerHTML=`${esnaf?`<div><span>Paket hak edişi</span><b>${tl(r.paketHak)}</b></div>`:pb?'':r.saat?`<div><span>Hak edilen (${fmt(r.saatSayi)} saat${r.saatSayi!==r.cizelgeSaat?` = çizelge ${fmt(r.cizelgeSaat)} ${r.saatSayi>r.cizelgeSaat?'+':'−'} ${fmt(Math.abs(r.saatSayi-r.cizelgeSaat))}`:''} × ${tl(r.saatUcret)})</span><b>${tl(r.hak)}</b></div>`:`<div><span>Hak edilen (net × ${x.sol.hakGun!=null?x.sol.hakGun:x.sol.gun}/30${x.sol.hakGun!=null&&x.sol.hakGun!==x.sol.gun?` · ${x.sol.hakGun-x.sol.gun} gün deneme`:''})</span><b>${tl(r.hak)}</b></div>`}<div><span>− Bankaya yatan</span><b>${tl(r.bankaya)}</b></div>${pb?'':`<div><span>= Maaş farkı</span><b>${tl(r.maasFarki)}</b></div>`}
       ${r.fmTl?`<div><span>+ Fazla mesai</span><b>${tl(r.fmTl)}</b></div>`:''}${r.paketPrimi?`<div><span>+ Paket primi</span><b>${tl(r.paketPrimi)}</b></div>`:''}${r.ciroPrimi?`<div><span>+ Ciro primi</span><b>${tl(r.ciroPrimi)}</b></div>`:''}${r.araOdeme?`<div><span>− Ara ödeme</span><b>${tl(r.araOdeme)}</b></div>`:''}${r.avans?`<div><span>− Avans${r.devirAvans?` (${tl(r.devirAvans)} geçen ay devri dahil)`:''}</span><b>${tl(r.avans)}</b></div>`:''}
       ${Math.abs(r.kalan-r.kalanHam)>0.004?`<div><span>Yuvarlama (5 ₺)</span><b>${tl(r.kalan-r.kalanHam)}</b></div>`:''}<div style="border-top:1px solid var(--line);margin-top:4px;padding-top:4px"><span>Kalan ödeme</span><b class="${r.kalan<0?'neg':'pos'}">${tl(r.kalan)}</b></div>${r.kalan<0?'<div><span class="note" style="margin:0">Eksi tutar sonraki ayın ödemesinden düşülür.</span></div>':''}`;};
   sh.querySelectorAll('input').forEach(i=>i.oninput=calc);calc();byId('oNo').onclick=closeSheet;
   byId('oOk').onclick=async()=>{const o=oku();const tcv=byId('oTc').value.replace(/\D/g,'');if(tcv&&tcv.length!==11){byId('oErr').innerHTML='<div class="confirm">TC kimlik no 11 haneli olmalı.</div>';return;}
     const sid=S.subeId,ak=V.ak;const sag=sagSonuclu(V,{[pid]:o});
     try{const netEl=byId('oNet');if(!esnaf){const u=usSimdi();if(u.tip!==us0.tip||(u.tip==='saat'&&u.saatUcret!==us0.saatUcret)){const m0=S.pt.maas||{};
         S.pt.maas={...m0,ucretSekli:{...(m0.ucretSekli||{}),[pid]:u.tip},paketBasi:{...(m0.paketBasi||{}),[pid]:u.tip==='paket'},saatUcret:{...(m0.saatUcret||{}),[pid]:u.tip==='saat'?u.saatUcret:(m0.saatUcret||{})[pid]||null}};
         await setDoc(doc(db,'maaslar',sid),{ucretSekli:{[pid]:u.tip},paketBasi:{[pid]:u.tip==='paket'},...(u.tip==='saat'?{saatUcret:{[pid]:u.saatUcret}}:{})},{merge:true});}}
       if((!esnaf&&netEl&&!byId('oNetW').hidden)||tcv!==tc){const m={};if(!esnaf&&netEl&&!byId('oNetW').hidden)m.net={[pid]:sayi(netEl.value)||null};if(tcv!==tc)m.tc={[pid]:tcv||null};
         if(m.net){S.pt.maas={...S.pt.maas,net:{...((S.pt.maas||{}).net||{}),[pid]:m.net[pid]}};}await setDoc(doc(db,'maaslar',sid),m,{merge:true});}
       // Primler ve eski kayıtlı avans/prim tutarları veri girişine taşınır: veri tek yerde.
       const sonGun=ymd(new Date(+ak.slice(0,4),+ak.slice(5),0));const kim=S.me.adSoyad||S.me.kullaniciAdi||'';const z=new Date().toISOString();const adP=adBuyuk(x.sol.ad);
       const satir=(tur,m,a)=>({id:Math.random().toString(36).slice(2,10),tarih:sonGun,ad:adP,pid,tur,miktar:m,aciklama:a,kim,zaman:z});const ek=[];
       if(sayi(byId('oPaket').value))ek.push(satir('PP',sayi(byId('oPaket').value),'Ödeme penceresinden'));if(sayi(byId('oCiro').value))ek.push(satir('CP',sayi(byId('oCiro').value),'Ödeme penceresinden'));
       const eskiS=sag[pid]||{};[['paketPrimi','PP'],['ciroPrimi','CP'],['avans','AV']].forEach(([f,t])=>{if(sayi(eskiS[f])){ek.push(satir(t,sayi(eskiS[f]),'Önceki kayıttan taşındı'));sag[pid]={...sag[pid],[f]:''};}});
       const veriY=[...((S.pt.doc&&S.pt.doc.veri)||[]),...ek];S.pt.doc={...(S.pt.doc||{}),veri:veriY};
       const sag2=sagSonuclu({...V,D:{...V.D,sag,veri:veriY}});
       await setDoc(doc(db,'puantaj',sid,'aylar',ak),{...(V.kilitli?{}:{sube:sid,ay:ak}),sag:sag2,...(ek.length?{veri:veriY}:{}),guncellendi:z},{merge:true});closeSheet();toast(ek.length?'Kaydedildi, primler veri girişine eklendi.':'Ödeme bilgileri kaydedildi.');}
     catch(e){yazmaHatasi(e);}};});}

/* ================= Muhasebe çıktısı ================= */
/* ================= Muhasebe çıktısı: görsel / PDF, paylaş ================= */
function trBuyukBas(t){return String(t||'').toLocaleLowerCase('tr-TR').split(/(\s+)/).map(w=>w.trim()?w[0].toLocaleUpperCase('tr-TR')+w.slice(1):w).join('');}
function muhBaslik(V){return `${trBuyukBas(V.sb.ad)} Şube ${AY[+V.ak.slice(5)-1]} Ayı Puantaj Verisi`;}
const MUH_TEMA={
  klasik:{ad:'Klasik mavi',bant:'#0f6fc6',bantYazi:'#fff',baslik:'#0b3d6e',ayKutu:'#ffd23f',ayYazi:'#3a2a00',th:'#1593e8',thYazi:'#fff',zebra:'#e9f3fd',cizgi:'#cfe0f1',cik:['#fff1a8','#ffd54a'],cikKen:'#e0b21c',not:'#5a6b80'},
  lacivert:{ad:'Lacivert & altın',bant:'#14284b',bantYazi:'#fff',baslik:'#14284b',ayKutu:'#f2b632',ayYazi:'#2a1d00',th:'#1f3a6b',thYazi:'#fff',zebra:'#eef2f8',cizgi:'#d6deea',cik:['#ffe9a3','#ffcd3c'],cikKen:'#d9a514',not:'#5e6b80'},
  dominos:{ad:'Mavi & kırmızı',bant:'#006491',bantYazi:'#fff',baslik:'#00527a',ayKutu:'#e31837',ayYazi:'#fff',th:'#006491',thYazi:'#fff',zebra:'#e8f3f8',cizgi:'#cde3ec',cik:['#fff2a6','#ffd84d'],cikKen:'#e2b51d',not:'#56697a'}};
async function muhasebeGorseli(V,temaK){try{await document.fonts.ready;}catch(e){}const T=MUH_TEMA[temaK||'klasik']||MUH_TEMA.klasik;
  const rows=V.satir.filter(x=>muhasebedeMi(x.sol)).map(x=>x.sol).sort((a,b)=>String(a.ad).localeCompare(String(b.ad),'tr'));
  const tmp=document.createElement('canvas').getContext('2d');const F=(w,s)=>`${w} ${s}px Figtree,system-ui,sans-serif`;const olc=(t,f)=>{tmp.font=f;return tmp.measureText(String(t)).width;};
  const veri=rows.map((r,i)=>[i+1,r.ad.toLocaleUpperCase('tr-TR'),muhGorev(r).toLocaleUpperCase('tr-TR'),(r.muhSekil||r.sekil||'').toLocaleUpperCase('tr-TR'),trTarih(r.giris),trTarih(r.cikis),r.rapor||'',r.ucretsiz||'',r.partGun?fmt(r.partGun):'',r.yillik||'',r.bayram||'']);
  const bas=['#','ADI SOYADI','GÖREV','ŞEKİL','GİRİŞ','ÇIKIŞ','RAPOR','ÜCR. İZİN','PART GÜN','YILLIK İZİN','BAYRAM'];
  const fH=F(800,10.5),fA=F(700,12),fD=F(600,11.5);
  const cw=bas.map((b,j)=>Math.ceil(Math.max(olc(b,fH),...veri.map(r=>olc(r[j],j===1?fA:fD)),j===1?150:24)+(j===1?22:16)));
  const pad=28,tw=cw.reduce((a,b)=>a+b,0),W=Math.max(tw+pad*2,560),ox=(W-tw)/2,rowH=26,thH=30,top=104;const H=top+thH+rows.length*rowH+70;
  const cv=document.createElement('canvas');cv.width=W*2;cv.height=H*2;const x=cv.getContext('2d');x.scale(2,2);x.textBaseline='middle';
  x.fillStyle='#fff';x.fillRect(0,0,W,H);
  // üst bant
  x.fillStyle=T.bant;x.fillRect(0,0,W,58);x.fillStyle=T.bantYazi;x.font=F(800,18);x.textAlign='left';x.fillText(`${String(V.sb.ad).toLocaleUpperCase('tr-TR')} ŞUBE`,ox,24);
  x.font=F(500,11.5);x.globalAlpha=.85;x.fillText('Aylık puantaj verisi',ox,43);x.globalAlpha=1;
  const ayT=`${AY[+V.ak.slice(5)-1].toLocaleUpperCase('tr-TR')} ${V.ak.slice(0,4)}`;x.font=F(800,13);const aw=olc(ayT,F(800,13))+28;
  x.fillStyle=T.ayKutu;x.beginPath();x.roundRect?x.roundRect(ox+tw-aw,15,aw,28,6):x.rect(ox+tw-aw,15,aw,28);x.fill();x.fillStyle=T.ayYazi;x.textAlign='center';x.fillText(ayT,ox+tw-aw/2,29.5);
  x.textAlign='left';x.fillStyle=T.not;x.font=F(600,11);x.fillText(`${rows.length} personel`,ox,80);x.textAlign='right';x.fillText(`Hazırlayan: ${S.me.adSoyad||S.me.kullaniciAdi||''} · ${trTarih(ymd(today()))}`,ox+tw,80);
  // başlık satırı
  let y=top;x.fillStyle=T.th;x.beginPath();x.roundRect?x.roundRect(ox,y,tw,thH,[6,6,0,0]):x.rect(ox,y,tw,thH);x.fill();let cx=ox;x.font=fH;x.fillStyle=T.thYazi;
  bas.forEach((b,j)=>{x.textAlign=j===1?'left':'center';x.fillText(b,j===1?cx+10:cx+cw[j]/2,y+thH/2+.5);cx+=cw[j];});y+=thH;
  rows.forEach((r,i)=>{const cik=r.cikis&&r.cikis<=ayKaydir(V.ak,1)+'-00';
    if(cik){const g=x.createLinearGradient(0,y,0,y+rowH);g.addColorStop(0,T.cik[0]);g.addColorStop(1,T.cik[1]);x.fillStyle=g;}else x.fillStyle=i%2?T.zebra:'#fff';x.fillRect(ox,y,tw,rowH);
    cx=ox;veri[i].forEach((v,j)=>{x.textAlign=j===1?'left':'center';x.fillStyle=j===0?T.not:'#14202f';x.font=j===1?fA:fD;x.fillText(String(v),j===1?cx+10:cx+cw[j]/2,y+rowH/2+.5);cx+=cw[j];});
    x.fillStyle=cik?T.cikKen:T.cizgi;x.fillRect(ox,y+rowH-1,tw,1);y+=rowH;});
  // dikey ince çizgiler
  cx=ox;x.fillStyle=T.cizgi;cw.slice(0,-1).forEach(w=>{cx+=w;x.fillRect(cx,top+thH,1,rows.length*rowH);});
  x.strokeStyle=T.cizgi;x.strokeRect(ox+.5,top+.5,tw-1,thH+rows.length*rowH-1);
  y+=22;const g2=x.createLinearGradient(0,y-6,0,y+6);g2.addColorStop(0,T.cik[0]);g2.addColorStop(1,T.cik[1]);x.fillStyle=g2;x.fillRect(ox,y-6,14,12);x.strokeStyle=T.cikKen;x.strokeRect(ox+.5,y-5.5,13,11);
  x.textAlign='left';x.fillStyle=T.not;x.font=F(600,11);x.fillText('Ay içinde çıkış yapan',ox+20,y);
  const tp=k=>rows.reduce((s,r)=>s+(r[k]||0),0);x.textAlign='right';x.fillText(`Rapor ${tp('rapor')} · Ücretsiz izin ${tp('ucretsiz')} · Yıllık izin ${tp('yillik')} · Bayram ${tp('bayram')} gün`,ox+tw,y);
  x.textAlign='center';x.font=F(500,10);x.fillText(muhBaslik(V),W/2,y+26);
  return cv;}
let jspdfY=null;function jspdfLib(){if(jspdfY)return jspdfY;jspdfY=new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';s.onload=()=>ok(window.jspdf.jsPDF);s.onerror=no;document.head.appendChild(s);});return jspdfY;}
async function muhasebeDosya(V,tur){const cv=await muhasebeGorseli(V);const ad=muhBaslik(V);
  if(tur==='png'){const b=await new Promise(r=>cv.toBlob(r,'image/png'));return new File([b],ad+'.png',{type:'image/png'});}
  const J=await jspdfLib();const w=cv.width/2*0.75,h=cv.height/2*0.75;const pdf=new J({orientation:w>h?'l':'p',unit:'pt',format:[w,h]});pdf.addImage(cv.toDataURL('image/png'),'PNG',0,0,w,h);
  pdf.setProperties({title:muhBaslik(V)});return new File([pdf.output('blob')],ad+'.pdf',{type:'application/pdf'});}
function muhasebeCiktisi(V){let tur=tryLS('pm.muhTur')||'pdf';const baslik=muhBaslik(V);
  openSheet(`<h2>Muhasebe çıktısı</h2><div class="sub">${esc(baslik)}</div>
   <div class="seg" id="mTur" style="margin-bottom:10px"><button data-v="pdf" class="${tur==='pdf'?'on':''}">PDF</button><button data-v="png" class="${tur==='png'?'on':''}">Fotoğraf</button></div>
   <img class="share-prev" id="mImg" alt="Puantaj önizleme">
   <div class="row2"><button class="btn grow" id="mIndir">İndir</button><button class="btn primary grow" id="mPay">WhatsApp / Paylaş</button></div>
   <p class="note">Paylaş'a basınca telefonun paylaşım menüsü açılır, WhatsApp'ı seçin; açıklama "${esc(baslik)}" olarak eklenir. Bilgisayarda dosya indirilir ve WhatsApp açılır, dosyayı sohbete sürükleyin.</p>`,async()=>{
   const cv=await muhasebeGorseli(V);byId('mImg').src=cv.toDataURL('image/png');
   byId('mTur').querySelectorAll('button').forEach(b=>b.onclick=()=>{tur=b.dataset.v;tryLS('pm.muhTur',tur);byId('mTur').querySelectorAll('button').forEach(q=>q.classList.toggle('on',q===b));});
   const indir=f=>{const a=document.createElement('a');a.href=URL.createObjectURL(f);a.download=f.name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000);};
   byId('mIndir').onclick=async()=>{try{indir(await muhasebeDosya(V,tur));}catch(e){toast('Dosya hazırlanamadı.');}};
   byId('mPay').onclick=async()=>{let f;try{f=await muhasebeDosya(V,tur);}catch(e){toast('Dosya hazırlanamadı.');return;}
     try{if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f],title:baslik,text:baslik});return;}}catch(e){if(e&&e.name==='AbortError')return;}
     indir(f);window.open('https://wa.me/?text='+encodeURIComponent(baslik),'_blank');};});}

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
function bordroPanel(V){const ids=Object.keys(V.sol);let satirlar=[];const okunan=[];
  openSheet(`<h2>Bordro PDF yükle</h2><div class="sub">${esc(V.sb.ad)} · ${ayAdi(V.ak)}. Birden çok şubenin bordrosunu birlikte bırakabilirsiniz; sadece bu puantajdaki kişiler eşleşir, diğerleri atlanır. Net ödenen tutarlar veri girişine "Bankaya yatan" olarak eklenir.</div>
   <label class="drop" id="bDrop"><input id="bF" type="file" accept="application/pdf" multiple hidden><b>PDF'leri buraya sürükleyip bırakın</b><span>ya da tıklayıp seçin (birden fazla seçebilirsiniz)</span></label><div id="bDosya"></div><div id="bOut"></div>`,sh=>{
   const tcMap={...((S.pt.maas&&S.pt.maas.tc)||{})};S.personel.forEach(q=>{if(q.tc&&!tcMap[q.id])tcMap[q.id]=q.tc;});
   const D=byId('bDrop');['dragenter','dragover'].forEach(ev=>D.addEventListener(ev,e=>{e.preventDefault();D.classList.add('on');}));['dragleave','drop'].forEach(ev=>D.addEventListener(ev,e=>{e.preventDefault();D.classList.remove('on');}));
   D.addEventListener('drop',e=>oku([...e.dataTransfer.files]));byId('bF').onchange=e=>oku([...e.target.files]);
   const oku=async files=>{files=files.filter(f=>/pdf$/i.test(f.name)||f.type==='application/pdf');if(!files.length){toast('PDF dosyası seçin.');return;}
     byId('bOut').innerHTML='<p class="note">PDF okunuyor…</p>';
     for(const f of files){let r;try{r=bordroCoz(await pdfSatirlari(f));}catch(err){okunan.push({ad:f.name,hata:'okunamadı (taranmış PDF olabilir)'});continue;}
       if(!r.kisiler.length){okunan.push({ad:f.name,hata:'bordro satırı bulunamadı'});continue;}
       const top=r.kisiler.reduce((s,k)=>s+(k.net||0),0);okunan.push({ad:f.name,isyeri:r.isyeri,donem:r.donem,n:r.kisiler.length,toplamOk:r.toplam==null||Math.abs(top-r.toplam)<0.05,toplam:r.toplam,top});
       r.kisiler.forEach(k=>{let pid=ids.find(id=>isimAnahtar(V.sol[id].ad)===isimAnahtar(k.ad));let yol='isim';if(!pid){pid=ids.find(id=>tcMap[id]&&tcMap[id]===k.tc)||null;yol=pid?'tc':null;}
         satirlar.push({...k,isyeri:r.isyeri||f.name,pid,yol,netYazi:k.net});});}
     ciz();};
   const ciz=()=>{// aynı kişi iki kez eşleşirse (aynı PDF iki kez bırakıldıysa vb.) ilki geçerli
     const gor={};satirlar.forEach(k=>{k.tekrar=false;if(!k.pid)return;if(gor[k.pid])k.tekrar=true;else gor[k.pid]=1;});
     byId('bDosya').innerHTML=okunan.map(o=>`<div class="tags" style="margin:6px 0 0"><span class="tag">${esc(o.ad)}</span>${o.hata?`<span class="tag warn">${esc(o.hata)}</span>`:`<span class="tag">${esc(o.isyeri||'')}</span><span class="tag">${esc(o.donem||'')}</span><span class="tag ${o.toplamOk?'':'warn'}">${o.n} kişi · ${tl(o.top)} ₺ ${o.toplamOk?'✓':'⚠ PDF toplamı '+tl(o.toplam)}</span>`}</div>`).join('');
     const es=satirlar.filter(k=>k.pid&&!k.tekrar),yok=satirlar.filter(k=>!k.pid);
     const satir=(k)=>{const j=satirlar.indexOf(k);const sol=k.pid&&V.sol[k.pid];const fark=sol&&k.sgkGun!=null&&sol.gun!==k.sgkGun;const p=k.pid&&S.personel.find(q=>q.id===k.pid);const h=p&&odemeSubesi(p);
       return `<tr class="${!k.pid?'oto':k.tekrar?'hata':''}"><td class="l">${esc(k.ad)}<br><span class="tag">${esc(k.isyeri)}</span>${k.neden?` <span class="tag">${k.eksikGun} gün ${esc(k.neden)}</span>`:''}</td>
         <td class="l"><select data-j="${j}" style="max-width:170px"><option value="">— bu şubede yok —</option>${ids.map(id=>`<option value="${esc(id)}" ${id===k.pid?'selected':''}>${esc(V.sol[id].ad)}</option>`).join('')}</select>
         ${k.yol==='tc'?'<br><span class="tag warn">İsim tutmadı, TC ile eşleşti</span>':''}${k.tekrar?'<br><span class="tag warn">Bu kişi başka satırda zaten var, atlanır</span>':''}${h&&h!==S.subeId?`<br><span class="tag">maaşı ${esc(subeAdi(h))} → oraya işlenir</span>`:''}</td>
         <td>${k.sgkGun??''}</td><td>${sol?sol.gun:''}${fark?' <span class="tag warn">gün farkı</span>':''}</td>
         <td class="bi"><input data-n="${j}" value="${esc(k.netYazi==null?'':fmt(k.netYazi))}" inputmode="decimal" style="width:110px;text-align:right;font-weight:700" title="Okunan tutar yanlışsa düzeltin"></td></tr>`;};
     byId('bOut').innerHTML=satirlar.length?`<p class="note" style="margin:8px 0 4px"><b>${es.length} kişi eşleşti</b>${yok.length?` · ${yok.length} kişi bu şubede yok (atlanır)`:''}. Tutar yanlış okunduysa kutudan düzeltin.</p>
       <div class="tbl-wrap" style="max-height:48vh;overflow:auto"><table class="pt vt"><thead><tr><th class="l">Bordrodaki isim</th><th class="l">Personel</th><th>SGK gün</th><th>Puantaj gün</th><th>Net ödenen</th></tr></thead><tbody>${[...es,...satirlar.filter(k=>k.pid&&k.tekrar),...yok].map(satir).join('')}</tbody></table></div>
       <div class="row2"><button class="btn grow" id="bEk">+ PDF ekle</button><button class="btn primary grow" id="bOk" ${es.length?'':'disabled'}>${es.length} kişinin bankaya yatanını işle</button></div>`:'';
     const be=byId('bEk');if(be)be.onclick=()=>byId('bF').click();
     byId('bOut').querySelectorAll('select[data-j]').forEach(s=>s.onchange=()=>{const k=satirlar[+s.dataset.j];k.pid=s.value||null;k.yol=s.value?'elle':null;ciz();});
     byId('bOut').querySelectorAll('input[data-n]').forEach(i=>i.onchange=()=>{satirlar[+i.dataset.n].netYazi=sayi(i.value);i.value=fmt(sayi(i.value));});
     const ok=byId('bOk');if(ok)ok.onclick=()=>isle(es);};
   const isle=async es=>{const deg={},tcYeni={};es.forEach(k=>{deg[k.pid]={bankaya:sayi(k.netYazi),kaynak:k.isyeri};if(!tcMap[k.pid]&&k.tc)tcYeni[k.pid]=k.tc;});
      const n=Object.keys(deg).length;if(!n){toast('Eşleşen personel yok.');return;}
      try{if(Object.keys(tcYeni).length)await setDoc(doc(db,'maaslar',S.subeId),{tc:tcYeni},{merge:true});
        const sonGun=ymd(new Date(+V.ak.slice(0,4),+V.ak.slice(5),0));const kim=S.me.adSoyad||S.me.kullaniciAdi||'';const z=new Date().toISOString();
        const hedefOf=pid=>{const p=S.personel.find(q=>q.id===pid);return p?odemeSubesi(p):S.subeId;};const satirOf=pid=>({id:Math.random().toString(36).slice(2,10),tarih:sonGun,ad:adBuyuk(V.sol[pid].ad),pid,tur:'BY',miktar:deg[pid].bankaya,aciklama:`Bordro PDF (${deg[pid].kaynak||V.sb.ad})`,kaynak:'bordro',kim,zaman:z});
        const burada=Object.keys(deg).filter(pid=>hedefOf(pid)===S.subeId),disari={};Object.keys(deg).forEach(pid=>{const h=hedefOf(pid);if(h!==S.subeId)(disari[h]=disari[h]||[]).push(pid);});
        const eski=((S.pt.doc&&S.pt.doc.veri)||[]).filter(v=>!(v.kaynak==='bordro'&&deg[v.pid]));const yeni=[...eski,...burada.map(satirOf)];
        const degS={};Object.keys(deg).forEach(pid=>degS[pid]={bankaya:''});
        S.pt.doc={...(S.pt.doc||{}),veri:yeni};const V2={...V,D:{...V.D,veri:yeni}};const sag=sagSonuclu(V2,degS);
        await setDoc(doc(db,'puantaj',S.subeId,'aylar',V.ak),{...(V.kilitli?{}:{sube:S.subeId,ay:V.ak}),sag,veri:yeni,guncellendi:z},{merge:true});
        const giden=[],yetkiYok=[];for(const[h,L] of Object.entries(disari)){if(!(isIsveren()||(S.me.subeler||[]).includes(h))){yetkiYok.push(subeAdi(h)+': '+L.map(pid=>adBuyuk(V.sol[pid].ad)).join(', '));continue;}
          const ref=doc(db,'puantaj',h,'aylar',V.ak);const d0=await getDoc(ref);const v0=((d0.exists()&&d0.data().veri)||[]).filter(v=>!(v.kaynak==='bordro'&&L.includes(v.pid)));
          await setDoc(ref,{sube:h,ay:V.ak,veri:[...v0,...L.map(satirOf)],guncellendi:z},{merge:true});giden.push(`${L.length} kişi → ${subeAdi(h)}`);}
        closeSheet();toast(`${burada.length} kişi bu şubeye işlendi${giden.length?', '+giden.join(', '):''}.`);render();
        if(yetkiYok.length)openSheet(`<h2>Bazı tutarlar işlenemedi</h2><div class="sub">Bu kişilerin maaşı yetkiniz olmayan şubede ödeniyor. Tutarları o şubenin bölge müdürü veri girişine "Bankaya yatan" olarak girmeli.</div><div class="card" style="padding:12px">${yetkiYok.map(esc).join('<br>')}</div><div class="row2"><button class="btn primary grow" onclick="document.getElementById('sheetRoot').innerHTML=''">Tamam</button></div>`);}
      catch(e){yazmaHatasi(e);}};});}

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
  if(withFm)['Hafta',`${AYK[+fmAyi(wid,sb).slice(5)-1]}`].forEach((t,j)=>{const X=pad+nameW+7*dayW+j*fmW;rr(X+3,y,fmW-6,dayH-8,8,C.soft);x.fillStyle=C.ink;x.font=F(800,14);x.fillText(t,X+fmW/2,y+14);x.fillStyle=C.mut;x.font=F(600,11);x.fillText('fazla mesai',X+fmW/2,y+31);});
  y+=dayH;let son=null;
  kisiler.forEach(p=>{const g=p.grup||'K';if(g!==son){son=g;x.textAlign='left';x.fillStyle=C.navy;x.font=F(800,14);x.fillText(GRUP[g].toLocaleUpperCase('tr-TR'),pad+2,y+groupH/2+2);x.fillStyle=C.line;x.fillRect(pad+90,y+groupH/2+2,W-pad*2-90,1);y+=groupH;}
    x.textAlign='left';x.fillStyle=C.ink;x.font=F(700,16);x.fillText(p.ad.toLocaleUpperCase('tr-TR'),pad+2,y+rowH/2,nameW-10);x.textAlign='center';
    ds.forEach((d,i)=>{const X=pad+nameW+i*dayW+3,Y=y+3,w=dayW-6,hh=rowH-6;if(!employed(p,d)){x.fillStyle=C.mut;x.font=F(600,15);x.fillText('—',X+w/2,Y+hh/2);return;}const v=cellOf(p.id,wid,i);
      if(isShift(v)){const k=shiftKind(v,sb);const[a,b]=v.split('-');const hw=(w-4)/2;rr(X,Y,hw,hh,7,k.o?C.open:C.soft);rr(X+hw+4,Y,hw,hh,7,k.k?C.close:C.soft);x.font=F(700,18,1);x.fillStyle=k.o?C.openI:C.ink;x.fillText(a,X+hw/2,Y+hh/2+1);x.fillStyle=k.k?C.closeI:C.ink;x.fillText(b,X+hw+4+hw/2,Y+hh/2+1);}
      else if(v&&KOD[v]){const kr=KOD_RENK[v]||[C.code,C.codeI];rr(X,Y,w,hh,7,kr[0]);x.fillStyle=kr[1];x.font=F(800,13);x.fillText(KOD[v].ad.toLocaleUpperCase('tr-TR'),X+w/2,Y+hh/2+1);}
      else{rr(X,Y,w,hh,7,BOS_RENK);x.strokeStyle='#f0b4b4';x.setLineDash([4,4]);x.beginPath();x.roundRect?x.roundRect(X+.5,Y+.5,w-1,hh-1,7):x.rect(X,Y,w,hh);x.stroke();x.setLineDash([]);}});
    if(withFm){const wk=haftaHesap(p,wid,sb),ay=ayHesap(p,fmAyi(wid,sb),sb);const vals=isEsnaf(p)?['esnaf',fmt(ay.h)+' sa']:p.sekil==='Part'?['part',fmt(ay.h)+' sa']:[sg(wk.fm),sg(ay.fm)];vals.forEach((t,j)=>{x.fillStyle=C.ink;x.font=F(700,17,1);x.fillText(t,pad+nameW+7*dayW+j*fmW+fmW/2,y+rowH/2+1);});}
    y+=rowH;});
  x.textAlign='left';x.font=F(600,12.5);let lx=pad;y+=22;[[C.open,'Açılış saati'],[C.close,'Kapanış saati'],...KOD_SIRA.filter(k=>k!=='B').map(k=>[KOD_RENK[k][0],KOD[k].ad])].forEach(([c,t])=>{rr(lx,y-7,14,14,3,c);x.fillStyle=C.mut;x.fillText(t,lx+20,y);lx+=x.measureText(t).width+44;});
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
  if(bolum==='subeler'){const hf=S.subeIds.filter(id=>sube(id).fmDonem==='hafta').length;
    h+=`<div class="actions"><button class="btn primary grow" id="ySubeEkle">Şube ekle</button></div>
     <div class="card" style="padding:12px;margin-bottom:10px"><span class="lbl" style="margin-top:0">Tüm şubelerde fazla mesai dönemi</span><div class="seg" id="yDon"><button data-v="hafta" class="${hf===S.subeIds.length?'on':''}">Haftalık (örn. Eylül: 7 Eyl – 4 Eki)</button><button data-v="ay" class="${hf===0?'on':''}">Takvim ayı</button></div>
     <p class="note" style="margin-bottom:0">Şu an ${hf} / ${S.subeIds.length} şube haftalık. Seçince tüm şubelere uygulanır; tek tek şube ayarından da değiştirilebilir.</p></div>`;
    h+=S.subeIds.length?`<div class="card list">${S.subeIds.map(id=>{const s=sube(id);return `<button class="row" data-sid="${esc(id)}"><div class="av">${esc(bas(s.ad))}</div><div class="m"><b>${esc(s.ad)}</b><span>${esc(s.acilis)}–${esc(s.kapanis)} · günlük ${fmt(s.gunluk)} sa · FM ${s.fmYontem==='maas'?'maaş ÷ 30 ÷ 9':tl0(s.fmUcret)+'/sa'}</span></div></button>`;}).join('')}</div>`:`<div class="empty-state"><b>Henüz şube yok</b>İlk şubeyi ekleyin.</div>`;}
  else{h+=`<div class="actions"><button class="btn primary grow" id="yKulEkle">Kullanıcı ekle</button></div>`;
    const us=S.users.slice().sort((a,b)=>['isveren','bolge','sube'].indexOf(a.rol)-['isveren','bolge','sube'].indexOf(b.rol)||String(a.adSoyad).localeCompare(String(b.adSoyad),'tr'));
    h+=`<div class="card list">${us.map(u=>`<button class="row" data-uid="${esc(u.uid)}"><div class="av">${esc(bas(u.adSoyad||u.kullaniciAdi))}</div><div class="m"><b>${esc(u.adSoyad||u.kullaniciAdi)}</b><span>${esc(u.kullaniciAdi)} · ${u.rol==='isveren'?'Tüm şubeler':(u.subeler||[]).map(s=>S.subeler[s]?S.subeler[s].ad:s).join(', ')||'Şube atanmamış'}</span></div>
      <span class="chip ${u.aktif===false?'mut':u.rol==='isveren'?'warn':u.rol==='bolge'?'ok':'mut'}">${u.aktif===false?'Kapalı':ROL[u.rol]||u.rol}</span></button>`).join('')}</div>`;}
  view(h,()=>{document.querySelectorAll('#ySeg button').forEach(b=>b.onclick=()=>{S.ynt=b.dataset.v;render();});
    document.querySelectorAll('#yDon button').forEach(b=>b.onclick=async()=>{const v=b.dataset.v;const bt=writeBatch(db);S.subeIds.forEach(id=>bt.set(doc(db,'subeler',id),{fmDonem:v},{merge:true}));try{await bt.commit();toast(`Tüm şubelerde fazla mesai dönemi: ${v==='hafta'?'haftalık':'takvim ayı'}.`);}catch(e){yazmaHatasi(e);}});
    const se=byId('ySubeEkle');if(se)se.onclick=()=>subePanel(null);document.querySelectorAll('[data-sid]').forEach(b=>b.onclick=()=>subePanel(b.dataset.sid));
    const ke=byId('yKulEkle');if(ke)ke.onclick=()=>kullaniciPanel(null);document.querySelectorAll('[data-uid]').forEach(b=>b.onclick=()=>kullaniciPanel(b.dataset.uid));});}
function subePanel(id){const s=id?sube(id):{...VARSAYILAN,ad:''};
  openSheet(`<h2>${id?'Şube ayarları':'Yeni şube'}</h2><div class="sub">Vardiya renkleri ve fazla mesai bu ayarlara göre hesaplanır.</div>
   <label class="field"><span>Şube adı</span><input id="sAd" value="${esc(s.ad)}" placeholder="Altınkale"></label>
   <div class="fgrid"><label class="field"><span>Açılış</span><input id="sAc" inputmode="numeric" value="${esc(s.acilis)}"></label><label class="field"><span>Kapanış</span><input id="sKa" inputmode="numeric" value="${esc(s.kapanis)}"></label>
   <label class="field"><span>Günlük mesai (sa)</span><input id="sGu" inputmode="decimal" value="${s.gunluk}"></label><label class="field"><span>Haftalık mesai (sa)</span><input id="sHa" inputmode="decimal" value="${s.haftalik}"></label>
   <label class="field"><span>Part günü (sa)</span><input id="sPa" inputmode="decimal" value="${s.partSaat}"></label><label class="field"><span>Kurye paket başı ücret (₺)</span><input id="sPk" inputmode="decimal" value="${s.paketUcret||''}"></label></div>
   <span class="lbl">Fazla mesai ücreti</span><div class="seg" id="sYon"><button data-v="sabit" class="${s.fmYontem!=='maas'?'on':''}">Sabit saat ücreti</button><button data-v="maas" class="${s.fmYontem==='maas'?'on':''}">Maaş ÷ 30 ÷ 9</button></div>
   <label class="field" id="sUcW"><span>Saat ücreti (₺)</span><input id="sUc" inputmode="decimal" value="${s.fmUcret}"></label>
   <span class="lbl">Fazla mesai dönemi</span><div class="seg" id="sDon"><button data-v="ay" class="${s.fmDonem!=='hafta'?'on':''}">Takvim ayı</button><button data-v="hafta" class="${s.fmDonem==='hafta'?'on':''}">Haftalık</button></div>
   <p class="note" style="margin-top:4px">Haftalık: pazartesisi o ayda olan haftalar sayılır. Örnek Eylül 2026: 7 Eylül – 4 Ekim. Rapor, izin ve bordro günü her iki durumda da takvim ayına göredir.</p><div id="sErr"></div>
   <div class="row2"><button class="btn grow" id="sNo">Vazgeç</button><button class="btn primary grow" id="sOk">Kaydet</button></div>
   ${id?`<div class="row2"><button class="btn grow" id="sX">Excel'den çizelge aktar</button></div>`:''}`,sh=>{
   const sx=byId('sX');if(sx)sx.onclick=()=>{closeSheet();if(S.subeId!==id)selectSube(id);const bekle=()=>{if(S.subeId===id&&S.loaded.personel)excelAktarPanel(id);else setTimeout(bekle,150);};bekle();};
   const yb=sh.querySelectorAll('#sYon button');const tog=()=>byId('sUcW').hidden=sh.querySelector('#sYon .on').dataset.v==='maas';yb.forEach(b=>b.onclick=()=>{yb.forEach(x=>x.classList.remove('on'));b.classList.add('on');tog();});tog();
   const db_=sh.querySelectorAll('#sDon button');db_.forEach(b=>b.onclick=()=>{db_.forEach(x=>x.classList.remove('on'));b.classList.add('on');});
   byId('sNo').onclick=closeSheet;byId('sOk').onclick=()=>{const ad=byId('sAd').value.trim(),ac=normTime(byId('sAc').value),ka=normTime(byId('sKa').value);
     if(!ad||!ac||!ka){byId('sErr').innerHTML='<div class="confirm">Şube adı, açılış ve kapanış saati gerekli (örn. 11:00 ve 00:30).</div>';return;}
     const gu=sayi(byId('sGu').value),ha=sayi(byId('sHa').value);if(!(gu>0&&gu<=16)||!(ha>0&&ha<=100)){byId('sErr').innerHTML='<div class="confirm">Günlük mesai 1–16 saat, haftalık mesai 1–100 saat arasında olmalı (örn. 8,5 ve 51).</div>';return;}
     const sid=id||slug(ad);if(!id&&S.subeler[sid]){byId('sErr').innerHTML='<div class="confirm">Bu isimde bir şube var.</div>';return;}
     const body={ad,acilis:ac,kapanis:ka,gunluk:sayi(byId('sGu').value)||8.5,haftalik:sayi(byId('sHa').value)||51,partSaat:sayi(byId('sPa').value)||8,paketUcret:sayi(byId('sPk').value),fmYontem:sh.querySelector('#sYon .on').dataset.v,fmUcret:sayi(byId('sUc').value),fmDonem:sh.querySelector('#sDon .on').dataset.v};
     sirayla('s'+sid,()=>setDoc(doc(db,'subeler',sid),body,{merge:true}));closeSheet();toast(id?'Şube ayarları kaydedildi.':`${ad} şubesi eklendi.`);};});}
/* ================= Excel'den çizelge aktarma (işveren) ================= */
let xlsxYuklendi=null;function xlsxLib(){if(xlsxYuklendi)return xlsxYuklendi;xlsxYuklendi=new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';s.onload=()=>ok(window.XLSX);s.onerror=no;document.head.appendChild(s);});return xlsxYuklendi;}
const XKOD={'HAF. İZİN':'HT','HAF.İZİN':'HT','HAFTALIK İZİN':'HT','HAFTA TATİLİ':'HT','İZİN':'HT','ÜCR. İZİN':'UI','ÜCR.İZİN':'UI','ÜCRETSİZ İZİN':'UI','YILLIK İZİN':'YI','YILLIK':'YI','RAPOR':'R','RAPORLU':'R','BAYRAM':'B','DİĞER':'D'};
function xSerialTarih(v){if(typeof v!=='number'||v<20000)return null;const d=new Date(Date.UTC(1899,11,30)+Math.round(v)*86400000);return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')+'-'+String(d.getUTCDate()).padStart(2,'0');}
function xSaat(v){if(typeof v==='number'){if(v>=1)v=v%1;const m=Math.round(v*1440)%1440;return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');}if(typeof v==='string')return normTime(v);return null;}
function xTarihMetin(v){if(typeof v==='number')return xSerialTarih(v);if(typeof v!=='string')return'';const m=v.trim().match(/^(\d{1,2})[.,/](\d{1,2})[.,/](\d{4})$/);return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:'';}
function adBuyuk(s){return String(s||'').trim().replace(/\s+/g,' ').toLocaleUpperCase('tr-TR');}
function xAd(s){return adBuyuk(s);}
function xSekil(s){s=String(s||'').toLocaleUpperCase('tr-TR');return s.includes('PART')?'Part':s.includes('ESNAF')?'Esnaf kurye':'Tam';}
function excelCoz(X,wb){const val=(ws,r,c)=>{const x=ws[X.utils.encode_cell({r,c})];return x?x.v:null;};const sayfalar=[];let liste=null;
  wb.SheetNames.forEach(name=>{const ws=wb.Sheets[name];if(!ws['!ref'])return;const R=X.utils.decode_range(ws['!ref']);const maxR=Math.min(R.e.r,400);
    // Personel listesi sayfası
    for(let r=0;r<=Math.min(maxR,12);r++)for(let c=0;c<=Math.min(R.e.c,20);c++){if(String(val(ws,r,c)||'').trim().toLocaleUpperCase('tr-TR')==='ADI SOYADI'){
      const hdr={};for(let cc=c;cc<=Math.min(R.e.c,c+12);cc++)hdr[String(val(ws,r,cc)||'').trim().toLocaleUpperCase('tr-TR')]=cc;
      if(hdr['GİRİŞ TARİHİ']!=null&&!liste){liste={};for(let rr=r+1;rr<=maxR;rr++){const ad=val(ws,rr,c);if(!ad||typeof ad!=='string')continue;
        const hv=k=>hdr[k]!=null?val(ws,rr,hdr[k]):null;
        liste[isimAnahtar(ad)]={sekil:hdr['ÇALIŞMA ŞEKLİ']!=null?xSekil(val(ws,rr,hdr['ÇALIŞMA ŞEKLİ'])):null,giris:xTarihMetin(val(ws,rr,hdr['GİRİŞ TARİHİ'])),cikis:hdr['ÇIKIŞ TARİHİ']!=null?xTarihMetin(val(ws,rr,hdr['ÇIKIŞ TARİHİ'])):'',
          bilgi:excelBilgi({tel:hv('TELEFON'),eposta:hv('MAİL')??hv('E-POSTA')??hv('MAIL'),iban:hv('IBAN')})};}}}}
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
  openSheet(`<h2>Excel'den çizelge aktar</h2><div class="sub">${esc(sb.ad)} · Mevcut MESAİ ÇİZELGESİ dosyanızı seçin. Personel listesi sayfası varsa giriş/çıkış tarihleri, telefon, e-posta ve IBAN da alınır.</div>
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
       const mevcut={};subePersoneli(sid).forEach(p=>mevcut[isimAnahtar(p.ad)]=p);
       const keys=Object.keys(kisi).sort((a,b)=>kisi[a].ad.localeCompare(kisi[b].ad,'tr'));
       byId('xOn2').innerHTML=`<span class="lbl">Personel · ${keys.length} kişi</span><p class="note" style="margin:0 0 8px">Yeni kişilerin görevini ve SGK şubesini seçin. Mevcut personel aynen kalır.</p>
        <div class="tbl-wrap"><table class="pt"><thead><tr><th class="l">İsim</th><th>Durum</th><th>Görev</th><th>SGK şubesi</th><th>Giriş</th><th>Çıkış</th></tr></thead><tbody>${keys.map(k=>{const m=mevcut[k],l=(P.liste||{})[k]||{};
          return `<tr><td class="l"><b>${esc(kisi[k].ad)}</b><br><span class="tag">${kisi[k].vardiya} gün</span>${l.sekil&&!m?` <span class="tag">${esc(l.sekil)}</span>`:''}</td><td>${m?'<span class="chip ok">Mevcut</span>':'<span class="chip warn">Yeni</span>'}</td>
          <td>${m?esc(gorevTahmin(m)):`<select data-k="${esc(k)}" data-t="g"><option value="">Seçin</option>${GOREVLER.map(g=>`<option value="${esc(g.ad)}" ${(l.sekil==='Esnaf kurye'&&g.ad==='Esnaf Kurye')?'selected':''}>${esc(g.ad)}</option>`).join('')}</select>`}</td>
          <td>${m?esc(m.sgkSube===SGK_YOK?'Boş':m.sgkSube?subeAdi(m.sgkSube):'—'):`<select data-k="${esc(k)}" data-t="s"><option value="${SGK_YOK}">Boş</option>${tumSubeler().map(([id2,ad2])=>`<option value="${esc(id2)}" ${id2===sid?'selected':''}>${esc(ad2)}</option>`).join('')}</select>`}</td><td>${trTarih(m?m.giris:l.giris)}</td><td>${trTarih(m?m.cikis:l.cikis)}</td></tr>`;}).join('')}</tbody></table></div>
        <p class="note">${Object.keys(haftalar).length} hafta aktarılacak. Aynı haftada çizelgede daha önce girilmiş günler Excel'deki değerle değiştirilir.</p>
        <div class="row2"><button class="btn grow" id="xNo">Vazgeç</button><button class="btn primary grow" id="xOk">Aktar</button></div>`;
       byId('xNo').onclick=closeSheet;
       byId('xOk').onclick=async()=>{const eksik=keys.filter(k=>!mevcut[k]&&!gorevBul((byId('xOn2').querySelector(`select[data-t="g"][data-k="${CSS.escape(k)}"]`)||{}).value));
         if(eksik.length){toast(`${eksik.length} kişinin görevi seçilmedi.`);return;}
         const btn=byId('xOk');btn.disabled=true;btn.textContent='Aktarılıyor…';const pidOf={};const ops=[];
         keys.forEach(k=>{const m=mevcut[k];if(m){pidOf[k]=m.id;const lb=((P.liste||{})[k]||{}).bilgi||{};const ek={};Object.entries(lb).forEach(([f,v])=>{if(v&&!m[f])ek[f]=v;});if(Object.keys(ek).length)ops.push([doc(db,'personel',m.id),ek,true]);return;}const l=(P.liste||{})[k]||{};const pid=slug(kisi[k].ad)+'-'+Math.random().toString(36).slice(2,6);pidOf[k]=pid;
           const g=gorevBul(byId('xOn2').querySelector(`select[data-t="g"][data-k="${CSS.escape(k)}"]`).value);const sgkV=byId('xOn2').querySelector(`select[data-t="s"][data-k="${CSS.escape(k)}"]`).value;
           ops.push([doc(db,'personel',pid),{ad:kisi[k].ad,grup:g.grup,gorev:g.ad,sekil:g.sekil||(l.sekil==='Part'?'Part':'Tam'),giris:l.giris||'',cikis:l.cikis||'',sgkSube:sgkV,anaSube:sid,...(l.bilgi||{})},false]);});
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
