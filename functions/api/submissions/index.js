import {
  createSubmissionIdentity,
  enforceRateLimit,
  errorResponse,
  eventId,
  getDb,
  json,
  normalizeSubmission,
  readJson,
  submissionKeys,
  verifyTurnstile,
} from "../../_lib/community.js";

export async function onRequestPost(context) {
  try {
    const input = await readJson(context.request);
    await verifyTurnstile(context.request, context.env, input.turnstileToken);
    await enforceRateLimit(context.request, context.env);

    const submission = normalizeSubmission(input);
    const identity = createSubmissionIdentity();
    const keys = await submissionKeys(submission, identity.receiptToken);
    const db = getDb(context.env);
    const now = new Date().toISOString();
    const existing = await db.prepare(`
      SELECT id, status FROM submissions
      WHERE dedupe_key = ? AND status IN ('pending', 'reviewing', 'approved')
      ORDER BY created_at DESC LIMIT 1
    `).bind(keys.dedupeKey).first();
    const status = existing ? "duplicate" : "pending";
    const publicNote = existing ? `已存在相同内容的投稿：${existing.id}` : null;

    await db.batch([
      db.prepare(`
        INSERT INTO submissions (
          id, type, status, target_url, target_key, up_uid, up_name, title, episode, category,
          reason, submitter_alias, contact, source_channel, dedupe_key, receipt_token_hash,
          public_note, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        identity.id, submission.type, status, submission.targetUrl, submission.targetKey,
        submission.upUid, submission.upName, submission.title, submission.episode, submission.category,
        submission.reason, submission.submitterAlias, submission.contact, submission.sourceChannel,
        keys.dedupeKey, keys.receiptTokenHash, publicNote, now, now
      ),
      db.prepare(`
        INSERT INTO submission_events (id, submission_id, action, actor, note, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(eventId(), identity.id, existing ? "duplicate_detected" : "submitted", "visitor", publicNote, now),
    ]);

    return json({
      ok: true,
      submission: {
        id: identity.id,
        receiptToken: identity.receiptToken,
        status,
        publicNote,
        createdAt: now,
      },
    }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}

export function onRequest() {
  return json({ ok: false, error: "请求方法不受支持" }, 405, { allow: "POST" });
}
