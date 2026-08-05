import { ApiError, errorResponse, getDb, json, readJson, sha256 } from "../_lib/community.js";

const EVENT_NAMES = new Set([
  "landing_view",
  "realm_open",
  "realm_locked_click",
  "creator_open",
  "video_open",
  "onboarding_start",
  "onboarding_step",
  "onboarding_complete",
  "onboarding_skip",
  "analysis_mode",
  "content_filter",
  "share_link_copy",
]);
const OBJECT_TYPES = new Set(["page", "realm", "creator", "video", "filter", "guide"]);

function text(value, maxLength, required = false) {
  const normalized = typeof value === "string" ? value.normalize("NFKC").trim() : "";
  if (required && !normalized) throw new ApiError(400, "统计事件缺少必要字段");
  if (normalized.length > maxLength) throw new ApiError(400, "统计事件字段过长");
  return normalized || null;
}

function normalizeEvent(input) {
  const eventName = text(input?.eventName, 40, true);
  if (!EVENT_NAMES.has(eventName)) throw new ApiError(400, "统计事件类型不受支持");
  const objectType = text(input?.objectType, 24);
  if (objectType && !OBJECT_TYPES.has(objectType)) throw new ApiError(400, "统计对象类型不受支持");
  const sessionId = text(input?.sessionId, 80, true);
  if (!/^[0-9a-z-]{12,80}$/i.test(sessionId)) throw new ApiError(400, "统计会话格式不正确");
  const device = input?.device === "mobile" ? "mobile" : "desktop";
  const position = Number.isInteger(input?.position) && input.position >= 0 && input.position <= 10_000
    ? input.position
    : null;

  return {
    sessionId,
    eventName,
    realm: text(input?.realm, 32),
    objectType,
    objectId: text(input?.objectId, 120),
    objectLabel: text(input?.objectLabel, 180),
    context: text(input?.context, 80),
    source: text(input?.source, 80) || "direct",
    device,
    path: text(input?.path, 160) || "/",
    position,
    clientAt: text(input?.clientAt, 40),
  };
}

async function enforceAnalyticsRateLimit(request, env) {
  const db = getDb(env);
  const now = new Date();
  const windowKey = now.toISOString().slice(0, 13);
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const actorKey = await sha256(`${env.RATE_LIMIT_SALT || "analytics-local"}|analytics|${windowKey}|${ip}`);
  const expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString();

  await db.prepare(`
    INSERT INTO analytics_rate_limits (actor_key, request_count, expires_at)
    VALUES (?, 1, ?)
    ON CONFLICT(actor_key) DO UPDATE SET request_count = request_count + 1
  `).bind(actorKey, expiresAt).run();
  const row = await db.prepare("SELECT request_count FROM analytics_rate_limits WHERE actor_key = ?")
    .bind(actorKey).first();
  if ((row?.request_count || 0) > 180) throw new ApiError(429, "统计请求过于频繁");
}

export async function onRequestPost(context) {
  try {
    const body = await readJson(context.request);
    if (!Array.isArray(body?.events) || body.events.length < 1 || body.events.length > 20) {
      throw new ApiError(400, "统计事件批次不正确");
    }

    const events = body.events.map(normalizeEvent);
    await enforceAnalyticsRateLimit(context.request, context.env);
    const db = getDb(context.env);
    const createdAt = new Date().toISOString();
    const country = text(context.request.cf?.country, 8);
    const statements = events.map((event) => db.prepare(`
      INSERT INTO analytics_events (
        session_id, event_name, realm, object_type, object_id, object_label,
        context, position, source, device, path, country, client_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      event.sessionId,
      event.eventName,
      event.realm,
      event.objectType,
      event.objectId,
      event.objectLabel,
      event.context,
      event.position,
      event.source,
      event.device,
      event.path,
      country,
      event.clientAt,
      createdAt,
    ));
    await db.batch(statements);
    return json({ ok: true, accepted: events.length }, 202);
  } catch (error) {
    return errorResponse(error);
  }
}
