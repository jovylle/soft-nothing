import {
  fetchStats,
  fetchFavorites,
  fetchSubmissions,
  getVisitorId,
  recordMood,
  recordNothingDone,
  recordPick,
  saveFavorites,
  submitActivity,
} from "./api.js";
import { builtInActivities, titleForId } from "./activities.js";
import { isAmbientPlaying, toggleAmbient } from "./ambient.js";

const categoryLabels = {
  still: "be still",
  senses: "use senses",
  tiny: "tiny joys",
  outside: "go outside-ish",
  weird: "weird & fine",
  secret: "almost nothing",
  community: "from others",
};

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
const THEME_KEY = "soft-nothing-theme";
const visitorId = getVisitorId();

let communityActivities = [];
let allActivities = [...builtInActivities];
let currentFilter = "all";
let favorites = new Set();
let timerInterval = null;
let timerSeconds = 0;
let timerMinutes = 5;
let moodDebounce = null;
let currentActivity = null;

const els = {
  nowActivity: document.getElementById("now-activity"),
  nowVibe: document.getElementById("now-vibe"),
  nowWhisper: document.getElementById("now-whisper"),
  btnAnother: document.getElementById("btn-another"),
  btnFavPick: document.getElementById("btn-fav-pick"),
  btnShare: document.getElementById("btn-share"),
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
  globalTop: document.getElementById("global-top"),
  btnTheme: document.getElementById("btn-theme"),
  btnAmbient: document.getElementById("btn-ambient"),
  submitForm: document.getElementById("submit-form"),
  submitMsg: document.getElementById("submit-msg"),
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
    // offline is fine
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
    // keep local
  }
}

async function loadCommunity() {
  try {
    communityActivities = await fetchSubmissions();
    allActivities = [...builtInActivities, ...communityActivities];
  } catch {
    communityActivities = [];
    allActivities = [...builtInActivities];
  }
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function getFiltered() {
  if (currentFilter === "all") return allActivities;
  if (currentFilter === "community") {
    return allActivities.filter((a) => a.category === "community" || a.id.startsWith("c-"));
  }
  return allActivities.filter((a) => a.category === currentFilter);
}

function showSuggestion(activity) {
  currentActivity = activity;
  els.nowActivity.textContent = activity.title;
  els.nowVibe.textContent = activity.vibe;
  if (activity.whisper) {
    els.nowWhisper.textContent = activity.whisper;
    els.nowWhisper.classList.remove("hidden");
  } else {
    els.nowWhisper.textContent = "";
    els.nowWhisper.classList.add("hidden");
  }
  els.btnNothingTimer.dataset.activityId = activity.id;
}

function suggestNow({ track = true } = {}) {
  const pool = getFiltered();
  const activity = pickRandom(pool.length ? pool : allActivities);
  showSuggestion(activity);
  if (track) recordPick(activity.id).catch(() => {});
}

function suggestFromFavorites() {
  const favActs = allActivities.filter((a) => favorites.has(a.id));
  if (!favActs.length) {
    els.nowVibe.textContent = "no favorites yet — heart something first, or don't. also valid.";
    return;
  }
  const activity = pickRandom(favActs);
  showSuggestion(activity);
  recordPick(activity.id).catch(() => {});
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function startTimer(minutes = timerMinutes) {
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
  if (showCard) els.timerCard.classList.add("hidden");
}

function toggleFavorite(id) {
  if (favorites.has(id)) favorites.delete(id);
  else favorites.add(id);
  syncFavorites();
  renderGrid();
  updateFooter();
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderGrid() {
  const filtered = getFiltered();
  els.grid.innerHTML = "";

  if (!filtered.length) {
    els.grid.innerHTML = `<p class="grid-empty">nothing here yet. the void is patient.</p>`;
    return;
  }

  filtered.forEach((activity, i) => {
    const card = document.createElement("article");
    card.className = "card";
    if (activity.id.startsWith("c-")) card.classList.add("card-community");
    card.style.animationDelay = `${i * 0.04}s`;

    const isFav = favorites.has(activity.id);
    card.innerHTML = `
      <button class="card-fav ${isFav ? "active" : ""}" type="button" aria-label="Favorite" data-id="${activity.id}">
        ${isFav ? "♥" : "♡"}
      </button>
      <span class="card-emoji">${escapeHtml(activity.emoji)}</span>
      <h3>${escapeHtml(activity.title)}</h3>
      <p>${escapeHtml(activity.desc)}</p>
      ${activity.whisper ? `<p class="card-whisper">${escapeHtml(activity.whisper)}</p>` : ""}
      <span class="card-tag">${escapeHtml(categoryLabels[activity.category] ?? activity.category)}</span>
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
      ? `${allActivities.length} ways to do nothing · no favorites yet (also fine)`
      : `${allActivities.length} ways to do nothing · ${favCount} soft favorite${favCount === 1 ? "" : "s"}`;
  els.footerStat.textContent = msg;
}

async function loadCommunityStats() {
  try {
    const stats = await fetchStats();
    els.globalNothing.textContent = String(stats.nothingSessions);
    els.globalMood.textContent =
      stats.avgMood === null ? "—" : `${stats.avgMood}%`;
    els.globalTop.textContent = stats.topPick
      ? `${titleForId(stats.topPick, communityActivities)} (${stats.topPickCount}×)`
      : "—";
  } catch {
    els.globalNothing.textContent = "—";
    els.globalMood.textContent = "—";
    els.globalTop.textContent = "—";
  }
}

function setTheme(dark) {
  if (dark) {
    document.documentElement.dataset.theme = "dark";
    localStorage.setItem(THEME_KEY, "dark");
    els.btnTheme.textContent = "☀️";
    els.btnTheme.setAttribute("aria-label", "Switch to light mode");
    document.querySelector('meta[name="theme-color"]').content = "#1e2423";
  } else {
    delete document.documentElement.dataset.theme;
    localStorage.setItem(THEME_KEY, "light");
    els.btnTheme.textContent = "🌙";
    els.btnTheme.setAttribute("aria-label", "Switch to dark mode");
    document.querySelector('meta[name="theme-color"]').content = "#c8d5c4";
  }
}

function updateAmbientBtn() {
  els.btnAmbient.textContent = isAmbientPlaying() ? "🔊" : "🔇";
  els.btnAmbient.setAttribute(
    "aria-label",
    isAmbientPlaying() ? "Turn off ambient sound" : "Turn on ambient sound",
  );
}

async function handleShare() {
  if (!currentActivity) return;
  const text = `right now i could: ${currentActivity.title}\n— soft nothing · soft-nothing.netlify.app`;
  try {
    await navigator.clipboard.writeText(text);
    const prev = els.nowVibe.textContent;
    els.nowVibe.textContent = "copied. go do nothing, or don't share it. both fine.";
    setTimeout(() => {
      if (currentActivity) els.nowVibe.textContent = prev;
    }, 2000);
  } catch {
    els.nowVibe.textContent = "couldn't copy. the suggestion remains yours alone.";
  }
}

function showSubmitMsg(text, ok = true) {
  els.submitMsg.textContent = text;
  els.submitMsg.classList.remove("hidden", "error");
  if (!ok) els.submitMsg.classList.add("error");
  setTimeout(() => els.submitMsg.classList.add("hidden"), 3000);
}

async function handleSubmit(e) {
  e.preventDefault();
  const emoji = document.getElementById("submit-emoji").value.trim() || "✨";
  const title = document.getElementById("submit-title").value.trim();
  const desc = document.getElementById("submit-desc").value.trim();
  const category = document.getElementById("submit-category").value;

  try {
    const submission = await submitActivity({ emoji, title, desc, category });
    communityActivities.unshift(submission);
    allActivities = [...builtInActivities, ...communityActivities];
    els.submitForm.reset();
    showSubmitMsg("added softly. the collective grows.");
    renderGrid();
    updateFooter();
    if (currentFilter === "community" || currentFilter === "all") {
      showSuggestion(submission);
    }
  } catch {
    showSubmitMsg("couldn't save. try again when the void is ready.", false);
  }
}

document.querySelectorAll(".chip[data-filter]").forEach((chip) => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".chip[data-filter]").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    currentFilter = chip.dataset.filter;
    renderGrid();
    suggestNow();
  });
});

document.querySelectorAll(".timer-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".timer-chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    timerMinutes = Number(chip.dataset.minutes);
  });
});

els.btnAnother.addEventListener("click", () => suggestNow());
els.btnFavPick.addEventListener("click", () => suggestFromFavorites());
els.btnShare.addEventListener("click", () => handleShare());
els.btnNothingTimer.addEventListener("click", () => startTimer(timerMinutes));
els.btnStopTimer.addEventListener("click", () => stopTimer());
els.moodSlider.addEventListener("input", updateMood);
els.moodSlider.addEventListener("change", queueMoodSync);
els.btnTheme.addEventListener("click", () => {
  setTheme(!document.documentElement.dataset.theme);
});
els.btnAmbient.addEventListener("click", async () => {
  await toggleAmbient();
  updateAmbientBtn();
});
els.submitForm.addEventListener("submit", handleSubmit);

async function init() {
  setTheme(localStorage.getItem(THEME_KEY) === "dark");
  updateAmbientBtn();
  await Promise.all([loadFavorites(), loadCommunity()]);
  suggestNow({ track: false });
  renderGrid();
  updateMood();
  updateFooter();
  loadCommunityStats();
}

init();
