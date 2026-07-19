import { assertStatus, errorResponse, getDb, json, requireAdmin } from "../../../_lib/community.js";

export async function onRequestGet(context) {
  try {
    requireAdmin(context.request, context.env);
    const url = new URL(context.request.url);
    const status = assertStatus(url.searchParams.get("status") || "pending");
    const result = await getDb(context.env).prepare(`
      SELECT id, type, status, target_url, target_key, up_uid, up_name, title, episode, category,
             reason, submitter_alias, contact, source_channel, public_note, created_at, updated_at
      FROM submissions
      WHERE status = ?
      ORDER BY created_at DESC
      LIMIT 100
    `).bind(status).all();
    return json({ ok: true, items: result.results || [] });
  } catch (error) {
    return errorResponse(error);
  }
}

export function onRequest() {
  return json({ ok: false, error: "请求方法不受支持" }, 405, { allow: "GET" });
}
