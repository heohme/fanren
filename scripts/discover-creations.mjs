import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getAnonymousCookie, UA } from "./bili-cookie.mjs";
import { encWbi, getWbiKeys } from "./wbi.mjs";
import { CREATION_CATEGORIES, TAXONOMY_PROMPT, classifyCreationByRule } from "./creation-taxonomy.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = path.join(ROOT, "data", "creations.json");
const PAGES = Number(process.env.CREATION_SEARCH_PAGES || 2);
const ARK_API_URL = process.env.ARK_API_URL || "https://ark.cn-beijing.volces.com/api/v3/chat/completions";
const MODEL = process.env.ARK_CLASSIFIER_MODEL || "doubao-seed-2-0-mini-260428";
const QUERIES = [
  "凡人修仙传 二创",
  "凡人修仙传 人物志",
  "凡人修仙传 混剪 手书",
  "凡人修仙传 鬼畜 恶搞",
  "凡人修仙传 配音 翻唱",
  "凡人修仙传 同人 MMD",
];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function clean(value = "") {
  return String(value).replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim();
}

async function fetchJson(url, { cookie, referer } = {}) {
  const response = await fetch(url, {
    headers: { "User-Agent": UA, Referer: referer || "https://www.bilibili.com/", ...(cookie ? { Cookie: cookie } : {}) },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function search(query, page, cookie, keys) {
  const params = { search_type: "video", keyword: query, order: "totalrank", page, page_size: 30, platform: "pc" };
  const encoded = encWbi(params, keys.imgKey, keys.subKey);
  const json = await fetchJson(`https://api.bilibili.com/x/web-interface/wbi/search/type?${encoded}`, {
    cookie,
    referer: `https://search.bilibili.com/all?keyword=${encodeURIComponent(query)}`,
  });
  if (json.code !== 0) throw new Error(`${json.code}: ${json.message}`);
  return json.data?.result || [];
}

function parsePlay(value) {
  if (typeof value === "number") return value;
  const text = String(value || "0");
  const number = Number.parseFloat(text) || 0;
  return text.includes("万") ? Math.round(number * 10000) : Math.round(number);
}

function candidateFromSearch(video) {
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
    pubTime: Number(video.pubdate || 0) * 1000,
    duration: video.duration || "",
    category: rule.category,
    confidence: rule.confidence,
    classificationSource: rule.source,
    classificationReason: rule.reason,
    include: rule.include,
  };
}

function parseModelOutput(response) {
  const content = response.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("模型未返回分类文本");
  const jsonText = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(jsonText);
}

async function classifyWithModel(items) {
  if (items.length === 0) return items;
  if (!process.env.ARK_API_KEY) {
    if (process.env.REQUIRE_CREATION_MODEL === "1") throw new Error("ARK_API_KEY 未配置，无法执行模型分类");
    console.log("[model] 未配置 ARK_API_KEY，本次仅使用规则分类");
    return items;
  }
  const batches = [];
  for (let index = 0; index < items.length; index += 30) batches.push(items.slice(index, index + 30));
  const resultMap = new Map();
  const usage = { input: 0, output: 0, total: 0 };
  for (const [index, batch] of batches.entries()) {
    console.log(`[model] ${index + 1}/${batches.length} · ${batch.length} 条`);
    const response = await fetch(ARK_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.ARK_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        thinking: { type: "disabled" },
        messages: [
          {
            role: "system",
            content: `${TAXONOMY_PROMPT}\n只返回合法 JSON，不要使用 Markdown。格式为：{"items":[{"id":"BV号","category":"六类之一","confidence":0到1之间的数字,"reason":"简短理由","include":true或false}]}`,
          },
          {
            role: "user",
            content: JSON.stringify(batch.map(({ id, title, description, upName, duration }) => ({ id, title, description, upName, duration }))),
          },
        ],
        temperature: 0,
      }),
    });
    if (!response.ok) throw new Error(`火山方舟 HTTP ${response.status}: ${await response.text()}`);
    const payload = await response.json();
    usage.input += Number(payload.usage?.prompt_tokens || 0);
    usage.output += Number(payload.usage?.completion_tokens || 0);
    usage.total += Number(payload.usage?.total_tokens || 0);
    const parsed = parseModelOutput(payload);
    if (!Array.isArray(parsed.items)) throw new Error("模型返回缺少 items 数组");
    for (const item of parsed.items) {
      if (!batch.some((candidate) => candidate.id === item.id)) continue;
      if (!CREATION_CATEGORIES.includes(item.category)) throw new Error(`模型返回未知分类：${item.category}`);
      if (typeof item.confidence !== "number" || item.confidence < 0 || item.confidence > 1) throw new Error(`模型返回非法置信度：${item.confidence}`);
      if (typeof item.include !== "boolean") throw new Error(`模型返回非法收录判断：${item.id}`);
      resultMap.set(item.id, item);
    }
    const missing = batch.filter((item) => !resultMap.has(item.id));
    if (missing.length) throw new Error(`模型漏判 ${missing.length} 条：${missing.map((item) => item.id).join(", ")}`);
  }
  console.log(`[model] Token 用量 · 输入 ${usage.input} · 输出 ${usage.output} · 合计 ${usage.total}`);
  return items.map((item) => {
    const result = resultMap.get(item.id);
    return result ? { ...item, category: result.category, confidence: result.confidence, classificationSource: "model", classificationReason: result.reason, include: result.include } : item;
  });
}

async function main() {
  console.log("[creation] 获取访问凭证");
  const cookie = await getAnonymousCookie();
  const keys = await getWbiKeys(cookie);
  const candidates = new Map();
  for (const query of QUERIES) {
    for (let page = 1; page <= PAGES; page++) {
      console.log(`[search] ${query} · ${page}/${PAGES}`);
      const videos = await search(query, page, cookie, keys);
      for (const video of videos) {
        const candidate = candidateFromSearch(video);
        if (candidate.id && /凡人|韩立|南宫婉/.test(`${candidate.title} ${candidate.description}`)) candidates.set(candidate.id, candidate);
      }
      await sleep(1800 + Math.random() * 900);
    }
  }
  let items = Array.from(candidates.values());
  items = await classifyWithModel(items);
  items = items
    .filter((item) => item.include && item.confidence >= 0.5)
    .sort((a, b) => b.play - a.play || b.pubTime - a.pubTime);
  const counts = Object.fromEntries(CREATION_CATEGORIES.map((category) => [category, items.filter((item) => item.category === category).length]));
  await fs.writeFile(OUTPUT, JSON.stringify({ generatedAt: Date.now(), taxonomyVersion: 1, model: process.env.ARK_API_KEY ? MODEL : null, categories: CREATION_CATEGORIES, counts, items }, null, 2));
  console.log(`[creation] 写入 ${path.relative(ROOT, OUTPUT)} · ${items.length} 条`);
  console.log(counts);
}

main().catch((error) => {
  console.error("[creation] 失败:", error.message);
  process.exit(1);
});
