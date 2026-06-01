import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getAnonymousCookie, UA } from "./bili-cookie.mjs";
import { encWbi, getWbiKeys } from "./wbi.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const KEYWORDS = [
  "凡人修仙传 解析",
  "凡人修仙传 PV",
  "凡人修仙传 新PV",
  "凡人修仙传 战斗PV",
  "凡人修仙传 慕兰之战",
  "凡人修仙传 韩立",
  "凡人修仙传 南宫婉",
  "凡人修仙传 逐帧",
  "凡人修仙传 第二季",
];
const PAGES_PER_KEYWORD = 3;
const PAGE_SIZE = 30;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url, { cookie, referer } = {}) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Referer: referer || "https://www.bilibili.com/",
      ...(cookie ? { Cookie: cookie } : {}),
    },
  });
  if (res.status === 412) return { code: -412, data: null };
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function searchVideos(keyword, page, cookie, wbiKeys) {
  const params = {
    search_type: "video",
    keyword,
    order: "totalrank",
    page,
    page_size: PAGE_SIZE,
    platform: "pc",
  };
  const query = encWbi(params, wbiKeys.imgKey, wbiKeys.subKey);
  const url = `https://api.bilibili.com/x/web-interface/wbi/search/type?${query}`;
  const json = await fetchJson(url, {
    cookie,
    referer: `https://search.bilibili.com/all?keyword=${encodeURIComponent(keyword)}`,
  });
  if (json.code !== 0) {
    console.error(`  搜索失败 [${keyword} p${page}]:`, json.code, json.message);
    return [];
  }
  return json.data?.result || [];
}

function cleanTitle(s) {
  return (s || "").replace(/<[^>]+>/g, "").trim();
}

async function getUpStats(uid, cookie) {
  const url = `https://api.bilibili.com/x/relation/stat?vmid=${uid}`;
  const json = await fetchJson(url, {
    cookie,
    referer: `https://space.bilibili.com/${uid}`,
  });
  if (json.code !== 0) return null;
  return { follower: json.data?.follower || 0 };
}

async function main() {
  console.log("[discover] 拿匿名 cookie ...");
  const cookie = await getAnonymousCookie();
  const wbiKeys = await getWbiKeys(cookie);

  const upMap = new Map();

  for (const kw of KEYWORDS) {
    for (let p = 1; p <= PAGES_PER_KEYWORD; p++) {
      console.log(`[search] 「${kw}」 page ${p}`);
      const videos = await searchVideos(kw, p, cookie, wbiKeys);
      console.log(`  → 拿到 ${videos.length} 条`);
      for (const v of videos) {
        const uid = String(v.mid);
        const upname = v.author;
        if (!uid || uid === "0") continue;
        if (!upMap.has(uid)) {
          upMap.set(uid, {
            uid,
            name: upname,
            videoCount: 0,
            totalPlay: 0,
            totalDanmaku: 0,
            totalFavorites: 0,
            recentTitles: [],
            recentDates: [],
          });
        }
        const u = upMap.get(uid);
        u.videoCount++;
        u.totalPlay += v.play || 0;
        u.totalDanmaku += v.danmaku || 0;
        u.totalFavorites += v.favorites || 0;
        if (u.recentTitles.length < 3) {
          u.recentTitles.push(cleanTitle(v.title));
          u.recentDates.push(v.pubdate ? new Date(v.pubdate * 1000).toISOString().slice(0, 10) : "");
        }
      }
      await sleep(2500 + Math.random() * 1500);
    }
  }

  console.log(`\n[discover] 共扫到 ${upMap.size} 个 UP，开始拉粉丝数 ...`);

  const candidates = Array.from(upMap.values())
    .filter((u) => u.videoCount >= 2)
    .sort((a, b) => b.totalPlay - a.totalPlay)
    .slice(0, 60);

  for (let i = 0; i < candidates.length; i++) {
    const u = candidates[i];
    console.log(`[stat] (${i + 1}/${candidates.length}) ${u.name} uid=${u.uid}`);
    const stat = await getUpStats(u.uid, cookie);
    u.follower = stat?.follower || 0;
    await sleep(800 + Math.random() * 400);
  }

  candidates.sort((a, b) => {
    const scoreA = a.totalPlay * 0.6 + a.follower * 50 + a.videoCount * 100000;
    const scoreB = b.totalPlay * 0.6 + b.follower * 50 + b.videoCount * 100000;
    return scoreB - scoreA;
  });

  const currentUps = JSON.parse(
    await fs.readFile(path.join(ROOT, "data", "ups.json"), "utf8")
  );
  const currentUids = new Set(currentUps.map((u) => u.uid));

  console.log("\n========== 热门 UP 主推荐 ==========");
  console.log(
    "排名 | 已收录 | UP 名".padEnd(30) +
      " | 视频数 | 总播放 | 总收藏 | 粉丝数 | UID"
  );
  console.log("-".repeat(140));
  candidates.forEach((u, i) => {
    const inList = currentUids.has(u.uid) ? "✓" : " ";
    const playK = (u.totalPlay / 10000).toFixed(1) + "万";
    const favK = (u.totalFavorites / 10000).toFixed(1) + "万";
    const fanK = u.follower >= 10000 ? (u.follower / 10000).toFixed(1) + "万" : String(u.follower);
    console.log(
      `${String(i + 1).padStart(2)}.  | [${inList}]   | ${u.name.padEnd(22)} | ${String(u.videoCount).padStart(3)}   | ${playK.padStart(8)} | ${favK.padStart(7)} | ${fanK.padStart(7)} | ${u.uid}`
    );
    console.log(`     └ 近期: 「${u.recentTitles[0] || ""}」`);
  });

  const outPath = path.join(ROOT, "discover-result.json");
  await fs.writeFile(outPath, JSON.stringify(candidates, null, 2));
  console.log(`\n详细结果已写入 ${path.relative(ROOT, outPath)}`);
}

main().catch((e) => {
  console.error("[discover] 异常:", e);
  process.exit(1);
});
