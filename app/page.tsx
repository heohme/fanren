import fs from "node:fs/promises";
import path from "node:path";
import type { Snapshot, UpVideo } from "@/lib/types";
import { formatRelative } from "@/lib/aggregate";
import WeeklyMap, {
  type AnalysisAtlasItem,
  type CreationAtlasItem,
  type OfficialAtlasItem,
  type StoryArc,
} from "@/components/WeeklyMap";

export const dynamic = "force-static";
export const revalidate = 600;

const OFFICIAL_UID = "98627270";
const REMIX_UID = "13921096";

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

function storyArcForEpisode(ep: number) {
  return STORY_ARCS.find((arc) => ep >= arc.start && ep <= arc.end)?.key || STORY_ARCS.at(-1)!.key;
}

function creationCategory(video: UpVideo) {
  if (video.contentType === "character" || /人物志|人物传|角色志/.test(video.title)) return "人物志";
  if (/手书|混剪|AMV|MAD|修复|燃向|踩点/.test(video.title)) return "混剪手书";
  if (/鬼畜|恶搞|整活|反贪|交通站|特烦恼|无仙区|抢亲|仙社会|元婴本色/.test(video.title)) return "趣味恶搞";
  return "搞笑二创";
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

  const currentEpisode = Number.parseInt(snap.official.newEp?.title || "", 10);
  const officialByEpisode = new Map<number, (typeof snap.official.episodes)[number]>();
  for (const episode of snap.official.episodes) {
    if (episode.ep && episode.ep <= currentEpisode) officialByEpisode.set(episode.ep, episode);
  }

  const official: OfficialAtlasItem[] = Array.from(officialByEpisode.values())
    .sort((a, b) => (b.ep || 0) - (a.ep || 0))
    .map((episode) => ({
      id: `official-${episode.ep}`,
      ep: episode.ep!,
      arc: storyArcForEpisode(episode.ep!),
      title: `第 ${episode.ep} 话${episode.longTitle ? ` · ${episode.longTitle}` : ""}`,
      subtitle: "哔哩哔哩国创 · 官方正片",
      cover: episode.cover || snap.official.cover,
      url: episode.playUrl || snap.series.officialUrl,
      badge: episode.ep === currentEpisode ? "最新" : undefined,
    }));

  const creatorVideos = snap.ups
    .filter((up) => up.uid !== OFFICIAL_UID)
    .flatMap((up) => up.videos.map((video) => ({ up, video })));

  const analysis: AnalysisAtlasItem[] = creatorVideos
    .filter(({ video }) => video.contentType === "episode" && video.ep != null)
    .sort((a, b) => (b.video.ep || 0) - (a.video.ep || 0) || (b.video.play || 0) - (a.video.play || 0))
    .map(({ up, video }) => ({
      id: video.bvid,
      ep: video.ep!,
      upId: up.uid,
      upName: up.name,
      title: video.title,
      subtitle: `${up.name} · 第 ${video.ep} 话解析`,
      cover: video.cover,
      url: video.videoUrl,
      play: video.play || 0,
      badge: `第 ${video.ep} 话`,
    }));

  const creations: CreationAtlasItem[] = creatorVideos
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

  const visibleArcs = STORY_ARCS.map((arc) => ({ ...arc, end: Math.min(arc.end, currentEpisode) }))
    .filter((arc) => arc.start <= currentEpisode);

  return (
    <WeeklyMap
      official={official}
      storyArcs={visibleArcs}
      analysis={analysis}
      creations={creations}
      currentEpisode={Number.isFinite(currentEpisode) ? currentEpisode : null}
      generatedLabel={`${formatRelative(snap.generatedAt)}巡检`}
    />
  );
}
