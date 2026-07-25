import fs from "node:fs/promises";
import path from "node:path";
import { formatRelative } from "@/lib/aggregate";
import type { ContentType, Snapshot, UpVideo } from "@/lib/types";

const OFFICIAL_UID = "98627270";
const REMIX_UID = "13921096";

export interface AtlasItem {
  id: string;
  title: string;
  subtitle: string;
  cover: string;
  url: string;
  play?: number;
  badge?: string;
  summary?: string;
  meta?: string;
  durationLabel?: string;
  publishedLabel?: string;
}

export interface OfficialAtlasItem extends AtlasItem {
  ep: number;
  arc: string;
}

export interface OfficialPreviewAtlasItem extends AtlasItem {
  ep: number | null;
  publishedAt: number;
}

export interface AnalysisAtlasItem extends AtlasItem {
  ep: number | null;
  episodes: number[];
  upId: string;
  upName: string;
  publishedAt: number;
  contentType: ContentType | "creation" | "other";
  category?: string;
  characters: string[];
  aiLabel: "AI 生成" | "AI 辅助" | null;
}

export interface CreationMetrics {
  like: number;
  coin: number;
  favorite: number;
  reply: number;
  danmaku: number;
  growth: number;
  engagementRate: number;
}

export interface CreationAtlasItem extends AtlasItem {
  category: string;
  upId: string;
  upName: string;
  publishedAt: number;
  firstSeenAt: number;
  lane: string | null;
  score: number;
  recommendationLabel: string;
  recommendationReasons: string[];
  characters: string[];
  episodes: number[];
  aiLabel: "AI 生成" | "AI 辅助" | null;
  eventTag: string;
  metrics: CreationMetrics;
}

export interface StoryArc {
  key: string;
  label: string;
  start: number;
  end: number;
}

export type CreatorSource = "tracked" | "history" | "creation";

export interface CreatorProfile {
  id: string;
  name: string;
  aliases: string[];
  shareCode?: string;
  source: CreatorSource;
  sourceLabel: string;
  tags: string[];
  count: number;
  episodeCount: number;
  averagePlay: number;
  totalPlay: number;
  latestEpisode: number | null;
  latestPublishedAt: number;
  note?: string;
  profileUrl: string;
}

export interface AtlasSummary {
  currentEpisode: number | null;
  generatedLabel: string;
  storyArcs: StoryArc[];
  counts: {
    official: number;
    analysis: number;
    creations: number;
  };
}

export interface OfficialPayload {
  items: OfficialAtlasItem[];
  previews: OfficialPreviewAtlasItem[];
}

export interface AnalysisPayload {
  archive: AnalysisAtlasItem[];
  creators: CreatorProfile[];
}

export interface CreationPayload {
  items: CreationAtlasItem[];
}

interface UpConfig {
  uid: string;
  name: string;
  tier?: "core" | "standard";
  shareCode?: string;
  alias?: string[];
  note?: string;
}

interface DiscoveredCreation {
  id: string;
  bvid?: string;
  title: string;
  description?: string;
  cover: string;
  url: string;
  upId: string;
  upName: string;
  play: number;
  pubTime: number;
  category: string;
  confidence: number;
  lane?: string | null;
  score?: number;
  firstSeenAt?: number;
  classificationReason?: string;
  eventTag?: string;
  originality?: string;
}

interface CreationIndex {
  items?: DiscoveredCreation[];
}

interface CreationMetricEntry {
  latest?: {
    play?: number;
    like?: number;
    coin?: number;
    favorite?: number;
    reply?: number;
    danmaku?: number;
  };
  samples?: Array<{ sampledAt: number; stats: { play?: number } }>;
}

interface CreationMetricsIndex {
  items?: Record<string, CreationMetricEntry>;
}

interface AtlasSources {
  snapshot: Snapshot;
  upConfigs: UpConfig[];
  discoveredCreations: DiscoveredCreation[];
  creationMetrics: Record<string, CreationMetricEntry>;
}

export const STORY_ARCS: StoryArc[] = [
  { key: "tiannan", label: "风起天南", start: 1, end: 17 },
  { key: "yanjiabao", label: "燕家堡之战", start: 18, end: 21 },
  { key: "modao", label: "魔道争锋", start: 22, end: 46 },
  { key: "farewell", label: "再别天南", start: 47, end: 60 },
  { key: "xinghai-entry", label: "初入星海", start: 61, end: 72 },
  { key: "xinghai-prelude", label: "星海飞驰序章", start: 73, end: 76 },
  { key: "xinghai", label: "星海飞驰", start: 77, end: 124 },
  { key: "outer-sea", label: "外海风云", start: 125, end: 152 },
  { key: "return", label: "重返天南", start: 153, end: 176 },
  { key: "mulan", label: "慕兰之战", start: 177, end: 182 },
];

let sourcesPromise: Promise<AtlasSources> | null = null;

async function readJson<T>(name: string): Promise<T> {
  const file = path.join(process.cwd(), "data", name);
  return JSON.parse(await fs.readFile(file, "utf8")) as T;
}

async function loadSources(): Promise<AtlasSources> {
  if (!sourcesPromise) {
    sourcesPromise = Promise.all([
      readJson<Snapshot>("snapshot.json"),
      readJson<UpConfig[]>("ups.json"),
      readJson<CreationIndex>("creations.json"),
      readJson<CreationMetricsIndex>("creation-metrics.json"),
    ]).then(([snapshot, upConfigs, creations, metrics]) => ({
      snapshot,
      upConfigs,
      discoveredCreations: (creations.items || []).filter((item) => item.confidence >= 0.5),
      creationMetrics: metrics.items || {},
    }));
  }
  return sourcesPromise;
}

function currentEpisodeOf(snapshot: Snapshot) {
  const currentEpisode = Number.parseInt(snapshot.official.newEp?.title || "", 10);
  return Number.isFinite(currentEpisode) ? currentEpisode : null;
}

function buildVisibleStoryArcs(currentEpisode: number | null): StoryArc[] {
  if (currentEpisode == null) return [];
  const lastArcIndex = STORY_ARCS.length - 1;
  return STORY_ARCS
    .map((arc, index) => {
      const effectiveEnd = index === lastArcIndex ? Math.max(arc.end, currentEpisode) : arc.end;
      return { ...arc, end: Math.min(effectiveEnd, currentEpisode) };
    })
    .filter((arc) => arc.start <= currentEpisode);
}

function formatDuration(duration?: number) {
  if (!duration) return "完整正片";
  const totalSeconds = Math.round(duration / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatPublished(pubTime: number | null) {
  if (!pubTime) return "已上线";
  const date = new Date(pubTime);
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日上线`;
}

function creationCategory(video: UpVideo) {
  if (video.creationCategory) return video.creationCategory;
  if (video.contentType === "character" || /人物志|人物传|角色志|角色解析/.test(video.title)) return "人物志";
  if (/手书|混剪|AMV|MAD|燃向|踩点|影视剪辑/.test(video.title)) return "混剪手书";
  if (/翻唱|原创曲|主题曲|配音|广播剧|有声/.test(video.title)) return "音乐配音";
  if (/同人画|绘画|临摹|自制建模|建模作品|MMD|COS|自制动画|定格/.test(video.title)) return "同人创作";
  if (/改编|凡人版|仙剑版|小剧场|短剧|剧情二创/.test(video.title)) return "剧情二创";
  return "趣味整活";
}

function analysisLabels(video: UpVideo) {
  if (video.contentType === "episode" && video.ep != null) {
    return { subtitle: `第 ${video.ep} 话解析`, badge: `第 ${video.ep} 话` };
  }
  if (video.contentType === "character") return { subtitle: "人物志", badge: "人物志" };
  if (video.contentType === "compilation") return { subtitle: "多集拉片", badge: "合集" };
  if (video.contentType === "topic") return { subtitle: "深度专题", badge: "专题" };
  if (video.contentType === "pv" || video.contentType === "episode-preview") return { subtitle: "PV 物料", badge: "物料" };
  return { subtitle: "凡人相关", badge: "收录" };
}

function recommendationLabel(lane?: string | null) {
  if (lane === "weekly_hot") return "本周热门";
  if (lane === "new_creator_watch") return "新人发现";
  if (lane === "hidden_gem") return "沧海遗珠";
  if (lane === "event_spotlight") return "活动专题";
  if (lane === "archive") return "经典归档";
  return "编辑推荐";
}

function inferEpisodes(text: string, currentEpisode: number | null) {
  const episodes = new Set<number>();
  const matcher = /(?:第\s*)?(\d{1,3})\s*[集话]|EP\s*0*(\d{1,3})|\bE0*(\d{1,3})\b/gi;
  for (const match of text.matchAll(matcher)) {
    const episode = Number.parseInt(match[1] || match[2] || match[3] || "", 10);
    if (Number.isFinite(episode) && episode > 0 && (currentEpisode == null || episode <= currentEpisode + 2)) episodes.add(episode);
  }
  return Array.from(episodes).sort((a, b) => b - a);
}

function inferCharacters(text: string, characters: string[] = []) {
  const normalized = text.normalize("NFKC");
  return characters
    .filter((character) => character.length >= 2 && normalized.includes(character))
    .filter((character, index, values) => values.findIndex((item) => item === character) === index)
    .slice(0, 8);
}

function inferAiLabel(text: string): "AI 生成" | "AI 辅助" | null {
  if (/AI\s*(生成|自制|绘画|动画|视频|配音|翻唱|换脸)|AIGC|文生图|图生视频/i.test(text)) return "AI 生成";
  if (/AI\s*(辅助|协作|润色)|人工智能辅助/i.test(text)) return "AI 辅助";
  return null;
}

function metricsFor(sources: AtlasSources, id: string, fallbackPlay = 0): CreationMetrics {
  const entry = sources.creationMetrics[id];
  const latest = entry?.latest || {};
  const samples = entry?.samples || [];
  const play = latest.play || fallbackPlay || 0;
  const firstPlay = samples[0]?.stats.play || play;
  const latestPlay = samples.at(-1)?.stats.play || play;
  const interactions = (latest.like || 0) + (latest.coin || 0) + (latest.favorite || 0);
  return {
    like: latest.like || 0,
    coin: latest.coin || 0,
    favorite: latest.favorite || 0,
    reply: latest.reply || 0,
    danmaku: latest.danmaku || 0,
    growth: Math.max(0, latestPlay - firstPlay),
    engagementRate: play > 0 ? interactions / play : 0,
  };
}

function recommendationReasons(item: DiscoveredCreation, metrics: CreationMetrics, generatedAt: number) {
  const reasons: string[] = [];
  const age = Math.max(0, generatedAt - (item.pubTime || 0));
  if (age <= 36 * 60 * 60 * 1000) reasons.push("36 小时新作");
  if (item.lane === "new_creator_watch") reasons.push("新作者值得关注");
  if (item.lane === "hidden_gem") reasons.push("高口碑沧海遗珠");
  if (item.lane === "weekly_hot") reasons.push("本周热度上升");
  if (item.lane === "event_spotlight") reasons.push(item.eventTag || "活动专题推荐");
  if (metrics.growth >= 10000) reasons.push("近期增长明显");
  if (metrics.engagementRate >= 0.08) reasons.push("互动率突出");
  if (metrics.reply >= 300) reasons.push(`${formatCompactNumber(metrics.reply)} 条讨论`);
  if (!reasons.length) reasons.push(item.classificationReason || "编辑筛选入藏");
  return Array.from(new Set(reasons)).slice(0, 3);
}

function formatCompactNumber(value: number) {
  if (value >= 10000) return `${(value / 10000).toFixed(value >= 100000 ? 0 : 1)}万`;
  return String(value);
}

function buildOfficial(sources: AtlasSources): OfficialPayload {
  const currentEpisode = currentEpisodeOf(sources.snapshot);
  const storyArcs = buildVisibleStoryArcs(currentEpisode);
  const officialByEpisode = new Map<number, Snapshot["official"]["episodes"][number]>();
  for (const episode of sources.snapshot.official.episodes) {
    if (episode.ep && currentEpisode != null && episode.ep <= currentEpisode) officialByEpisode.set(episode.ep, episode);
  }

  const items = Array.from(officialByEpisode.values())
    .sort((a, b) => (b.ep || 0) - (a.ep || 0))
    .map((episode): OfficialAtlasItem => {
      const arc = storyArcs.find((item) => episode.ep! >= item.start && episode.ep! <= item.end);
      return {
        id: `official-${episode.ep}`,
        ep: episode.ep!,
        arc: arc?.key || storyArcs.at(-1)?.key || "",
        title: `第 ${episode.ep} 话`,
        subtitle: "哔哩哔哩国创 · 独播",
        summary: episode.longTitle || `《凡人修仙传》第 ${episode.ep} 话官方正片`,
        meta: arc?.label || "官方剧集",
        durationLabel: formatDuration(episode.duration),
        publishedLabel: formatPublished(episode.pubTime),
        cover: episode.cover || sources.snapshot.official.cover,
        url: episode.playUrl || sources.snapshot.series.officialUrl,
        badge: episode.ep === currentEpisode ? "最新" : undefined,
      };
    });
  const upPreviews = sources.snapshot.ups
    .find((up) => String(up.uid) === OFFICIAL_UID)?.videos
    .filter((video) => video.contentType === "episode-preview")
    .map((video): OfficialPreviewAtlasItem => ({
      id: `preview-${video.bvid}`,
      ep: video.ep,
      publishedAt: video.pubTime || 0,
      title: video.ep ? `第 ${video.ep} 话预告` : "官方预告",
      subtitle: "哔哩哔哩国创 · 独家预告",
      summary: video.title,
      meta: video.ep && currentEpisode != null && video.ep > currentEpisode ? "下回预告" : "历史预告",
      publishedLabel: formatPublished(video.pubTime),
      cover: video.cover || sources.snapshot.official.cover,
      url: video.videoUrl,
      play: video.play || 0,
      badge: video.ep && currentEpisode != null && video.ep > currentEpisode ? "待播" : "预告",
    })) || [];
  const previewByEpisode = new Map<string, OfficialPreviewAtlasItem>();
  for (const preview of upPreviews) {
    previewByEpisode.set(preview.ep ? `ep-${preview.ep}` : preview.id, preview);
  }
  for (const episode of sources.snapshot.official.episodes) {
    if (
      !episode.ep ||
      currentEpisode == null ||
      episode.ep <= currentEpisode ||
      !episode.duration ||
      episode.duration >= 5 * 60 * 1000
    ) {
      continue;
    }
    const key = `ep-${episode.ep}`;
    if (previewByEpisode.has(key)) continue;
    previewByEpisode.set(key, {
      id: `season-preview-${episode.ep}`,
      ep: episode.ep,
      publishedAt: episode.pubTime || 0,
      title: `第 ${episode.ep} 话预告`,
      subtitle: "哔哩哔哩 · 番剧先导",
      summary: episode.longTitle
        ? `《凡人修仙传》${episode.longTitle}官方预告`
        : `《凡人修仙传》第 ${episode.ep} 话官方预告`,
      meta: "下回预告",
      publishedLabel: formatPublished(episode.pubTime),
      cover: episode.cover || sources.snapshot.official.cover,
      url: episode.playUrl || sources.snapshot.series.officialUrl,
      badge: "待播",
    });
  }
  const previews = Array.from(previewByEpisode.values())
    .sort((a, b) => (b.ep || 0) - (a.ep || 0) || b.publishedAt - a.publishedAt)
    .slice(0, 12);
  return { items, previews };
}

function creatorTags(items: AnalysisAtlasItem[]) {
  const tags = new Set<string>();
  for (const item of items) {
    if (item.contentType === "episode") tags.add("逐集解析");
    else if (item.contentType === "topic") tags.add("深度专题");
    else if (item.contentType === "character") tags.add("人物专题");
    else if (item.contentType === "compilation") tags.add("多集拉片");
    else if (item.contentType === "pv" || item.contentType === "episode-preview") tags.add("PV 物料");
    else if (item.contentType === "chat") tags.add("资讯杂谈");
    if (item.category) tags.add(item.category);
  }
  return Array.from(tags).slice(0, 5);
}

function buildAnalysis(sources: AtlasSources): AnalysisPayload {
  const configMap = new Map(sources.upConfigs.map((up) => [String(up.uid), up]));
  const archiveMap = new Map<string, AnalysisAtlasItem>();
  const profileSeed = new Map<string, { name: string; aliases: string[]; note: string; inSnapshot: boolean }>();

  for (const up of sources.snapshot.ups) {
    if (String(up.uid) === OFFICIAL_UID) continue;
    profileSeed.set(String(up.uid), {
      name: up.name,
      aliases: up.alias || [],
      note: up.note || "",
      inSnapshot: true,
    });
    for (const video of up.videos) {
      const labels = analysisLabels(video);
      const sourceText = `${video.title}\n${video.description || ""}`;
      archiveMap.set(video.bvid, {
        id: video.bvid,
        ep: video.contentType === "episode" ? video.ep : null,
        episodes: video.ep != null ? [video.ep] : inferEpisodes(sourceText, currentEpisodeOf(sources.snapshot)),
        upId: String(up.uid),
        upName: up.name,
        publishedAt: video.pubTime || 0,
        contentType: video.contentType || "other",
        category: video.contentType === "character" ? "人物志" : undefined,
        characters: video.characters?.length ? video.characters : inferCharacters(sourceText, sources.snapshot.series.characters),
        aiLabel: inferAiLabel(sourceText),
        title: video.title,
        subtitle: `${up.name} · ${labels.subtitle}`,
        cover: video.cover,
        url: video.videoUrl,
        play: video.play || 0,
        badge: labels.badge,
      });
    }
  }

  for (const item of sources.discoveredCreations) {
    const upId = String(item.upId);
    const sourceText = `${item.title}\n${item.description || ""}`;
    if (!profileSeed.has(upId)) {
      profileSeed.set(upId, { name: item.upName, aliases: [], note: "", inSnapshot: false });
    }
    if (!archiveMap.has(item.id)) {
      archiveMap.set(item.id, {
        id: item.id,
        ep: null,
        episodes: inferEpisodes(sourceText, currentEpisodeOf(sources.snapshot)),
        upId,
        upName: item.upName,
        publishedAt: item.pubTime || 0,
        contentType: "creation",
        category: item.category,
        characters: inferCharacters(sourceText, sources.snapshot.series.characters),
        aiLabel: inferAiLabel(sourceText),
        title: item.title,
        subtitle: `${item.upName} · ${item.category}`,
        cover: item.cover,
        url: item.url,
        play: item.play || 0,
        badge: item.category,
      });
    }
  }

  const archive = Array.from(archiveMap.values()).sort((a, b) => b.publishedAt - a.publishedAt || (b.play || 0) - (a.play || 0));
  const itemsByCreator = new Map<string, AnalysisAtlasItem[]>();
  for (const item of archive) {
    if (!itemsByCreator.has(item.upId)) itemsByCreator.set(item.upId, []);
    itemsByCreator.get(item.upId)!.push(item);
  }

  const creators = Array.from(profileSeed.entries()).map(([id, seed]): CreatorProfile => {
    const items = itemsByCreator.get(id) || [];
    const config = configMap.get(id);
    const episodeItems = items.filter((item) => item.contentType === "episode" && item.ep != null);
    const episodeNumbers = new Set(episodeItems.map((item) => item.ep as number));
    const totalPlay = items.reduce((sum, item) => sum + (item.play || 0), 0);
    const source: CreatorSource = config ? "tracked" : seed.inSnapshot ? "history" : "creation";
    const sourceLabel = source === "tracked" ? "常驻追踪" : source === "history" ? "历史发现" : "二创作者";
    return {
      id,
      name: seed.name || config?.name || id,
      aliases: Array.from(new Set([...(seed.aliases || []), ...(config?.alias || [])])),
      shareCode: config?.shareCode,
      source,
      sourceLabel,
      tags: creatorTags(items),
      count: items.length,
      episodeCount: episodeNumbers.size,
      averagePlay: items.length ? Math.round(totalPlay / items.length) : 0,
      totalPlay,
      latestEpisode: episodeNumbers.size ? Math.max(...episodeNumbers) : null,
      latestPublishedAt: items[0]?.publishedAt || 0,
      note: config?.note || seed.note,
      profileUrl: `https://space.bilibili.com/${id}`,
    };
  }).sort((a, b) => {
    const sourceOrder = { tracked: 0, history: 1, creation: 2 };
    return sourceOrder[a.source] - sourceOrder[b.source] || b.latestPublishedAt - a.latestPublishedAt || b.count - a.count;
  });

  return { archive, creators };
}

function buildCreations(sources: AtlasSources): CreationPayload {
  const creatorVideos = sources.snapshot.ups
    .filter((up) => String(up.uid) !== OFFICIAL_UID)
    .flatMap((up) => up.videos.map((video) => ({ up, video })));

  const snapshotCreations: CreationAtlasItem[] = creatorVideos
    .filter(({ up, video }) =>
      video.contentType === "character" ||
      String(up.uid) === REMIX_UID ||
      (/二创|手书|混剪|鬼畜|凡人版|人物志/.test(video.title) && video.contentType !== "episode")
    )
    .map(({ up, video }) => {
      const sourceText = `${video.title}\n${video.description || ""}`;
      const metrics = metricsFor(sources, video.bvid, video.play || 0);
      return {
        id: video.bvid,
        category: creationCategory(video),
        upId: String(up.uid),
        upName: up.name,
        publishedAt: video.pubTime || 0,
        firstSeenAt: video.pubTime || 0,
        lane: null,
        score: 0,
        recommendationLabel: "历史收录",
        recommendationReasons: ["历史优质内容"],
        characters: video.characters?.length ? video.characters : inferCharacters(sourceText, sources.snapshot.series.characters),
        episodes: video.ep != null ? [video.ep] : inferEpisodes(sourceText, currentEpisodeOf(sources.snapshot)),
        aiLabel: inferAiLabel(sourceText),
        eventTag: "",
        metrics,
        title: video.title,
        subtitle: `${up.name} · 历史收录`,
        summary: "历史内容归档，适合回看与补藏。",
        cover: video.cover,
        url: video.videoUrl,
        play: video.play || 0,
        badge: creationCategory(video),
      };
    });

  const creationMap = new Map(snapshotCreations.map((item) => [item.id, item]));
  for (const item of sources.discoveredCreations) {
    const label = recommendationLabel(item.lane);
    const sourceText = `${item.title}\n${item.description || ""}`;
    const metrics = metricsFor(sources, item.id, item.play || 0);
    const reasons = recommendationReasons(item, metrics, sources.snapshot.generatedAt);
    creationMap.set(item.id, {
      id: item.id,
      category: item.category,
      upId: String(item.upId),
      upName: item.upName,
      publishedAt: item.pubTime || 0,
      firstSeenAt: item.firstSeenAt || item.pubTime || 0,
      lane: item.lane || null,
      score: item.score || 0,
      recommendationLabel: label,
      recommendationReasons: reasons,
      characters: inferCharacters(sourceText, sources.snapshot.series.characters),
      episodes: inferEpisodes(sourceText, currentEpisodeOf(sources.snapshot)),
      aiLabel: inferAiLabel(sourceText),
      eventTag: item.eventTag || "",
      metrics,
      title: item.title,
      subtitle: `${item.upName} · ${label}`,
      summary: reasons.join(" · "),
      cover: item.cover,
      url: item.url,
      play: sources.creationMetrics[item.id]?.latest?.play || item.play || 0,
      badge: item.category,
    });
  }
  return { items: Array.from(creationMap.values()) };
}

export async function getAtlasSummary(): Promise<AtlasSummary | null> {
  try {
    const sources = await loadSources();
    const currentEpisode = currentEpisodeOf(sources.snapshot);
    const official = buildOfficial(sources);
    const analysis = buildAnalysis(sources);
    const creations = buildCreations(sources);
    return {
      currentEpisode,
      generatedLabel: `${formatRelative(sources.snapshot.generatedAt)}巡检`,
      storyArcs: buildVisibleStoryArcs(currentEpisode),
      counts: {
        official: official.items.length,
        analysis: analysis.archive.length,
        creations: creations.items.length,
      },
    };
  } catch {
    return null;
  }
}

export async function getOfficialPayload() {
  return buildOfficial(await loadSources());
}

export async function getAnalysisPayload() {
  return buildAnalysis(await loadSources());
}

export async function getCreationPayload() {
  return buildCreations(await loadSources());
}
