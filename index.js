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

async function fetchEditions(surahNum, editions) {
  const url = `https://api.alquran.cloud/v1/surah/${surahNum}/editions/${editions}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("API isteği başarısız: " + res.status);
  const data = await res.json();
  return data.data;
}

// Tekrar eden cümleleri temizleme fonksiyonu
function removeConsecutiveDuplicates(text) {
  if (!text) return text;
  const sentences = text.split(/([.?!])\s*/);
  const filtered = [];
  for (let i = 0; i < sentences.length; i += 2) {
    const sentence = (sentences[i] || '') + (sentences[i+1] || '');
    if (i === 0 || sentence.trim() !== filtered[filtered.length - 1]?.trim()) {
      filtered.push(sentence.trim());
    }
  }
  return filtered.join(' ');
}

let audioQueue = [];
let currentAudio = null;
let playing = false;
let paused = false;

function playQueue(urls, fromStart = true) {
  if (fromStart) {
    stopAudio(true);
    audioQueue = Array.from(urls);
    playing = true;
    paused = false;
    playNext();
  } else {
    if (currentAudio && paused) {
      currentAudio.play();
      paused = false;
      stopBtn.textContent = "⏸ Dur";
    }
  }
}

function playNext() {
  if (!playing) return;
  if (audioQueue.length === 0) {
    playing = false;
    currentAudio = null;
    stopBtn.textContent = "⏸ Dur";
    return;
  }
  const url = audioQueue.shift();
  currentAudio = new Audio(url);
  currentAudio.onended = () => { currentAudio = null; playNext(); };
  currentAudio.onerror = () => { console.warn("Ses yüklenirken hata", url); playNext(); };
  currentAudio.play().catch(err => {
    console.warn("Oynatma başlatılamadı:", err);
  });
}

function stopAudio(fullStop = false) {
  if (currentAudio) {
    if (fullStop) {
      currentAudio.pause();
      currentAudio = null;
      paused = false;
      stopBtn.textContent = "⏸ Dur";
    } else {
      currentAudio.pause();
      paused = true;
      stopBtn.textContent = "▶ Devam Et";
    }
  }
}

async function loadSurah(surahNum, surahDisplayName, clickedEl) {
  try {
    surahTitleEl.textContent = `Yükleniyor...`;
    arabicTextEl.textContent = "";
    turkishTextEl.textContent = "";
    translitTextEl.textContent = "";
    displayArea.classList.add('hidden');

    const editions = await fetchEditions(surahNum, "quran-uthmani,tr.diyanet");
    const arabicEdition = editions.find(e => e.edition.identifier.includes("quran-uthmani"));
    const turkishEdition = editions.find(e => e.edition.identifier.includes("tr"));

    const arabicText = arabicEdition ? arabicEdition.ayahs.map(a => a.text).join(' ') : "Arapça metin yüklenemedi.";
    let turkishTextRaw = turkishEdition ? turkishEdition.ayahs.map(a => a.text).join(' ') : "Türkçe meal yüklenemedi.";

    // Sadece Felâk (113) ve Nâs (114) için tekrar temizle
    let turkishText = turkishTextRaw;
    if (surahNum === 113 || surahNum === 114) {
      turkishText = removeConsecutiveDuplicates(turkishTextRaw);
    }

    let turkceOkunus = "";
    if (turkceOkunusJson) {
      const found = turkceOkunusJson.find(s => s.chapter === surahNum);
      if (found && found.ayahs) {
        turkceOkunus = found.ayahs.map(a => a.text).join(' ');
      }
    }

    let audioUrls = [];
    try {
      const audioRes = await fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/ar.alafasy`);
      if (audioRes.ok) {
        const json = await audioRes.json();
        if (json?.data?.ayahs) {
          audioUrls = json.data.ayahs.map(a => a.audio).filter(Boolean);
        }
      }
    } catch (e) {
      console.warn("Ses için ek istek başarısız:", e);
    }

    surahTitleEl.textContent = surahDisplayName;
    arabicTextEl.textContent = arabicText;
    turkishTextEl.textContent = turkishText;
    translitTextEl.textContent = turkceOkunus || "Okunuş (transliterasyon) bulunamadı.";
    displayArea.classList.remove('hidden');

    playBtn.textContent = "🔊 Sûreyi Sesli Oku";
    playBtn.onclick = () => playQueue(audioUrls, true);

    stopBtn.textContent = "⏸ Dur";
    stopBtn.onclick = () => {
      if (paused) {
        playQueue(audioUrls, false);
      } else {
        stopAudio(false);
      }
    };

    document.querySelectorAll('.surah-item').forEach(el => el.classList.remove('active'));
    if (clickedEl) clickedEl.classList.add('active');

  } catch (err) {
    console.error("Sûre yükleme hatası:", err);
    surahTitleEl.textContent = "Yükleme hatası";
    arabicTextEl.textContent = "Bir hata oluştu.";
    turkishTextEl.textContent = "";
    translitTextEl.textContent = "";
    displayArea.classList.remove('hidden');
  }
}

function populateList() {
  NAMAZ_SURAHS.forEach(s => {
    const item = document.createElement('div');
    item.className = 'surah-item';
    item.textContent = `${s.name} (Sûre ${s.num})`;
    item.addEventListener('click', () => loadSurah(s.num, `${s.name} (Sûre ${s.num})`, item));
    surahListEl.appendChild(item);
  });
}

populateList();
