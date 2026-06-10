const API_BASE = "/api";

export function getVisitorId() {
  const KEY = "soft-nothing-visitor";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    throw new Error(`api ${res.status}`);
  }

  return res.json();
}

export async function fetchStats() {
  return request("/stats");
}

export async function recordPick(activityId) {
  return request("/stats", {
    method: "POST",
    body: JSON.stringify({ type: "pick", activityId }),
  });
}

export async function recordNothingDone() {
  return request("/stats", {
    method: "POST",
    body: JSON.stringify({ type: "nothing-done" }),
  });
}

export async function recordMood(value) {
  return request("/mood", {
    method: "POST",
    body: JSON.stringify({ value }),
  });
}

export async function fetchFavorites(visitorId) {
  const data = await request(`/favorites?visitorId=${encodeURIComponent(visitorId)}`);
  return data.favorites;
}

export async function saveFavorites(visitorId, favorites) {
  return request("/favorites", {
    method: "PUT",
    body: JSON.stringify({ visitorId, favorites }),
  });
}

export async function fetchSubmissions() {
  const data = await request("/submissions");
  return data.submissions;
}

export async function submitActivity(payload) {
  const data = await request("/submissions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data.submission;
}
