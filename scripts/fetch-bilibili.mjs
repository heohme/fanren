/**
 * 主抓取脚本
 * 1. 拉取官方番剧分集（season_id -> episodes）
 * 2. 遍历 UP 主，拉取最近投稿，正则匹配凡人相关 + 集数
 * 3. 写入 data/snapshot.json
 *
 * 用法: node scripts/fetch-bilibili.mjs
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getAnonymousCookie, UA } from "./bili-cookie.mjs";
import { encWbi, getWbiKeys } from "./wbi.mjs";
import { matchEpisode } from "./match-episode.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");

const DEBUG = !!process.env.DEBUG;
const log = (...a) => console.log("[fetch]", ...a);
const dlog = (...a) => DEBUG && console.log("[debug]", ...a);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url, { cookie, referer } = {}) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Referer: referer || "https://www.bilibili.com/",
      ...(cookie ? { Cookie: cookie } : {}),
    },
  });
  // B 站风控会返回 412，body 仍是 JSON，需要继续解析
  if (res.status === 412) {
    return { code: -412, message: "412 Precondition Failed (风控)", data: null };
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

/* ============== 官方番剧 ============== */

async function fetchSeason(seasonId, cookie) {
  const url = `https://api.bilibili.com/pgc/view/web/season?season_id=${seasonId}`;
  const json = await fetchJson(url, { cookie });
  if (json.code !== 0) throw new Error(`season fail: ${json.message}`);
  const result = json.result || {};
  const episodes = (result.episodes || []).map((e) => ({
    ep: parseInt(e.title, 10) || null,
    epRaw: e.title,
    longTitle: e.long_title || "",
    bvid: e.bvid,
    aid: e.aid,
    cover: e.cover,
    pubTime: e.pub_time ? e.pub_time * 1000 : null,
    duration: e.duration,
    link: e.link,
    playUrl: `https://www.bilibili.com/bangumi/play/ep${e.id}`,
  }));
  return {
    title: result.title,
    cover: result.cover,
    newEp: result.new_ep || {},
    totalCount: episodes.length,
    episodes,
  };
}

/* ============== UP 主投稿 ============== */

/**
 * 主源：动态接口（无 WBI，风控宽松，数据更丰富）
 */
async function fetchUpVideosViaDynamic(uid, cookie) {
  const url = `https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space?host_mid=${uid}&offset=&timezone_offset=-480&features=itemOpusStyle`;
  const json = await fetchJson(url, {
    cookie,
    referer: `https://space.bilibili.com/${uid}/dynamic`,
  });
  if (json.code !== 0) {
    dlog(`dynamic ${uid} fail:`, json.code, json.message);
    return { error: json.message, list: [] };
  }
  const items = json.data?.items || [];
  const videos = [];
  for (const it of items) {
    const major = it?.modules?.module_dynamic?.major;
    const archive = major?.archive;
    if (!archive) continue;
    const author = it?.modules?.module_author || {};
    videos.push({
      bvid: archive.bvid,
      aid: archive.aid,
      title: archive.title,
      description: archive.desc || "",
      cover: archive.cover,
      pubTime: (author.pub_ts || 0) * 1000,
      duration: archive.duration_text || archive.duration,
      play: archive.stat?.play,
      videoUrl: `https://www.bilibili.com/video/${archive.bvid}`,
    });
  }
  return { error: null, list: videos };
}

/**
 * 备源：WBI 投稿搜索接口
 */
async function fetchUpVideosViaWbi(uid, cookie, wbiKeys, pageSize = 30) {
  const params = {
    mid: uid,
    ps: pageSize,
    tid: 0,
    pn: 1,
    keyword: "",
    order: "pubdate",
    platform: "web",
    web_location: 1550101,
    order_avoided: true,
  };
  const query = encWbi(params, wbiKeys.imgKey, wbiKeys.subKey);
  const url = `https://api.bilibili.com/x/space/wbi/arc/search?${query}`;
  const json = await fetchJson(url, {
    cookie,
    referer: `https://space.bilibili.com/${uid}/upload/video`,
  });
  if (json.code !== 0) {
    dlog(`wbi ${uid} fail:`, json.code, json.message);
    return { error: json.message, list: [] };
  }
  const vlist = json.data?.list?.vlist || [];
  return {
    error: null,
    list: vlist.map((v) => ({
      bvid: v.bvid,
      aid: v.aid,
      title: v.title,
      description: v.description,
      cover: v.pic,
      pubTime: (v.created || 0) * 1000,
      duration: v.length,
      play: v.play,
      videoUrl: `https://www.bilibili.com/video/${v.bvid}`,
    })),
  };
}

/**
 * 合并两个来源（动态优先，WBI 补充更多历史）
 */
async function fetchUpVideos(uid, cookie, wbiKeys) {
  // 1. 动态接口（主）
  const dyn = await fetchUpVideosViaDynamic(uid, cookie);
  let videos = dyn.list;
  let errors = dyn.error ? [`dynamic:${dyn.error}`] : [];

  // 2. WBI 接口（补充，最多重试一次）
  await sleep(1500);
  let wbi = await fetchUpVideosViaWbi(uid, cookie, wbiKeys);
  if (wbi.error?.includes("风控")) {
    await sleep(4000);
    wbi = await fetchUpVideosViaWbi(uid, cookie, wbiKeys);
  }
  if (wbi.error) errors.push(`wbi:${wbi.error}`);

  // 合并去重（按 bvid）
  const seen = new Set(videos.map((v) => v.bvid));
  for (const v of wbi.list) {
    if (!seen.has(v.bvid)) {
      videos.push(v);
      seen.add(v.bvid);
    }
  }
  // 按发布时间倒序
  videos.sort((a, b) => (b.pubTime || 0) - (a.pubTime || 0));

  return {
    error: videos.length === 0 ? errors.join("; ") : null,
    list: videos,
    sources: {
      dynamic: dyn.list.length,
      wbi: wbi.list.length,
    },
  };
}

/* ============== 主流程 ============== */

async function readPrevSnapshot(series) {
  try {
    const txt = await fs.readFile(path.join(DATA_DIR, "snapshot.json"), "utf8");
    const snap = JSON.parse(txt);
    for (const up of snap.ups || []) {
      for (const v of up.videos || []) {
        const m = matchEpisode(v.title, series);
        v.matched = m.matched;
        v.ep = m.ep;
        v.isCompilation = m.isCompilation || false;
        v.contentType = m.contentType || null;
        v.characters = m.characters || [];
      }
    }
    return snap;
  } catch {
    return null;
  }
}

/** 把本次结果与历史合并（按 bvid 去重，保留更全的信息） */
function mergeVideos(prev, curr) {
  const map = new Map();
  for (const v of prev || []) map.set(v.bvid, v);
  for (const v of curr || []) map.set(v.bvid, { ...map.get(v.bvid), ...v });
  return Array.from(map.values()).sort(
    (a, b) => (b.pubTime || 0) - (a.pubTime || 0)
  );
}

async function fetchUpWithRetry(up, cookieRef, wbiKeysRef) {
  for (let i = 0; i < 3; i++) {
    let result;
    try {
      result = await fetchUpVideos(up.uid, cookieRef.value, wbiKeysRef.value);
    } catch (e) {
      result = { error: e.message, list: [], sources: {} };
    }
    if (result.list.length > 0) return result;

    // 全失败：刷新 cookie 再试
    log(`  [${up.name}] 第 ${i + 1} 次失败，刷新 cookie 后重试 ...`);
    await sleep(8000 + i * 4000);
    try {
      cookieRef.value = await getAnonymousCookie();
      wbiKeysRef.value = await getWbiKeys(cookieRef.value);
    } catch (e) {
      dlog("  刷 cookie 失败:", e.message);
    }
  }
  return { error: "all retries failed", list: [], sources: {} };
}

async function main() {
  const series = JSON.parse(
    await fs.readFile(path.join(DATA_DIR, "series.json"), "utf8")
  );
  const ups = JSON.parse(
    await fs.readFile(path.join(DATA_DIR, "ups.json"), "utf8")
  );
  const prevSnapshot = await readPrevSnapshot(series);
  const prevUpMap = new Map(
    (prevSnapshot?.ups || []).map((u) => [u.uid, u])
  );

  log("init: 获取匿名 cookie ...");
  const cookieRef = { value: await getAnonymousCookie() };
  dlog("cookie:", cookieRef.value.slice(0, 120) + "...");

  log("init: 获取 WBI keys ...");
  const wbiKeysRef = { value: await getWbiKeys(cookieRef.value) };
  dlog("wbi:", wbiKeysRef.value);

  log(`官方: 拉取 season ${series.seasonId} ...`);
  let seasonData;
  try {
    seasonData = await fetchSeason(series.seasonId, cookieRef.value);
    log(`官方: 共 ${seasonData.totalCount} 集，最新「${seasonData.newEp.title}」`);
  } catch (e) {
    log(`官方拉取失败: ${e.message}，沿用历史数据`);
    seasonData = prevSnapshot?.official || { episodes: [], totalCount: 0 };
  }

  const upResults = [];
  for (const up of ups) {
    log(`UP[${up.name}] uid=${up.uid} 拉取中 ...`);
    const result = await fetchUpWithRetry(up, cookieRef, wbiKeysRef);
    if (result.sources) {
      dlog(`  sources: dynamic=${result.sources.dynamic} wbi=${result.sources.wbi}`);
    }

    const videos = (result?.list || []).map((v) => {
      const m = matchEpisode(v.title, series);
      return {
        ...v,
        matched: m.matched,
        ep: m.ep,
        isCompilation: m.isCompilation || false,
        contentType: m.contentType || null,
        characters: m.characters || [],
      };
    });
    const related = videos.filter((v) => v.matched);

    const prevUp = prevUpMap.get(up.uid);
    const mergedRelated = mergeVideos(prevUp?.videos, related);

    log(
      `  -> 本次抓 ${videos.length} 条 / 凡人相关 ${related.length} 条 / 合并后 ${mergedRelated.length} 条`
    );

    upResults.push({
      uid: up.uid,
      name: up.name,
      alias: up.alias || [],
      note: up.note || "",
      error: result?.error || null,
      lastFetched: Date.now(),
      lastSuccess:
        videos.length > 0 ? Date.now() : prevUp?.lastSuccess || null,
      videos: mergedRelated,
      recentTitles:
        videos.length > 0
          ? videos.slice(0, 5).map((v) => v.title)
          : prevUp?.recentTitles || [],
    });
    await sleep(8000 + Math.random() * 4000);
  }

  const snapshot = {
    generatedAt: Date.now(),
    series,
    official: seasonData,
    ups: upResults,
  };

  const outPath = path.join(DATA_DIR, "snapshot.json");
  await fs.writeFile(outPath, JSON.stringify(snapshot, null, 2));
  log(`✅ 已写入 ${path.relative(ROOT, outPath)}`);

  // 统计摘要
  const succ = upResults.filter((u) => u.videos.length > 0).length;
  log(`📊 摘要: ${succ}/${upResults.length} UP 有数据`);
}

main().catch((e) => {
  console.error("[fetch] 致命错误:", e);
  process.exit(1);
});
