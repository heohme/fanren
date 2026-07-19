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

export interface AnalysisAtlasItem extends AtlasItem {
  ep: number | null;
  upId: string;
  upName: string;
  publishedAt: number;
  contentType: ContentType | "creation" | "other";
  category?: string;
}

export interface CreationAtlasItem extends AtlasItem {
  category: string;
  upId: string;
  upName: string;
  publishedAt: number;
  lane: string | null;
  score: number;
  recommendationLabel: string;
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
}

interface CreationIndex {
  items?: DiscoveredCreation[];
}

interface AtlasSources {
  snapshot: Snapshot;
  upConfigs: UpConfig[];
  discoveredCreations: DiscoveredCreation[];
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
    ]).then(([snapshot, upConfigs, creations]) => ({
      snapshot,
      upConfigs,
      discoveredCreations: (creations.items || []).filter((item) => item.confidence >= 0.5),
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
  return { items };
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
      archiveMap.set(video.bvid, {
        id: video.bvid,
        ep: video.contentType === "episode" ? video.ep : null,
        upId: String(up.uid),
        upName: up.name,
        publishedAt: video.pubTime || 0,
        contentType: video.contentType || "other",
        category: video.contentType === "character" ? "人物志" : undefined,
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
    if (!profileSeed.has(upId)) {
      profileSeed.set(upId, { name: item.upName, aliases: [], note: "", inSnapshot: false });
    }
    if (!archiveMap.has(item.id)) {
      archiveMap.set(item.id, {
        id: item.id,
        ep: null,
        upId,
        upName: item.upName,
        publishedAt: item.pubTime || 0,
        contentType: "creation",
        category: item.category,
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
    .map(({ up, video }) => ({
      id: video.bvid,
      category: creationCategory(video),
      upId: String(up.uid),
      upName: up.name,
      publishedAt: video.pubTime || 0,
      lane: null,
      score: 0,
      recommendationLabel: "历史收录",
      title: video.title,
      subtitle: `${up.name} · 历史收录`,
      cover: video.cover,
      url: video.videoUrl,
      play: video.play || 0,
      badge: creationCategory(video),
    }));

  const creationMap = new Map(snapshotCreations.map((item) => [item.id, item]));
  for (const item of sources.discoveredCreations) {
    const label = recommendationLabel(item.lane);
    creationMap.set(item.id, {
      id: item.id,
      category: item.category,
      upId: String(item.upId),
      upName: item.upName,
      publishedAt: item.pubTime || 0,
      lane: item.lane || null,
      score: item.score || 0,
      recommendationLabel: label,
      title: item.title,
      subtitle: `${item.upName} · ${label}`,
      cover: item.cover,
      url: item.url,
      play: item.play || 0,
      badge: item.category,
    });
  }
  return { items: Array.from(creationMap.values()) };
}

function analysisCount(payload: AnalysisPayload) {
  const counted = new Map<string, AnalysisAtlasItem>();
  for (const item of payload.archive) {
    if (item.contentType === "episode" && item.ep != null) {
      const key = `${item.ep}:${item.upId}`;
      const previous = counted.get(key);
      if (!previous || (item.play || 0) > (previous.play || 0)) counted.set(key, item);
    } else if (item.contentType === "topic" || item.contentType === "character") {
      counted.set(item.id, item);
    }
  }
  return counted.size;
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
        analysis: analysisCount(analysis),
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
