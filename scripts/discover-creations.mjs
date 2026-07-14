import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getAnonymousCookie, UA } from "./bili-cookie.mjs";
import { encWbi, getWbiKeys } from "./wbi.mjs";
import { CREATION_CATEGORIES, TAXONOMY_PROMPT, classifyCreationByRule } from "./creation-taxonomy.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = path.join(ROOT, "data", "creations.json");
const PAGES = Number(process.env.CREATION_SEARCH_PAGES || 2);
const MODEL = process.env.OPENAI_CLASSIFIER_MODEL || "gpt-5.4-mini";
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

function outputText(response) {
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) return content.text;
    }
  }
  throw new Error("模型未返回结构化文本");
}

async function classifyWithModel(items) {
  if (!process.env.OPENAI_API_KEY || items.length === 0) return items;
  const batches = [];
  for (let index = 0; index < items.length; index += 30) batches.push(items.slice(index, index + 30));
  const resultMap = new Map();
  for (const [index, batch] of batches.entries()) {
    console.log(`[model] ${index + 1}/${batches.length} · ${batch.length} 条`);
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        store: false,
        input: [
          { role: "system", content: TAXONOMY_PROMPT },
          { role: "user", content: JSON.stringify(batch.map(({ id, title, description, upName, duration }) => ({ id, title, description, upName, duration }))) },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "creation_classification",
            strict: true,
            schema: {
              type: "object",
              properties: {
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      category: { type: "string", enum: CREATION_CATEGORIES },
                      confidence: { type: "number", minimum: 0, maximum: 1 },
                      reason: { type: "string" },
                      include: { type: "boolean" },
                    },
                    required: ["id", "category", "confidence", "reason", "include"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["items"],
              additionalProperties: false,
            },
          },
        },
      }),
    });
    if (!response.ok) throw new Error(`OpenAI HTTP ${response.status}: ${await response.text()}`);
    const parsed = JSON.parse(outputText(await response.json()));
    for (const item of parsed.items || []) resultMap.set(item.id, item);
  }
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
  await fs.writeFile(OUTPUT, JSON.stringify({ generatedAt: Date.now(), taxonomyVersion: 1, model: process.env.OPENAI_API_KEY ? MODEL : null, categories: CREATION_CATEGORIES, counts, items }, null, 2));
  console.log(`[creation] 写入 ${path.relative(ROOT, OUTPUT)} · ${items.length} 条`);
  console.log(counts);
}

main().catch((error) => {
  console.error("[creation] 失败:", error.message);
  process.exit(1);
});
