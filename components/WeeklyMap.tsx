"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AtlasOnboarding, {
  ONBOARDING_STEPS,
  type GuidedRealm,
} from "@/components/AtlasGuidance";
import CommunityHub from "@/components/CommunityHub";
import { trackEvent, trackLandingView } from "@/lib/analytics";
import type {
  AnalysisAtlasItem,
  AnalysisPayload,
  AtlasItem,
  CreationAtlasItem,
  CreationPayload,
  CreatorProfile,
  OfficialAtlasItem,
  OfficialPreviewAtlasItem,
  OfficialPayload,
  StoryArc,
} from "@/lib/atlas-data";

type RealmKey = "righteous" | "demonic" | "heaven" | "nine";
type OpenRealm = Exclude<RealmKey, "nine">;
type AnalysisMode = "latest" | "episode" | "directory" | "character" | "category" | "ai";
const CREATION_CATEGORY_ORDER = [
  "本集解析",
  "剧情杂谈",
  "改编讨论",
  "人物赏析",
  "设定考据",
  "Reaction",
  "剧情二创",
  "趣味整活",
  "混剪手书",
  "音乐配音",
  "同人创作",
  "多集拉片",
  "其他内容",
];
const ANALYSIS_BATCH_SIZE = 80;
const VIEWED_ITEMS_KEY = "fanrenmap-viewed-items-v1";
const ONBOARDING_VERSION = "2";
const ONBOARDING_KEY = "fanrenmap-onboarding-version";
const CREATOR_RANKING_PRIOR_WORKS = 5;

interface Realm {
  key: RealmKey;
  name: string;
  module: string;
  description: string;
  count: number;
  path: string;
  locked?: boolean;
}

const paths: Record<RealmKey, string> = {
  heaven:
    "M475 111 L534 88 L604 96 L647 111 L705 122 L754 146 L800 150 L855 137 L915 117 L987 117 L1050 110 L1120 119 L1180 126 L1250 139 L1320 150 L1380 170 L1433 190 L1413 224 L1374 256 L1340 286 L1316 307 L1275 320 L1233 342 L1190 359 L1165 380 L1122 404 L1086 421 L1048 434 L1015 407 L986 399 L968 419 L950 440 L927 433 L904 414 L871 414 L843 424 L818 417 L791 405 L771 420 L748 415 L724 392 L695 388 L675 396 L653 389 L642 371 L615 368 L588 351 L559 341 L528 324 L497 313 L471 296 L444 286 L425 268 L403 263 L391 237 L403 211 L410 184 L438 152 Z",
  righteous:
    "M172 233 L242 219 L301 217 L359 229 L384 252 L410 273 L444 286 L471 296 L497 313 L528 324 L559 341 L588 351 L615 368 L642 371 L653 389 L675 396 L695 388 L724 392 L748 415 L771 420 L791 405 L818 417 L843 424 L871 414 L904 414 L927 433 L950 440 L938 463 L922 482 L910 507 L900 535 L894 562 L886 586 L877 606 L862 624 L843 641 L817 657 L793 671 L765 682 L730 693 L694 704 L656 715 L616 728 L580 739 L547 752 L512 749 L486 729 L459 721 L431 714 L403 706 L376 698 L344 702 L315 705 L288 696 L261 683 L233 677 L205 670 L177 669 L150 656 L130 637 L118 609 L113 582 L117 553 L124 523 L130 493 L137 463 L143 434 L151 406 L156 375 L160 343 L162 313 L159 285 L158 257 Z",
  demonic:
    "M1433 190 L1473 170 L1520 184 L1568 198 L1618 214 L1660 238 L1700 260 L1748 276 L1780 303 L1817 322 L1840 352 L1858 382 L1868 425 L1865 469 L1853 506 L1849 546 L1830 576 L1818 603 L1796 622 L1777 642 L1748 653 L1714 668 L1682 662 L1650 672 L1618 670 L1590 680 L1560 685 L1530 681 L1502 694 L1464 687 L1425 687 L1385 690 L1340 697 L1300 701 L1260 696 L1220 689 L1190 683 L1162 676 L1132 671 L1104 667 L1078 666 L1053 662 L1035 661 L1010 664 L980 669 L946 671 L925 657 L914 632 L915 600 L920 568 L919 538 L925 510 L936 480 L949 452 L968 423 L986 400 L1015 407 L1048 434 L1086 421 L1122 404 L1165 380 L1190 359 L1233 342 L1275 320 L1316 307 L1340 286 L1374 256 L1413 224 Z",
  nine:
    "M486 729 L512 749 L547 752 L580 739 L616 728 L656 715 L694 704 L730 693 L765 682 L793 671 L817 657 L843 641 L862 624 L877 606 L894 620 L918 646 L946 668 L980 655 L1015 642 L1060 641 L1110 649 L1160 656 L1210 666 L1260 678 L1310 687 L1370 689 L1430 690 L1480 687 L1530 681 L1565 690 L1590 716 L1594 748 L1578 777 L1548 798 L1510 811 L1472 817 L1432 828 L1383 838 L1330 844 L1280 851 L1225 857 L1170 863 L1115 869 L1060 866 L1000 866 L942 862 L884 858 L826 855 L770 847 L714 837 L660 825 L610 810 L566 790 L528 768 L500 748 Z",
};

const labelPositions: Record<RealmKey, { left: string; top: string }> = {
  heaven: { left: "47.8%", top: "26%" },
  righteous: { left: "31%", top: "49.5%" },
  demonic: { left: "77.2%", top: "45%" },
  nine: { left: "54%", top: "72.5%" },
};

function formatPlay(value = 0) {
  if (value >= 10000) return `${(value / 10000).toFixed(value >= 100000 ? 0 : 1)}万`;
  return String(value);
}

function episodeFromSearch(params: URLSearchParams) {
  const token = (params.get("e") || params.get("episode"))?.trim();
  if (!token || !/^\d+$/.test(token)) return null;
  const episode = Number(token);
  return Number.isSafeInteger(episode) && episode > 0 ? episode : null;
}

function compactPublicSearch(url: URL) {
  const source = url.searchParams.get("f")
    || url.searchParams.get("from")
    || url.searchParams.get("src")
    || url.searchParams.get("utm_source");
  const mode = url.searchParams.get("m") || url.searchParams.get("mode");
  const episode = url.searchParams.get("e") || url.searchParams.get("episode");

  if (source) url.searchParams.set("f", source);
  if (mode) url.searchParams.set("m", mode);
  if (episode) url.searchParams.set("e", episode);
  ["from", "src", "utm_source", "mode", "episode"].forEach((key) => url.searchParams.delete(key));
  return url;
}

function biliThumbnail(url: string, width: number) {
  const normalized = url.replace(/^http:\/\//, "https://");
  if (!/\.hdslb\.com\//.test(normalized) || normalized.includes("@")) return normalized;
  const height = Math.round(width * 9 / 16);
  return `${normalized}@${width}w_${height}h_1c.webp`;
}

function ProgressiveImage({ src, width = 640 }: { src: string; width?: number }) {
  const [loaded, setLoaded] = useState(false);
  const original = src.replace(/^http:\/\//, "https://");
  const thumbnail = biliThumbnail(src, width);

  return (
    <span className={`progressive-image ${loaded ? "is-loaded" : ""}`}>
      <img
        src={thumbnail}
        alt=""
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={(event) => {
          if (event.currentTarget.src !== original) event.currentTarget.src = original;
        }}
      />
    </span>
  );
}

function biliPlayerUrl(item: AtlasItem) {
  const bvid = item.id.match(/^BV[0-9A-Za-z]+$/i)?.[0]
    || item.url.match(/\/video\/(BV[0-9A-Za-z]+)/i)?.[1];
  const episodeId = item.url.match(/\/bangumi\/play\/ep(\d+)/i)?.[1];
  const params = new URLSearchParams({
    autoplay: "0",
    danmaku: "1",
    poster: "1",
    refer: "1",
  });
  if (episodeId) params.set("episodeId", episodeId);
  else if (bvid) params.set("bvid", bvid);
  else return null;
  return `https://player.bilibili.com/player.html?${params.toString()}`;
}

function isOfficialEpisode(item: AtlasItem): item is OfficialAtlasItem {
  const candidate = item as Partial<OfficialAtlasItem>;
  return typeof candidate.ep === "number" && typeof candidate.arc === "string";
}

interface AdminStreamIndexResponse {
  ok: boolean;
  episodes?: Array<{ episode: number; url: string }>;
  error?: string;
}

let adminStreamIndexPromise: Promise<Map<number, string>> | null = null;

async function loadAdminStreamIndex(force = false) {
  if (force) adminStreamIndexPromise = null;
  if (adminStreamIndexPromise) return adminStreamIndexPromise;

  adminStreamIndexPromise = (async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch("/api/admin-stream?m=admin", {
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
      const payload = await response.json() as AdminStreamIndexResponse;
      if (!response.ok || !payload.ok || !Array.isArray(payload.episodes)) {
        throw new Error(payload.error || `片源索引请求失败（${response.status}）`);
      }

      return new Map(payload.episodes.map((item) => [item.episode, item.url]));
    } finally {
      window.clearTimeout(timeout);
    }
  })().catch((error) => {
    adminStreamIndexPromise = null;
    throw error;
  });

  return adminStreamIndexPromise;
}

function MediaCard({
  item,
  rank,
  compact = false,
  official = false,
  adminMode = false,
  viewed = false,
  onViewed,
  onPlay,
  onOpen,
}: {
  item: AtlasItem;
  rank: number;
  compact?: boolean;
  official?: boolean;
  adminMode?: boolean;
  viewed?: boolean;
  onViewed?: (id: string) => void;
  onPlay?: (item: AtlasItem) => void;
  onOpen?: (item: AtlasItem, mode: "inline" | "outbound") => void;
}) {
  const adminEpisode = adminMode && official && isOfficialEpisode(item);
  const canPlayInline = Boolean(onPlay && (adminEpisode || biliPlayerUrl(item)));
  const openInline = () => {
    onViewed?.(item.id);
    onOpen?.(item, "inline");
    onPlay?.(item);
  };

  if (official) {
    const content = (
      <>
        <div className="media-cover">
          <ProgressiveImage src={item.cover} width={720} />
          <i>{String(rank).padStart(2, "0")}</i>
          {item.badge && <b>{item.badge}</b>}
          {viewed && <span className="viewed-mark">✓ 已看</span>}
        </div>
        <div className="official-copy">
          <div className="official-kicker"><span>{item.meta || "官方剧集"}</span><em>正片档案</em></div>
          <h2>{item.title}</h2>
          <p>{item.summary}</p>
          <div className="official-meta">
            <span>{item.durationLabel || "完整正片"}</span>
            <span>{item.publishedLabel || "已上线"}</span>
          </div>
          <footer><small>{adminEpisode ? "暴风资源 · 管理员片源" : item.subtitle}</small><strong>{adminEpisode ? "暴风片源 ▶" : canPlayInline ? "站内播放 ▶" : "前往 B 站 ↗"}</strong></footer>
        </div>
      </>
    );
    if (canPlayInline) {
      return (
        <button className={`media-card media-card-button official-card ${viewed ? "is-viewed" : ""}`} type="button" aria-label={`站内播放：${item.title}`} onClick={openInline}>
          {content}
        </button>
      );
    }
    return (
      <a className={`media-card official-card ${viewed ? "is-viewed" : ""}`} href={item.url} target="_blank" rel="noreferrer" onClick={() => { onViewed?.(item.id); onOpen?.(item, "outbound"); }}>
        {content}
      </a>
    );
  }
  const content = (
    <>
      <div className="media-cover">
        <ProgressiveImage src={item.cover} width={compact ? 420 : 640} />
        <i>{String(rank).padStart(2, "0")}</i>
        {item.badge && <b>{item.badge}</b>}
        {viewed && <span className="viewed-mark">✓ 已看</span>}
      </div>
      <div className="media-copy">
        <h2>{item.title}</h2>
        <p>{item.subtitle}</p>
        {item.summary && <div className="media-summary">{item.summary}</div>}
        <span>{item.play != null ? `${formatPlay(item.play)} 播放` : "前往官方观看"}<em>{canPlayInline ? "播 ▶" : "阅 →"}</em></span>
      </div>
    </>
  );
  if (canPlayInline) {
    return (
      <button className={`media-card media-card-button ${compact ? "compact" : ""} ${viewed ? "is-viewed" : ""}`} type="button" aria-label={`站内播放：${item.title}`} onClick={openInline}>
        {content}
      </button>
    );
  }
  return (
    <a className={`media-card ${compact ? "compact" : ""} ${viewed ? "is-viewed" : ""}`} href={item.url} target="_blank" rel="noreferrer" onClick={() => { onViewed?.(item.id); onOpen?.(item, "outbound"); }}>
      {content}
    </a>
  );
}

function AdminStreamPlayer({ episode, poster }: { episode: number; poster: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("片源暂时未能接通");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let disposed = false;
    let hls: { destroy: () => void } | null = null;
    let loadTimeout = 0;
    const ready = () => {
      if (!disposed) {
        window.clearTimeout(loadTimeout);
        setPhase("ready");
      }
    };
    const failed = (message = "片源暂时未能接通") => {
      if (!disposed) {
        window.clearTimeout(loadTimeout);
        setErrorMessage(message);
        setPhase("error");
      }
    };
    const handleVideoError = () => failed("浏览器未能加载当前片源");

    setPhase("loading");
    setErrorMessage("片源暂时未能接通");
    loadTimeout = window.setTimeout(() => failed("片源加载超时，请重新加载"), 15000);
    video.addEventListener("canplay", ready);
    video.addEventListener("error", handleVideoError);

    void (async () => {
      try {
        const streams = await loadAdminStreamIndex(attempt > 0);
        const manifestUrl = streams.get(episode);
        if (!manifestUrl) {
          failed(`暴风资源暂未收录第 ${episode} 话`);
          return;
        }

        const { default: Hls } = await import("hls.js");
        if (disposed) return;
        if (Hls.isSupported()) {
          let networkRecoveryCount = 0;
          let mediaRecoveryCount = 0;
          const instance = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            backBufferLength: 90,
            maxBufferLength: 30,
            fragLoadingMaxRetry: 3,
            fragLoadingRetryDelay: 750,
            manifestLoadingMaxRetry: 2,
            manifestLoadingRetryDelay: 750,
            manifestLoadingTimeOut: 10000,
            fragLoadingTimeOut: 15000,
          });
          hls = instance;
          instance.on(Hls.Events.ERROR, (_event, data) => {
            if (!data.fatal) return;
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRecoveryCount < 2) {
              networkRecoveryCount += 1;
              instance.startLoad();
              return;
            }
            if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRecoveryCount < 1) {
              mediaRecoveryCount += 1;
              instance.recoverMediaError();
              return;
            }
            failed(data.type === Hls.ErrorTypes.NETWORK_ERROR
              ? "暴风片源网络连接失败"
              : "当前片源格式暂时无法播放");
          });
          instance.attachMedia(video);
          instance.loadSource(manifestUrl);
          return;
        }

        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = manifestUrl;
          video.load();
          return;
        }
        failed();
      } catch (error) {
        failed(error instanceof Error && error.name === "AbortError"
          ? "获取剧集地址超时，请重新加载"
          : error instanceof Error ? error.message : "片源暂时未能接通");
      }
    })();

    return () => {
      disposed = true;
      window.clearTimeout(loadTimeout);
      video.removeEventListener("canplay", ready);
      video.removeEventListener("error", handleVideoError);
      hls?.destroy();
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [attempt, episode]);

  return (
    <div className="admin-video-shell">
      <video ref={videoRef} controls playsInline preload="metadata" poster={poster} aria-label={`第 ${episode} 话暴风资源播放器`} />
      {phase === "loading" && <div className="admin-player-state"><span className="atlas-seal">载</span><strong>正在接引暴风片源</strong><small>首次展开可能需要几秒</small></div>}
      {phase === "error" && <div className="admin-player-state error"><span className="atlas-seal">候</span><strong>{errorMessage}</strong><button type="button" onClick={() => setAttempt((value) => value + 1)}>重新加载</button></div>}
      <span className="admin-stream-badge">ADMIN · BFZY · 第 {episode} 话</span>
    </div>
  );
}

function VideoPlayerModal({ item, adminMode, onClose }: { item: AtlasItem; adminMode: boolean; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const adminEpisode = adminMode && isOfficialEpisode(item);
  const playerUrl = adminEpisode ? null : biliPlayerUrl(item);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    return () => previousFocus?.focus();
  }, []);

  if (!adminEpisode && !playerUrl) return null;

  return (
    <div className="video-player-overlay" role="presentation" onClick={onClose}>
      <section className="video-player-dialog" role="dialog" aria-modal="true" aria-labelledby="video-player-title" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span>{adminEpisode ? "残图密录 · BFZY HLS PLAYER" : "残图留影 · BILIBILI PLAYER"}</span>
            <h2 id="video-player-title">{item.title}</h2>
            <p>{adminEpisode ? `管理员片源模式 · 暴风资源 · 第 ${item.ep} 话` : item.subtitle}</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="关闭站内播放器">×</button>
        </header>
        <div className="video-player-frame">
          {adminEpisode ? (
            <AdminStreamPlayer episode={item.ep} poster={item.cover} />
          ) : (
            <iframe
              src={playerUrl!}
              title={`${item.title} - B站播放器`}
              scrolling="no"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          )}
        </div>
        <footer>
          <p>{adminEpisode ? "播放器通过浏览器直连暴风资源的 HLS 片源；片源失效时可使用右侧官方入口。" : "播放器由哔哩哔哩提供；需要更高清画质、登录、点赞或评论时，可前往 B 站继续观看。"}</p>
          <div>
            <button type="button" onClick={onClose}>返回残图</button>
            <a href={item.url} target="_blank" rel="noreferrer">{adminEpisode ? "官方 B 站备用 ↗" : "去 B 站看高清与评论 ↗"}</a>
          </div>
        </footer>
      </section>
    </div>
  );
}

function PreviewCard({ item, featured = false, viewed = false, onViewed, onPlay, onOpen }: { item: OfficialPreviewAtlasItem; featured?: boolean; viewed?: boolean; onViewed: (id: string) => void; onPlay?: (item: AtlasItem) => void; onOpen?: (item: AtlasItem, mode: "inline" | "outbound") => void }) {
  const canPlayInline = Boolean(onPlay && biliPlayerUrl(item));
  const content = (
    <>
      <div className="preview-cover">
        <ProgressiveImage src={item.cover} width={featured ? 860 : 520} />
        <span>{item.badge || "预告"}</span>
        {viewed && <b>✓ 已看</b>}
      </div>
      <div className="preview-copy">
        <small>{item.meta || "官方预告"} · {item.publishedLabel}</small>
        <h2>{item.title}</h2>
        <p>{item.summary}</p>
        <footer><span>{item.play != null ? `${formatPlay(item.play)} 播放` : "官方物料"}</span><strong>{canPlayInline ? "站内播放 ▶" : "观看预告 →"}</strong></footer>
      </div>
    </>
  );
  if (canPlayInline) {
    return (
      <button className={`preview-card preview-card-button ${featured ? "featured" : ""} ${viewed ? "is-viewed" : ""}`} type="button" aria-label={`站内播放：${item.title}`} onClick={() => { onViewed(item.id); onOpen?.(item, "inline"); onPlay?.(item); }}>
        {content}
      </button>
    );
  }
  return (
    <a className={`preview-card ${featured ? "featured" : ""} ${viewed ? "is-viewed" : ""}`} href={item.url} target="_blank" rel="noreferrer" onClick={() => { onViewed(item.id); onOpen?.(item, "outbound"); }}>
      {content}
    </a>
  );
}

function RecommendationCard({ item, rank, viewed, onViewed, onPlay, onOpen }: { item: CreationAtlasItem; rank: number; viewed: boolean; onViewed: (id: string) => void; onPlay?: (item: AtlasItem) => void; onOpen?: (item: AtlasItem, mode: "inline" | "outbound") => void }) {
  const canPlayInline = Boolean(onPlay && biliPlayerUrl(item));
  const content = (
    <>
      <div className="daily-cover">
        <ProgressiveImage src={item.cover} width={620} />
        <i>{String(rank).padStart(2, "0")}</i>
        <b>{item.recommendationLabel}</b>
        {viewed && <span>✓ 已看</span>}
      </div>
      <div className="daily-copy">
        <small>{item.upName} · {item.category}{item.aiLabel ? ` · ${item.aiLabel}` : ""}</small>
        <h2>{item.title}</h2>
        <div className="reason-chips">{item.recommendationReasons.slice(0, 3).map((reason) => <em key={reason}>{reason}</em>)}</div>
        <footer>
          <span>{formatPlay(item.play || 0)} 播放 · {formatPlay(item.metrics.like)} 赞 · {formatPlay(item.metrics.reply)} 评</span>
          <strong>{canPlayInline ? "站内播放 ▶" : "去看 →"}</strong>
        </footer>
      </div>
    </>
  );
  if (canPlayInline) {
    return (
      <button className={`daily-card daily-card-button ${viewed ? "is-viewed" : ""}`} type="button" aria-label={`站内播放：${item.title}`} onClick={() => { onViewed(item.id); onOpen?.(item, "inline"); onPlay?.(item); }}>
        {content}
      </button>
    );
  }
  return (
    <a className={`daily-card ${viewed ? "is-viewed" : ""}`} href={item.url} target="_blank" rel="noreferrer" onClick={() => { onViewed(item.id); onOpen?.(item, "outbound"); }}>
      {content}
    </a>
  );
}

function selectDiverse(items: CreationAtlasItem[], limit: number, used = new Set<string>()) {
  const result: CreationAtlasItem[] = [];
  const creators = new Map<string, number>();
  const categories = new Map<string, number>();
  for (const item of items) {
    if (
      used.has(item.id) ||
      (creators.get(item.upId) || 0) >= 1 ||
      (categories.get(item.category) || 0) >= 2
    ) continue;
    result.push(item);
    used.add(item.id);
    creators.set(item.upId, (creators.get(item.upId) || 0) + 1);
    categories.set(item.category, (categories.get(item.category) || 0) + 1);
    if (result.length >= limit) break;
  }
  return result;
}

function LoadMore({ shown, total, onMore }: { shown: number; total: number; onMore: () => void }) {
  if (shown >= total) return null;
  return <button className="load-more" type="button" onClick={onMore}><span>已展卷 {shown} / {total}</span><strong>再展开 {Math.min(ANALYSIS_BATCH_SIZE, total - shown)} 部 ＋</strong></button>;
}

type RankedCreator = CreatorProfile & { stableAveragePlay: number };

function CreatorCard({ creator, onSelect, reason, rank }: { creator: RankedCreator; onSelect: (id: string) => void; reason?: string; rank?: number }) {
  return (
    <button className="creator-card" type="button" onClick={() => onSelect(creator.id)}>
      <span className="creator-card-top"><strong>{creator.name}</strong><em>{rank ? `第 ${String(rank).padStart(2, "0")} 位` : reason || creator.sourceLabel}</em></span>
      <span className="creator-card-performance">
        <strong><small>稳定均播</small>{formatPlay(creator.stableAveragePlay)}</strong>
        <span>实际均播 {formatPlay(creator.averagePlay)} · {creator.count} 部</span>
      </span>
      <small>{creator.latestEpisode ? `最新跟进第 ${creator.latestEpisode} 话 · ` : ""}总播放 {formatPlay(creator.totalPlay)} · {creator.sourceLabel}</small>
      <span className="creator-tags">
        {(creator.tags.length ? creator.tags : ["内容待完善"]).slice(0, 3).map((tag) => <i key={tag}>{tag}</i>)}
      </span>
    </button>
  );
}

export default function WeeklyMap({
  storyArcs,
  currentEpisode,
  generatedLabel,
  counts,
}: {
  storyArcs: StoryArc[];
  currentEpisode: number | null;
  generatedLabel: string;
  counts: { official: number; analysis: number; creations: number };
}) {
  const [active, setActive] = useState<OpenRealm | null>(null);
  const [hovered, setHovered] = useState<RealmKey | null>(null);
  const [official, setOfficial] = useState<OfficialAtlasItem[]>([]);
  const [officialPreviews, setOfficialPreviews] = useState<OfficialPreviewAtlasItem[]>([]);
  const [analysisArchive, setAnalysisArchive] = useState<AnalysisAtlasItem[]>([]);
  const [analysisCreators, setAnalysisCreators] = useState<CreatorProfile[]>([]);
  const [creations, setCreations] = useState<CreationAtlasItem[]>([]);
  const [realmStatus, setRealmStatus] = useState<Record<OpenRealm, "idle" | "loading" | "ready" | "error">>({
    righteous: "idle",
    demonic: "idle",
    heaven: "idle",
  });
  const [officialMode, setOfficialMode] = useState<"episodes" | "previews">("episodes");
  const [officialArc, setOfficialArc] = useState(storyArcs.at(-1)?.key || "");
  const [previewArc, setPreviewArc] = useState<string | null>(null);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("latest");
  const [analysisEpisode, setAnalysisEpisode] = useState(currentEpisode || 0);
  const [analysisUp, setAnalysisUp] = useState("");
  const [analysisCharacter, setAnalysisCharacter] = useState("");
  const [analysisCategory, setAnalysisCategory] = useState("");
  const [analysisVisibleLimit, setAnalysisVisibleLimit] = useState(ANALYSIS_BATCH_SIZE);
  const [creatorQuery, setCreatorQuery] = useState("");
  const [creatorTag, setCreatorTag] = useState("全部");
  const [shareCopied, setShareCopied] = useState(false);
  const [viewedItems, setViewedItems] = useState<Set<string>>(() => new Set());
  const [onlyUnseen, setOnlyUnseen] = useState<Record<OpenRealm, boolean>>({ righteous: false, demonic: false, heaven: true });
  const [exitConfirm, setExitConfirm] = useState(false);
  const [playingItem, setPlayingItem] = useState<AtlasItem | null>(null);
  const [adminMode, setAdminMode] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const exitBypassRef = useRef(false);
  const deepLinkReadyRef = useRef(false);
  const deepLinkLoadRequestedRef = useRef(false);
  const shareFeedbackTimerRef = useRef<number | null>(null);
  const loadedRealmsRef = useRef<Set<OpenRealm>>(new Set());
  const loadingRealmsRef = useRef<Set<OpenRealm>>(new Set());

  useEffect(() => {
    trackLandingView();
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const isPlainHome = url.pathname === "/" && !url.search && !url.hash;
    const onboardingComplete = localStorage.getItem(ONBOARDING_KEY) === ONBOARDING_VERSION;
    if (isPlainHome && !onboardingComplete) {
      setOnboardingStep(0);
      setOnboardingOpen(true);
      trackEvent({ eventName: "onboarding_start", objectType: "guide", objectId: ONBOARDING_VERSION, context: "automatic" });
    }
  }, []);

  const finishOnboarding = () => {
    localStorage.setItem(ONBOARDING_KEY, ONBOARDING_VERSION);
    trackEvent({ eventName: "onboarding_complete", objectType: "guide", objectId: ONBOARDING_VERSION, position: onboardingStep + 1 });
    setOnboardingOpen(false);
    setOnboardingStep(0);
  };

  const skipOnboarding = () => {
    localStorage.setItem(ONBOARDING_KEY, ONBOARDING_VERSION);
    trackEvent({ eventName: "onboarding_skip", objectType: "guide", objectId: ONBOARDING_VERSION, position: onboardingStep + 1 });
    setOnboardingOpen(false);
    setOnboardingStep(0);
  };

  const changeOnboardingStep = (step: number) => {
    setOnboardingStep(step);
    const item = ONBOARDING_STEPS[step];
    trackEvent({
      eventName: "onboarding_step",
      objectType: "guide",
      objectId: item.targets.join(","),
      objectLabel: item.title,
      position: step + 1,
    });
  };

  const startOnboardingManually = () => {
    setOnboardingStep(0);
    setOnboardingOpen(true);
    trackEvent({ eventName: "onboarding_start", objectType: "guide", objectId: ONBOARDING_VERSION, context: "manual" });
  };

  useEffect(() => {
    const url = compactPublicSearch(new URL(window.location.href));
    setAdminMode(url.searchParams.get("m") === "admin");
    if (url.toString() !== window.location.href) history.replaceState(history.state, "", url);
  }, []);

  const loadRealmData = useCallback(async (realm: OpenRealm, force = false) => {
    if (!force && (loadedRealmsRef.current.has(realm) || loadingRealmsRef.current.has(realm))) return;
    if (force) loadedRealmsRef.current.delete(realm);
    loadingRealmsRef.current.add(realm);
    setRealmStatus((current) => ({ ...current, [realm]: "loading" }));
    try {
      if (realm === "righteous") {
        const response = await fetch("/content/official.json");
        if (!response.ok) throw new Error("official payload unavailable");
        const payload = await response.json() as OfficialPayload;
        setOfficial(payload.items);
        setOfficialPreviews(payload.previews || []);
      } else if (realm === "demonic") {
        const response = await fetch("/content/analysis.json");
        if (!response.ok) throw new Error("analysis payload unavailable");
        const payload = await response.json() as AnalysisPayload;
        setAnalysisArchive(payload.archive);
        setAnalysisCreators(payload.creators);
      } else if (realm === "heaven") {
        const response = await fetch("/content/creations.json");
        if (!response.ok) throw new Error("creation payload unavailable");
        const payload = await response.json() as CreationPayload;
        setCreations(payload.items);
      }
      loadedRealmsRef.current.add(realm);
      setRealmStatus((current) => ({ ...current, [realm]: "ready" }));
    } catch {
      setRealmStatus((current) => ({ ...current, [realm]: "error" }));
    } finally {
      loadingRealmsRef.current.delete(realm);
    }
  }, []);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(VIEWED_ITEMS_KEY) || "[]") as string[];
      setViewedItems(new Set(saved));
    } catch {
      localStorage.removeItem(VIEWED_ITEMS_KEY);
    }
  }, []);

  const markViewed = useCallback((id: string) => {
    setViewedItems((current) => {
      if (current.has(id)) return current;
      const next = new Set(current);
      next.add(id);
      localStorage.setItem(VIEWED_ITEMS_KEY, JSON.stringify(Array.from(next)));
      return next;
    });
  }, []);

  useEffect(() => {
    const isMobile = window.matchMedia("(max-width: 820px), (pointer: coarse)").matches;
    if (!isMobile) return;

    const guardKey = "__fanrenExitGuard";
    const currentState = history.state && typeof history.state === "object" ? history.state : {};
    if (!currentState[guardKey]) {
      history.pushState({ ...currentState, [guardKey]: true }, "", window.location.href);
    }

    const interceptExit = (event: PopStateEvent) => {
      if (exitBypassRef.current || event.state?.[guardKey]) return;
      const restoredState = history.state && typeof history.state === "object" ? history.state : {};
      history.pushState({ ...restoredState, [guardKey]: true }, "", window.location.href);
      setExitConfirm(true);
    };

    window.addEventListener("popstate", interceptExit);
    return () => window.removeEventListener("popstate", interceptExit);
  }, []);

  const confirmExit = () => {
    exitBypassRef.current = true;
    setExitConfirm(false);
    const currentUrl = window.location.href;
    history.go(-2);
    window.setTimeout(() => {
      if (window.location.href === currentUrl) exitBypassRef.current = false;
    }, 800);
  };

  useEffect(() => {
    if (!active && !exitConfirm && !playingItem) return;
    const close = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (playingItem) setPlayingItem(null);
      else if (exitConfirm) setExitConfirm(false);
      else setActive(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [active, exitConfirm, playingItem]);

  const analysisEpisodes = useMemo(
    () => Array.from(new Set(analysisArchive
      .filter((item) => item.contentType === "episode")
      .map((item) => item.ep)
      .filter((ep): ep is number => ep != null))).sort((a, b) => b - a),
    [analysisArchive]
  );
  const analysisEpisodeOptions = useMemo(
    () => Array.from(new Set([
      ...(analysisEpisode > 0 ? [analysisEpisode] : []),
      ...analysisEpisodes,
    ])).sort((a, b) => b - a),
    [analysisEpisode, analysisEpisodes]
  );
  const analysisUps = useMemo(() => {
    const totalPlay = analysisCreators.reduce((sum, creator) => sum + creator.totalPlay, 0);
    const totalWorks = analysisCreators.reduce((sum, creator) => sum + creator.count, 0);
    const globalAveragePlay = totalWorks ? totalPlay / totalWorks : 0;
    return analysisCreators.map((creator): RankedCreator => ({
      ...creator,
      stableAveragePlay: Math.round(
        (creator.totalPlay + globalAveragePlay * CREATOR_RANKING_PRIOR_WORKS) /
        (creator.count + CREATOR_RANKING_PRIOR_WORKS)
      ),
    })).sort((a, b) =>
      b.stableAveragePlay - a.stableAveragePlay ||
      b.averagePlay - a.averagePlay ||
      b.totalPlay - a.totalPlay ||
      b.count - a.count ||
      b.latestPublishedAt - a.latestPublishedAt ||
      a.name.localeCompare(b.name, "zh-CN")
    );
  }, [analysisCreators]);
  const creatorTags = useMemo(() => [
    "全部",
    ...Array.from(new Set(analysisUps.flatMap((up) => up.tags))).sort((a, b) => a.localeCompare(b, "zh-CN")),
  ], [analysisUps]);
  const filteredCreators = useMemo(() => {
    const token = creatorQuery.normalize("NFKC").trim().toLocaleLowerCase("zh-CN");
    return analysisUps.filter((creator) => {
      const matchesTag = creatorTag === "全部" || creator.tags.includes(creatorTag);
      if (!matchesTag) return false;
      if (!token) return true;
      return [creator.name, ...creator.aliases, ...creator.tags, creator.sourceLabel]
        .some((value) => value.normalize("NFKC").toLocaleLowerCase("zh-CN").includes(token));
    });
  }, [analysisUps, creatorQuery, creatorTag]);
  const analysisCharacters = useMemo(() => Array.from(new Set(analysisArchive.flatMap((item) => item.characters || [])))
    .map((name) => ({ name, count: analysisArchive.filter((item) => item.characters?.includes(name)).length }))
    .filter((item) => item.count >= 1)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh-CN")), [analysisArchive]);
  const analysisCategories = useMemo(() => Array.from(new Set(analysisArchive.map((item) => item.category).filter((value): value is string => Boolean(value))))
    .map((name) => ({ name, count: analysisArchive.filter((item) => item.category === name).length }))
    .sort((a, b) => {
      const aIndex = CREATION_CATEGORY_ORDER.indexOf(a.name);
      const bIndex = CREATION_CATEGORY_ORDER.indexOf(b.name);
      return (aIndex < 0 ? CREATION_CATEGORY_ORDER.length : aIndex) - (bIndex < 0 ? CREATION_CATEGORY_ORDER.length : bIndex) || b.count - a.count;
    }), [analysisArchive]);

  useEffect(() => {
    if (!analysisCharacter && analysisCharacters[0]) setAnalysisCharacter(analysisCharacters[0].name);
    if (!analysisCategory && analysisCategories[0]) setAnalysisCategory(analysisCategories[0].name);
  }, [analysisCategories, analysisCategory, analysisCharacter, analysisCharacters]);

  useEffect(() => {
    setAnalysisVisibleLimit(ANALYSIS_BATCH_SIZE);
  }, [analysisMode, analysisCharacter, analysisCategory, onlyUnseen.demonic]);

  useEffect(() => {
    if (deepLinkLoadRequestedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const hasDeepLink = params.has("up") || episodeFromSearch(params) != null;
    if (!hasDeepLink) return;
    deepLinkLoadRequestedRef.current = true;
    setActive("demonic");
    void loadRealmData("demonic");
  }, [loadRealmData]);

  useEffect(() => {
    if (deepLinkReadyRef.current || !analysisArchive.length) return;

    const params = new URLSearchParams(window.location.search);
    const token = params.get("up")?.normalize("NFKC").trim();
    const normalizedToken = token?.toLocaleLowerCase("zh-CN");
    const linkedUp = normalizedToken
      ? analysisUps.find((up) =>
          up.id === token ||
          up.shareCode?.toLocaleLowerCase("zh-CN") === normalizedToken ||
          up.name.normalize("NFKC").trim().toLocaleLowerCase("zh-CN") === normalizedToken ||
          up.aliases.some((alias) => alias.normalize("NFKC").trim().toLocaleLowerCase("zh-CN") === normalizedToken)
        )
      : undefined;

    deepLinkReadyRef.current = true;
    if (linkedUp) {
      setAnalysisUp(linkedUp.id);
      setAnalysisMode("directory");
      setActive("demonic");
      return;
    }

    const linkedEpisode = episodeFromSearch(params);
    if (linkedEpisode != null) {
      setAnalysisEpisode(linkedEpisode);
      setAnalysisMode("episode");
      setActive("demonic");
    }
  }, [analysisArchive.length, analysisUps]);

  useEffect(() => () => {
    if (shareFeedbackTimerRef.current) window.clearTimeout(shareFeedbackTimerRef.current);
  }, []);

  const setUpInAddress = (upId: string) => {
    const up = analysisUps.find((item) => item.id === upId);
    if (!up) return null;
    const url = compactPublicSearch(new URL(window.location.href));
    url.searchParams.set("up", up.shareCode || up.name);
    url.searchParams.delete("e");
    url.searchParams.delete("episode");
    url.hash = "";
    history.replaceState(history.state, "", url);
    return url;
  };

  const setEpisodeInAddress = (episode: number) => {
    const url = compactPublicSearch(new URL(window.location.href));
    url.searchParams.set("e", String(episode));
    url.searchParams.delete("episode");
    url.searchParams.delete("up");
    url.hash = "";
    history.replaceState(history.state, "", url);
  };

  const selectAnalysisUp = (upId: string) => {
    const up = analysisUps.find((item) => item.id === upId);
    trackEvent({
      eventName: "creator_open",
      realm: "demonic",
      objectType: "creator",
      objectId: upId,
      objectLabel: up?.name,
      context: analysisMode,
    });
    setAnalysisUp(upId);
    setAnalysisMode("directory");
    setShareCopied(false);
    setUpInAddress(upId);
  };

  const selectAnalysisMode = (mode: AnalysisMode) => {
    trackEvent({ eventName: "analysis_mode", realm: "demonic", objectType: "filter", objectId: mode });
    setAnalysisMode(mode);
    setShareCopied(false);
    if (mode === "directory") return;
    const url = compactPublicSearch(new URL(window.location.href));
    url.searchParams.delete("up");
    url.searchParams.delete("episode");
    if (mode === "episode" && analysisEpisode > 0) url.searchParams.set("e", String(analysisEpisode));
    else url.searchParams.delete("e");
    history.replaceState(history.state, "", url);
  };

  const selectAnalysisEpisode = (episode: number) => {
    setAnalysisEpisode(episode);
    setAnalysisMode("episode");
    setShareCopied(false);
    setEpisodeInAddress(episode);
  };

  const clearAnalysisUp = () => {
    setAnalysisUp("");
    setShareCopied(false);
    const url = compactPublicSearch(new URL(window.location.href));
    url.searchParams.delete("up");
    url.searchParams.delete("e");
    url.searchParams.delete("episode");
    history.replaceState(history.state, "", url);
  };

  const copyAnalysisUpLink = async () => {
    const url = setUpInAddress(analysisUp);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url.toString());
    } catch {
      const input = document.createElement("textarea");
      input.value = url.toString();
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    setShareCopied(true);
    trackEvent({
      eventName: "share_link_copy",
      realm: "demonic",
      objectType: "creator",
      objectId: analysisUp,
      objectLabel: analysisUps.find((item) => item.id === analysisUp)?.name,
    });
    if (shareFeedbackTimerRef.current) window.clearTimeout(shareFeedbackTimerRef.current);
    shareFeedbackTimerRef.current = window.setTimeout(() => setShareCopied(false), 1800);
  };

  const realms: Realm[] = [
    {
      key: "heaven",
      name: "天道盟",
      module: "今日追番",
      description: "今日新发现的解析与二创推荐，不知道看什么就从这里开始。",
      count: counts.creations,
      path: paths.heaven,
    },
    {
      key: "righteous",
      name: "正道",
      module: "正片 · 预告",
      description: "官方正片按篇章归档，下一话预告单独成卷。",
      count: counts.official,
      path: paths.righteous,
    },
    {
      key: "demonic",
      name: "魔道",
      module: "二创万象",
      description: "按剧集、作者、角色、类型与 AI 标记纵览全部二创。",
      count: counts.analysis,
      path: paths.demonic,
    },
    {
      key: "nine",
      name: "九国盟",
      module: "边境封印",
      description: "战火燃烧，暂未开放",
      count: 0,
      path: paths.nine,
      locked: true,
    },
  ];

  const activeRealm = realms.find((realm) => realm.key === active);
  const officialItems = official
    .filter((item) => item.arc === officialArc)
    .filter((item) => !onlyUnseen.righteous || !viewedItems.has(item.id));
  const hoveredArc = storyArcs.find((arc) => arc.key === previewArc);
  const hoveredArcLatest = hoveredArc
    ? official.find((item) => item.arc === hoveredArc.key)
    : undefined;

  const episodeAnalysisItems = useMemo(() => {
    const byCreator = new Map<string, AnalysisAtlasItem>();
    for (const item of analysisArchive) {
      if (!item.episodes.includes(analysisEpisode)) continue;
      const key = item.contentType === "episode" ? item.upId : item.id;
      const previous = byCreator.get(key);
      if (!previous || (item.play || 0) > (previous.play || 0)) byCreator.set(key, item);
    }
    return Array.from(byCreator.values()).sort((a, b) => (b.play || 0) - (a.play || 0));
  }, [analysisArchive, analysisEpisode]);

  const selectedCreator = analysisUps.find((creator) => creator.id === analysisUp);
  const selectedCreatorItems = analysisArchive
    .filter((item) => item.upId === analysisUp)
    .filter((item) => !onlyUnseen.demonic || !viewedItems.has(item.id))
    .sort((a, b) => b.publishedAt - a.publishedAt || (b.play || 0) - (a.play || 0));
  const analysisItems = episodeAnalysisItems.filter((item) => !onlyUnseen.demonic || !viewedItems.has(item.id));
  const latestAnalysisItems = analysisArchive
    .filter((item) => !onlyUnseen.demonic || !viewedItems.has(item.id))
    .slice(0, 120);
  const characterItems = analysisArchive
    .filter((item) => item.characters.includes(analysisCharacter))
    .filter((item) => !onlyUnseen.demonic || !viewedItems.has(item.id));
  const categoryItems = analysisArchive
    .filter((item) => item.category === analysisCategory)
    .filter((item) => !onlyUnseen.demonic || !viewedItems.has(item.id));
  const aiItems = analysisArchive
    .filter((item) => item.aiLabel)
    .filter((item) => !onlyUnseen.demonic || !viewedItems.has(item.id));

  const dailySelection = useMemo(() => {
    const used = new Set<string>();
    const latestAt = Math.max(0, ...creations.map((item) => item.publishedAt));
    const value = (item: CreationAtlasItem) =>
      (viewedItems.has(item.id) ? 0 : 1_000_000) + item.score * 10_000 + Math.min(item.metrics.growth, 500_000) + item.metrics.engagementRate * 100_000 + item.publishedAt / 1_000_000_000;
    const ranked = creations.slice().sort((a, b) => value(b) - value(a));
    const recent = ranked.filter((item) => latestAt - item.publishedAt <= 14 * 24 * 60 * 60 * 1000);
    const currentEpisodePicks = ranked.filter((item) => currentEpisode != null && item.episodes.includes(currentEpisode));
    const must = selectDiverse(currentEpisodePicks, 3, used);
    must.push(...selectDiverse((recent.length ? recent : ranked).filter((item) => !used.has(item.id)), 5 - must.length, used));
    const discoveries = selectDiverse(ranked.filter((item) => item.lane === "new_creator_watch"), 3, used);
    const hidden = selectDiverse(ranked.filter((item) => item.lane === "hidden_gem" || item.lane === "related_archive" || (item.metrics.engagementRate >= 0.06 && latestAt - item.publishedAt > 7 * 24 * 60 * 60 * 1000)), 3, used);
    if (must.length < 5) must.push(...selectDiverse(ranked, 5 - must.length, used));
    if (discoveries.length < 3) discoveries.push(...selectDiverse(ranked, 3 - discoveries.length, used));
    if (hidden.length < 3) hidden.push(...selectDiverse(ranked, 3 - hidden.length, used));
    return { must, discoveries, hidden, all: [...must, ...discoveries, ...hidden] };
  }, [creations, currentEpisode, viewedItems]);
  const dailyViewedCount = dailySelection.all.filter((item) => viewedItems.has(item.id)).length;

  const openRealm = (realm: Realm) => {
    if (realm.locked) {
      trackEvent({ eventName: "realm_locked_click", realm: realm.key, objectType: "realm", objectId: realm.key, objectLabel: realm.name });
      return;
    }
    const key = realm.key as OpenRealm;
    trackEvent({ eventName: "realm_open", realm: key, objectType: "realm", objectId: key, objectLabel: `${realm.name} · ${realm.module}` });
    setActive(key);
    void loadRealmData(key);
  };
  const trackVideoOpen = (item: AtlasItem, realm: OpenRealm, mode: "inline" | "outbound") => {
    trackEvent({
      eventName: "video_open",
      realm,
      objectType: "video",
      objectId: item.id,
      objectLabel: item.title,
      context: mode,
    });
  };
  const guidedRealms = onboardingOpen
    ? new Set<GuidedRealm>(ONBOARDING_STEPS[onboardingStep].targets)
    : new Set<GuidedRealm>();

  return (
    <main className={`atlas-shell ${active ? "scroll-open" : ""} ${onboardingOpen ? "is-guiding" : ""}`}>
      <header className="atlas-header">
        <a className="atlas-brand" href="#atlas" aria-label="凡人残图首页">
          <span className="atlas-seal" aria-hidden="true">凡<br />图</span>
          <span><strong>凡人残图</strong><small>天南寻迹图</small></span>
        </a>
        <p>第 {currentEpisode || "—"} 话 · {generatedLabel}</p>
        <div className="atlas-guide">
          <button type="button" aria-label="残图指引" onClick={startOnboardingManually}>残图指引</button>
        </div>
      </header>

      <section className="atlas-stage" id="atlas" aria-label="天南势力内容地图">
        <div className="map-media">
          <img
            className="map-placeholder"
            src="/tiannan-map-blur.webp"
            alt=""
            aria-hidden="true"
            width={48}
            height={27}
            decoding="async"
          />
          <picture className="map-picture">
            <source media="(max-width: 720px)" srcSet="/tiannan-map-960.webp" type="image/webp" />
            <source srcSet="/tiannan-map-1440.webp" type="image/webp" />
            <img
              src="/tiannan-map-1440.webp"
              alt="天南舆图"
              width={1440}
              height={799}
              draggable={false}
              decoding="sync"
              loading="eager"
              fetchPriority="high"
            />
          </picture>
          <div className="map-wash" aria-hidden="true" />
          <svg className="realm-overlay" viewBox="0 0 1882 1044" role="group" aria-label="可探索区域">
            {realms.map((realm) => (
              <g
                className={`realm realm-${realm.key} ${hovered === realm.key ? "is-hovered" : ""} ${guidedRealms.has(realm.key) ? "is-guided" : ""} ${realm.locked ? "is-locked" : ""}`}
                key={realm.key}
                onMouseEnter={() => setHovered(realm.key)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(realm.key)}
                onBlur={() => setHovered(null)}
                onClick={() => openRealm(realm)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") openRealm(realm);
                }}
                role="button"
                tabIndex={0}
                aria-disabled={realm.locked}
                aria-label={`${realm.name}：${realm.locked ? realm.description : realm.module}`}
              >
                <path className="realm-hit" d={realm.path} />
                <path className="realm-line realm-line-soft" d={realm.path} />
                <path className="realm-line realm-line-bright" d={realm.path} />
              </g>
            ))}
          </svg>

          {realms.map((realm) => (
            <div
              className={`realm-badge badge-${realm.key} ${hovered === realm.key ? "is-hovered" : ""} ${guidedRealms.has(realm.key) ? "is-guided" : ""}`}
              style={labelPositions[realm.key]}
              key={realm.key}
              aria-hidden="true"
            >
              <strong>{realm.name}</strong>
              <span>{realm.module}{realm.count ? ` · ${realm.count}` : ""}</span>
              <small>{realm.locked ? "战火燃烧，暂未开放" : "入境一观 · 点击展开"}</small>
            </div>
          ))}
        </div>
      </section>
      {onboardingOpen && (
        <AtlasOnboarding
          step={onboardingStep}
          onStepChange={changeOnboardingStep}
          onComplete={finishOnboarding}
          onSkip={skipOnboarding}
        />
      )}

      <div className={`scroll-backdrop ${active ? "visible" : ""}`} onClick={() => setActive(null)} aria-hidden={!active} />

      <div
        className={`exit-confirm ${exitConfirm ? "visible" : ""}`}
        role="presentation"
        onClick={() => setExitConfirm(false)}
        aria-hidden={!exitConfirm}
      >
        <section role="alertdialog" aria-modal="true" aria-labelledby="exit-confirm-title" onClick={(event) => event.stopPropagation()}>
          <span className="exit-seal" aria-hidden="true">留</span>
          <p>即将离开天南舆图</p>
          <h2 id="exit-confirm-title">确定要退出吗？</h2>
          <small>再次确认后才会返回上一页，当前浏览位置不会丢失。</small>
          <div>
            <button type="button" onClick={() => setExitConfirm(false)}>继续浏览</button>
            <button type="button" className="danger" onClick={confirmExit}>确认退出</button>
          </div>
        </section>
      </div>

      <section
        className={`ancient-scroll ${active ? "visible" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!active || Boolean(playingItem)}
        aria-labelledby="scroll-title"
      >
        <div className="scroll-roller left" aria-hidden="true"><i /><i /></div>
        <div className="scroll-sheet">
          <button className="scroll-close" type="button" onClick={() => setActive(null)} aria-label="收起古卷">收</button>
          <div className="scroll-content">
            <header className="scroll-heading">
              <div>
                <p>{activeRealm?.name} · CONTENT ARCHIVE</p>
                <h1 id="scroll-title">{activeRealm?.module}</h1>
              </div>
              <span>{activeRealm?.description}</span>
            </header>

            {active && realmStatus[active] === "loading" && (
              <div className="module-status"><span className="atlas-seal">载</span><strong>正在展开内容卷宗</strong><small>只在首次进入该区域时加载</small></div>
            )}
            {active && realmStatus[active] === "error" && (
              <div className="module-status"><span className="atlas-seal">候</span><strong>卷宗暂时未能展开</strong><button type="button" onClick={() => void loadRealmData(active, true)}>重新加载</button></div>
            )}

            {active === "righteous" && realmStatus.righteous === "ready" && (
              <div className="module-view official-view">
                <div className="realm-modebar">
                  <div className="mode-switch" aria-label="官方内容浏览方式">
                    <button className={officialMode === "episodes" ? "active" : ""} type="button" onClick={() => setOfficialMode("episodes")}>正片档案</button>
                    <button className={officialMode === "previews" ? "active" : ""} type="button" onClick={() => setOfficialMode("previews")}>官方预告 <small>{officialPreviews.length}</small></button>
                  </div>
                  <span className={adminMode && officialMode === "episodes" ? "admin-source-indicator" : ""}>{officialMode === "episodes" ? adminMode ? "管理员片源 · 暴风资源已接入" : "正片只认官方上线集数" : "预告独立成卷，不计入最新正片"}</span>
                </div>

                {officialMode === "episodes" && <>
                  <nav className="filter-rail arc-rail" aria-label="动画篇章">
                    {storyArcs.slice().reverse().map((arc) => (
                      <button
                        className={officialArc === arc.key ? "active" : ""}
                        type="button"
                        onClick={() => {
                          setOfficialArc(arc.key);
                          trackEvent({ eventName: "content_filter", realm: "righteous", objectType: "filter", objectId: arc.key, objectLabel: arc.label });
                        }}
                        onMouseEnter={() => setPreviewArc(arc.key)}
                        onMouseLeave={() => setPreviewArc(null)}
                        onFocus={() => setPreviewArc(arc.key)}
                        onBlur={() => setPreviewArc(null)}
                        key={arc.key}
                      >
                        <strong>{arc.label}</strong><small>第 {arc.start}—{arc.end} 话</small>
                        <span className="arc-hint">悬停预览 · 点击切换</span>
                      </button>
                    ))}
                  </nav>
                  <div className={`arc-preview ${hoveredArc ? "visible" : ""}`} aria-live="polite">
                    {hoveredArc && <>
                      <span>篇章速览</span>
                      <strong>{hoveredArc.label}</strong>
                      <small>第 {hoveredArc.start}—{hoveredArc.end} 话 · 共 {hoveredArc.end - hoveredArc.start + 1} 话</small>
                      <p>{hoveredArcLatest?.summary || "移入篇章即可预览范围，点击后切换下方剧集。"}</p>
                    </>}
                  </div>
                  <div className="ranking-head compact-head">
                    <strong>{storyArcs.find((arc) => arc.key === officialArc)?.label} · 正片档案</strong>
                    <div className="ranking-head-aside"><span>{officialItems.length} 话</span><button className={onlyUnseen.righteous ? "active" : ""} type="button" onClick={() => setOnlyUnseen((value) => ({ ...value, righteous: !value.righteous }))}>{onlyUnseen.righteous ? "显示全部" : "只看未看"}</button></div>
                  </div>
                  <div className="content-rail episode-rail">
                    {officialItems.map((item, index) => <MediaCard item={item} rank={index + 1} official adminMode={adminMode} viewed={viewedItems.has(item.id)} onViewed={markViewed} onPlay={setPlayingItem} onOpen={(opened, mode) => trackVideoOpen(opened, "righteous", mode)} key={item.id} />)}
                    {officialItems.length === 0 && <div className="empty-ranking"><strong>这一篇章都看过了</strong><p>切换“显示全部”即可回看已浏览的正片。</p></div>}
                  </div>
                </>}

                {officialMode === "previews" && (
                  <div className="preview-archive">
                    <header className="preview-intro"><span className="atlas-seal">先</span><div><small>下一话 · 先导玉简</small><strong>{officialPreviews[0]?.ep ? `第 ${officialPreviews[0].ep} 话预告已至` : "等待下一话预告"}</strong><p>正片上线后仍保留历史预告，方便回看每周伏笔。</p></div></header>
                    <div className="preview-grid">
                      {officialPreviews.filter((item) => !onlyUnseen.righteous || !viewedItems.has(item.id)).map((item, index) => <PreviewCard item={item} featured={index === 0} viewed={viewedItems.has(item.id)} onViewed={markViewed} onPlay={setPlayingItem} onOpen={(opened, mode) => trackVideoOpen(opened, "righteous", mode)} key={item.id} />)}
                    </div>
                  </div>
                )}
              </div>
            )}

            {active === "demonic" && realmStatus.demonic === "ready" && (
              <div className="module-view analysis-view">
                <div className="realm-modebar dimension-bar">
                  <div className="mode-switch dimension-switch" aria-label="二创浏览维度">
                    <button className={analysisMode === "latest" ? "active" : ""} type="button" onClick={() => selectAnalysisMode("latest")}>最新收录</button>
                    <button className={analysisMode === "episode" ? "active" : ""} type="button" onClick={() => selectAnalysisMode("episode")}>按剧集</button>
                    <button className={analysisMode === "directory" ? "active" : ""} type="button" onClick={() => { clearAnalysisUp(); selectAnalysisMode("directory"); }}>全部 UP</button>
                    <button className={analysisMode === "character" ? "active" : ""} type="button" onClick={() => selectAnalysisMode("character")}>按角色</button>
                    <button className={analysisMode === "category" ? "active" : ""} type="button" onClick={() => selectAnalysisMode("category")}>按类型</button>
                    <button className={analysisMode === "ai" ? "active" : ""} type="button" onClick={() => selectAnalysisMode("ai")}>AI 生成</button>
                  </div>
                  <button className={`unseen-toggle ${onlyUnseen.demonic ? "active" : ""}`} type="button" onClick={() => setOnlyUnseen((value) => ({ ...value, demonic: !value.demonic }))}>{onlyUnseen.demonic ? "仅未看" : "全部作品"}</button>
                </div>
                <div className="mode-row dimension-filters">
                  {analysisMode === "episode" && (
                    <div className="filter-rail slim episode-filter">
                      {analysisEpisodeOptions.map((ep) => (
                        <button className={analysisEpisode === ep ? "active" : ""} type="button" onClick={() => selectAnalysisEpisode(ep)} key={ep}>
                          <strong>{ep}</strong><small>话</small>
                        </button>
                      ))}
                    </div>
                  )}
                  {analysisMode === "character" && <div className="filter-rail slim dimension-filter">{analysisCharacters.map((item) => <button className={analysisCharacter === item.name ? "active" : ""} type="button" onClick={() => { setAnalysisCharacter(item.name); trackEvent({ eventName: "content_filter", realm: "demonic", objectType: "filter", objectId: item.name, context: "character" }); }} key={item.name}><strong>{item.name}</strong><small>{item.count}</small></button>)}</div>}
                  {analysisMode === "category" && <div className="filter-rail slim dimension-filter">{analysisCategories.map((item) => <button className={analysisCategory === item.name ? "active" : ""} type="button" onClick={() => { setAnalysisCategory(item.name); trackEvent({ eventName: "content_filter", realm: "demonic", objectType: "filter", objectId: item.name, context: "category" }); }} key={item.name}><strong>{item.name}</strong><small>{item.count}</small></button>)}</div>}
                </div>

                {analysisMode === "latest" && <>
                  <div className="archive-overview"><div><strong>{analysisArchive.length}</strong><span>全部作品</span></div><div><strong>{analysisUps.length}</strong><span>收录 UP</span></div><div><strong>{analysisCharacters.length}</strong><span>角色索引</span></div><div><strong>{analysisArchive.filter((item) => item.aiLabel).length}</strong><span>AI 标记</span></div></div>
                  <div className="ranking-head"><strong>万象新卷 · 最近收录</strong><span>所有维度共用同一座二创资料库</span></div>
                  <div className="rank-list">{latestAnalysisItems.map((item, index) => <MediaCard item={item} rank={index + 1} compact viewed={viewedItems.has(item.id)} onViewed={markViewed} onPlay={setPlayingItem} onOpen={(opened, mode) => trackVideoOpen(opened, "demonic", mode)} key={item.id} />)}</div>
                </>}

                {analysisMode === "episode" && <>
                  <div className="ranking-head">
                    <strong>第 {analysisEpisode} 话 · 百家论道</strong>
                    <div className="ranking-head-aside"><span>{analysisItems.length} 条 · 按播放量排列</span><button className={onlyUnseen.demonic ? "active" : ""} type="button" onClick={() => setOnlyUnseen((value) => ({ ...value, demonic: !value.demonic }))}>{onlyUnseen.demonic ? "显示全部" : "只看未看"}</button></div>
                  </div>
                  <div className="rank-list">
                    {analysisItems.map((item, index) => <MediaCard item={item} rank={index + 1} compact viewed={viewedItems.has(item.id)} onViewed={markViewed} onPlay={setPlayingItem} onOpen={(opened, mode) => trackVideoOpen(opened, "demonic", mode)} key={item.id} />)}
                    {analysisItems.length === 0 && <div className="empty-ranking"><strong>本话暂时没有未看解析</strong><p>可以显示全部，或切换到其他剧集。</p></div>}
                  </div>
                </>}

                {analysisMode === "directory" && !selectedCreator && <>
                  <div className="creator-tools">
                    <label><span>筛选全部 {analysisUps.length} 位 UP</span><input value={creatorQuery} onChange={(event) => setCreatorQuery(event.target.value)} placeholder="输入 UP 名、别名或擅长类型" /></label>
                    <nav className="filter-rail slim" aria-label="作者类型">
                      {creatorTags.map((tag) => <button className={creatorTag === tag ? "active" : ""} type="button" onClick={() => setCreatorTag(tag)} key={tag}><strong>{tag}</strong></button>)}
                    </nav>
                  </div>
                  <div className="ranking-head"><strong>百家名录 · 稳定均播排行</strong><span>{filteredCreators.length} 位 · 兼顾实际均播与收录量，单篇爆款适度降权</span></div>
                  <div className="creator-grid">{filteredCreators.map((creator, index) => <CreatorCard creator={creator} rank={index + 1} onSelect={selectAnalysisUp} key={creator.id} />)}</div>
                </>}

                {analysisMode === "directory" && selectedCreator && <>
                  <div className="creator-detail-head">
                    <button type="button" onClick={clearAnalysisUp}>← 返回全部 UP</button>
                    <div><strong>{selectedCreator.name}</strong><span>{selectedCreator.sourceLabel} · {selectedCreator.count} 部作品 · 均播 {formatPlay(selectedCreator.averagePlay)}</span><small>{selectedCreator.tags.join(" · ") || "内容待完善"}</small></div>
                    <a href={selectedCreator.profileUrl} target="_blank" rel="noreferrer">B站主页</a>
                  </div>
                  <div className="ranking-head">
                    <strong>{selectedCreator.name} · 内容归档</strong>
                    <div className="ranking-head-aside"><span>{selectedCreatorItems.length} 条</span><button className={onlyUnseen.demonic ? "active" : ""} type="button" onClick={() => setOnlyUnseen((value) => ({ ...value, demonic: !value.demonic }))}>{onlyUnseen.demonic ? "显示全部" : "只看未看"}</button><button className={shareCopied ? "copied" : ""} type="button" onClick={copyAnalysisUpLink}>{shareCopied ? "入口已复制" : "复制专属入口"}</button></div>
                  </div>
                  <div className="rank-list">
                    {selectedCreatorItems.map((item, index) => <MediaCard item={item} rank={index + 1} compact viewed={viewedItems.has(item.id)} onViewed={markViewed} onPlay={setPlayingItem} onOpen={(opened, mode) => trackVideoOpen(opened, "demonic", mode)} key={item.id} />)}
                    {selectedCreatorItems.length === 0 && <div className="empty-ranking"><strong>该作者的作品都看过了</strong><p>切换“显示全部”即可重新查看。</p></div>}
                  </div>
                </>}

                {analysisMode === "character" && <>
                  <div className="ranking-head"><strong>{analysisCharacter || "角色"} · 相关二创</strong><span>{characterItems.length} 部 · 由标题与内容标签汇聚</span></div>
                  <div className="rank-list">{characterItems.slice(0, analysisVisibleLimit).map((item, index) => <MediaCard item={item} rank={index + 1} compact viewed={viewedItems.has(item.id)} onViewed={markViewed} onPlay={setPlayingItem} onOpen={(opened, mode) => trackVideoOpen(opened, "demonic", mode)} key={item.id} />)}{characterItems.length === 0 && <div className="empty-ranking"><strong>暂未找到相关作品</strong><p>可以换一个角色，或关闭“仅未看”。</p></div>}<LoadMore shown={Math.min(analysisVisibleLimit, characterItems.length)} total={characterItems.length} onMore={() => setAnalysisVisibleLimit((value) => value + ANALYSIS_BATCH_SIZE)} /></div>
                </>}

                {analysisMode === "category" && <>
                  <div className="ranking-head"><strong>{analysisCategory || "二创类型"} · 内容归档</strong><span>{categoryItems.length} 部</span></div>
                  <div className="rank-list">{categoryItems.slice(0, analysisVisibleLimit).map((item, index) => <MediaCard item={item} rank={index + 1} compact viewed={viewedItems.has(item.id)} onViewed={markViewed} onPlay={setPlayingItem} onOpen={(opened, mode) => trackVideoOpen(opened, "demonic", mode)} key={item.id} />)}{categoryItems.length === 0 && <div className="empty-ranking"><strong>这一类型暂无未看作品</strong><p>切换类型或显示全部即可继续探索。</p></div>}<LoadMore shown={Math.min(analysisVisibleLimit, categoryItems.length)} total={categoryItems.length} onMore={() => setAnalysisVisibleLimit((value) => value + ANALYSIS_BATCH_SIZE)} /></div>
                </>}

                {analysisMode === "ai" && <>
                  <div className="ai-disclosure"><span>AI</span><div><strong>AI 创作明确标记</strong><p>这里汇总标题或简介中明确说明 AI 生成、AI 翻唱、AI 配音及 AI 辅助的作品；不对未声明内容作主观判断。</p></div></div>
                  <div className="ranking-head"><strong>AI 生成与辅助创作</strong><span>{aiItems.length} 部</span></div>
                  <div className="rank-list">{aiItems.map((item, index) => <MediaCard item={{ ...item, badge: item.aiLabel || item.badge }} rank={index + 1} compact viewed={viewedItems.has(item.id)} onViewed={markViewed} onPlay={setPlayingItem} onOpen={(opened, mode) => trackVideoOpen(opened, "demonic", mode)} key={item.id} />)}{aiItems.length === 0 && <div className="empty-ranking"><strong>暂无未看的 AI 标记作品</strong><p>切换“全部作品”可以查看完整归档。</p></div>}</div>
                </>}
              </div>
            )}

            {active === "heaven" && realmStatus.heaven === "ready" && (
              <div className="module-view daily-view">
                <section className="daily-briefing">
                  <div><small>天道盟 · DAILY DISCOVERY</small><strong>今日十一荐</strong><p>新作、增长、互动、新作者与历史口碑共同入选；同一 UP 不重复刷屏。</p></div>
                  <div className="daily-progress"><span><b>{dailyViewedCount}</b> / {dailySelection.all.length} 已阅</span><i><b style={{ width: `${dailySelection.all.length ? dailyViewedCount / dailySelection.all.length * 100 : 0}%` }} /></i><button className={onlyUnseen.heaven ? "active" : ""} type="button" onClick={() => setOnlyUnseen((value) => ({ ...value, heaven: !value.heaven }))}>{onlyUnseen.heaven ? "优先未看" : "包含已看"}</button></div>
                </section>
                <div className="daily-sections">
                  <section><header><div><small>01 · TODAY&apos;S PICKS</small><strong>今日必看</strong></div><span>综合新鲜度、推荐分与互动表现</span></header><div className="daily-grid">{dailySelection.must.filter((item) => !onlyUnseen.heaven || !viewedItems.has(item.id)).map((item, index) => <RecommendationCard item={item} rank={index + 1} viewed={viewedItems.has(item.id)} onViewed={markViewed} onPlay={setPlayingItem} onOpen={(opened, mode) => trackVideoOpen(opened, "heaven", mode)} key={item.id} />)}</div></section>
                  <section><header><div><small>02 · NEW DISCOVERY</small><strong>新发现</strong></div><span>新作者与 72 小时内首次发现</span></header><div className="daily-grid compact">{dailySelection.discoveries.filter((item) => !onlyUnseen.heaven || !viewedItems.has(item.id)).map((item, index) => <RecommendationCard item={item} rank={index + 1} viewed={viewedItems.has(item.id)} onViewed={markViewed} onPlay={setPlayingItem} onOpen={(opened, mode) => trackVideoOpen(opened, "heaven", mode)} key={item.id} />)}</div></section>
                  <section><header><div><small>03 · HIDDEN GEMS</small><strong>沧海遗珠</strong></div><span>时间稍久但互动与口碑仍然出色</span></header><div className="daily-grid compact">{dailySelection.hidden.filter((item) => !onlyUnseen.heaven || !viewedItems.has(item.id)).map((item, index) => <RecommendationCard item={item} rank={index + 1} viewed={viewedItems.has(item.id)} onViewed={markViewed} onPlay={setPlayingItem} onOpen={(opened, mode) => trackVideoOpen(opened, "heaven", mode)} key={item.id} />)}</div></section>
                  {onlyUnseen.heaven && dailyViewedCount === dailySelection.all.length && <div className="empty-ranking"><strong>今日精选已经全部看完</strong><p>晨晚两次寻迹会补入新作；也可以切换为“包含已看”重新回顾。</p></div>}
                  <details className="daily-submission"><summary><span>荐</span><div><strong>发现一部漏网好作？</strong><small>粘贴 UP 名称或 B 站链接，道友上报会进入审核队列。</small></div><b>展开举荐 ＋</b></summary><CommunityHub variant="discovery" items={[]} onRefresh={() => undefined} /></details>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="scroll-roller right" aria-hidden="true"><i /><i /></div>
      </section>
      {playingItem && <VideoPlayerModal item={playingItem} adminMode={adminMode} onClose={() => setPlayingItem(null)} />}
    </main>
  );
}
