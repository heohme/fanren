/**
 * 按集搜索并回填历史解析视频。
 *
 * 默认从最新集倒序处理，可断点续跑。每集先跑主查询；若独立 UP 数不足目标值，
 * 再跑补充查询。每完成一集立即写入快照和进度，避免长任务中断后重头开始。
 *
 * 用法：
 *   node scripts/backfill-episodes.mjs
 *   node scripts/backfill-episodes.mjs --from=182 --to=153 --max-episodes=10
 *   node scripts/backfill-episodes.mjs --pages=2 --target-ups=12 --delay=2800
 *   node scripts/backfill-episodes.mjs --reset --from=182 --to=1
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getAnonymousCookie, UA } from "./bili-cookie.mjs";
import { encWbi, getWbiKeys } from "./wbi.mjs";
import { matchEpisode } from "./match-episode.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SNAPSHOT_PATH = path.join(ROOT, "data", "snapshot.json");
const SERIES_PATH = path.join(ROOT, "data", "series.json");
const PROGRESS_PATH = path.join(ROOT, "data", "backfill-progress.json");
const OFFICIAL_UID = "98627270";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    return [key, rest.length ? rest.join("=") : true];
  })
);

const numberArg = (name, fallback) => {
  const value = Number(args[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const PAGES = Math.min(5, numberArg("pages", 2));
const PAGE_SIZE = 30;
const TARGET_UPS = Math.min(30, numberArg("target-ups", 12));
const MIN_ACCEPTABLE_UPS = Math.min(10, TARGET_UPS);
const MAX_EPISODES = Math.min(182, numberArg("max-episodes", 8));
const DELAY = Math.max(1800, numberArg("delay", 2800));
const DRY_RUN = args["dry-run"] === true;
const RESET = args.reset === true;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (...items) => console.log("[backfill]", ...items);

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(file, value) {
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function fetchJson(url, { cookie, referer } = {}) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Referer: referer || "https://www.bilibili.com/",
      ...(cookie ? { Cookie: cookie } : {}),
    },
  });
  if (response.status === 412) return { code: -412, message: "412 风控", data: null };
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function searchVideos(keyword, page, auth) {
  const params = {
    search_type: "video",
    keyword,
    order: "totalrank",
    page,
    page_size: PAGE_SIZE,
    platform: "pc",
  };
  const query = encWbi(params, auth.wbiKeys.imgKey, auth.wbiKeys.subKey);
  const url = `https://api.bilibili.com/x/web-interface/wbi/search/type?${query}`;
  let json = await fetchJson(url, {
    cookie: auth.cookie,
    referer: `https://search.bilibili.com/all?keyword=${encodeURIComponent(keyword)}`,
  });

  if (json.code === -412 || json.code === -352) {
    log(`  命中风控，刷新会话后重试 p${page}`);
    await sleep(6500);
    auth.cookie = await getAnonymousCookie();
    auth.wbiKeys = await getWbiKeys(auth.cookie);
    const retryQuery = encWbi(params, auth.wbiKeys.imgKey, auth.wbiKeys.subKey);
    json = await fetchJson(
      `https://api.bilibili.com/x/web-interface/wbi/search/type?${retryQuery}`,
      {
        cookie: auth.cookie,
        referer: `https://search.bilibili.com/all?keyword=${encodeURIComponent(keyword)}`,
      }
    );
  }

  if (json.code !== 0) throw new Error(`搜索失败 ${json.code}: ${json.message || "unknown"}`);
  return json.data?.result || [];
}

function cleanText(value) {
  return String(value || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim();
}

function normalizeCover(value) {
  if (!value) return "";
  return value.startsWith("//") ? `https:${value}` : value;
}

const ANALYSIS_HINTS = /解析|解读|逐帧|漫谈|复盘|点评|吐槽|观后感|reaction|售后|瑕疵|建议|细节|改编|剧情|水准|在线峰值/i;
const REPOST_HINTS = /完整版|完整\s*4k|最新\s*4k|高清完整版|最新完整版|最新版|4k版|高清版|无水印|纯享版|正片资源/i;
const CLIP_HINTS = /合集|超前速看|名场面|杜比视界|动画放映|完整片段/i;
const CLIP_CREATOR_HINTS = /4k|修复计划|放映|有声/i;

function isLikelyAnalysisTitle(title, upName = "") {
  if (REPOST_HINTS.test(title)) return false;
  if (ANALYSIS_HINTS.test(title)) return true;
  if (CLIP_HINTS.test(title) || CLIP_CREATOR_HINTS.test(upName)) return false;
  // 保留有明确观点/剧情摘要的长标题，排除“凡人181集”这类无法判断内容性质的短标题。
  return title.replace(/\s/g, "").length >= 14;
}

function normalizeSearchVideo(raw, series, expectedEpisode) {
  const title = cleanText(raw.title);
  const upName = cleanText(raw.author) || `UP ${raw.mid || ""}`;
  if (!isLikelyAnalysisTitle(title, upName)) return null;
  const matched = matchEpisode(title, series);
  if (!matched.matched || matched.contentType !== "episode" || matched.ep !== expectedEpisode) return null;

  const uid = String(raw.mid || "");
  const bvid = String(raw.bvid || "");
  if (!uid || uid === "0" || uid === OFFICIAL_UID || !bvid) return null;

  return {
    uid,
    upName,
    video: {
      bvid,
      aid: Number(raw.aid || 0),
      title,
      description: cleanText(raw.description),
      cover: normalizeCover(raw.pic),
      pubTime: Number(raw.pubdate || 0) * 1000,
      duration: raw.duration || "",
      play: Number(raw.play || 0),
      videoUrl: raw.arcurl || `https://www.bilibili.com/video/${bvid}`,
      matched: true,
      ep: expectedEpisode,
      isCompilation: false,
      contentType: "episode",
      characters: matched.characters || [],
      discoveredBy: "episode-search",
    },
  };
}

function pruneBackfillNoise(snapshot) {
  let removed = 0;
  for (const up of snapshot.ups || []) {
    const before = up.videos?.length || 0;
    up.videos = (up.videos || []).filter(
      (video) => video.discoveredBy !== "episode-search" || isLikelyAnalysisTitle(video.title || "", up.name || "")
    );
    removed += before - up.videos.length;
  }
  snapshot.ups = (snapshot.ups || []).filter(
    (up) => up.videos?.length || up.source !== "search-backfill"
  );
  return removed;
}

function mergeVideoList(previous, incoming) {
  const map = new Map((previous || []).map((video) => [video.bvid, video]));
  for (const video of incoming) map.set(video.bvid, { ...map.get(video.bvid), ...video });
  return Array.from(map.values()).sort((a, b) => (b.pubTime || 0) - (a.pubTime || 0));
}

function mergeEpisodeResults(snapshot, results) {
  const upMap = new Map((snapshot.ups || []).map((up) => [String(up.uid), up]));
  const grouped = new Map();
  for (const result of results) {
    if (!grouped.has(result.uid)) grouped.set(result.uid, { name: result.upName, videos: [] });
    grouped.get(result.uid).videos.push(result.video);
  }

  for (const [uid, group] of grouped) {
    const previous = upMap.get(uid);
    upMap.set(uid, {
      uid,
      name: previous?.name || group.name,
      alias: previous?.alias || [],
      note: previous?.note || "按集搜索发现",
      source: previous?.source || "search-backfill",
      error: previous?.error || null,
      lastFetched: Date.now(),
      lastSuccess: Date.now(),
      videos: mergeVideoList(previous?.videos, group.videos),
      recentTitles: previous?.recentTitles?.length
        ? previous.recentTitles
        : group.videos.slice(0, 5).map((video) => video.title),
    });
  }
  snapshot.ups = Array.from(upMap.values());
}

function episodeCoverage(snapshot, ep) {
  const ups = new Set();
  let videos = 0;
  for (const up of snapshot.ups || []) {
    if (String(up.uid) === OFFICIAL_UID) continue;
    const hits = (up.videos || []).filter((video) => video.contentType === "episode" && video.ep === ep);
    if (hits.length) ups.add(String(up.uid));
    videos += hits.length;
  }
  return { ups: ups.size, videos };
}

async function collectEpisode(ep, series, auth) {
  const queries = [
    `凡人修仙传 第${ep}集 解析`,
    `凡人修仙传 ${ep}集 逐帧解读`,
    `凡人修仙传 ${ep}集`,
  ];
  const found = new Map();

  for (const keyword of queries) {
    for (let page = 1; page <= PAGES; page++) {
      log(`  搜索「${keyword}」p${page}`);
      const rows = await searchVideos(keyword, page, auth);
      for (const row of rows) {
        const normalized = normalizeSearchVideo(row, series, ep);
        if (normalized) found.set(normalized.video.bvid, normalized);
      }
      const uniqueUps = new Set(Array.from(found.values()).map((item) => item.uid)).size;
      log(`    有效视频 ${found.size}，独立 UP ${uniqueUps}`);
      if (rows.length < PAGE_SIZE || uniqueUps >= TARGET_UPS) break;
      await sleep(DELAY + Math.random() * 900);
    }
    const uniqueUps = new Set(Array.from(found.values()).map((item) => item.uid)).size;
    if (uniqueUps >= TARGET_UPS) break;
    await sleep(DELAY + Math.random() * 900);
  }

  return Array.from(found.values());
}

async function main() {
  const series = await readJson(SERIES_PATH, null);
  const snapshot = await readJson(SNAPSHOT_PATH, null);
  if (!series || !snapshot) throw new Error("缺少 series.json 或 snapshot.json");

  const currentEpisode = Number.parseInt(snapshot.official?.newEp?.title || "", 10);
  if (!Number.isFinite(currentEpisode)) throw new Error("无法识别官方当前集数");

  const pruned = pruneBackfillNoise(snapshot);
  if (pruned) log(`质量清理：移除 ${pruned} 条疑似完整视频/非解析结果`);

  const from = Math.min(currentEpisode, numberArg("from", currentEpisode));
  const to = Math.max(1, Math.min(from, numberArg("to", 1)));
  const progress = RESET
    ? { version: 1, completed: [], episodes: {}, updatedAt: null }
    : await readJson(PROGRESS_PATH, { version: 1, completed: [], episodes: {}, updatedAt: null });
  const completed = new Set(progress.completed || []);
  for (const ep of Array.from(completed)) {
    if (episodeCoverage(snapshot, ep).ups < MIN_ACCEPTABLE_UPS) completed.delete(ep);
  }
  progress.completed = Array.from(completed).sort((a, b) => b - a);
  for (const ep of completed) {
    const coverage = episodeCoverage(snapshot, ep);
    progress.episodes[ep] = {
      ...(progress.episodes[ep] || {}),
      afterUps: coverage.ups,
      videos: coverage.videos,
    };
  }
  const queue = [];
  for (let ep = from; ep >= to; ep--) {
    if (!completed.has(ep)) queue.push(ep);
    if (queue.length >= MAX_EPISODES) break;
  }

  if (!queue.length) {
    log(`范围 ${from}—${to} 已全部完成。`);
    if (!DRY_RUN) {
      if (pruned) await writeJson(SNAPSHOT_PATH, snapshot);
      await writeJson(PROGRESS_PATH, progress);
    }
    return;
  }

  log(`准备处理 ${queue.join(", ")}；每集目标 ${TARGET_UPS} 位 UP，最多 ${PAGES} 页/查询`);
  const auth = {
    cookie: await getAnonymousCookie(),
    wbiKeys: null,
  };
  auth.wbiKeys = await getWbiKeys(auth.cookie);

  for (const ep of queue) {
    const before = episodeCoverage(snapshot, ep);
    log(`EP${ep} 开始，当前 ${before.ups} 位 UP / ${before.videos} 条视频`);
    try {
      const results = await collectEpisode(ep, series, auth);
      mergeEpisodeResults(snapshot, results);
      const after = episodeCoverage(snapshot, ep);
      progress.episodes[ep] = {
        beforeUps: before.ups,
        afterUps: after.ups,
        videos: after.videos,
        searchedAt: Date.now(),
      };
      if (after.ups >= MIN_ACCEPTABLE_UPS) completed.add(ep);
      else completed.delete(ep);
      progress.completed = Array.from(completed).sort((a, b) => b - a);
      progress.updatedAt = Date.now();
      snapshot.generatedAt = Date.now();
      log(
        `EP${ep} ${after.ups >= MIN_ACCEPTABLE_UPS ? "完成" : "待继续补充"}：` +
        `${before.ups} → ${after.ups} 位 UP，共 ${after.videos} 条`
      );
      if (!DRY_RUN) {
        await writeJson(SNAPSHOT_PATH, snapshot);
        await writeJson(PROGRESS_PATH, progress);
      }
    } catch (error) {
      log(`EP${ep} 失败：${error.message}`);
      progress.episodes[ep] = { error: error.message, searchedAt: Date.now() };
      progress.updatedAt = Date.now();
      if (!DRY_RUN) await writeJson(PROGRESS_PATH, progress);
    }
    await sleep(DELAY + Math.random() * 1100);
  }

  const coverage = queue.map((ep) => ({ ep, ...episodeCoverage(snapshot, ep) }));
  console.table(coverage);
  if (DRY_RUN) log("dry-run：未写入数据文件");
  else log("已写入 snapshot.json 与 backfill-progress.json");
}

main().catch((error) => {
  console.error("[backfill] 致命错误：", error);
  process.exit(1);
});
