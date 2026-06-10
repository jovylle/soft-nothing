import { getStore } from "@netlify/blobs";

const STORE_NAME = "soft-nothing";
const MAX_SUBMISSIONS = 48;

const defaultStats = () => ({
  nothingSessions: 0,
  activityPicks: {},
  moodSum: 0,
  moodCount: 0,
});

function store() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

async function readStats(s) {
  const stats = await s.get("stats", { type: "json" });
  return stats ?? defaultStats();
}

async function readSubmissions(s) {
  return (await s.get("submissions", { type: "json" })) ?? [];
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function cleanText(value, max) {
  return String(value ?? "")
    .trim()
    .replace(/<[^>]*>/g, "")
    .slice(0, max);
}

export default async (req, context) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  const s = store();
  const action = context.params?.action;

  try {
    if (action === "stats" && req.method === "GET") {
      const stats = await readStats(s);
      const avgMood = stats.moodCount
        ? Math.round(stats.moodSum / stats.moodCount)
        : null;

      const picks = Object.entries(stats.activityPicks || {});
      const top = picks.sort((a, b) => b[1] - a[1])[0] ?? null;

      return json({
        nothingSessions: stats.nothingSessions,
        avgMood,
        moodCount: stats.moodCount,
        topPick: top?.[0] ?? null,
        topPickCount: top?.[1] ?? 0,
        activityPicks: stats.activityPicks,
      });
    }

    if (action === "stats" && req.method === "POST") {
      const body = await req.json();
      const stats = await readStats(s);

      if (body.type === "nothing-done") {
        stats.nothingSessions += 1;
      }

      if (body.type === "pick" && body.activityId) {
        stats.activityPicks[body.activityId] =
          (stats.activityPicks[body.activityId] || 0) + 1;
      }

      await s.setJSON("stats", stats);
      return json({ ok: true, stats });
    }

    if (action === "favorites" && req.method === "GET") {
      const visitorId = new URL(req.url).searchParams.get("visitorId");
      if (!visitorId) {
        return json({ error: "visitorId required" }, 400);
      }

      const favorites =
        (await s.get(`favorites:${visitorId}`, { type: "json" })) ?? [];
      return json({ favorites });
    }

    if (action === "favorites" && req.method === "PUT") {
      const body = await req.json();
      const { visitorId, favorites } = body;

      if (!visitorId || !Array.isArray(favorites)) {
        return json({ error: "visitorId and favorites[] required" }, 400);
      }

      await s.setJSON(`favorites:${visitorId}`, favorites.slice(0, 32));
      return json({ ok: true });
    }

    if (action === "mood" && req.method === "POST") {
      const body = await req.json();
      const value = Number(body.value);

      if (Number.isNaN(value) || value < 0 || value > 100) {
        return json({ error: "value must be 0-100" }, 400);
      }

      const stats = await readStats(s);
      stats.moodSum += value;
      stats.moodCount += 1;
      await s.setJSON("stats", stats);

      return json({
        ok: true,
        avgMood: Math.round(stats.moodSum / stats.moodCount),
      });
    }

    if (action === "submissions" && req.method === "GET") {
      const submissions = await readSubmissions(s);
      return json({ submissions });
    }

    if (action === "submissions" && req.method === "POST") {
      const body = await req.json();
      const title = cleanText(body.title, 80);
      const desc = cleanText(body.desc, 160);
      const emoji = cleanText(body.emoji, 4) || "✨";
      const category = cleanText(body.category, 20) || "community";

      if (!title || !desc) {
        return json({ error: "title and desc required" }, 400);
      }

      const allowed = ["still", "senses", "tiny", "outside", "weird", "community"];
      const safeCategory = allowed.includes(category) ? category : "community";

      const submissions = await readSubmissions(s);
      const entry = {
        id: `c-${Date.now().toString(36)}`,
        emoji,
        title,
        desc,
        category: safeCategory,
        vibe: "donated by a fellow loafer",
        createdAt: new Date().toISOString(),
      };

      submissions.unshift(entry);
      await s.setJSON("submissions", submissions.slice(0, MAX_SUBMISSIONS));

      return json({ ok: true, submission: entry });
    }

    return json({ error: "not found" }, 404);
  } catch (err) {
    console.error("api error:", err);
    return json({ error: "something went soft and wrong" }, 500);
  }
};

export const config = {
  path: "/api/:action",
};
