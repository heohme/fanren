import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const WARN_THRESHOLD_MS = 6 * 60 * 60 * 1000;
const ISSUE_THRESHOLD_MS = 12 * 60 * 60 * 1000;
const ISSUE_TITLE = "[Auto] UP 主抓取持续失败告警";
const ISSUE_LABEL = "fetch-stale";

function gh(args, { silent = false } = {}) {
  try {
    return execSync(`gh ${args}`, {
      encoding: "utf8",
      stdio: silent ? ["ignore", "pipe", "ignore"] : ["ignore", "pipe", "inherit"],
    }).trim();
  } catch (e) {
    if (!silent) console.error("[gh failed]", e.message);
    return "";
  }
}

async function main() {
  const snapPath = path.join(ROOT, "data", "snapshot.json");
  let snap;
  try {
    snap = JSON.parse(await fs.readFile(snapPath, "utf8"));
  } catch {
    console.log("::warning::snapshot.json 不存在或损坏，跳过告警检查");
    return;
  }

  const now = Date.now();
  const stale = [];
  const critical = [];

  for (const up of snap.ups || []) {
    const last = up.lastSuccess || 0;
    if (!last) continue;
    const ageMs = now - last;
    if (ageMs > ISSUE_THRESHOLD_MS) {
      critical.push({ ...up, ageMs });
    } else if (ageMs > WARN_THRESHOLD_MS) {
      stale.push({ ...up, ageMs });
    }
  }

  const fmtAge = (ms) => {
    const h = Math.floor(ms / 3600000);
    return h >= 24 ? `${Math.floor(h / 24)}天${h % 24}小时` : `${h}小时`;
  };

  for (const up of stale) {
    console.log(
      `::warning title=抓取偏慢::${up.name} (uid=${up.uid}) 已 ${fmtAge(up.ageMs)} 未成功，error=${up.error || "未知"}`
    );
  }
  for (const up of critical) {
    console.log(
      `::error title=抓取持续失败::${up.name} (uid=${up.uid}) 已 ${fmtAge(up.ageMs)} 未成功，可能被 B 站风控，error=${up.error || "未知"}`
    );
  }

  if (!process.env.GH_TOKEN || !process.env.GH_REPO) {
    console.log("[check-stale] 非 Actions 环境，跳过 Issue 联动");
    return;
  }

  const existingRaw = gh(
    `issue list --repo ${process.env.GH_REPO} --label "${ISSUE_LABEL}" --state open --json number,title --limit 5`,
    { silent: true }
  );
  let existing = [];
  try {
    existing = JSON.parse(existingRaw || "[]");
  } catch {}
  const existingIssue = existing.find((i) => i.title === ISSUE_TITLE);

  if (critical.length === 0) {
    if (existingIssue) {
      console.log(`[check-stale] 所有 UP 已恢复，关闭告警 Issue #${existingIssue.number}`);
      gh(
        `issue close ${existingIssue.number} --repo ${process.env.GH_REPO} --comment "所有 UP 抓取已恢复，自动关闭。" --reason completed`
      );
    } else {
      console.log("[check-stale] 无 critical UP，无需开 Issue ✓");
    }
    return;
  }

  const runUrl = process.env.RUN_URL || "";
  const body = [
    `检测时间：${new Date(now).toISOString()}`,
    "",
    "以下 UP 主**持续超过 12 小时**未成功抓到数据，可能被 B 站风控：",
    "",
    ...critical.map(
      (u) =>
        `- **${u.name}** (uid=${u.uid}) · 已 ${fmtAge(u.ageMs)} 未成功 · error: \`${u.error || "未知"}\``
    ),
    "",
    stale.length > 0
      ? `另有 ${stale.length} 个 UP 偏慢（6-12 小时）：${stale.map((u) => u.name).join("、")}`
      : "",
    "",
    "## 排查建议",
    "1. 检查 UP 主主页 https://space.bilibili.com/<UID> 是否能正常访问",
    "2. 查看 [本次 Actions 运行日志](" + runUrl + ")",
    "3. 若 B 站风控持续，可考虑：增大 UP 间 sleep 间隔 / 减少 UP 数量 / 改用代理 IP",
    "",
    "_本 Issue 由 check-stale.mjs 自动维护，恢复后会自动关闭。_",
  ]
    .filter(Boolean)
    .join("\n");

  const bodyFile = path.join(ROOT, ".stale-issue-body.md");
  await fs.writeFile(bodyFile, body);

  if (existingIssue) {
    console.log(`[check-stale] 更新已有 Issue #${existingIssue.number}`);
    gh(
      `issue comment ${existingIssue.number} --repo ${process.env.GH_REPO} --body-file "${bodyFile}"`
    );
  } else {
    console.log(`[check-stale] 创建新告警 Issue`);
    gh(
      `issue create --repo ${process.env.GH_REPO} --title "${ISSUE_TITLE}" --label "${ISSUE_LABEL}" --body-file "${bodyFile}"`
    );
  }

  await fs.unlink(bodyFile).catch(() => {});
}

main().catch((e) => {
  console.error("[check-stale] 异常:", e);
  process.exit(0);
});
