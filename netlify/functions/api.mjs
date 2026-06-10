import { getStore } from "@netlify/blobs";

const STORE_NAME = "soft-nothing";

const defaultStats = () => ({
  nothingSessions: 0,
  activityPicks: {},
  moodSum: 0,
  moodCount: 0,
});

async function readStats(store) {
  const stats = await store.get("stats", { type: "json" });
  return stats ?? defaultStats();
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

  const store = getStore(STORE_NAME);
  const action = context.params?.action;

  try {
    if (action === "stats" && req.method === "GET") {
      const stats = await readStats(store);
      const avgMood = stats.moodCount
        ? Math.round(stats.moodSum / stats.moodCount)
        : null;

      const picks = Object.entries(stats.activityPicks || {});
      const topPick = picks.sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      return json({
        nothingSessions: stats.nothingSessions,
        avgMood,
        moodCount: stats.moodCount,
        topPick,
        activityPicks: stats.activityPicks,
      });
    }

    if (action === "stats" && req.method === "POST") {
      const body = await req.json();
      const stats = await readStats(store);

      if (body.type === "nothing-done") {
        stats.nothingSessions += 1;
      }

      if (body.type === "pick" && body.activityId) {
        stats.activityPicks[body.activityId] =
          (stats.activityPicks[body.activityId] || 0) + 1;
      }

      await store.setJSON("stats", stats);
      return json({ ok: true });
    }

    if (action === "favorites" && req.method === "GET") {
      const visitorId = new URL(req.url).searchParams.get("visitorId");
      if (!visitorId) {
        return json({ error: "visitorId required" }, 400);
      }

      const favorites =
        (await store.get(`favorites:${visitorId}`, { type: "json" })) ?? [];
      return json({ favorites });
    }

    if (action === "favorites" && req.method === "PUT") {
      const body = await req.json();
      const { visitorId, favorites } = body;

      if (!visitorId || !Array.isArray(favorites)) {
        return json({ error: "visitorId and favorites[] required" }, 400);
      }

      await store.setJSON(`favorites:${visitorId}`, favorites.slice(0, 24));
      return json({ ok: true });
    }

    if (action === "mood" && req.method === "POST") {
      const body = await req.json();
      const value = Number(body.value);

      if (Number.isNaN(value) || value < 0 || value > 100) {
        return json({ error: "value must be 0-100" }, 400);
      }

      const stats = await readStats(store);
      stats.moodSum += value;
      stats.moodCount += 1;
      await store.setJSON("stats", stats);

      return json({
        ok: true,
        avgMood: Math.round(stats.moodSum / stats.moodCount),
      });
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
