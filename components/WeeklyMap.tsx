"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CommunityHub from "@/components/CommunityHub";
import type { CommunityItem } from "@/lib/community-types";
import type {
  AnalysisAtlasItem,
  AnalysisPayload,
  AtlasItem,
  CreationAtlasItem,
  CreationPayload,
  CreatorProfile,
  OfficialAtlasItem,
  OfficialPayload,
  StoryArc,
} from "@/lib/atlas-data";

type RealmKey = "righteous" | "demonic" | "heaven" | "nine";
type OpenRealm = RealmKey;
const CREATION_CATEGORY_ORDER = ["人物志", "剧情二创", "趣味整活", "混剪手书", "音乐配音", "同人创作"];
const VIEWED_ITEMS_KEY = "fanrenmap-viewed-items-v1";
const CREATION_LANES = [
  { key: "推荐", lane: null },
  { key: "本周热门", lane: "weekly_hot" },
  { key: "新人发现", lane: "new_creator_watch" },
  { key: "沧海遗珠", lane: "hidden_gem" },
  { key: "活动专题", lane: "event_spotlight" },
] as const;

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

function MediaCard({
  item,
  rank,
  compact = false,
  official = false,
  viewed = false,
  onViewed,
}: {
  item: AtlasItem;
  rank: number;
  compact?: boolean;
  official?: boolean;
  viewed?: boolean;
  onViewed?: (id: string) => void;
}) {
  if (official) {
    return (
      <a className={`media-card official-card ${viewed ? "is-viewed" : ""}`} href={item.url} target="_blank" rel="noreferrer" onClick={() => onViewed?.(item.id)}>
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
          <footer><small>{item.subtitle}</small><strong>前往观看 →</strong></footer>
        </div>
      </a>
    );
  }
  return (
    <a className={`media-card ${compact ? "compact" : ""} ${viewed ? "is-viewed" : ""}`} href={item.url} target="_blank" rel="noreferrer" onClick={() => onViewed?.(item.id)}>
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
        <span>{item.play != null ? `${formatPlay(item.play)} 播放` : "前往官方观看"}<em>阅 →</em></span>
      </div>
    </a>
  );
}

function CreatorCard({ creator, onSelect, reason }: { creator: CreatorProfile; onSelect: (id: string) => void; reason?: string }) {
  return (
    <button className="creator-card" type="button" onClick={() => onSelect(creator.id)}>
      <span className="creator-card-top"><strong>{creator.name}</strong><em>{reason || creator.sourceLabel}</em></span>
      <small>{creator.latestEpisode ? `最新第 ${creator.latestEpisode} 话` : `${creator.count} 部作品`} · {creator.sourceLabel}</small>
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
  const [analysisArchive, setAnalysisArchive] = useState<AnalysisAtlasItem[]>([]);
  const [analysisCreators, setAnalysisCreators] = useState<CreatorProfile[]>([]);
  const [creations, setCreations] = useState<CreationAtlasItem[]>([]);
  const [communityItems, setCommunityItems] = useState<CommunityItem[]>([]);
  const [realmStatus, setRealmStatus] = useState<Record<OpenRealm, "idle" | "loading" | "ready" | "error">>({
    righteous: "idle",
    demonic: "idle",
    heaven: "idle",
    nine: "idle",
  });
  const [officialArc, setOfficialArc] = useState(storyArcs.at(-1)?.key || "");
  const [previewArc, setPreviewArc] = useState<string | null>(null);
  const [analysisMode, setAnalysisMode] = useState<"recommend" | "episode" | "directory">("recommend");
  const [analysisEpisode, setAnalysisEpisode] = useState(currentEpisode || 0);
  const [analysisUp, setAnalysisUp] = useState("");
  const [creatorQuery, setCreatorQuery] = useState("");
  const [creatorTag, setCreatorTag] = useState("全部");
  const [shareCopied, setShareCopied] = useState(false);
  const [creationCategory, setCreationCategory] = useState("推荐");
  const [viewedItems, setViewedItems] = useState<Set<string>>(() => new Set());
  const [onlyUnseen, setOnlyUnseen] = useState<Record<OpenRealm, boolean>>({ righteous: false, demonic: false, heaven: false, nine: false });
  const [exitConfirm, setExitConfirm] = useState(false);
  const exitBypassRef = useRef(false);
  const deepLinkReadyRef = useRef(false);
  const deepLinkLoadRequestedRef = useRef(false);
  const shareFeedbackTimerRef = useRef<number | null>(null);
  const loadedRealmsRef = useRef<Set<OpenRealm>>(new Set());
  const loadingRealmsRef = useRef<Set<OpenRealm>>(new Set());

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
      } else {
        const response = await fetch("/api/community");
        if (!response.ok) throw new Error("community payload unavailable");
        const payload = await response.json() as { items: CommunityItem[] };
        setCommunityItems(payload.items || []);
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
    if (!active && !exitConfirm) return;
    const close = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (exitConfirm) setExitConfirm(false);
      else setActive(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [active, exitConfirm]);

  const analysisEpisodes = useMemo(
    () => Array.from(new Set(analysisArchive
      .filter((item) => item.contentType === "episode")
      .map((item) => item.ep)
      .filter((ep): ep is number => ep != null))).sort((a, b) => b - a),
    [analysisArchive]
  );
  const analysisUps = useMemo(
    () => analysisCreators.slice().sort((a, b) => b.latestPublishedAt - a.latestPublishedAt || b.count - a.count || a.name.localeCompare(b.name, "zh-CN")),
    [analysisCreators]
  );
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
  const creationCategories = useMemo(
    () => [
      ...CREATION_LANES.map((item) => item.key),
      "总榜",
      ...CREATION_CATEGORY_ORDER.filter((category) => creations.some((item) => item.category === category)),
      ...Array.from(new Set(creations.map((item) => item.category))).filter((category) => !CREATION_CATEGORY_ORDER.includes(category)),
    ],
    [creations]
  );

  useEffect(() => {
    if (deepLinkLoadRequestedRef.current) return;
    const hasDeepLink = new URLSearchParams(window.location.search).has("up");
    if (!hasDeepLink) return;
    deepLinkLoadRequestedRef.current = true;
    setActive("demonic");
    void loadRealmData("demonic");
  }, [loadRealmData]);

  useEffect(() => {
    if (deepLinkReadyRef.current || !analysisUps.length) return;
    deepLinkReadyRef.current = true;

    const token = new URLSearchParams(window.location.search).get("up")?.normalize("NFKC").trim();
    const normalizedToken = token?.toLocaleLowerCase("zh-CN");
    const linkedUp = normalizedToken
      ? analysisUps.find((up) =>
          up.id === token ||
          up.shareCode?.toLocaleLowerCase("zh-CN") === normalizedToken ||
          up.name.normalize("NFKC").trim().toLocaleLowerCase("zh-CN") === normalizedToken ||
          up.aliases.some((alias) => alias.normalize("NFKC").trim().toLocaleLowerCase("zh-CN") === normalizedToken)
        )
      : undefined;

    if (linkedUp) {
      setAnalysisUp(linkedUp.id);
      setAnalysisMode("directory");
      setActive("demonic");
      return;
    }
  }, [analysisUps]);

  useEffect(() => () => {
    if (shareFeedbackTimerRef.current) window.clearTimeout(shareFeedbackTimerRef.current);
  }, []);

  const setUpInAddress = (upId: string) => {
    const up = analysisUps.find((item) => item.id === upId);
    if (!up) return null;
    const url = new URL(window.location.href);
    url.searchParams.set("up", up.shareCode || up.name);
    url.hash = "";
    history.replaceState(history.state, "", url);
    return url;
  };

  const selectAnalysisUp = (upId: string) => {
    setAnalysisUp(upId);
    setAnalysisMode("directory");
    setShareCopied(false);
    setUpInAddress(upId);
  };

  const selectAnalysisMode = (mode: "recommend" | "episode" | "directory") => {
    setAnalysisMode(mode);
    setShareCopied(false);
    if (mode === "directory") return;
    const url = new URL(window.location.href);
    url.searchParams.delete("up");
    history.replaceState(history.state, "", url);
  };

  const clearAnalysisUp = () => {
    setAnalysisUp("");
    setShareCopied(false);
    const url = new URL(window.location.href);
    url.searchParams.delete("up");
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
    if (shareFeedbackTimerRef.current) window.clearTimeout(shareFeedbackTimerRef.current);
    shareFeedbackTimerRef.current = window.setTimeout(() => setShareCopied(false), 1800);
  };

  const realms: Realm[] = [
    {
      key: "heaven",
      name: "天道盟",
      module: "万象二创",
      description: "人物志、趣味恶搞与混剪手书，入盟一观今日榜单。",
      count: counts.creations,
      path: paths.heaven,
    },
    {
      key: "righteous",
      name: "正道",
      module: "官方正片",
      description: "按动画篇章循迹，快速抵达每一段修仙旅程。",
      count: counts.official,
      path: paths.righteous,
    },
    {
      key: "demonic",
      name: "魔道",
      module: "UP 主解析",
      description: "本话推荐、全部 UP 名录与百家论道，一卷尽览。",
      count: counts.analysis,
      path: paths.demonic,
    },
    {
      key: "nine",
      name: "九国盟",
      module: "九国举荐",
      description: "慕兰烽火正烈，举荐喜欢的 UP 主与作品入阵。",
      count: communityItems.length,
      path: paths.nine,
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
      if (item.contentType !== "episode" || item.ep !== analysisEpisode) continue;
      const previous = byCreator.get(item.upId);
      if (!previous || (item.play || 0) > (previous.play || 0)) byCreator.set(item.upId, item);
    }
    return Array.from(byCreator.values()).sort((a, b) => (b.play || 0) - (a.play || 0));
  }, [analysisArchive, analysisEpisode]);

  const selectedCreator = analysisUps.find((creator) => creator.id === analysisUp);
  const selectedCreatorItems = analysisArchive
    .filter((item) => item.upId === analysisUp)
    .filter((item) => !onlyUnseen.demonic || !viewedItems.has(item.id))
    .sort((a, b) => b.publishedAt - a.publishedAt || (b.play || 0) - (a.play || 0));
  const analysisItems = episodeAnalysisItems.filter((item) => !onlyUnseen.demonic || !viewedItems.has(item.id));

  const creatorById = new Map(analysisUps.map((creator) => [creator.id, creator]));
  const currentEpisodeCreatorIds = Array.from(new Set(analysisArchive
    .filter((item) => item.contentType === "episode" && item.ep === currentEpisode)
    .map((item) => item.upId)));
  const currentEpisodeCreatorCount = currentEpisodeCreatorIds.length;
  const recommendableCreator = (creator: CreatorProfile) => !/账号已注销|哔哩哔哩用户/.test(creator.name);
  const currentEpisodeCreators = currentEpisodeCreatorIds
    .map((id) => creatorById.get(id))
    .filter((creator): creator is CreatorProfile => Boolean(creator))
    .filter(recommendableCreator)
    .sort((a, b) => b.latestPublishedAt - a.latestPublishedAt || b.averagePlay - a.averagePlay)
    .slice(0, 12);
  const stableCreators = analysisUps
    .filter((creator) => creator.episodeCount >= 5 && recommendableCreator(creator))
    .sort((a, b) => b.episodeCount - a.episodeCount || b.averagePlay - a.averagePlay)
    .slice(0, 12);
  const newCreators = analysisUps
    .filter((creator) => creator.source !== "tracked" && recommendableCreator(creator))
    .sort((a, b) => b.latestPublishedAt - a.latestPublishedAt || b.count - a.count)
    .slice(0, 12);

  const activeLane = CREATION_LANES.find((item) => item.key === creationCategory)?.lane;
  const creationItems = (creationCategory === "推荐"
    ? creations.slice().sort((a, b) => b.score - a.score || b.publishedAt - a.publishedAt)
    : activeLane
      ? creations.filter((item) => item.lane === activeLane).sort((a, b) => b.score - a.score || b.publishedAt - a.publishedAt)
      : creationCategory === "总榜"
        ? creations.slice().sort((a, b) => (b.play || 0) - (a.play || 0))
        : creations.filter((item) => item.category === creationCategory).sort((a, b) => b.score - a.score || (b.play || 0) - (a.play || 0))
  ).filter((item) => !onlyUnseen.heaven || !viewedItems.has(item.id));

  const creationFilterCount = (filter: string) => {
    if (filter === "推荐" || filter === "总榜") return creations.length;
    const lane = CREATION_LANES.find((item) => item.key === filter)?.lane;
    if (lane) return creations.filter((item) => item.lane === lane).length;
    return creations.filter((item) => item.category === filter).length;
  };

  const openRealm = (realm: Realm) => {
    if (realm.locked) return;
    const key = realm.key as OpenRealm;
    setActive(key);
    void loadRealmData(key);
  };

  return (
    <main className={`atlas-shell ${active ? "scroll-open" : ""}`}>
      <header className="atlas-header">
        <a className="atlas-brand" href="#atlas" aria-label="凡人残图首页">
          <span className="atlas-seal" aria-hidden="true">凡<br />图</span>
          <span><strong>凡人残图</strong><small>天南寻迹图</small></span>
        </a>
        <p>第 {currentEpisode || "—"} 话 · {generatedLabel}</p>
        <span className="atlas-guide">悬停寻境 · 点击开卷</span>
      </header>

      <section className="atlas-stage" id="atlas" aria-label="天南势力内容地图">
        <div className="map-media">
          <img className="map-placeholder" src="/tiannan-map-960.webp" alt="" aria-hidden="true" />
          <picture className="map-picture">
            <source media="(max-width: 720px)" srcSet="/tiannan-map-960.webp" type="image/webp" />
            <source srcSet="/tiannan-map.webp" type="image/webp" />
            <img
              src="/tiannan-map.png"
              alt="天南舆图"
              draggable={false}
              decoding="async"
              fetchPriority="high"
            />
          </picture>
          <div className="map-wash" aria-hidden="true" />
          <svg className="realm-overlay" viewBox="0 0 1882 1044" role="group" aria-label="可探索区域">
            {realms.map((realm) => (
              <g
                className={`realm realm-${realm.key} ${hovered === realm.key ? "is-hovered" : ""} ${realm.locked ? "is-locked" : ""}`}
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
              className={`realm-badge badge-${realm.key} ${hovered === realm.key ? "is-hovered" : ""}`}
              style={labelPositions[realm.key]}
              key={realm.key}
              aria-hidden="true"
            >
              <strong>{realm.name}</strong>
              <span>{realm.module}{realm.count ? ` · ${realm.count}` : ""}</span>
              <small>{realm.locked ? "战火纷争，尚未开放" : "入境一观 · 点击展开"}</small>
            </div>
          ))}
        </div>
      </section>

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
        aria-hidden={!active}
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
              <div className="module-view">
                <nav className="filter-rail arc-rail" aria-label="动画篇章">
                  {storyArcs.slice().reverse().map((arc) => (
                    <button
                      className={officialArc === arc.key ? "active" : ""}
                      type="button"
                      onClick={() => setOfficialArc(arc.key)}
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
                  {officialItems.map((item, index) => <MediaCard item={item} rank={index + 1} official viewed={viewedItems.has(item.id)} onViewed={markViewed} key={item.id} />)}
                  {officialItems.length === 0 && <div className="empty-ranking"><strong>这一篇章都看过了</strong><p>切换“显示全部”即可回看已浏览的正片。</p></div>}
                </div>
              </div>
            )}

            {active === "demonic" && realmStatus.demonic === "ready" && (
              <div className="module-view analysis-view">
                <div className="mode-row">
                  <div className="mode-switch" aria-label="解析浏览方式">
                    <button className={analysisMode === "recommend" ? "active" : ""} type="button" onClick={() => selectAnalysisMode("recommend")}>推荐</button>
                    <button className={analysisMode === "episode" ? "active" : ""} type="button" onClick={() => selectAnalysisMode("episode")}>按剧集</button>
                    <button className={analysisMode === "directory" ? "active" : ""} type="button" onClick={() => { clearAnalysisUp(); selectAnalysisMode("directory"); }}>全部 UP</button>
                  </div>
                  {analysisMode === "episode" && (
                    <div className="filter-rail slim episode-filter">
                      {analysisEpisodes.map((ep) => (
                        <button className={analysisEpisode === ep ? "active" : ""} type="button" onClick={() => setAnalysisEpisode(ep)} key={ep}>
                          <strong>{ep}</strong><small>话</small>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {analysisMode === "recommend" && (
                  <div className="recommendation-view">
                    <section className="creator-shelf">
                      <header><strong>本话先看谁</strong><span>第 {currentEpisode || "—"} 话已有 {currentEpisodeCreatorCount} 位道友更新</span></header>
                      <div>{currentEpisodeCreators.map((creator) => <CreatorCard creator={creator} onSelect={selectAnalysisUp} reason="本话有更" key={creator.id} />)}</div>
                    </section>
                    <section className="creator-shelf">
                      <header><strong>稳定更新</strong><span>按历史覆盖集数推荐</span></header>
                      <div>{stableCreators.map((creator) => <CreatorCard creator={creator} onSelect={selectAnalysisUp} reason={`${creator.episodeCount} 集持续更新`} key={creator.id} />)}</div>
                    </section>
                    <section className="creator-shelf">
                      <header><strong>新道友</strong><span>历史回填与二创发现中的新面孔</span></header>
                      <div>{newCreators.map((creator) => <CreatorCard creator={creator} onSelect={selectAnalysisUp} reason="新发现" key={creator.id} />)}</div>
                    </section>
                  </div>
                )}

                {analysisMode === "episode" && <>
                  <div className="ranking-head">
                    <strong>第 {analysisEpisode} 话 · 百家论道</strong>
                    <div className="ranking-head-aside"><span>{analysisItems.length} 条 · 按播放量排列</span><button className={onlyUnseen.demonic ? "active" : ""} type="button" onClick={() => setOnlyUnseen((value) => ({ ...value, demonic: !value.demonic }))}>{onlyUnseen.demonic ? "显示全部" : "只看未看"}</button></div>
                  </div>
                  <div className="rank-list">
                    {analysisItems.map((item, index) => <MediaCard item={item} rank={index + 1} compact viewed={viewedItems.has(item.id)} onViewed={markViewed} key={item.id} />)}
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
                  <div className="ranking-head"><strong>百家名录</strong><span>{filteredCreators.length} 位 · 点击查看全部收录作品</span></div>
                  <div className="creator-grid">{filteredCreators.map((creator) => <CreatorCard creator={creator} onSelect={selectAnalysisUp} key={creator.id} />)}</div>
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
                    {selectedCreatorItems.map((item, index) => <MediaCard item={item} rank={index + 1} compact viewed={viewedItems.has(item.id)} onViewed={markViewed} key={item.id} />)}
                    {selectedCreatorItems.length === 0 && <div className="empty-ranking"><strong>该作者的作品都看过了</strong><p>切换“显示全部”即可重新查看。</p></div>}
                  </div>
                </>}
              </div>
            )}

            {active === "heaven" && realmStatus.heaven === "ready" && (
              <div className="module-view creation-view">
                <nav className="filter-rail category-rail" aria-label="二创推荐与分类">
                  {creationCategories.map((category) => (
                    <button className={creationCategory === category ? "active" : ""} type="button" onClick={() => setCreationCategory(category)} key={category}>
                      <strong>{category}</strong><small>{creationFilterCount(category)} 部</small>
                    </button>
                  ))}
                </nav>
                <div className="ranking-head">
                  <strong>{creationCategory} · 天道榜</strong>
                  <div className="ranking-head-aside"><span>{creationCategory === "总榜" ? "按累计播放" : "按推荐分与新鲜度"}</span><button className={onlyUnseen.heaven ? "active" : ""} type="button" onClick={() => setOnlyUnseen((value) => ({ ...value, heaven: !value.heaven }))}>{onlyUnseen.heaven ? "显示全部" : "只看未看"}</button></div>
                </div>
                <div className="rank-list creation-rank">
                  {creationItems.map((item, index) => <MediaCard item={item} rank={index + 1} compact viewed={viewedItems.has(item.id)} onViewed={markViewed} key={item.id} />)}
                  {creationItems.length === 0 && <div className="empty-ranking"><strong>这个榜单暂时没有未看作品</strong><p>切换“显示全部”即可重新查看。</p></div>}
                </div>
              </div>
            )}

            {active === "nine" && realmStatus.nine === "ready" && (
              <div className="module-view community-view">
                <CommunityHub items={communityItems} onRefresh={() => void loadRealmData("nine", true)} />
              </div>
            )}
          </div>
        </div>
        <div className="scroll-roller right" aria-hidden="true"><i /><i /></div>
      </section>
    </main>
  );
}
