export interface SeriesConfig {
  title: string;
  seasonId: string;
  mediaId: string;
  officialUrl: string;
  premiereDate: string;
  weekday: number;
  schedule: string;
  newSeasonStartEp: number;
  newSeasonLabel: string;
  keywords: string[];
  characters?: string[];
  episodeRegex: string;
}

export interface OfficialEpisode {
  ep: number | null;
  epRaw: string;
  longTitle: string;
  bvid: string | null;
  aid: number;
  cover: string;
  pubTime: number | null;
  duration?: number;
  link?: string;
  playUrl: string;
}

export interface OfficialData {
  title: string;
  cover: string;
  newEp: { title?: string; desc?: string; id?: number };
  totalCount: number;
  episodes: OfficialEpisode[];
}

export type ContentType =
  | "episode"
  | "episode-preview"
  | "pv"
  | "character"
  | "topic"
  | "chat"
  | "compilation"
  | "other";

export interface UpVideo {
  bvid: string;
  aid: number;
  title: string;
  description: string;
  cover: string;
  pubTime: number;
  duration?: string | number;
  play?: number;
  videoUrl: string;
  matched: boolean;
  ep: number | null;
  isCompilation: boolean;
  contentType: ContentType | null;
  characters: string[];
  creationCategory?: string;
  classificationConfidence?: number;
  classificationSource?: "rule" | "model" | "manual";
}

export interface UpResult {
  uid: string;
  name: string;
  alias: string[];
  note: string;
  error: string | null;
  lastFetched: number;
  lastSuccess: number | null;
  videos: UpVideo[];
  recentTitles: string[];
}

export interface Snapshot {
  generatedAt: number;
  series: SeriesConfig;
  official: OfficialData;
  ups: UpResult[];
}

export interface EpisodeRow {
  ep: number;
  isNewSeason: boolean;
  official: OfficialEpisode | null;
  upVideos: Array<{
    up: UpResult;
    video: UpVideo;
  }>;
  latestActivityAt: number;
}
