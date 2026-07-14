import fs from "node:fs/promises";
import path from "node:path";
import type { Snapshot, UpVideo } from "@/lib/types";
import { buildEpisodeRows, formatRelative } from "@/lib/aggregate";
import WeeklyMap, { type AtlasItem } from "@/components/WeeklyMap";

export const dynamic = "force-static";
export const revalidate = 600;

const OFFICIAL_UID = "98627270";
const REMIX_UID = "13921096";

async function loadSnapshot(): Promise<Snapshot | null> {
  try {
    const file = path.join(process.cwd(), "data", "snapshot.json");
    return JSON.parse(await fs.readFile(file, "utf8")) as Snapshot;
  } catch {
    return null;
  }
}

function videoItem(video: UpVideo, upName: string, badge?: string): AtlasItem {
  return {
    id: video.bvid,
    title: video.title,
    subtitle: upName,
    cover: video.cover,
    url: video.videoUrl,
    play: video.play || 0,
    badge,
  };
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

  const rows = buildEpisodeRows(snap);
  const latest = rows[0] || null;
  const official: AtlasItem[] = rows
    .filter((row) => row.official)
    .slice(0, 24)
    .map((row) => ({
      id: `official-${row.ep}`,
      title: `第 ${row.ep} 话${row.official?.longTitle ? ` · ${row.official.longTitle}` : ""}`,
      subtitle: "哔哩哔哩国创 · 官方正片",
      cover: row.official?.cover || snap.official.cover,
      url: row.official?.playUrl || snap.series.officialUrl,
      badge: row.ep === latest?.ep ? "最新" : undefined,
    }));

  const creatorVideos = snap.ups
    .filter((up) => up.uid !== OFFICIAL_UID)
    .flatMap((up) => up.videos.map((video) => ({ up, video })));

  const analysis = creatorVideos
    .filter(({ video }) => video.contentType === "episode")
    .sort((a, b) => (b.video.play || 0) - (a.video.play || 0) || b.video.pubTime - a.video.pubTime)
    .slice(0, 36)
    .map(({ up, video }) => videoItem(video, up.name, video.ep ? `第 ${video.ep} 话` : "解析"));

  const creations = creatorVideos
    .filter(({ up, video }) =>
      up.uid === REMIX_UID ||
      (/二创|手书|混剪|鬼畜|凡人版/.test(video.title) && video.contentType !== "episode")
    )
    .sort((a, b) => (b.video.play || 0) - (a.video.play || 0) || b.video.pubTime - a.video.pubTime)
    .slice(0, 36)
    .map(({ up, video }) => videoItem(video, up.name, "二创"));

  return (
    <WeeklyMap
      official={official}
      analysis={analysis}
      creations={creations}
      currentEpisode={latest?.ep || null}
      generatedLabel={`${formatRelative(snap.generatedAt)}巡检`}
    />
  );
}
