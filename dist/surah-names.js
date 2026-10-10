// Albanian interface labels. Quran.com's Arabic text and chapter data stay intact.
export const surahMeanings = [
  'Hapja','Lopa','Familja e Imranit','Gratë','Sofra','Bagëtitë','Lartësitë','Plaçka e luftës','Pendimi','Junusi',
  'Hudi','Jusufi','Bubullima','Ibrahimi','Hixhri','Bleta','Udhëtimi i natës','Shpella','Merjemja','Ta-Ha',
  'Profetët','Haxhi','Besimtarët','Drita','Dalluesi','Poetët','Milingona','Rrëfimet','Merimanga','Romakët',
  'Llukmani','Sexhdja','Aleatët','Sebeja','Krijuesi','Ja-Sin','Të rreshtuarit','Sad','Grupet','Falësi',
  'Të shpjeguara hollësisht','Këshillimi','Stolitë e arta','Tymi','Të gjunjëzuarit','Dunat e rërës','Muhamedi','Fitorja','Dhomat','Kaf',
  'Erërat që shpërndajnë','Mali','Ylli','Hëna','I Gjithëmëshirshmi','Ngjarja','Hekuri','Gruaja që polemizon','Dëbimi','E sprovuara',
  'Rreshti','E premtja','Hipokritët','Mashtrimi i ndërsjellë','Shkurorëzimi','Ndalimi','Sundimi','Pena','E vërteta','Shkallët e ngritjes',
  'Nuhu','Xhinët','I mbështjelli','I mbuluari','Ringjallja','Njeriu','Të dërguarit','Lajmi','Ata që nxjerrin','Ai u vrenjt',
  'Mbështjellja','Çarja','Mashtruesit në matje','Plasaritja','Yjësitë','Ylli i natës','Më i Larti','Ngjarja që mbulon','Agimi','Qyteti',
  'Dielli','Nata','Paraditja','Zgjerimi','Fiku','Gjaku i ngjizur','Nata e Kadrit','Dëshmia e qartë','Tërmeti','Kuajt që vrapojnë',
  'Goditja','Gara për pasuri','Koha','Përgojuesi','Elefanti','Kurejshët','Ndihma e vogël','Mirësitë e shumta','Mohuesit','Ndihma',
  'Litari prej fijesh','Sinqeriteti','Agimi','Njerëzit'
];
export function surahMeaning(id) { return surahMeanings[Number(id)-1] || 'Kurani'; }
export function normalizeSearch(value) { return String(value).toLocaleLowerCase('sq').normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
