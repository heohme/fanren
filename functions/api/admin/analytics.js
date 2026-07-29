import { errorResponse, getDb, json, requireAdmin } from "../../_lib/community.js";

function rows(result) {
  return result.results || [];
}

export async function onRequestGet(context) {
  try {
    requireAdmin(context.request, context.env);
    const requestedDays = Number(new URL(context.request.url).searchParams.get("days") || 7);
    const days = [1, 7, 30].includes(requestedDays) ? requestedDays : 7;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const db = getDb(context.env);

    const [
      summary,
      events,
      realms,
      creators,
      videos,
      sources,
      devices,
      daily,
    ] = await Promise.all([
      db.prepare(`
        SELECT COUNT(*) AS event_count, COUNT(DISTINCT session_id) AS sessions
        FROM analytics_events WHERE created_at >= ?
      `).bind(since).first(),
      db.prepare(`
        SELECT event_name, COUNT(*) AS count, COUNT(DISTINCT session_id) AS sessions
        FROM analytics_events WHERE created_at >= ?
        GROUP BY event_name ORDER BY count DESC
      `).bind(since).all(),
      db.prepare(`
        SELECT realm, COUNT(*) AS count, COUNT(DISTINCT session_id) AS sessions
        FROM analytics_events
        WHERE created_at >= ? AND event_name = 'realm_open'
        GROUP BY realm ORDER BY count DESC
      `).bind(since).all(),
      db.prepare(`
        SELECT object_id, MAX(object_label) AS label, COUNT(*) AS count,
               COUNT(DISTINCT session_id) AS sessions
        FROM analytics_events
        WHERE created_at >= ? AND event_name = 'creator_open'
        GROUP BY object_id ORDER BY count DESC LIMIT 20
      `).bind(since).all(),
      db.prepare(`
        SELECT object_id, MAX(object_label) AS label, MAX(realm) AS realm,
               COUNT(*) AS count, COUNT(DISTINCT session_id) AS sessions
        FROM analytics_events
        WHERE created_at >= ? AND event_name = 'video_open'
        GROUP BY object_id ORDER BY count DESC LIMIT 20
      `).bind(since).all(),
      db.prepare(`
        SELECT source, COUNT(DISTINCT session_id) AS sessions
        FROM analytics_events WHERE created_at >= ?
        GROUP BY source ORDER BY sessions DESC LIMIT 20
      `).bind(since).all(),
      db.prepare(`
        SELECT device, COUNT(DISTINCT session_id) AS sessions
        FROM analytics_events WHERE created_at >= ?
        GROUP BY device ORDER BY sessions DESC
      `).bind(since).all(),
      db.prepare(`
        SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS event_count,
               COUNT(DISTINCT session_id) AS sessions
        FROM analytics_events WHERE created_at >= ?
        GROUP BY day ORDER BY day ASC
      `).bind(since).all(),
    ]);

    return json({
      ok: true,
      days,
      summary: {
        eventCount: summary?.event_count || 0,
        sessions: summary?.sessions || 0,
      },
      events: rows(events),
      realms: rows(realms),
      creators: rows(creators),
      videos: rows(videos),
      sources: rows(sources),
      devices: rows(devices),
      daily: rows(daily),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
