import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { matchEpisode } from "./match-episode.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SNAP = path.join(ROOT, "data/snapshot.json");

const series = JSON.parse(
  await fs.readFile(path.join(ROOT, "data/series.json"), "utf8")
);
const snap = JSON.parse(await fs.readFile(SNAP, "utf8"));

let updated = 0;
for (const up of snap.ups || []) {
  for (const v of up.videos || []) {
    const m = matchEpisode(v.title, series);
    v.matched = m.matched;
    v.ep = m.ep;
    v.isCompilation = m.isCompilation || false;
    v.contentType = m.contentType || null;
    v.characters = m.characters || [];
    updated++;
  }
}

await fs.writeFile(SNAP, JSON.stringify(snap, null, 2));
console.log(`✅ 重分类完成，更新 ${updated} 条视频`);
