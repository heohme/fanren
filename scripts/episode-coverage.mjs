import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const snapshot = JSON.parse(await fs.readFile(path.join(ROOT, "data", "snapshot.json"), "utf8"));
const current = Number.parseInt(snapshot.official?.newEp?.title || "", 10);
const from = Number(process.argv.find((arg) => arg.startsWith("--from="))?.split("=")[1]) || current;
const to = Number(process.argv.find((arg) => arg.startsWith("--to="))?.split("=")[1]) || Math.max(1, from - 19);
const officialUid = "98627270";

const rows = [];
for (let ep = from; ep >= to; ep--) {
  const upNames = [];
  let videos = 0;
  for (const up of snapshot.ups || []) {
    if (String(up.uid) === officialUid) continue;
    const hits = (up.videos || []).filter((video) => video.contentType === "episode" && video.ep === ep);
    if (hits.length) upNames.push(up.name);
    videos += hits.length;
  }
  rows.push({ ep, ups: upNames.length, videos, names: upNames.join("、") });
}

console.table(rows);
const covered = rows.filter((row) => row.ups >= 10).length;
console.log(`覆盖达标：${covered}/${rows.length} 集达到 10+ 位 UP`);
