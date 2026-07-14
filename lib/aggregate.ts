import type {
  ContentType,
  EpisodeRow,
  OfficialEpisode,
  Snapshot,
  UpResult,
  UpVideo,
} from "./types";

export function buildEpisodeRows(snap: Snapshot): EpisodeRow[] {
  const startEp = snap.series.newSeasonStartEp ?? 1;
  const currentOfficialEp = Number.parseInt(snap.official.newEp?.title || "", 10);
  const officialMap = new Map<number, OfficialEpisode>();
  for (const e of snap.official.episodes) {
    if (
      e.ep != null &&
      e.ep >= startEp &&
      (!Number.isFinite(currentOfficialEp) || e.ep <= currentOfficialEp)
    ) {
      officialMap.set(e.ep, e);
    }
  }

  const allEps = new Set<number>(officialMap.keys());
  for (const up of snap.ups) {
    for (const v of up.videos) {
      if (
        v.ep != null &&
        v.ep >= startEp &&
        v.contentType === "episode" &&
        (!Number.isFinite(currentOfficialEp) || v.ep <= currentOfficialEp)
      ) {
        allEps.add(v.ep);
      }
    }
  }

  const rows: EpisodeRow[] = Array.from(allEps).map((ep) => {
    const official = officialMap.get(ep) || null;
    const upVideos: EpisodeRow["upVideos"] = [];
    for (const up of snap.ups) {
      const hit = up.videos
        .filter(
          (v) =>
            v.ep === ep &&
            v.contentType === "episode"
        )
        .sort((a, b) => (b.pubTime || 0) - (a.pubTime || 0))[0];
      if (hit) upVideos.push({ up, video: hit });
    }
    const latestActivityAt = Math.max(
      official?.pubTime || 0,
      ...upVideos.map((u) => u.video.pubTime || 0)
    );
    return {
      ep,
      isNewSeason: ep >= startEp,
      official,
      upVideos,
      latestActivityAt,
    };
  });

  rows.sort((a, b) => b.ep - a.ep);
  return rows;
}

export interface SideVideo {
  up: UpResult;
  video: UpVideo;
}

export function getSideVideosByType(
  snap: Snapshot,
  type: ContentType
): SideVideo[] {
  const items: SideVideo[] = [];
  for (const up of snap.ups) {
    for (const v of up.videos) {
      if (v.contentType === type) items.push({ up, video: v });
    }
  }
  return items.sort((a, b) => b.video.pubTime - a.video.pubTime);
}

export function getCharacterGroups(snap: Snapshot): Array<{
  character: string;
  videos: SideVideo[];
}> {
  const map = new Map<string, SideVideo[]>();
  for (const up of snap.ups) {
    for (const v of up.videos) {
      if (v.contentType !== "character" && v.contentType !== "topic") continue;
      for (const name of v.characters || []) {
        if (!map.has(name)) map.set(name, []);
        map.get(name)!.push({ up, video: v });
      }
    }
  }
  const groups = Array.from(map.entries()).map(([character, videos]) => ({
    character,
    videos: videos.sort((a, b) => b.video.pubTime - a.video.pubTime),
  }));
  groups.sort((a, b) => b.videos.length - a.videos.length);
  return groups;
}

export function formatRelative(ts: number): string {
  if (!ts) return "";
  const delta = Date.now() - ts;
  const min = 60 * 1000;
  const hour = 60 * min;
  const day = 24 * hour;
  if (delta < min) return "刚刚";
  if (delta < hour) return `${Math.floor(delta / min)} 分钟前`;
  if (delta < day) return `${Math.floor(delta / hour)} 小时前`;
  if (delta < 7 * day) return `${Math.floor(delta / day)} 天前`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function formatDate(ts: number): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}
