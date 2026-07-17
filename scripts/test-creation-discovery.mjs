import assert from "node:assert/strict";
import { applyCreationPolicy } from "./creation-policy.mjs";

const now = Date.UTC(2026, 6, 17, 0, 0, 0);
const candidate = (id, upId, daysAgo, play = 50000) => ({
  id,
  bvid: id,
  title: `测试作品 ${id}`,
  description: "",
  cover: "https://example.com/cover.jpg",
  url: `https://www.bilibili.com/video/${id}`,
  upId,
  upName: `UP ${upId}`,
  play,
  pubTime: now - daysAgo * 86400000,
});
const classification = (overrides = {}) => ({
  relevance: "related",
  contentNature: "secondary_creation",
  creationType: "剧情二创",
  originality: "original",
  eventTag: null,
  creatorPotential: "observe",
  confidence: 0.92,
  riskFlags: [],
  reason: "测试",
  source: "model",
  ...overrides,
});

const candidates = [
  candidate("BVepisode", "known", 2, 500000),
  candidate("BVoriginal", "new-a", 3, 80000),
  candidate("BVambiguous", "known", 5, 60000),
  candidate("BVnew1", "new-b", 8, 45000),
  candidate("BVnew2", "new-b", 12, 38000),
];
const classifications = {
  BVepisode: classification({ contentNature: "episode_analysis", originality: "unknown", riskFlags: ["episode_analysis"] }),
  BVoriginal: classification(),
  BVambiguous: classification({ originality: "light_edit", confidence: 0.78, riskFlags: ["uncertain"] }),
  BVnew1: classification({ creationType: "同人创作", originality: "deep_adaptation" }),
  BVnew2: classification({ creationType: "混剪手书", originality: "deep_adaptation" }),
};
const metrics = Object.fromEntries(candidates.map((item, index) => [
  item.bvid,
  {
    latest: { play: item.play, like: 3000 - index * 200, coin: 600, favorite: 800, reply: 100, danmaku: 300 },
    samples: [{ sampledAt: now, stats: { play: item.play, like: 3000 - index * 200, coin: 600, favorite: 800, reply: 100, danmaku: 300 } }],
  },
]));

const result = applyCreationPolicy({ candidates, classifications, metrics, knownUpIds: ["known"], now });
const byId = new Map(result.items.map((item) => [item.bvid, item]));

assert.equal(byId.get("BVepisode").status, "rejected", "逐集解析不能因高播放量被发布");
assert.equal(byId.get("BVoriginal").status, "approved", "高置信原创二创应自动发布");
assert.equal(byId.get("BVambiguous").status, "review", "轻剪辑且不确定的内容应进入复核");
assert.equal(byId.get("BVnew1").lane, "new_creator_watch", "同一新 UP 的连续作品应进入新人观察");
assert.equal(byId.get("BVnew2").lane, "new_creator_watch", "同一新 UP 的连续作品应进入新人观察");
assert.equal(result.summary.total, candidates.length);

console.log("creation policy tests passed");
