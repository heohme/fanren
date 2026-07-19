const SUBMISSION_TYPES = new Set(["creator", "work", "correction"]);
const SUBMISSION_STATUSES = new Set(["pending", "reviewing", "approved", "rejected", "duplicate", "needs_info", "withdrawn"]);
const CATEGORIES = new Set([
  "逐集解析",
  "深度专题",
  "人物专题",
  "多集拉片",
  "PV物料",
  "资讯杂谈",
  "人物志",
  "剧情二创",
  "趣味整活",
  "混剪手书",
  "音乐配音",
  "同人创作",
  "其他",
]);

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

export async function readJson(request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 32_000) throw new ApiError(413, "投稿内容过长");
  const body = await request.text();
  if (body.length > 32_000) throw new ApiError(413, "投稿内容过长");
  try {
    return JSON.parse(body);
  } catch {
    throw new ApiError(400, "请求格式不正确");
  }
}

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function errorResponse(error) {
  if (error instanceof ApiError) return json({ ok: false, error: error.message, details: error.details }, error.status);
  console.error(error);
  return json({ ok: false, error: "服务暂时不可用，请稍后再试" }, 500);
}

export function getDb(env) {
  if (!env.COMMUNITY_DB) throw new ApiError(503, "投稿数据库尚未完成绑定");
  return env.COMMUNITY_DB;
}

function text(value, maxLength, required = false) {
  const normalized = typeof value === "string" ? value.normalize("NFKC").trim() : "";
  if (required && !normalized) throw new ApiError(400, "请完整填写必填内容");
  if (normalized.length > maxLength) throw new ApiError(400, `单项内容不能超过 ${maxLength} 字`);
  return normalized || null;
}

function normalizeBilibiliTarget(type, input) {
  const raw = text(input, 500, true);
  let url;
  try {
    url = new URL(raw);
  } catch {
    if (type === "creator") {
      if (raw.length < 2 || raw.length > 50) throw new ApiError(400, "UP 名称应为 2—50 个字");
      return {
        targetUrl: `https://search.bilibili.com/upuser?keyword=${encodeURIComponent(raw)}`,
        targetKey: `name:${raw.toLocaleLowerCase("zh-CN")}`,
        upUid: null,
        inferredUpName: raw,
      };
    }
    throw new ApiError(400, "请输入完整的网页链接");
  }

  if (!["http:", "https:"].includes(url.protocol)) throw new ApiError(400, "链接协议不受支持");
  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  const isBilibili = hostname === "bilibili.com" || hostname.endsWith(".bilibili.com");
  const isFanren = hostname === "fanrenmap.pages.dev" || hostname === "127.0.0.1" || hostname === "localhost";

  if (type === "creator") {
    if (hostname !== "space.bilibili.com") throw new ApiError(400, "推荐 UP 请填写 B 站个人主页链接");
    const match = url.pathname.match(/^\/(\d+)/);
    if (!match) throw new ApiError(400, "未能从链接中识别 UP UID");
    return { targetUrl: `https://space.bilibili.com/${match[1]}`, targetKey: match[1], upUid: match[1], inferredUpName: null };
  }

  if (type === "work") {
    if (!isBilibili) throw new ApiError(400, "推荐作品目前只支持 B 站视频链接");
    const match = url.pathname.match(/\/video\/(BV[0-9A-Za-z]+|av\d+)/i);
    if (!match) throw new ApiError(400, "未能识别视频 BV 号，请使用完整视频链接");
    const targetKey = match[1].startsWith("av") ? match[1].toLowerCase() : `BV${match[1].slice(2)}`;
    return { targetUrl: `https://www.bilibili.com/video/${targetKey}`, targetKey, upUid: null, inferredUpName: null };
  }

  if (!isBilibili && !isFanren) throw new ApiError(400, "纠错链接仅支持本站或 B 站页面");
  url.hash = "";
  return { targetUrl: url.toString(), targetKey: url.toString(), upUid: null, inferredUpName: null };
}

export function normalizeTarget(type, input) {
  if (!SUBMISSION_TYPES.has(type)) throw new ApiError(400, "投稿类型不受支持");
  return normalizeBilibiliTarget(type, input);
}

export function normalizeSubmission(input) {
  const type = text(input?.type, 30, true);
  if (!SUBMISSION_TYPES.has(type)) throw new ApiError(400, "投稿类型不受支持");

  const target = normalizeBilibiliTarget(type, input.targetUrl);
  const upName = text(input.upName, 80, false) || target.inferredUpName;
  const title = text(input.title, 160, false);
  const category = text(input.category, 40, false);
  if (category && !CATEGORIES.has(category)) throw new ApiError(400, "作品分类不受支持");

  let episode = input.episode === "" || input.episode == null ? null : Number(input.episode);
  if (episode != null && (!Number.isInteger(episode) || episode < 1 || episode > 999)) {
    throw new ApiError(400, "集数应为 1—999 的整数");
  }

  const submittedReason = text(input.reason, 500, false);
  if (type === "correction" && (!submittedReason || submittedReason.length < 4)) {
    throw new ApiError(400, "请简单说明需要修改的地方");
  }
  const reason = submittedReason || (type === "creator" ? "道友推荐这位 UP" : "道友推荐这部作品");

  return {
    type,
    targetUrl: target.targetUrl,
    targetKey: target.targetKey,
    upUid: target.upUid || text(input.upUid, 30, false),
    upName,
    title,
    episode,
    category,
    reason,
    submitterAlias: text(input.submitterAlias, 50, false),
    contact: text(input.contact, 120, false),
    sourceChannel: text(input.sourceChannel, 80, false),
  };
}

function randomToken(size = 12) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function createSubmissionIdentity(now = new Date()) {
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = randomToken(5).replace(/[^0-9A-Za-z]/g, "").slice(0, 7).toUpperCase();
  return { id: `FR-${date}-${suffix}`, receiptToken: `${randomToken(8).slice(0, 4)}-${randomToken(8).slice(0, 4)}`.toUpperCase() };
}

export async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function submissionKeys(submission, receiptToken) {
  return {
    receiptTokenHash: await sha256(receiptToken),
    dedupeKey: await sha256([submission.type, submission.targetKey, submission.episode || ""].join("|")),
  };
}

export async function verifyTurnstile(request, env, token) {
  if (!env.TURNSTILE_SECRET_KEY) {
    if (env.ALLOW_INSECURE_LOCAL === "true") return;
    throw new ApiError(503, "Turnstile 尚未完成配置");
  }
  if (!token) throw new ApiError(400, "请先完成人机验证");

  const remoteIp = request.headers.get("CF-Connecting-IP") || undefined;
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: token, remoteip: remoteIp }),
  });
  if (!response.ok) throw new ApiError(502, "人机验证服务暂时不可用");
  const result = await response.json();
  if (!result.success) throw new ApiError(400, "人机验证未通过，请刷新后重试", result["error-codes"] || []);
  if (env.PUBLIC_HOSTNAME && result.hostname !== env.PUBLIC_HOSTNAME) throw new ApiError(400, "人机验证来源不匹配");
}

export async function enforceRateLimit(request, env) {
  const db = getDb(env);
  const now = new Date();
  const windowKey = now.toISOString().slice(0, 13);
  const expires = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const actorKey = await sha256(`${env.RATE_LIMIT_SALT || "local-only"}|${windowKey}|${ip}`);
  const configuredLimit = Number(env.RATE_LIMIT_PER_HOUR || 5);
  const limit = Number.isFinite(configuredLimit) ? Math.max(1, configuredLimit) : 5;

  await db.prepare("DELETE FROM submission_rate_limits WHERE expires_at < ?").bind(now.toISOString()).run();
  await db.prepare(`
    INSERT INTO submission_rate_limits (actor_key, request_count, expires_at)
    VALUES (?, 1, ?)
    ON CONFLICT(actor_key) DO UPDATE SET request_count = request_count + 1
  `).bind(actorKey, expires).run();
  const row = await db.prepare("SELECT request_count FROM submission_rate_limits WHERE actor_key = ?").bind(actorKey).first();
  if ((row?.request_count || 0) > limit) throw new ApiError(429, "投稿过于频繁，请一小时后再试");
}

export function requireAdmin(request, env) {
  const authorization = request.headers.get("authorization") || "";
  const bearer = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (env.ADMIN_API_TOKEN && bearer === env.ADMIN_API_TOKEN) return "admin-token";

  const email = request.headers.get("Cf-Access-Authenticated-User-Email")?.toLowerCase();
  const allowlist = String(env.ADMIN_EMAILS || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  if (email && allowlist.includes(email)) return email;
  throw new ApiError(401, "需要管理员身份");
}

export function assertStatus(value) {
  if (!SUBMISSION_STATUSES.has(value)) throw new ApiError(400, "审核状态不受支持");
  return value;
}

export function eventId() {
  return `EV-${Date.now()}-${randomToken(5)}`;
}

export function communityId(type, targetKey) {
  return `CI-${type}-${targetKey}`.replace(/[^0-9A-Za-z_-]/g, "-").slice(0, 120);
}
