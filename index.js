const surahListEl = document.getElementById('surahList');
const surahTitleEl = document.getElementById('surahTitle');
const arabicTextEl = document.getElementById('arabicText');
const turkishTextEl = document.getElementById('turkishText');
const translitTextEl = document.getElementById('translitText');
const displayArea = document.getElementById('displayArea');
const playBtn = document.getElementById('playAudio');
const stopBtn = document.getElementById('stopAudio');
const sidebar = document.getElementById('sidebar');
const toggleMenu = document.getElementById('toggleMenu');

toggleMenu.addEventListener('click', () => {
  sidebar.classList.toggle('closed');
});

/* Namaz sûreleri listesi (eklenen Tebbet ve Fil ile) */
/* Namaz sûreleri listesi (Kureyş ve Ma’un eklendi, Kur’an sırasına göre sıralandı) */
const NAMAZ_SURAHS = [
  {name: "Fâtiha", num: 1},
  {name: "Asr", num: 103},
  {name: "Fil", num: 105},
  {name: "Kureyş", num: 106},
  {name: "Ma’un", num: 107},
  {name: "Kevser", num: 108},
  {name: "Kâfirûn", num: 109},
  {name: "Tebbet", num: 111},
  {name: "İhlâs", num: 112},
  {name: "Felâk", num: 113},
  {name: "Nâs", num: 114}
];

/* Türkçe okunuş JSON yükleme */
let turkceOkunusJson = null;

fetch('turkce_okunus.json')
  .then(res => {
    if (!res.ok) throw new Error("Türkçe okunuş JSON yüklenemedi");
    return res.json();
  })
  .then(json => {
    turkceOkunusJson = json;
  })
  .catch(e => {
    console.warn("Türkçe okunuş yüklenemedi:", e);
    turkceOkunusJson = null;
  });

/* AlQuran Cloud edition çağrısı */
async function fetchEditions(surahNum, editions) {
  const url = `https://api.alquran.cloud/v1/surah/${surahNum}/editions/${editions}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("API isteği başarısız: " + res.status);
  const data = await res.json();
  return data.data; // array
}

/* Ses çalma altyapısı */
let audioQueue = [];
let currentAudio = null;
let playing = false;

function playQueue(urls) {
  stopAudio();
  audioQueue = Array.from(urls);
  playing = true;
  playNext();
}

function playNext() {
  if (!playing) return;
  if (audioQueue.length === 0) {
    playing = false;
    currentAudio = null;
    return;
  }
  const url = audioQueue.shift();
  currentAudio = new Audio(url);
  currentAudio.onended = () => { currentAudio = null; playNext(); };
  currentAudio.onerror = () => { console.warn("Ses yüklenirken hata", url); playNext(); };
  currentAudio.play().catch(err => {
    console.warn("Oynatma başlatılamadı (tarayıcı kısıtlaması?):", err);
  });
}

function stopAudio() {
  playing = false;
  audioQueue = [];
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
}

/* Surah seçimi işlendiğinde API çağrıları */
async function loadSurah(surahNum, surahDisplayName, clickedEl) {
  try {
    surahTitleEl.textContent = `Yükleniyor...`;
    arabicTextEl.textContent = "";
    turkishTextEl.textContent = "";
    translitTextEl.textContent = "";
    displayArea.classList.add('hidden');

    // 1) Arapça + Türkçe meal (Diyanet)
    const editions = await fetchEditions(surahNum, "quran-uthmani,tr.diyanet");

    const arabicEdition = editions.find(e => e.edition.identifier && e.edition.identifier.includes("quran-uthmani"));
    const turkishEdition = editions.find(e => e.edition.identifier && (e.edition.identifier.includes("tr") || e.edition.identifier.includes("diyanet")));

    const arabicText = arabicEdition ? arabicEdition.ayahs.map(a => a.text).join(' ') : "Arapça metin yüklenemedi.";
    const turkishText = turkishEdition ? turkishEdition.ayahs.map(a => a.text).join(' ') : "Türkçe meal yüklenemedi.";

    // 2) Türkçe okunuş JSON'u kullan
    let turkceOkunus = "";
    if (turkceOkunusJson) {
      const found = turkceOkunusJson.find(s => s.chapter === surahNum);
      if (found && found.ayahs) {
        turkceOkunus = found.ayahs.map(a => a.text).join(' ');
      }
    }

    // 3) Ses: ar.alafasy endpoint'inden ayah-by-ayah audio URL'leri
    let audioUrls = [];
    try {
      const audioRes = await fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/ar.alafasy`);
      if (audioRes.ok) {
        const json = await audioRes.json();
        if (json && json.data && json.data.ayahs) {
          audioUrls = json.data.ayahs.map(a => a.audio).filter(Boolean);
        }
        if (audioUrls.length === 0 && json && json.data && json.data.audio) {
          audioUrls = [json.data.audio];
        }
      }
    } catch (e) {
      console.warn("Ses için ek istek başarısız:", e);
    }

    // UI'ya yaz
    surahTitleEl.textContent = surahDisplayName;
    arabicTextEl.textContent = arabicText;
    turkishTextEl.textContent = turkishText;
    translitTextEl.textContent = turkceOkunus || "Okunuş (transliterasyon) kaynağı bulunamadı veya yüklenemedi.";

    displayArea.classList.remove('hidden');

    playBtn.onclick = () => {
      if (audioUrls.length === 0) {
        alert("Ses kaynağı bulunamadı veya yüklenemedi.");
        return;
      }
      playQueue(audioUrls);
    };
    stopBtn.onclick = stopAudio;

    document.querySelectorAll('.surah-item').forEach(el => el.classList.remove('active'));
    if (clickedEl) clickedEl.classList.add('active');

  } catch (err) {
    console.error("Süre yükleme hatası:", err);
    surahTitleEl.textContent = "Yükleme hatası";
    arabicTextEl.textContent = "Bir hata oluştu. Konsolu kontrol edin.";
    turkishTextEl.textContent = "";
    translitTextEl.textContent = "";
    displayArea.classList.remove('hidden');
  }
}

/* Listeyi doldur */
function populateList() {
  NAMAZ_SURAHS.forEach(s => {
    const item = document.createElement('div');
    item.className = 'surah-item';
    item.textContent = `${s.name} (Sûre ${s.num})`;
    item.addEventListener('click', () => loadSurah(s.num, `${s.name} (Sûre ${s.num})`, item));
    surahListEl.appendChild(item);
  });
}

// Başlat
populateList();
