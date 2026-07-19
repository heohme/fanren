import { errorResponse, getDb, json } from "../_lib/community.js";

export async function onRequestGet(context) {
  try {
    const result = await getDb(context.env).prepare(`
      SELECT id, type, target_url, target_key, up_uid, up_name, title, episode, category,
             recommendation_reason, approved_at
      FROM community_items
      WHERE published = 1
      ORDER BY approved_at DESC
      LIMIT 100
    `).all();

    return json({
      ok: true,
      items: (result.results || []).map((row) => ({
        id: row.id,
        type: row.type,
        targetUrl: row.target_url,
        targetKey: row.target_key,
        upUid: row.up_uid,
        upName: row.up_name,
        title: row.title,
        episode: row.episode,
        category: row.category,
        recommendationReason: row.recommendation_reason,
        approvedAt: row.approved_at,
      })),
    }, 200, { "cache-control": "public, max-age=60, stale-while-revalidate=300" });
  } catch (error) {
    return errorResponse(error);
  }
}
