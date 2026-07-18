import fs from "node:fs/promises";
import path from "node:path";
import type { Snapshot, UpVideo } from "@/lib/types";
import { formatRelative } from "@/lib/aggregate";
import WeeklyMap, {
  type AnalysisCreator,
  type AnalysisAtlasItem,
  type CreationAtlasItem,
  type OfficialAtlasItem,
  type StoryArc,
} from "@/components/WeeklyMap";

const OFFICIAL_UID = "98627270";
const REMIX_UID = "13921096";

interface UpConfig {
  uid: string;
  name: string;
  shareCode?: string;
  note?: string;
}

interface DiscoveredCreation {
  id: string;
  title: string;
  cover: string;
  url: string;
  upName: string;
  play: number;
  category: string;
  confidence: number;
}

const STORY_ARCS: StoryArc[] = [
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

async function loadSnapshot(): Promise<Snapshot | null> {
  try {
    const file = path.join(process.cwd(), "data", "snapshot.json");
    return JSON.parse(await fs.readFile(file, "utf8")) as Snapshot;
  } catch {
    return null;
  }
}

function buildVisibleStoryArcs(currentEpisode: number): StoryArc[] {
  if (!Number.isFinite(currentEpisode)) return [];

  const lastArcIndex = STORY_ARCS.length - 1;
  return STORY_ARCS
    .map((arc, index) => {
      // 最后一个篇章视为连载中：官方更新后自动把结束话数扩展到最新话。
      const effectiveEnd = index === lastArcIndex
        ? Math.max(arc.end, currentEpisode)
        : arc.end;
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
  return { subtitle: "凡人解析", badge: "解析" };
}

async function loadUpConfigs(): Promise<UpConfig[]> {
  try {
    const file = path.join(process.cwd(), "data", "ups.json");
    return JSON.parse(await fs.readFile(file, "utf8")) as UpConfig[];
  } catch {
    return [];
  }
}

async function loadDiscoveredCreations(): Promise<DiscoveredCreation[]> {
  try {
    const file = path.join(process.cwd(), "data", "creations.json");
    const data = JSON.parse(await fs.readFile(file, "utf8")) as { items?: DiscoveredCreation[] };
    return (data.items || []).filter((item) => item.confidence >= 0.5);
  } catch {
    return [];
  }
}

export default async function Home() {
  const snap = await loadSnapshot();

  if (!snap) {
    return (
      <main className="empty-state">
        <span className="atlas-seal">凡<br />图</span>
        <h1>残图尚未显形</h1>
        <p>请先生成一次数据快照，再回来循迹。</p>
      </main>
    );
  }

  const [upConfigs, discoveredCreations] = await Promise.all([loadUpConfigs(), loadDiscoveredCreations()]);
  const currentEpisode = Number.parseInt(snap.official.newEp?.title || "", 10);
  const visibleArcs = buildVisibleStoryArcs(currentEpisode);
  const officialByEpisode = new Map<number, (typeof snap.official.episodes)[number]>();
  for (const episode of snap.official.episodes) {
    if (episode.ep && episode.ep <= currentEpisode) officialByEpisode.set(episode.ep, episode);
  }

  const official: OfficialAtlasItem[] = Array.from(officialByEpisode.values())
    .sort((a, b) => (b.ep || 0) - (a.ep || 0))
    .map((episode) => {
      const arc = visibleArcs.find((item) => episode.ep! >= item.start && episode.ep! <= item.end);
      return {
        id: `official-${episode.ep}`,
        ep: episode.ep!,
        arc: arc?.key || visibleArcs.at(-1)?.key || "",
        title: `第 ${episode.ep} 话`,
        subtitle: "哔哩哔哩国创 · 独播",
        summary: episode.longTitle || `《凡人修仙传》第 ${episode.ep} 话官方正片`,
        meta: arc?.label || "官方剧集",
        durationLabel: formatDuration(episode.duration),
        publishedLabel: formatPublished(episode.pubTime),
        cover: episode.cover || snap.official.cover,
        url: episode.playUrl || snap.series.officialUrl,
        badge: episode.ep === currentEpisode ? "最新" : undefined,
      };
    });

  const creatorVideos = snap.ups
    .filter((up) => up.uid !== OFFICIAL_UID)
    .flatMap((up) => up.videos.map((video) => ({ up, video })));

  const toAnalysisItem = ({ up, video }: (typeof creatorVideos)[number]): AnalysisAtlasItem => {
    const labels = analysisLabels(video);
    return {
      id: video.bvid,
      ep: video.contentType === "episode" ? video.ep : null,
      upId: up.uid,
      upName: up.name,
      publishedAt: video.pubTime || 0,
      title: video.title,
      subtitle: `${up.name} · ${labels.subtitle}`,
      cover: video.cover,
      url: video.videoUrl,
      play: video.play || 0,
      badge: labels.badge,
    };
  };

  // 「按 UP 主」展示白名单账号已抓到的全部凡人相关投稿，不受逐集分类限制。
  const analysisArchive: AnalysisAtlasItem[] = creatorVideos
    .slice()
    .sort((a, b) => (b.video.pubTime || 0) - (a.video.pubTime || 0))
    .map(toAnalysisItem);

  const rawAnalysis: AnalysisAtlasItem[] = creatorVideos
    .filter(({ video }) =>
      (video.contentType === "episode" && video.ep != null) ||
      video.contentType === "topic" ||
      video.contentType === "character"
    )
    .sort((a, b) => (b.video.ep || 0) - (a.video.ep || 0) || (b.video.play || 0) - (a.video.play || 0))
    .map(toAnalysisItem);
  const analysisByEpisodeAndUp = new Map<string, AnalysisAtlasItem>();
  for (const item of rawAnalysis) {
    if (item.ep == null) {
      analysisByEpisodeAndUp.set(item.id, item);
      continue;
    }
    const key = `${item.ep}:${item.upId}`;
    const previous = analysisByEpisodeAndUp.get(key);
    if (!previous || (item.play || 0) > (previous.play || 0)) analysisByEpisodeAndUp.set(key, item);
  }
  const analysis = Array.from(analysisByEpisodeAndUp.values());

  const snapshotUpMap = new Map(snap.ups.map((up) => [String(up.uid), up]));
  const analysisCreators: AnalysisCreator[] = upConfigs
    .filter((up) => up.uid !== OFFICIAL_UID)
    .map((config) => {
      const snapshotUp = snapshotUpMap.get(String(config.uid));
      const videos = snapshotUp?.videos || [];
      const episodePlays = videos.map((video) => video.play || 0);
      const episodes = new Set(videos.map((video) => video.ep).filter((ep): ep is number => ep != null));
      const totalPlay = episodePlays.reduce((sum, play) => sum + play, 0);
      return {
        id: String(config.uid),
        name: snapshotUp?.name || config.name,
        shareCode: config.shareCode,
        count: videos.length,
        averagePlay: episodePlays.length ? Math.round(totalPlay / episodePlays.length) : 0,
        totalPlay,
        latestEpisode: episodes.size ? Math.max(...episodes) : null,
        note: config.note || snapshotUp?.note || "",
      };
    });

  const snapshotCreations: CreationAtlasItem[] = creatorVideos
    .filter(({ up, video }) =>
      video.contentType === "character" ||
      up.uid === REMIX_UID ||
      (/二创|手书|混剪|鬼畜|凡人版|人物志/.test(video.title) && video.contentType !== "episode")
    )
    .map(({ up, video }) => ({
      id: video.bvid,
      category: creationCategory(video),
      title: video.title,
      subtitle: up.name,
      cover: video.cover,
      url: video.videoUrl,
      play: video.play || 0,
      badge: creationCategory(video),
    }));
  const creationMap = new Map(snapshotCreations.map((item) => [item.id, item]));
  for (const item of discoveredCreations) {
    creationMap.set(item.id, {
      id: item.id,
      category: item.category,
      title: item.title,
      subtitle: item.upName,
      cover: item.cover,
      url: item.url,
      play: item.play || 0,
      badge: item.category,
    });
  }
  const creations = Array.from(creationMap.values());

  return (
    <WeeklyMap
      official={official}
      storyArcs={visibleArcs}
      analysis={analysis}
      analysisArchive={analysisArchive}
      analysisCreators={analysisCreators}
      creations={creations}
      currentEpisode={Number.isFinite(currentEpisode) ? currentEpisode : null}
      generatedLabel={`${formatRelative(snap.generatedAt)}巡检`}
    />
  );
}
