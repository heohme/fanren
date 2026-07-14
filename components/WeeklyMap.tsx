"use client";

import { useEffect, useMemo, useState } from "react";

export interface AtlasItem {
  id: string;
  title: string;
  subtitle: string;
  cover: string;
  url: string;
  play?: number;
  badge?: string;
  summary?: string;
}

export interface OfficialAtlasItem extends AtlasItem {
  ep: number;
  arc: string;
}

export interface AnalysisAtlasItem extends AtlasItem {
  ep: number | null;
  upId: string;
  upName: string;
}

export interface CreationAtlasItem extends AtlasItem {
  category: string;
}

export interface StoryArc {
  key: string;
  label: string;
  start: number;
  end: number;
}

export interface AnalysisCreator {
  id: string;
  name: string;
  count: number;
  averagePlay: number;
  totalPlay: number;
  latestEpisode: number | null;
  note?: string;
}

type RealmKey = "righteous" | "demonic" | "heaven" | "nine";
type OpenRealm = Exclude<RealmKey, "nine">;
const CREATION_CATEGORY_ORDER = ["人物志", "剧情二创", "趣味整活", "混剪手书", "音乐配音", "同人创作"];

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

function MediaCard({ item, rank, compact = false, official = false }: { item: AtlasItem; rank: number; compact?: boolean; official?: boolean }) {
  return (
    <a className={`media-card ${compact ? "compact" : ""} ${official ? "official-card" : ""}`} href={item.url} target="_blank" rel="noreferrer">
      <div className="media-cover">
        <img src={item.cover} alt="" loading="lazy" referrerPolicy="no-referrer" />
        <i>{String(rank).padStart(2, "0")}</i>
        {item.badge && <b>{item.badge}</b>}
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

export default function WeeklyMap({
  official,
  storyArcs,
  analysis,
  analysisCreators,
  creations,
  currentEpisode,
  generatedLabel,
}: {
  official: OfficialAtlasItem[];
  storyArcs: StoryArc[];
  analysis: AnalysisAtlasItem[];
  analysisCreators: AnalysisCreator[];
  creations: CreationAtlasItem[];
  currentEpisode: number | null;
  generatedLabel: string;
}) {
  const [active, setActive] = useState<OpenRealm | null>(null);
  const [hovered, setHovered] = useState<RealmKey | null>(null);
  const [officialArc, setOfficialArc] = useState(storyArcs.at(-1)?.key || "");
  const [previewArc, setPreviewArc] = useState<string | null>(null);
  const [analysisMode, setAnalysisMode] = useState<"episode" | "up">("episode");
  const [analysisEpisode, setAnalysisEpisode] = useState(currentEpisode || 0);
  const [analysisUp, setAnalysisUp] = useState("");
  const [creationCategory, setCreationCategory] = useState("总榜");

  useEffect(() => {
    if (!active) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActive(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [active]);

  const analysisEpisodes = useMemo(
    () => Array.from(new Set(analysis.map((item) => item.ep).filter((ep): ep is number => ep != null))).sort((a, b) => b - a),
    [analysis]
  );
  const analysisUps = useMemo(
    () => analysisCreators.slice().sort((a, b) => b.count - a.count || b.averagePlay - a.averagePlay || a.name.localeCompare(b.name, "zh-CN")),
    [analysisCreators]
  );
  const creationCategories = useMemo(
    () => [
      "总榜",
      ...CREATION_CATEGORY_ORDER.filter((category) => creations.some((item) => item.category === category)),
      ...Array.from(new Set(creations.map((item) => item.category))).filter((category) => !CREATION_CATEGORY_ORDER.includes(category)),
    ],
    [creations]
  );

  useEffect(() => {
    if (!analysisUp && analysisUps[0]) setAnalysisUp(analysisUps[0].id);
  }, [analysisUp, analysisUps]);

  const realms: Realm[] = [
    {
      key: "heaven",
      name: "天道盟",
      module: "万象二创",
      description: "人物志、趣味恶搞与混剪手书，入盟一观今日榜单。",
      count: creations.length,
      path: paths.heaven,
    },
    {
      key: "righteous",
      name: "正道",
      module: "官方正片",
      description: "按动画篇章循迹，快速抵达每一段修仙旅程。",
      count: official.length,
      path: paths.righteous,
    },
    {
      key: "demonic",
      name: "魔道",
      module: "UP 主解析",
      description: "按话数聚合百家论道，也可循一位道友遍览其解读。",
      count: analysis.length,
      path: paths.demonic,
    },
    {
      key: "nine",
      name: "九国盟",
      module: "尚未开放",
      description: "残图尚缺，静候补全。",
      count: 0,
      path: paths.nine,
      locked: true,
    },
  ];

  const activeRealm = realms.find((realm) => realm.key === active);
  const officialItems = official.filter((item) => item.arc === officialArc);
  const hoveredArc = storyArcs.find((arc) => arc.key === previewArc);
  const hoveredArcLatest = hoveredArc
    ? official.find((item) => item.arc === hoveredArc.key)
    : undefined;
  const analysisItems = analysisMode === "episode"
    ? analysis.filter((item) => item.ep === analysisEpisode).sort((a, b) => (b.play || 0) - (a.play || 0))
    : analysis.filter((item) => item.upId === analysisUp).sort((a, b) => (b.ep || 0) - (a.ep || 0) || (b.play || 0) - (a.play || 0));
  const creationItems = (creationCategory === "总榜"
    ? creations
    : creations.filter((item) => item.category === creationCategory)
  ).slice().sort((a, b) => (b.play || 0) - (a.play || 0));

  const openRealm = (realm: Realm) => {
    if (realm.locked) return;
    setActive(realm.key as OpenRealm);
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
          <img src="/tiannan-map.png" alt="天南舆图" draggable={false} />
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
                aria-label={`${realm.name}：${realm.module}${realm.locked ? "，暂未开放" : ""}`}
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
              <small>{realm.locked ? "残图尚缺 · 静候补全" : "入境一观 · 点击展开"}</small>
            </div>
          ))}
        </div>
      </section>

      <div className={`scroll-backdrop ${active ? "visible" : ""}`} onClick={() => setActive(null)} aria-hidden={!active} />

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

            {active === "righteous" && (
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
                <div className="content-rail episode-rail">
                  {officialItems.map((item, index) => <MediaCard item={item} rank={index + 1} official key={item.id} />)}
                </div>
              </div>
            )}

            {active === "demonic" && (
              <div className="module-view analysis-view">
                <div className="mode-row">
                  <div className="mode-switch" aria-label="解析筛选方式">
                    <button className={analysisMode === "episode" ? "active" : ""} type="button" onClick={() => setAnalysisMode("episode")}>按剧集</button>
                    <button className={analysisMode === "up" ? "active" : ""} type="button" onClick={() => setAnalysisMode("up")}>按 UP 主</button>
                  </div>
                  <div className="filter-rail slim">
                    {analysisMode === "episode" ? analysisEpisodes.map((ep) => (
                      <button className={analysisEpisode === ep ? "active" : ""} type="button" onClick={() => setAnalysisEpisode(ep)} key={ep}>
                        <strong>{ep}</strong><small>话</small>
                      </button>
                    )) : analysisUps.map((up) => (
                      <button className={analysisUp === up.id ? "active" : ""} type="button" onClick={() => setAnalysisUp(up.id)} key={up.id}>
                        <strong>{up.name}</strong>
                        <small>{up.count} 条解析 · 均播 {formatPlay(up.averagePlay)}</small>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="ranking-head">
                  <strong>{analysisMode === "episode" ? `第 ${analysisEpisode} 话 · 百家论道` : `${analysisUps.find((up) => up.id === analysisUp)?.name || "UP 主"} · 解析归档`}</strong>
                  <span>{analysisMode === "episode"
                    ? `${analysisItems.length} 条 · 按播放量排列`
                    : `${analysisItems.length} 条 · 均播 ${formatPlay(analysisUps.find((up) => up.id === analysisUp)?.averagePlay || 0)}`}</span>
                </div>
                <div className="rank-list">
                  {analysisItems.map((item, index) => <MediaCard item={item} rank={index + 1} compact key={item.id} />)}
                  {analysisMode === "up" && analysisItems.length === 0 && (
                    <div className="empty-ranking">
                      <strong>已列入主播白名单</strong>
                      <p>利维坦等专题型 UP 暂无可识别的逐集标题；人物志与深度专题会在天道盟展示。</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {active === "heaven" && (
              <div className="module-view creation-view">
                <nav className="filter-rail category-rail" aria-label="二创分类">
                  {creationCategories.map((category) => (
                    <button className={creationCategory === category ? "active" : ""} type="button" onClick={() => setCreationCategory(category)} key={category}>
                      <strong>{category}</strong>
                      <small>{category === "总榜" ? creations.length : creations.filter((item) => item.category === category).length} 部</small>
                    </button>
                  ))}
                </nav>
                <div className="ranking-head">
                  <strong>{creationCategory} · 天道榜</strong><span>按播放量排列</span>
                </div>
                <div className="rank-list creation-rank">
                  {creationItems.map((item, index) => <MediaCard item={item} rank={index + 1} compact key={item.id} />)}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="scroll-roller right" aria-hidden="true"><i /><i /></div>
      </section>
    </main>
  );
}
