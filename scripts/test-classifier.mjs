import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { matchEpisode, CONTENT_TYPES } from "./match-episode.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const snap = JSON.parse(await fs.readFile(path.join(ROOT, "data/snapshot.json"), "utf8"));
const series = JSON.parse(await fs.readFile(path.join(ROOT, "data/series.json"), "utf8"));

const counts = {};
const samples = {};

console.log("\n┌─────────────────────────────────────────────────┐");
console.log("│  内容分类器 · 真实数据回归测试                    │");
console.log("└─────────────────────────────────────────────────┘\n");

for (const up of snap.ups) {
  for (const v of up.videos) {
    const m = matchEpisode(v.title, series);
    const type = m.contentType || "skipped";
    counts[type] = (counts[type] || 0) + 1;
    if (!samples[type]) samples[type] = [];
    if (samples[type].length < 5) {
      samples[type].push({
        title: v.title,
        ep: m.ep,
        chars: m.characters,
        up: up.name,
      });
    }
  }
}

console.log("📊 分类统计:\n");
for (const [type, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
  const label = CONTENT_TYPES[type] || type;
  console.log(`  ${label.padEnd(10, "　")} ${String(n).padStart(3)} 条`);
}

console.log("\n📋 各类样本:\n");
for (const [type, items] of Object.entries(samples)) {
  const label = CONTENT_TYPES[type] || type;
  console.log(`▶ ${label}`);
  for (const it of items) {
    const tag = it.ep != null ? `[EP${it.ep}]` : "";
    const charTag = it.chars.length > 0 ? `{${it.chars.join(",")}}` : "";
    console.log(`  ${tag}${charTag} ${it.title.substring(0, 60)}`);
  }
  console.log("");
}
