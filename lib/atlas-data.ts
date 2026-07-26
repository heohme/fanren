import fs from "node:fs/promises";
import path from "node:path";
import { formatRelative } from "@/lib/aggregate";
import type { ContentType, Snapshot, UpVideo } from "@/lib/types";

const OFFICIAL_UID = "98627270";

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
  contentForm: ContentForm;
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
  contentForm: ContentForm;
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

export type ContentForm =
  | "official_episode"
  | "official_preview"
  | "official_material"
  | "episode_analysis"
  | "episode_commentary"
  | "adaptation_analysis"
  | "character_analysis"
  | "lore_analysis"
  | "reaction"
  | "story_remix"
  | "humor"
  | "remix"
  | "music_voice"
  | "fan_creation"
  | "compilation"
  | "other";

type ContentSource = "official-season" | "tracked-up" | "episode-search" | "creation-discovery";

interface UnifiedContentItem {
  id: string;
  bvid: string | null;
  title: string;
  description: string;
  cover: string;
  url: string;
  upId: string;
  upName: string;
  publishedAt: number;
  firstSeenAt: number;
  duration: string | number | null;
  durationMs: number | null;
  play: number;
  episode: number | null;
  episodes: number[];
  characters: string[];
  aiLabel: "AI 生成" | "AI 辅助" | null;
  contentType: ContentType | "creation" | "other";
  contentForm: ContentForm;
  category: string;
  sourceKinds: ContentSource[];
  isTrackedCreator: boolean;
  showInRighteous: boolean;
  showInDemonic: boolean;
  recommendationEligible: boolean;
  lane: string | null;
  score: number;
  confidence: number;
  eventTag: string;
  classificationReason: string;
  metrics: CreationMetrics;
}

interface UnifiedContentPool {
  generatedAt: number;
  currentEpisode: number | null;
  currentCharacters: string[];
  items: UnifiedContentItem[];
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

function recommendationLabel(lane?: string | null) {
  if (lane === "episode_pick") return "本集热议";
  if (lane === "related_archive") return "旧作重看";
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

function formatCompactNumber(value: number) {
  if (value >= 10000) return `${(value / 10000).toFixed(value >= 100000 ? 0 : 1)}万`;
  return String(value);
}

function durationSeconds(value: string | number | null | undefined) {
  if (typeof value === "number") return value > 10000 ? Math.round(value / 1000) : value;
  const parts = String(value || "").split(":").map(Number);
  if (!parts.length || parts.some((part) => !Number.isFinite(part))) return 0;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

function contentFormForVideo(video: UpVideo, official = false): ContentForm {
  const text = `${video.title}\n${video.description || ""}`;
  if (official) {
    if (video.contentType === "episode-preview" || /预告|PV/i.test(video.title)) return "official_preview";
    if (video.contentType === "episode") return "official_episode";
    return "official_material";
  }
  if (/reaction|陪看|看《?凡人|看凡人/i.test(text)) return "reaction";
  if (/原著|动画.*改编|改编.*(?:分析|解析|讨论|精髓|对比)|超绝改编|文戏.*改编/i.test(text)) return "adaptation_analysis";
  if (
    video.contentType === "character" ||
    /人物志|人物传|角色志|个人向|情路.*赏析|人物.*(?:解析|赏析)|角色.*(?:解析|赏析)/i.test(text)
  ) return "character_analysis";
  if (video.contentType === "episode") {
    if (/逐帧|解析|解读|复盘|点评|细节|分析|拉片/i.test(text)) return "episode_analysis";
    return "episode_commentary";
  }
  if (video.contentType === "topic") return "lore_analysis";
  if (video.contentType === "compilation") return "compilation";
  if (/手书|混剪|AMV|MAD|燃向|踩点|影视剪辑/i.test(text)) return "remix";
  if (/翻唱|原创曲|主题曲|配音|广播剧|说唱/i.test(text)) return "music_voice";
  if (/同人画|绘画|临摹|自制建模|MMD|COS|自制动画|定格/i.test(text)) return "fan_creation";
  if (/改编|凡人版|小剧场|短剧|视角演绎/i.test(text)) return "story_remix";
  if (/鬼畜|恶搞|整活|搞笑|沙雕/i.test(text)) return "humor";
  return "other";
}

function contentFormForCreation(item: DiscoveredCreation): ContentForm {
  if (item.category === "人物志") return /改编|原著|动画.*对比/i.test(item.title) ? "adaptation_analysis" : "character_analysis";
  if (item.category === "剧情二创") return "story_remix";
  if (item.category === "趣味整活") return "humor";
  if (item.category === "混剪手书") return "remix";
  if (item.category === "音乐配音") return "music_voice";
  if (item.category === "同人创作") return "fan_creation";
  return "other";
}

function contentFormLabel(form: ContentForm) {
  const labels: Record<ContentForm, string> = {
    official_episode: "官方正片",
    official_preview: "官方预告",
    official_material: "官方物料",
    episode_analysis: "本集解析",
    episode_commentary: "剧情杂谈",
    adaptation_analysis: "改编讨论",
    character_analysis: "人物赏析",
    lore_analysis: "设定考据",
    reaction: "Reaction",
    story_remix: "剧情二创",
    humor: "趣味整活",
    remix: "混剪手书",
    music_voice: "音乐配音",
    fan_creation: "同人创作",
    compilation: "多集拉片",
    other: "其他内容",
  };
  return labels[form];
}

function legacyContentType(form: ContentForm, episode: number | null): ContentType | "creation" | "other" {
  if (["episode_analysis", "episode_commentary", "adaptation_analysis", "reaction"].includes(form) && episode != null) return "episode";
  if (form === "character_analysis") return "character";
  if (["adaptation_analysis", "lore_analysis"].includes(form)) return "topic";
  if (form === "compilation") return "compilation";
  if (["story_remix", "humor", "remix", "music_voice", "fan_creation"].includes(form)) return "creation";
  return "other";
}

function poolRecommendationScore({
  form,
  play,
  episode,
  currentEpisode,
  publishedAt,
  generatedAt,
  tracked,
}: {
  form: ContentForm;
  play: number;
  episode: number | null;
  currentEpisode: number | null;
  publishedAt: number;
  generatedAt: number;
  tracked: boolean;
}) {
  const formScore: Partial<Record<ContentForm, number>> = {
    episode_analysis: 18,
    episode_commentary: 17,
    adaptation_analysis: 22,
    character_analysis: 20,
    lore_analysis: 18,
    reaction: 14,
    story_remix: 20,
    humor: 14,
    remix: 18,
    music_voice: 18,
    fan_creation: 20,
  };
  const ageDays = Math.max(0, generatedAt - publishedAt) / 86400000;
  const freshness = ageDays <= 3 ? 12 : ageDays <= 14 ? 8 : ageDays <= 90 ? 4 : 0;
  const episodeBoost = episode != null && episode === currentEpisode ? 28 : 0;
  const playSignal = Math.min(14, Math.max(0, Math.log10(Math.max(1, play)) * 3 - 2));
  return Math.round((formScore[form] || 5) + freshness + episodeBoost + playSignal + (tracked ? 6 : 0));
}

const poolCache = new WeakMap<AtlasSources, UnifiedContentPool>();

function contentPoolFor(sources: AtlasSources): UnifiedContentPool {
  const cached = poolCache.get(sources);
  if (cached) return cached;

  const currentEpisode = currentEpisodeOf(sources.snapshot);
  const configMap = new Map(sources.upConfigs.map((up) => [String(up.uid), up]));
  const items = new Map<string, UnifiedContentItem>();
  const generatedAt = Math.max(
    sources.snapshot.generatedAt || 0,
    ...sources.discoveredCreations.map((item) => item.firstSeenAt || item.pubTime || 0),
  );

  for (const episode of sources.snapshot.official.episodes) {
    if (!episode.ep) continue;
    const futurePreview =
      currentEpisode != null &&
      episode.ep > currentEpisode &&
      Number(episode.duration || 0) > 0 &&
      Number(episode.duration || 0) < 5 * 60 * 1000;
    if (currentEpisode != null && episode.ep > currentEpisode && !futurePreview) continue;
    const form: ContentForm = futurePreview ? "official_preview" : "official_episode";
    const id = episode.bvid || `${form}-${episode.ep}`;
    items.set(id, {
      id,
      bvid: episode.bvid || null,
      title: form === "official_episode" ? `第 ${episode.ep} 话` : `第 ${episode.ep} 话预告`,
      description: episode.longTitle || `《凡人修仙传》第 ${episode.ep} 话`,
      cover: episode.cover || sources.snapshot.official.cover,
      url: episode.playUrl || sources.snapshot.series.officialUrl,
      upId: OFFICIAL_UID,
      upName: "哔哩哔哩国创",
      publishedAt: episode.pubTime || 0,
      firstSeenAt: episode.pubTime || 0,
      duration: episode.duration || null,
      durationMs: episode.duration || null,
      play: 0,
      episode: episode.ep,
      episodes: [episode.ep],
      characters: inferCharacters(episode.longTitle || "", sources.snapshot.series.characters),
      aiLabel: null,
      contentType: futurePreview ? "episode-preview" : "episode",
      contentForm: form,
      category: contentFormLabel(form),
      sourceKinds: ["official-season"],
      isTrackedCreator: true,
      showInRighteous: true,
      showInDemonic: false,
      recommendationEligible: false,
      lane: null,
      score: 0,
      confidence: 1,
      eventTag: "",
      classificationReason: "官方番剧数据",
      metrics: metricsFor(sources, id),
    });
  }

  for (const up of sources.snapshot.ups) {
    const isOfficial = String(up.uid) === OFFICIAL_UID;
    const tracked = configMap.has(String(up.uid));
    for (const video of up.videos) {
      const existing = items.get(video.bvid);
      if (existing && isOfficial) {
        existing.sourceKinds = Array.from(new Set([...existing.sourceKinds, "tracked-up"]));
        existing.play = Math.max(existing.play, video.play || 0);
        existing.metrics = metricsFor(sources, video.bvid, existing.play);
        continue;
      }
      const sourceText = `${video.title}\n${video.description || ""}`;
      const form = contentFormForVideo(video, isOfficial);
      const episodes = video.ep != null ? [video.ep] : inferEpisodes(sourceText, currentEpisode);
      const characters = video.characters?.length
        ? video.characters
        : inferCharacters(sourceText, sources.snapshot.series.characters);
      const sourceKind: ContentSource = tracked ? "tracked-up" : "episode-search";
      const explicitEditorialValue = /解析|逐帧|漫谈|杂谈|reaction|改编|赏析|人物志|深度|点评|观后感|考据|混剪|手书|配音|翻唱/i.test(sourceText);
      const substantial = durationSeconds(video.duration) >= 5 * 60 && (video.play || 0) >= 3000;
      const unsafe = /完整版|高清版|无水印|在线观看|网盘|一口气看完|完整剧情/i.test(sourceText);
      const recommendationEligible =
        !isOfficial &&
        !unsafe &&
        !["other", "compilation"].includes(form) &&
        (tracked || explicitEditorialValue || substantial);
      const score = poolRecommendationScore({
        form,
        play: video.play || 0,
        episode: video.ep,
        currentEpisode,
        publishedAt: video.pubTime || 0,
        generatedAt,
        tracked,
      });
      items.set(video.bvid, {
        id: video.bvid,
        bvid: video.bvid,
        title: video.title,
        description: video.description || "",
        cover: video.cover,
        url: video.videoUrl,
        upId: String(up.uid),
        upName: up.name,
        publishedAt: video.pubTime || 0,
        firstSeenAt: video.pubTime || 0,
        duration: video.duration || null,
        durationMs: null,
        play: video.play || 0,
        episode: video.ep,
        episodes,
        characters,
        aiLabel: inferAiLabel(sourceText),
        contentType: video.contentType || legacyContentType(form, video.ep),
        contentForm: form,
        category: contentFormLabel(form),
        sourceKinds: [sourceKind],
        isTrackedCreator: tracked,
        showInRighteous: isOfficial,
        showInDemonic: !isOfficial,
        recommendationEligible,
        lane: null,
        score,
        confidence: video.classificationConfidence || (tracked ? 0.9 : 0.7),
        eventTag: "",
        classificationReason: tracked ? "常驻作者内容" : "分集搜索发现",
        metrics: metricsFor(sources, video.bvid, video.play || 0),
      });
    }
  }

  for (const creation of sources.discoveredCreations) {
    const existing = items.get(creation.id);
    const sourceText = `${creation.title}\n${creation.description || ""}`;
    const form = contentFormForCreation(creation);
    const episodes = inferEpisodes(sourceText, currentEpisode);
    const characters = inferCharacters(sourceText, sources.snapshot.series.characters);
    const metrics = metricsFor(sources, creation.id, creation.play || 0);
    const incomingScore = creation.score || poolRecommendationScore({
      form,
      play: metrics.like ? sources.creationMetrics[creation.id]?.latest?.play || creation.play : creation.play,
      episode: episodes[0] || null,
      currentEpisode,
      publishedAt: creation.pubTime || 0,
      generatedAt,
      tracked: configMap.has(String(creation.upId)),
    });
    items.set(creation.id, {
      id: creation.id,
      bvid: creation.bvid || creation.id,
      title: creation.title,
      description: creation.description || existing?.description || "",
      cover: creation.cover || existing?.cover || "",
      url: creation.url || existing?.url || `https://www.bilibili.com/video/${creation.id}`,
      upId: String(creation.upId || existing?.upId || ""),
      upName: creation.upName || existing?.upName || "",
      publishedAt: creation.pubTime || existing?.publishedAt || 0,
      firstSeenAt: creation.firstSeenAt || existing?.firstSeenAt || creation.pubTime || 0,
      duration: existing?.duration || null,
      durationMs: existing?.durationMs || null,
      play: sources.creationMetrics[creation.id]?.latest?.play || creation.play || existing?.play || 0,
      episode: episodes[0] || existing?.episode || null,
      episodes: Array.from(new Set([...episodes, ...(existing?.episodes || [])])).sort((a, b) => b - a),
      characters: Array.from(new Set([...characters, ...(existing?.characters || [])])).slice(0, 8),
      aiLabel: inferAiLabel(sourceText) || existing?.aiLabel || null,
      contentType: "creation",
      contentForm: form,
      category: contentFormLabel(form),
      sourceKinds: Array.from(new Set([...(existing?.sourceKinds || []), "creation-discovery"])),
      isTrackedCreator: configMap.has(String(creation.upId)) || existing?.isTrackedCreator || false,
      showInRighteous: false,
      showInDemonic: true,
      recommendationEligible: true,
      lane: creation.lane || existing?.lane || null,
      score: incomingScore,
      confidence: creation.confidence,
      eventTag: creation.eventTag || "",
      classificationReason: creation.classificationReason || "二创发现策略入选",
      metrics,
    });
  }

  const currentCharacters = Array.from(new Set(
    Array.from(items.values())
      .filter((item) => item.episode === currentEpisode)
      .flatMap((item) => item.characters),
  ));

  for (const item of items.values()) {
    if (!item.recommendationEligible) continue;
    const relatedCharacters = item.episode !== currentEpisode
      ? item.characters.filter((character) => currentCharacters.includes(character))
      : [];
    if (relatedCharacters.length && ["character_analysis", "adaptation_analysis", "lore_analysis"].includes(item.contentForm)) {
      if (!item.lane) item.lane = "related_archive";
      item.score += 12;
    } else if (item.episode === currentEpisode && !item.lane) {
      item.lane = item.isTrackedCreator ? "episode_pick" : "new_creator_watch";
    }
  }

  const pool = {
    generatedAt,
    currentEpisode,
    currentCharacters,
    items: Array.from(items.values()).sort((a, b) => b.publishedAt - a.publishedAt || b.play - a.play),
  };
  poolCache.set(sources, pool);
  return pool;
}

function buildOfficial(sources: AtlasSources): OfficialPayload {
  const pool = contentPoolFor(sources);
  const currentEpisode = pool.currentEpisode;
  const storyArcs = buildVisibleStoryArcs(currentEpisode);
  const officialByEpisode = new Map<number, UnifiedContentItem>();
  for (const item of pool.items.filter((content) => content.showInRighteous && content.contentForm === "official_episode" && content.episode != null)) {
    const previous = officialByEpisode.get(item.episode!);
    if (!previous || (item.durationMs || 0) > (previous.durationMs || 0)) officialByEpisode.set(item.episode!, item);
  }
  const items = Array.from(officialByEpisode.values())
    .sort((a, b) => (b.episode || 0) - (a.episode || 0))
    .map((item): OfficialAtlasItem => {
      const arc = storyArcs.find((storyArc) => item.episode! >= storyArc.start && item.episode! <= storyArc.end);
      return {
        id: item.id,
        ep: item.episode!,
        arc: arc?.key || storyArcs.at(-1)?.key || "",
        title: `第 ${item.episode} 话`,
        subtitle: "哔哩哔哩国创 · 独播",
        summary: item.description || `《凡人修仙传》第 ${item.episode} 话官方正片`,
        meta: arc?.label || "官方剧集",
        durationLabel: formatDuration(item.durationMs || undefined),
        publishedLabel: formatPublished(item.publishedAt),
        cover: item.cover || sources.snapshot.official.cover,
        url: item.url || sources.snapshot.series.officialUrl,
        play: item.play || undefined,
        badge: item.episode === currentEpisode ? "最新" : undefined,
      };
    });

  const previewByEpisode = new Map<string, UnifiedContentItem>();
  for (const item of pool.items.filter((content) => content.showInRighteous && content.contentForm === "official_preview")) {
    const key = item.episode != null ? `ep-${item.episode}` : item.id;
    const previous = previewByEpisode.get(key);
    if (!previous || item.publishedAt > previous.publishedAt) previewByEpisode.set(key, item);
  }
  const previews = Array.from(previewByEpisode.values())
    .map((item): OfficialPreviewAtlasItem => ({
      id: item.id,
      ep: item.episode,
      publishedAt: item.publishedAt,
      title: item.episode ? `第 ${item.episode} 话预告` : "官方预告",
      subtitle: "哔哩哔哩 · 番剧先导",
      summary: item.title === `第 ${item.episode} 话预告` ? item.description : item.title,
      meta: item.episode && currentEpisode != null && item.episode > currentEpisode ? "下回预告" : "历史预告",
      publishedLabel: formatPublished(item.publishedAt),
      cover: item.cover || sources.snapshot.official.cover,
      url: item.url,
      play: item.play || 0,
      badge: item.episode && currentEpisode != null && item.episode > currentEpisode ? "待播" : "预告",
    }))
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
  const pool = contentPoolFor(sources);
  const configMap = new Map(sources.upConfigs.map((up) => [String(up.uid), up]));
  const archiveMap = new Map<string, AnalysisAtlasItem>();
  const profileSeed = new Map<string, { name: string; aliases: string[]; note: string; inSnapshot: boolean }>();

  for (const item of pool.items.filter((content) => content.showInDemonic)) {
    const upId = String(item.upId);
    const snapshotUp = sources.snapshot.ups.find((up) => String(up.uid) === upId);
    if (!profileSeed.has(upId)) {
      profileSeed.set(upId, {
        name: item.upName,
        aliases: snapshotUp?.alias || [],
        note: snapshotUp?.note || "",
        inSnapshot: item.sourceKinds.some((source) => source !== "creation-discovery"),
      });
    }
    archiveMap.set(item.id, {
      id: item.id,
      ep: item.episode,
      episodes: item.episodes,
      upId,
      upName: item.upName,
      publishedAt: item.publishedAt,
      contentType: legacyContentType(item.contentForm, item.episode),
      contentForm: item.contentForm,
      category: item.category,
      characters: item.characters,
      aiLabel: item.aiLabel,
      title: item.title,
      subtitle: `${item.upName} · ${item.category}`,
      summary: item.classificationReason,
      cover: item.cover,
      url: item.url,
      play: item.play,
      badge: item.episode != null ? `第 ${item.episode} 话` : item.category,
    });
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

function recommendationReasonsForPool(item: UnifiedContentItem, pool: UnifiedContentPool) {
  const reasons: string[] = [];
  const age = Math.max(0, pool.generatedAt - item.publishedAt);
  if (item.episode != null && item.episode === pool.currentEpisode) reasons.push(`第 ${item.episode} 话相关`);
  if (item.lane === "related_archive") {
    const related = item.characters.filter((character) => pool.currentCharacters.includes(character));
    reasons.push(related.length ? `${related.slice(0, 2).join("、")}补充阅读` : "本集关联旧作");
  }
  if (item.lane === "new_creator_watch") reasons.push("新作者值得关注");
  if (item.lane === "hidden_gem") reasons.push("高口碑沧海遗珠");
  if (item.lane === "weekly_hot") reasons.push("本周热度上升");
  if (item.lane === "event_spotlight") reasons.push(item.eventTag || "活动专题推荐");
  if (age <= 36 * 60 * 60 * 1000) reasons.push("36 小时新作");
  if (item.metrics.growth >= 10000) reasons.push("近期增长明显");
  if (item.metrics.engagementRate >= 0.08) reasons.push("互动率突出");
  if (item.metrics.reply >= 300) reasons.push(`${formatCompactNumber(item.metrics.reply)} 条讨论`);
  reasons.push(contentFormLabel(item.contentForm));
  return Array.from(new Set(reasons)).slice(0, 3);
}

function buildCreations(sources: AtlasSources): CreationPayload {
  const pool = contentPoolFor(sources);
  const items = pool.items
    .filter((item) => item.showInDemonic && item.recommendationEligible)
    .map((item): CreationAtlasItem => {
      const label = recommendationLabel(item.lane);
      const reasons = recommendationReasonsForPool(item, pool);
      return {
        id: item.id,
        category: item.category,
        contentForm: item.contentForm,
        upId: item.upId,
        upName: item.upName,
        publishedAt: item.publishedAt,
        firstSeenAt: item.firstSeenAt,
        lane: item.lane,
        score: item.score,
        recommendationLabel: label,
        recommendationReasons: reasons,
        characters: item.characters,
        episodes: item.episodes,
        aiLabel: item.aiLabel,
        eventTag: item.eventTag,
        metrics: item.metrics,
        title: item.title,
        subtitle: `${item.upName} · ${label}`,
        summary: reasons.join(" · "),
        cover: item.cover,
        url: item.url,
        play: item.play,
        badge: item.category,
      };
    })
    .sort((a, b) => b.score - a.score || b.publishedAt - a.publishedAt || (b.play || 0) - (a.play || 0));
  const prioritized = [
    ...items.filter((item) => item.episodes.includes(pool.currentEpisode || -1)),
    ...items.filter((item) => item.lane === "related_archive"),
    ...items.filter((item) => ["new_creator_watch", "hidden_gem", "weekly_hot", "event_spotlight"].includes(item.lane || "")),
    ...items,
  ];
  const unique = new Map(prioritized.map((item) => [item.id, item]));
  return { items: Array.from(unique.values()).slice(0, 320) };
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
