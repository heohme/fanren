import { ApiError, errorResponse, getDb, json, sha256 } from "../../../_lib/community.js";

export async function onRequestGet(context) {
  try {
    const id = String(context.params.id || "").trim();
    const url = new URL(context.request.url);
    const token = url.searchParams.get("token") || context.request.headers.get("x-receipt-token") || "";
    if (!id || !token) throw new ApiError(400, "请填写投稿编号和查询凭证");

    const row = await getDb(context.env).prepare(`
      SELECT id, type, status, title, up_name, target_url, public_note, created_at, updated_at, receipt_token_hash
      FROM submissions WHERE id = ?
    `).bind(id).first();
    if (!row || await sha256(token.toUpperCase()) !== row.receipt_token_hash) throw new ApiError(404, "未找到对应投稿，请检查编号和凭证");

    return json({
      ok: true,
      submission: {
        id: row.id,
        type: row.type,
        status: row.status,
        title: row.title || row.up_name || row.target_url,
        publicNote: row.public_note,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export function onRequest() {
  return json({ ok: false, error: "请求方法不受支持" }, 405, { allow: "GET" });
}
