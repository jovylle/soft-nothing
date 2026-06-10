import {
  fetchStats,
  fetchFavorites,
  getVisitorId,
  recordMood,
  recordNothingDone,
  recordPick,
  saveFavorites,
} from "./api.js";

const activities = [
  {
    id: "ceiling",
    emoji: "👀",
    title: "stare at the ceiling",
    desc: "notice a crack you've never named. give it a nickname if you want. or don't.",
    category: "still",
    vibe: "zero input, maximum presence",
  },
  {
    id: "clouds",
    emoji: "☁️",
    title: "watch clouds argue",
    desc: "find shapes. lose the shapes. forget what shapes are.",
    category: "outside",
    vibe: "sky television, no subscription",
  },
  {
    id: "water",
    emoji: "💧",
    title: "drink water like it's a ritual",
    desc: "one slow sip. hold it. swallow. you are a temple of hydration.",
    category: "tiny",
    vibe: "ceremony without meaning",
  },
  {
    id: "floor",
    emoji: "🫠",
    title: "lie on the floor",
    desc: "gravity is doing the work. you're just cooperating.",
    category: "still",
    vibe: "horizontal enlightenment",
  },
  {
    id: "pillow",
    emoji: "🛏️",
    title: "flip the pillow",
    desc: "find the cold side. press your cheek into it. time stops briefly.",
    category: "tiny",
    vibe: "small luxury, big peace",
  },
  {
    id: "window",
    emoji: "🪟",
    title: "open a window and listen",
    desc: "birds, cars, wind, someone's distant lawnmower. the world hums.",
    category: "senses",
    vibe: "ambient reality playlist",
  },
  {
    id: "tea",
    emoji: "🍵",
    title: "make tea and forget it",
    desc: "the ritual matters. drinking it is optional. warmth in a mug is enough.",
    category: "tiny",
    vibe: "process over outcome",
  },
  {
    id: "sock",
    emoji: "🧦",
    title: "find the comfiest sock",
    desc: "put it on your hand. puppet optional. judgment forbidden.",
    category: "weird",
    vibe: "domestic absurdism",
  },
  {
    id: "blink",
    emoji: "😌",
    title: "blink slowly, on purpose",
    desc: "like a very calm lizard who has never heard of email.",
    category: "still",
    vibe: "reptile energy",
  },
  {
    id: "shadow",
    emoji: "🌿",
    title: "sit in a patch of shade",
    desc: "the sun moved for you. or you moved for the sun. either way, nice.",
    category: "outside",
    vibe: "borrowed coolness",
  },
  {
    id: "smell",
    emoji: "🌸",
    title: "smell something nice",
    desc: "soap, rain, old book, clean laundry. let your nose do a tiny vacation.",
    category: "senses",
    vibe: "olfactory daydream",
  },
  {
    id: "stretch",
    emoji: "🐱",
    title: "stretch like a cat",
    desc: "no fitness goals. just spine noises and dignity optional.",
    category: "still",
    vibe: "feline wisdom",
  },
  {
    id: "hum",
    emoji: "🎵",
    title: "hum one note",
    desc: "hold it until it gets boring. boredom is the point.",
    category: "weird",
    vibe: "single-frequency meditation",
  },
  {
    id: "count",
    emoji: "🍃",
    title: "count five green things",
    desc: "plants, socks, mugs, envy — anything counts if you squint.",
    category: "outside",
    vibe: "gentle scavenger hunt",
  },
  {
    id: "breathe",
    emoji: "🫁",
    title: "breathe like you mean it",
    desc: "in for four, out for six. or don't count. your lungs know what to do.",
    category: "still",
    vibe: "autopilot appreciation",
  },
  {
    id: "hand",
    emoji: "✋",
    title: "look at your hands",
    desc: "weird little meat tools you've had your whole life. hi, hands.",
    category: "weird",
    vibe: "body inventory",
  },
  {
    id: "rain",
    emoji: "🌧️",
    title: "stand near rain without getting wet",
    desc: "doorway, window, porch. listen to the sound of not being outside.",
    category: "senses",
    vibe: "dry observation",
  },
  {
    id: "blanket",
    emoji: "🧣",
    title: "become a blanket burrito",
    desc: "wrap up. immobilize slightly. accept your new cylindrical form.",
    category: "tiny",
    vibe: "soft containment",
  },
  {
    id: "walk",
    emoji: "🚶",
    title: "walk with no destination",
    desc: "turn left because left felt right. arrive nowhere. success.",
    category: "outside",
    vibe: "purposeless pilgrimage",
  },
  {
    id: "pet",
    emoji: "🐾",
    title: "pet something soft",
    desc: "pet, pillow, plant, your own arm. all valid. all soft enough.",
    category: "tiny",
    vibe: "texture therapy",
  },
  {
    id: "dark",
    emoji: "🌙",
    title: "sit in dim light",
    desc: "not full darkness. just enough to feel like evening at any hour.",
    category: "senses",
    vibe: "perpetual golden hour",
  },
  {
    id: "exist",
    emoji: "✨",
    title: "exist aggressively",
    desc: "you are here. that is the whole activity. no notes.",
    category: "weird",
    vibe: "pure being",
  },
  {
    id: "rock",
    emoji: "🪨",
    title: "find a rock and admire it",
    desc: "it has been through things. so have you. nod at each other.",
    category: "outside",
    vibe: "geological kinship",
  },
  {
    id: "silence",
    emoji: "🤫",
    title: "enjoy three seconds of silence",
    desc: "then notice the fridge hum you forgot existed. that's also fine.",
    category: "senses",
    vibe: "negative space appreciation",
  },
];

const moodLabels = [
  { max: 15, text: "still carrying the world — that's okay" },
  { max: 30, text: "lightly burdened, mostly fog" },
  { max: 45, text: "half here, half elsewhere" },
  { max: 60, text: "drifting like a leaf with no river" },
  { max: 75, text: "pleasantly hollow" },
  { max: 90, text: "almost entirely air" },
  { max: 100, text: "pure void, beautiful and free" },
];

const STORAGE_KEY = "soft-nothing-favs";
const visitorId = getVisitorId();

let currentFilter = "all";
let favorites = new Set();
let timerInterval = null;
let timerSeconds = 0;
let moodDebounce = null;

const els = {
  nowActivity: document.getElementById("now-activity"),
  nowVibe: document.getElementById("now-vibe"),
  btnAnother: document.getElementById("btn-another"),
  btnNothingTimer: document.getElementById("btn-nothing-timer"),
  timerCard: document.getElementById("timer-card"),
  timerDisplay: document.getElementById("timer-display"),
  timerHint: document.getElementById("timer-hint"),
  btnStopTimer: document.getElementById("btn-stop-timer"),
  grid: document.getElementById("activity-grid"),
  moodSlider: document.getElementById("mood-slider"),
  moodReadout: document.getElementById("mood-readout"),
  footerStat: document.getElementById("footer-stat"),
  globalNothing: document.getElementById("global-nothing"),
  globalMood: document.getElementById("global-mood"),
};

function loadLocalFavorites() {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function saveLocalFavorites() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...favorites]));
}

async function syncFavorites() {
  saveLocalFavorites();
  try {
    await saveFavorites(visitorId, [...favorites]);
  } catch {
    // offline is fine. local hearts still work.
  }
}

async function loadFavorites() {
  favorites = loadLocalFavorites();

  try {
    const remote = await fetchFavorites(visitorId);
    if (remote.length) {
      favorites = new Set(remote);
      saveLocalFavorites();
    }
  } catch {
    // keep local copy
  }
}

function pickRandom(list = activities) {
  return list[Math.floor(Math.random() * list.length)];
}

function getFiltered() {
  if (currentFilter === "all") return activities;
  return activities.filter((a) => a.category === currentFilter);
}

function showSuggestion(activity) {
  els.nowActivity.textContent = activity.title;
  els.nowVibe.textContent = activity.vibe;
  els.btnNothingTimer.dataset.activityId = activity.id;
}

function suggestNow({ track = true } = {}) {
  const pool = getFiltered();
  const activity = pickRandom(pool.length ? pool : activities);
  showSuggestion(activity);

  if (track) {
    recordPick(activity.id).catch(() => {});
  }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function startTimer(minutes = 5) {
  stopTimer(false);
  timerSeconds = minutes * 60;
  els.timerCard.classList.remove("hidden");
  els.timerDisplay.textContent = formatTime(timerSeconds);
  els.timerHint.textContent = "no phone. no optimizing. just exist.";

  timerInterval = setInterval(() => {
    timerSeconds -= 1;
    els.timerDisplay.textContent = formatTime(timerSeconds);

    if (timerSeconds <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      els.timerHint.textContent = "you did nothing. that counts as everything today.";
      recordNothingDone()
        .then(() => loadCommunityStats())
        .catch(() => {});
    }
  }, 1000);
}

function stopTimer(showCard = true) {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  if (showCard) {
    els.timerCard.classList.add("hidden");
  }
}

function toggleFavorite(id) {
  if (favorites.has(id)) {
    favorites.delete(id);
  } else {
    favorites.add(id);
  }
  syncFavorites();
  renderGrid();
  updateFooter();
}

function renderGrid() {
  const filtered = getFiltered();
  els.grid.innerHTML = "";

  filtered.forEach((activity, i) => {
    const card = document.createElement("article");
    card.className = "card";
    card.style.animationDelay = `${i * 0.04}s`;

    const isFav = favorites.has(activity.id);
    card.innerHTML = `
      <button class="card-fav ${isFav ? "active" : ""}" type="button" aria-label="Favorite" data-id="${activity.id}">
        ${isFav ? "♥" : "♡"}
      </button>
      <span class="card-emoji">${activity.emoji}</span>
      <h3>${activity.title}</h3>
      <p>${activity.desc}</p>
      <span class="card-tag">${activity.category}</span>
    `;

    card.querySelector(".card-fav").addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFavorite(activity.id);
    });

    card.addEventListener("click", () => {
      showSuggestion(activity);
      recordPick(activity.id).catch(() => {});
    });

    els.grid.appendChild(card);
  });
}

function updateMood() {
  const val = Number(els.moodSlider.value);
  const label = moodLabels.find((m) => val <= m.max);
  els.moodReadout.textContent = `${val}% — ${label.text}`;
}

function queueMoodSync() {
  clearTimeout(moodDebounce);
  moodDebounce = setTimeout(() => {
    recordMood(Number(els.moodSlider.value))
      .then(() => loadCommunityStats())
      .catch(() => {});
  }, 600);
}

function updateFooter() {
  const favCount = favorites.size;
  const msg =
    favCount === 0
      ? `${activities.length} ways to do nothing · no favorites yet (also fine)`
      : `${activities.length} ways to do nothing · ${favCount} soft favorite${favCount === 1 ? "" : "s"}`;
  els.footerStat.textContent = msg;
}

async function loadCommunityStats() {
  try {
    const stats = await fetchStats();
    els.globalNothing.textContent = String(stats.nothingSessions);
    els.globalMood.textContent =
      stats.avgMood === null ? "—" : `${stats.avgMood}%`;
  } catch {
    els.globalNothing.textContent = "—";
    els.globalMood.textContent = "—";
  }
}

document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    currentFilter = chip.dataset.filter;
    renderGrid();
    suggestNow();
  });
});

els.btnAnother.addEventListener("click", () => suggestNow());
els.btnNothingTimer.addEventListener("click", () => startTimer(5));
els.btnStopTimer.addEventListener("click", () => stopTimer());
els.moodSlider.addEventListener("input", updateMood);
els.moodSlider.addEventListener("change", queueMoodSync);

async function init() {
  await loadFavorites();
  suggestNow({ track: false });
  renderGrid();
  updateMood();
  updateFooter();
  loadCommunityStats();
}

init();
