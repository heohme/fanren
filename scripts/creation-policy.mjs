const DAY = 24 * 60 * 60 * 1000;

export const POLICY_VERSION = 1;

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function percentileRank(values, value) {
  const usable = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (usable.length <= 1) return 0.5;
  let below = 0;
  for (const item of usable) if (item <= value) below += 1;
  return clamp((below - 1) / (usable.length - 1));
}

function freshnessScore(ageDays) {
  if (ageDays <= 7) return 15;
  if (ageDays <= 14) return 13;
  if (ageDays <= 30) return 10;
  if (ageDays <= 90) return 6;
  if (ageDays <= 365) return 2;
  return 0;
}

function originalityScore(classification) {
  if (classification.contentNature === "character_or_lore") return 25;
  return { original: 30, deep_adaptation: 26, light_edit: 12, unknown: 6 }[classification.originality] || 0;
}

function latestStats(candidate, metricEntry) {
  const samples = Array.isArray(metricEntry?.samples) ? metricEntry.samples : [];
  const latest = samples.at(-1)?.stats || metricEntry?.latest || {};
  return {
    play: Number(latest.play ?? candidate.play ?? 0),
    like: Number(latest.like ?? 0),
    coin: Number(latest.coin ?? 0),
    favorite: Number(latest.favorite ?? candidate.favorites ?? 0),
    reply: Number(latest.reply ?? 0),
    danmaku: Number(latest.danmaku ?? candidate.danmaku ?? 0),
  };
}

function velocity(candidate, metricEntry, now) {
  const samples = Array.isArray(metricEntry?.samples) ? metricEntry.samples : [];
  if (samples.length >= 2) {
    const first = samples[0];
    const last = samples.at(-1);
    const days = Math.max(1 / 24, (Number(last.sampledAt) - Number(first.sampledAt)) / DAY);
    return Math.max(0, (Number(last.stats?.play || 0) - Number(first.stats?.play || 0)) / days);
  }
  const ageDays = Math.max(1, (now - Number(candidate.pubTime || now)) / DAY);
  return Number(candidate.play || 0) / ageDays;
}

function interactionRate(stats) {
  if (!stats.play) return 0;
  return (stats.like + stats.coin * 1.6 + stats.favorite * 1.8 + stats.reply * 2 + stats.danmaku * 0.35) / stats.play;
}

function policyGate(classification) {
  const risks = new Set(classification.riskFlags || []);
  if (classification.relevance !== "related") return { eligible: false, reason: "与凡人主题关联不足" };
  if (!['secondary_creation', 'character_or_lore'].includes(classification.contentNature)) {
    return { eligible: false, reason: "不是二创或人物/设定专题" };
  }
  if (risks.has("episode_analysis") || risks.has("repost") || risks.has("official_clip")) {
    return { eligible: false, reason: "命中解析、搬运或官方切片风险" };
  }
  if (classification.confidence < 0.65) return { eligible: false, reason: "分类置信度不足" };
  return { eligible: true, reason: "通过内容边界" };
}

function laneFor(item, creatorRecentCounts, now) {
  const ageDays = Math.max(0, (now - Number(item.pubTime || now)) / DAY);
  if (item.eventTag && ageDays <= 45) return "event_spotlight";
  if (!item.knownCreator && (creatorRecentCounts.get(item.upId) || 0) >= 2 && ageDays <= 90) return "new_creator_watch";
  if (ageDays <= 30 && item.score >= 68) return "weekly_hot";
  if (ageDays <= 90 && item.score >= 55 && item.play < 100000) return "hidden_gem";
  return "archive";
}

export function applyCreationPolicy({ candidates, classifications, metrics = {}, knownUpIds = [], now = Date.now() }) {
  const known = new Set(knownUpIds.map(String));
  const prepared = [];
  const creatorRecentCounts = new Map();

  for (const candidate of candidates) {
    const classification = classifications[candidate.bvid || candidate.id];
    if (!classification) continue;
    const ageDays = Math.max(0, (now - Number(candidate.pubTime || now)) / DAY);
    const stats = latestStats(candidate, metrics[candidate.bvid || candidate.id]);
    const item = {
      ...candidate,
      ...classification,
      play: stats.play,
      stats,
      ageDays,
      velocity: velocity(candidate, metrics[candidate.bvid || candidate.id], now),
      interactionRate: interactionRate(stats),
      knownCreator: known.has(String(candidate.upId || "")),
    };
    prepared.push(item);
    if (ageDays <= 90 && classification.relevance === "related" && ['secondary_creation', 'character_or_lore'].includes(classification.contentNature)) {
      creatorRecentCounts.set(String(candidate.upId || ""), (creatorRecentCounts.get(String(candidate.upId || "")) || 0) + 1);
    }
  }

  const velocities = prepared.map((item) => item.velocity);
  const interactions = prepared.map((item) => item.interactionRate);
  const items = prepared.map((item) => {
    const gate = policyGate(item);
    const score = Math.round(
      originalityScore(item) +
      percentileRank(velocities, item.velocity) * 20 +
      percentileRank(interactions, item.interactionRate) * 20 +
      freshnessScore(item.ageDays) +
      (item.knownCreator ? 0 : 10) +
      (item.eventTag ? 5 : 0),
    );
    const risks = new Set(item.riskFlags || []);
    const strongOriginality = item.contentNature === "character_or_lore" || ["original", "deep_adaptation"].includes(item.originality);
    let status = "rejected";
    let policyReason = gate.reason;
    if (gate.eligible && item.confidence >= 0.85 && strongOriginality && score >= 60 && !risks.has("uncertain")) {
      status = "approved";
      policyReason = "高置信原创内容，达到自动发布线";
    } else if (gate.eligible && score >= 45) {
      status = "review";
      policyReason = strongOriginality ? "内容可收录，但需人工复核分类或风险" : "疑似轻度剪辑，需人工确认原创性";
    }
    const result = { ...item, score, status, policyReason };
    return { ...result, lane: status === "approved" ? laneFor(result, creatorRecentCounts, now) : null };
  });

  const byStatus = (status) => items.filter((item) => item.status === status);
  const lanes = Object.fromEntries(
    ["event_spotlight", "weekly_hot", "hidden_gem", "new_creator_watch", "archive"].map((lane) => [
      lane,
      items.filter((item) => item.status === "approved" && item.lane === lane).sort((a, b) => b.score - a.score || b.play - a.play).map((item) => item.bvid || item.id),
    ]),
  );
  return {
    items,
    approved: byStatus("approved").sort((a, b) => b.score - a.score || b.play - a.play),
    review: byStatus("review").sort((a, b) => b.score - a.score || b.play - a.play),
    rejected: byStatus("rejected"),
    lanes,
    summary: {
      total: items.length,
      approved: byStatus("approved").length,
      review: byStatus("review").length,
      rejected: byStatus("rejected").length,
    },
  };
}
