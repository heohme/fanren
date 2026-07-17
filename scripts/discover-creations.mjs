import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getAnonymousCookie, UA } from "./bili-cookie.mjs";
import { encWbi, getWbiKeys } from "./wbi.mjs";
import {
  CONTENT_NATURE_VALUES,
  CREATION_CATEGORIES,
  CREATOR_POTENTIAL_VALUES,
  ORIGINALITY_VALUES,
  PROMPT_VERSION,
  RELEVANCE_VALUES,
  RISK_FLAG_VALUES,
  TAXONOMY_PROMPT,
  TAXONOMY_VERSION,
  classifyCreationByRule,
} from "./creation-taxonomy.mjs";
import { POLICY_VERSION, applyCreationPolicy } from "./creation-policy.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data");
const PATHS = {
  raw: path.join(DATA, "discovery-raw.json"),
  classifications: path.join(DATA, "classification.json"),
  metrics: path.join(DATA, "creation-metrics.json"),
  review: path.join(DATA, "discovery-review.json"),
  published: path.join(DATA, "creations.json"),
  ups: path.join(DATA, "ups.json"),
};
const MODE = process.env.CREATION_DISCOVERY_MODE === "history" ? "history" : "fresh";
const ARK_API_URL = process.env.ARK_API_URL || "https://ark.cn-beijing.volces.com/api/v3/chat/completions";
const MODEL = process.env.ARK_CLASSIFIER_MODEL || "doubao-seed-2-0-mini-260428";
const SEARCH_CONFIG = {
  fresh: { order: "pubdate", pages: Number(process.env.CREATION_SEARCH_PAGES || 1), metricLimit: 36 },
  history: { order: "totalrank", pages: Number(process.env.CREATION_SEARCH_PAGES || 2), metricLimit: 60 },
};
const QUERIES = [
  "凡人修仙传 二创",
  "凡人官方二创大会",
  "凡人修仙传 人物志 设定",
  "凡人修仙传 混剪 手书",
  "凡人修仙传 MMD 同人动画",
  "凡人修仙传 鬼畜 整活",
  "凡人修仙传 配音 翻唱",
  "韩立 二创",
  "南宫婉 二创",
  "凡人修仙传 小剧场",
  "凡人修仙传 同人",
  "凡人修仙传 法宝 功法 人物",
];
const RELEVANCE_HINT = /凡人修仙传|凡人二创|凡人官方二创|韩立|南宫婉|紫灵|元瑶|银月|王蝉|厉飞雨|向之礼|陈巧倩|墨彩环|大衍神君|风希|曲魂/;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function clean(value = "") {
  return String(value).replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim();
}

function parsePlay(value) {
  if (typeof value === "number") return value;
  const text = String(value || "0");
  const number = Number.parseFloat(text) || 0;
  return text.includes("万") ? Math.round(number * 10000) : Math.round(number);
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function fetchJson(url, { cookie, referer } = {}) {
  const response = await fetch(url, {
    headers: { "User-Agent": UA, Referer: referer || "https://www.bilibili.com/", ...(cookie ? { Cookie: cookie } : {}) },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function search(query, page, cookie, keys) {
  const config = SEARCH_CONFIG[MODE];
  const params = { search_type: "video", keyword: query, order: config.order, page, page_size: 30, platform: "pc" };
  const encoded = encWbi(params, keys.imgKey, keys.subKey);
  const json = await fetchJson(`https://api.bilibili.com/x/web-interface/wbi/search/type?${encoded}`, {
    cookie,
    referer: `https://search.bilibili.com/all?keyword=${encodeURIComponent(query)}`,
  });
  if (json.code !== 0) throw new Error(`${json.code}: ${json.message}`);
  return json.data?.result || [];
}

function candidateFromSearch(video, query, now) {
  const title = clean(video.title);
  const description = clean(video.description);
  const rule = classifyCreationByRule(title, description);
  return {
    id: video.bvid,
    bvid: video.bvid,
    title,
    description,
    cover: String(video.pic || "").replace(/^\/\//, "https://"),
    url: video.arcurl || `https://www.bilibili.com/video/${video.bvid}`,
    upId: String(video.mid || ""),
    upName: clean(video.author),
    play: parsePlay(video.play),
    favorites: parsePlay(video.favorites),
    danmaku: parsePlay(video.video_review),
    pubTime: Number(video.pubdate || 0) * 1000,
    duration: video.duration || "",
    firstSeenAt: now,
    lastSeenAt: now,
    sourceQueries: [query],
    discoveryModes: [MODE],
    rule,
  };
}

function candidateFromPublished(item, now) {
  return {
    ...item,
    id: item.bvid || item.id,
    bvid: item.bvid || item.id,
    firstSeenAt: item.firstSeenAt || now,
    lastSeenAt: item.lastSeenAt || now,
    sourceQueries: item.sourceQueries || ["legacy-published"],
    discoveryModes: item.discoveryModes || ["history"],
    rule: item.rule || classifyCreationByRule(item.title, item.description),
  };
}

function mergeCandidate(existing, incoming) {
  if (!existing) return incoming;
  return {
    ...existing,
    ...incoming,
    firstSeenAt: Math.min(Number(existing.firstSeenAt || incoming.firstSeenAt), Number(incoming.firstSeenAt || existing.firstSeenAt)),
    lastSeenAt: Math.max(Number(existing.lastSeenAt || 0), Number(incoming.lastSeenAt || 0)),
    sourceQueries: [...new Set([...(existing.sourceQueries || []), ...(incoming.sourceQueries || [])])],
    discoveryModes: [...new Set([...(existing.discoveryModes || []), ...(incoming.discoveryModes || [])])],
  };
}

function ruleClassification(candidate, now) {
  return {
    id: candidate.bvid,
    relevance: "related",
    contentNature: "episode_analysis",
    creationType: candidate.rule?.category || "剧情二创",
    originality: "unknown",
    eventTag: null,
    creatorPotential: "one_off",
    confidence: 0.99,
    riskFlags: ["episode_analysis"],
    reason: candidate.rule?.reason || "命中硬排除规则",
    source: "rule",
    taxonomyVersion: TAXONOMY_VERSION,
    promptVersion: PROMPT_VERSION,
    classifiedAt: now,
  };
}

function parseModelOutput(payload) {
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("模型未返回分类文本");
  return JSON.parse(content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
}

function validateModelItem(item, batchMap, now) {
  const candidate = batchMap.get(item.id);
  if (!candidate) throw new Error(`模型返回未知 ID：${item.id}`);
  const normalized =
    !RELEVANCE_VALUES.includes(item.relevance) ||
    !CONTENT_NATURE_VALUES.includes(item.contentNature) ||
    !CREATION_CATEGORIES.includes(item.creationType) ||
    !ORIGINALITY_VALUES.includes(item.originality) ||
    !CREATOR_POTENTIAL_VALUES.includes(item.creatorPotential) ||
    typeof item.confidence !== "number" ||
    !Array.isArray(item.riskFlags) ||
    item.riskFlags.some((flag) => !RISK_FLAG_VALUES.includes(flag));
  const riskFlags = Array.isArray(item.riskFlags) ? item.riskFlags.filter((flag) => RISK_FLAG_VALUES.includes(flag)) : [];
  if (normalized) riskFlags.push("uncertain");
  return {
    id: item.id,
    relevance: RELEVANCE_VALUES.includes(item.relevance) ? item.relevance : "weak",
    contentNature: CONTENT_NATURE_VALUES.includes(item.contentNature) ? item.contentNature : "unknown",
    creationType: CREATION_CATEGORIES.includes(item.creationType) ? item.creationType : candidate.rule?.category || "趣味整活",
    originality: ORIGINALITY_VALUES.includes(item.originality) ? item.originality : "unknown",
    eventTag: typeof item.eventTag === "string" && item.eventTag.trim() ? item.eventTag.trim() : null,
    creatorPotential: CREATOR_POTENTIAL_VALUES.includes(item.creatorPotential) ? item.creatorPotential : "one_off",
    confidence: Math.min(1, Math.max(0, Number(item.confidence) || 0.2)),
    riskFlags: [...new Set(riskFlags)],
    reason: clean(item.reason).slice(0, 180),
    source: "model",
    taxonomyVersion: TAXONOMY_VERSION,
    promptVersion: PROMPT_VERSION,
    classifiedAt: now,
  };
}

function safeFallbackClassification(candidate, now, reason) {
  return {
    id: candidate.bvid,
    relevance: "weak",
    contentNature: "unknown",
    creationType: candidate.rule?.category || "趣味整活",
    originality: "unknown",
    eventTag: null,
    creatorPotential: "one_off",
    confidence: 0.2,
    riskFlags: ["uncertain"],
    reason: `模型返回不完整，安全排除：${clean(reason).slice(0, 100)}`,
    source: "fallback",
    taxonomyVersion: TAXONOMY_VERSION,
    promptVersion: PROMPT_VERSION,
    classifiedAt: now,
  };
}

async function requestModel(batch) {
  const response = await fetch(ARK_API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.ARK_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      thinking: { type: "disabled" },
      messages: [
        {
          role: "system",
          content: `${TAXONOMY_PROMPT}\n只返回合法 JSON，不要使用 Markdown。格式：{"items":[{"id":"BV号","relevance":"related","contentNature":"secondary_creation","creationType":"趣味整活","originality":"deep_adaptation","eventTag":null,"creatorPotential":"observe","confidence":0.9,"riskFlags":[],"reason":"一句话"}]}`,
        },
        {
          role: "user",
          content: JSON.stringify(batch.map(({ bvid, title, description, upName, duration, pubTime, play }) => ({ id: bvid, title, description, upName, duration, pubTime, play }))),
        },
      ],
      temperature: 0,
    }),
  });
  if (!response.ok) throw new Error(`火山方舟 HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`);
  return response.json();
}

async function classifyNewCandidates(candidates, cache, now) {
  const usage = { input: 0, output: 0, total: 0, requests: 0 };
  const pending = candidates.filter((candidate) => {
    const cached = cache[candidate.bvid];
    return !cached || cached.taxonomyVersion !== TAXONOMY_VERSION || cached.promptVersion !== PROMPT_VERSION;
  });
  for (const candidate of pending.filter((item) => item.rule?.hardExcluded)) cache[candidate.bvid] = ruleClassification(candidate, now);
  const modelPending = pending.filter((item) => !item.rule?.hardExcluded);
  if (modelPending.length && !process.env.ARK_API_KEY) {
    if (process.env.REQUIRE_CREATION_MODEL === "1") throw new Error("ARK_API_KEY 未配置，无法执行模型分类");
    console.log(`[model] 未配置 ARK_API_KEY，跳过 ${modelPending.length} 条新候选`);
    return usage;
  }
  for (let offset = 0; offset < modelPending.length; offset += 18) {
    const batch = modelPending.slice(offset, offset + 18);
    console.log(`[model] ${Math.floor(offset / 18) + 1}/${Math.ceil(modelPending.length / 18)} · ${batch.length} 条`);
    let payload;
    let lastError;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        payload = await requestModel(batch);
        const parsed = parseModelOutput(payload);
        if (!Array.isArray(parsed.items)) throw new Error("模型返回缺少 items 数组");
        const batchMap = new Map(batch.map((item) => [item.bvid, item]));
        const validated = parsed.items.map((item) => validateModelItem(item, batchMap, now));
        if (validated.length !== batch.length || new Set(validated.map((item) => item.id)).size !== batch.length) throw new Error("模型存在漏判或重复 ID");
        for (const item of validated) cache[item.id] = item;
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        console.warn(`[model] 第 ${attempt} 次失败：${error.message}`);
        if (attempt < 2) await sleep(1500);
      }
    }
    if (lastError) {
      console.warn(`[model] 本批安全降级：${lastError.message}`);
      for (const candidate of batch) cache[candidate.bvid] = safeFallbackClassification(candidate, now, lastError.message);
      continue;
    }
    usage.input += Number(payload.usage?.prompt_tokens || 0);
    usage.output += Number(payload.usage?.completion_tokens || 0);
    usage.total += Number(payload.usage?.total_tokens || 0);
    usage.requests += 1;
    await sleep(500);
  }
  return usage;
}

async function videoStats(bvid, cookie) {
  const json = await fetchJson(`https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`, { cookie });
  if (json.code !== 0) throw new Error(`${json.code}: ${json.message}`);
  const stat = json.data?.stat || {};
  return {
    play: Number(stat.view || 0),
    like: Number(stat.like || 0),
    coin: Number(stat.coin || 0),
    favorite: Number(stat.favorite || 0),
    reply: Number(stat.reply || 0),
    danmaku: Number(stat.danmaku || 0),
  };
}

async function updateMetrics(candidates, classifications, metricItems, cookie, now) {
  const config = SEARCH_CONFIG[MODE];
  const shortlisted = candidates
    .filter((item) => {
      const classification = classifications[item.bvid];
      return classification && classification.relevance !== "irrelevant" && !["episode_analysis", "news_or_preview", "official_content", "clip_or_repost"].includes(classification.contentNature);
    })
    .sort((a, b) => Number(b.lastSeenAt || 0) - Number(a.lastSeenAt || 0) || b.play - a.play)
    .slice(0, config.metricLimit);
  for (const [index, candidate] of shortlisted.entries()) {
    try {
      console.log(`[metrics] ${index + 1}/${shortlisted.length} · ${candidate.bvid}`);
      const stats = await videoStats(candidate.bvid, cookie);
      const existing = metricItems[candidate.bvid] || { bvid: candidate.bvid, samples: [] };
      const date = new Date(now).toISOString().slice(0, 10);
      const samples = (existing.samples || []).filter((sample) => new Date(sample.sampledAt).toISOString().slice(0, 10) !== date);
      samples.push({ sampledAt: now, stats });
      metricItems[candidate.bvid] = { bvid: candidate.bvid, latest: stats, samples: samples.slice(-30) };
      candidate.play = stats.play;
    } catch (error) {
      console.warn(`[metrics] ${candidate.bvid} 获取失败：${error.message}`);
    }
    await sleep(850 + Math.random() * 450);
  }
}

function publicItem(item) {
  return {
    id: item.bvid,
    bvid: item.bvid,
    title: item.title,
    description: item.description,
    cover: item.cover,
    url: item.url,
    upId: item.upId,
    upName: item.upName,
    play: item.play,
    pubTime: item.pubTime,
    duration: item.duration,
    category: item.creationType,
    confidence: item.confidence,
    classificationSource: item.source,
    classificationReason: item.reason,
    contentNature: item.contentNature,
    originality: item.originality,
    eventTag: item.eventTag,
    creatorPotential: item.creatorPotential,
    score: item.score,
    lane: item.lane,
    firstSeenAt: item.firstSeenAt,
    lastSeenAt: item.lastSeenAt,
    sourceQueries: item.sourceQueries,
    discoveryModes: item.discoveryModes,
  };
}

async function main() {
  const now = Date.now();
  console.log(`[creation] ${MODE} 模式 · 获取访问凭证`);
  const [rawData, legacyPublished, classificationData, metricData, ups] = await Promise.all([
    readJson(PATHS.raw, { items: [] }),
    readJson(PATHS.published, { items: [] }),
    readJson(PATHS.classifications, { items: {} }),
    readJson(PATHS.metrics, { items: {} }),
    readJson(PATHS.ups, []),
  ]);
  const candidates = new Map();
  for (const item of rawData.items || []) candidates.set(item.bvid || item.id, item);
  if (!rawData.items?.length) {
    for (const item of legacyPublished.items || []) {
      const seeded = candidateFromPublished(item, now);
      candidates.set(seeded.bvid, seeded);
    }
    console.log(`[creation] 从旧发布层迁移 ${candidates.size} 条候选`);
  }

  const cookie = await getAnonymousCookie();
  const keys = await getWbiKeys(cookie);
  const config = SEARCH_CONFIG[MODE];
  for (const query of QUERIES) {
    for (let page = 1; page <= config.pages; page++) {
      console.log(`[search] ${query} · ${page}/${config.pages}`);
      const videos = await search(query, page, cookie, keys);
      for (const video of videos) {
        const incoming = candidateFromSearch(video, query, now);
        if (incoming.bvid && RELEVANCE_HINT.test(`${incoming.title} ${incoming.description}`)) {
          candidates.set(incoming.bvid, mergeCandidate(candidates.get(incoming.bvid), incoming));
        }
      }
      await sleep(1500 + Math.random() * 700);
    }
  }

  const allCandidates = [...candidates.values()]
    .sort((a, b) => Number(b.lastSeenAt || 0) - Number(a.lastSeenAt || 0) || b.play - a.play)
    .slice(0, 2000);
  const classifications = classificationData.items || {};
  const usage = await classifyNewCandidates(allCandidates, classifications, now);
  console.log(`[model] Token · 输入 ${usage.input} · 输出 ${usage.output} · 合计 ${usage.total}`);
  const metrics = metricData.items || {};
  await updateMetrics(allCandidates, classifications, metrics, cookie, now);
  const policy = applyCreationPolicy({
    candidates: allCandidates,
    classifications,
    metrics,
    knownUpIds: ups.map((up) => up.uid),
    now,
  });

  const publishedItems = policy.approved.map(publicItem);
  const counts = Object.fromEntries(CREATION_CATEGORIES.map((category) => [category, publishedItems.filter((item) => item.category === category).length]));
  await Promise.all([
    writeJson(PATHS.raw, { generatedAt: now, mode: MODE, queries: QUERIES, count: allCandidates.length, items: allCandidates }),
    writeJson(PATHS.classifications, {
      generatedAt: now,
      taxonomyVersion: TAXONOMY_VERSION,
      promptVersion: PROMPT_VERSION,
      model: process.env.ARK_API_KEY ? MODEL : null,
      lastRunUsage: usage,
      count: Object.keys(classifications).length,
      items: classifications,
    }),
    writeJson(PATHS.metrics, { generatedAt: now, count: Object.keys(metrics).length, items: metrics }),
    writeJson(PATHS.review, {
      generatedAt: now,
      mode: MODE,
      taxonomyVersion: TAXONOMY_VERSION,
      policyVersion: POLICY_VERSION,
      summary: policy.summary,
      lanes: policy.lanes,
      items: policy.review.map((item) => ({ ...publicItem(item), riskFlags: item.riskFlags, policyReason: item.policyReason, stats: item.stats })),
    }),
    writeJson(PATHS.published, {
      generatedAt: now,
      mode: MODE,
      taxonomyVersion: TAXONOMY_VERSION,
      policyVersion: POLICY_VERSION,
      model: process.env.ARK_API_KEY ? MODEL : null,
      categories: CREATION_CATEGORIES,
      counts,
      lanes: policy.lanes,
      items: publishedItems,
    }),
  ]);
  console.log(`[creation] 候选 ${allCandidates.length} · 发布 ${policy.summary.approved} · 复核 ${policy.summary.review} · 排除 ${policy.summary.rejected}`);
  console.log(counts);
}

main().catch((error) => {
  console.error("[creation] 失败:", error.stack || error.message);
  process.exit(1);
});
