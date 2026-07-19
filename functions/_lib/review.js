import {
  ApiError,
  communityId,
  errorResponse,
  eventId,
  getDb,
  json,
  normalizeTarget,
  readJson,
  requireAdmin,
  sha256,
} from "./community.js";

function optionalText(value, maxLength) {
  const normalized = typeof value === "string" ? value.normalize("NFKC").trim() : "";
  if (normalized.length > maxLength) throw new ApiError(400, `审核内容不能超过 ${maxLength} 字`);
  return normalized || null;
}

export async function reviewRequest(context, action) {
  try {
    const actor = requireAdmin(context.request, context.env);
    const input = await readJson(context.request);
    const id = String(context.params.id || "").trim();
    const db = getDb(context.env);
    const submission = await db.prepare("SELECT * FROM submissions WHERE id = ?").bind(id).first();
    if (!submission) throw new ApiError(404, "投稿不存在");
    if (!["pending", "reviewing", "needs_info"].includes(submission.status)) {
      throw new ApiError(409, "该投稿已经完成审核");
    }

    const now = new Date().toISOString();
    const publicNote = optionalText(input.publicNote, 300);
    const reviewNote = optionalText(input.reviewNote, 500);
    const status = action === "approve" ? "approved" : action === "duplicate" ? "duplicate" : "rejected";

    const title = optionalText(input.title, 160) ?? submission.title;
    const upName = optionalText(input.upName, 80) ?? submission.up_name;
    const category = optionalText(input.category, 40) ?? submission.category;
    const episode = input.episode === "" || input.episode == null ? submission.episode : Number(input.episode);
    if (episode != null && (!Number.isInteger(episode) || episode < 1 || episode > 999)) throw new ApiError(400, "集数应为 1—999 的整数");
    let targetUrl = submission.target_url;
    let targetKey = submission.target_key;
    let upUid = submission.up_uid;
    const editedTargetUrl = optionalText(input.targetUrl, 500);
    if (editedTargetUrl && editedTargetUrl !== submission.target_url) {
      const target = normalizeTarget(submission.type, editedTargetUrl);
      targetUrl = target.targetUrl;
      targetKey = target.targetKey;
      upUid = target.upUid;
    }
    if (action === "approve" && submission.type === "creator" && !upName) throw new ApiError(400, "通过前请补充 UP 名称");
    if (action === "approve" && submission.type === "creator" && targetKey.startsWith("name:")) throw new ApiError(400, "通过前请把链接改为准确的 B 站 UP 主页");
    if (action === "approve" && submission.type === "work" && !title) throw new ApiError(400, "通过前请补充作品标题");
    const dedupeKey = await sha256([submission.type, targetKey, episode || ""].join("|"));

    const statements = [
      db.prepare(`
        UPDATE submissions
        SET status = ?, target_url = ?, target_key = ?, up_uid = ?, dedupe_key = ?,
            title = ?, up_name = ?, episode = ?, category = ?, reviewer = ?,
            review_note = ?, public_note = ?, updated_at = ?
        WHERE id = ?
      `).bind(status, targetUrl, targetKey, upUid, dedupeKey, title, upName, episode, category, actor, reviewNote, publicNote, now, id),
      db.prepare(`
        INSERT INTO submission_events (id, submission_id, action, actor, note, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(eventId(), id, status, actor, reviewNote || publicNote, now),
    ];

    if (action === "approve" && submission.type !== "correction") {
      statements.push(db.prepare(`
        INSERT INTO community_items (
          id, source_submission_id, type, target_url, target_key, up_uid, up_name, title,
          episode, category, recommendation_reason, published, created_at, approved_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        ON CONFLICT(type, target_key) DO UPDATE SET
          source_submission_id = excluded.source_submission_id,
          target_url = excluded.target_url,
          up_uid = excluded.up_uid,
          up_name = excluded.up_name,
          title = excluded.title,
          episode = excluded.episode,
          category = excluded.category,
          recommendation_reason = excluded.recommendation_reason,
          published = 1,
          approved_at = excluded.approved_at
      `).bind(
        communityId(submission.type, targetKey), id, submission.type,
        targetUrl, targetKey, upUid, upName, title,
        episode, category, publicNote || submission.reason, submission.created_at, now
      ));
    }

    await db.batch(statements);
    return json({ ok: true, submission: { id, status, updatedAt: now } });
  } catch (error) {
    return errorResponse(error);
  }
}
