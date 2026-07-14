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
}

type RealmKey = "righteous" | "demonic" | "heaven" | "nine";

interface Realm {
  key: RealmKey;
  name: string;
  module: string;
  description: string;
  count: number;
  path: string;
  labelX: number;
  labelY: number;
  locked?: boolean;
}

const paths: Record<RealmKey, string> = {
  heaven:
    "M455 132 L500 104 L624 109 L688 117 L770 142 L882 123 L1032 112 L1154 119 L1272 137 L1360 170 L1474 226 L1432 293 L1358 318 L1287 348 L1210 372 L1134 424 L1049 445 L974 418 L892 412 L811 421 L728 389 L655 392 L598 359 L510 335 L441 276 L398 222 Z",
  righteous:
    "M188 221 L386 230 L453 299 L575 340 L700 385 L810 424 L930 423 L1018 476 L1009 567 L913 620 L801 688 L679 727 L528 734 L367 700 L261 710 L128 666 L122 530 L151 409 Z",
  demonic:
    "M1434 190 L1537 226 L1640 240 L1768 305 L1840 380 L1818 490 L1794 608 L1686 660 L1531 677 L1437 695 L1311 670 L1194 650 L1074 615 L1005 567 L1022 477 L1112 424 L1204 369 L1286 346 L1363 304 Z",
  nine:
    "M552 682 L681 724 L801 689 L913 622 L1030 604 L1175 648 L1298 678 L1424 706 L1550 691 L1595 748 L1510 807 L1383 829 L1259 855 L1125 872 L985 865 L841 862 L710 838 L593 804 L510 753 Z",
};

function formatPlay(value = 0) {
  if (value >= 10000) return `${(value / 10000).toFixed(value >= 100000 ? 0 : 1)}万`;
  return String(value);
}

export default function WeeklyMap({
  official,
  analysis,
  creations,
  currentEpisode,
  generatedLabel,
}: {
  official: AtlasItem[];
  analysis: AtlasItem[];
  creations: AtlasItem[];
  currentEpisode: number | null;
  generatedLabel: string;
}) {
  const [active, setActive] = useState<Exclude<RealmKey, "nine"> | null>(null);
  const [hovered, setHovered] = useState<RealmKey | null>(null);

  useEffect(() => {
    if (!active) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActive(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [active]);

  const realms: Realm[] = useMemo(
    () => [
      {
        key: "heaven",
        name: "天道盟",
        module: "万象二创",
        description: "剪辑、手书与同人妙想，按播放量寻得本周热作。",
        count: creations.length,
        path: paths.heaven,
        labelX: 900,
        labelY: 272,
      },
      {
        key: "righteous",
        name: "正道",
        module: "官方正片",
        description: "循官方时间线回看已播正片，最新一话居首。",
        count: official.length,
        path: paths.righteous,
        labelX: 560,
        labelY: 520,
      },
      {
        key: "demonic",
        name: "魔道",
        module: "UP 主解析",
        description: "百家论道、逐帧拆解，按播放量从高到低排列。",
        count: analysis.length,
        path: paths.demonic,
        labelX: 1455,
        labelY: 468,
      },
      {
        key: "nine",
        name: "九国盟",
        module: "尚未开放",
        description: "残图尚缺，静候补全。",
        count: 0,
        path: paths.nine,
        labelX: 1030,
        labelY: 760,
        locked: true,
      },
    ],
    [analysis.length, creations.length, official.length]
  );

  const activeRealm = realms.find((realm) => realm.key === active);
  const activeItems = active === "righteous" ? official : active === "demonic" ? analysis : creations;

  const openRealm = (realm: Realm) => {
    if (realm.locked) return;
    setActive(realm.key as Exclude<RealmKey, "nine">);
  };

  return (
    <main className={`atlas-shell ${active ? "scroll-open" : ""}`}>
      <header className="atlas-header">
        <a className="atlas-brand" href="#atlas" aria-label="凡人残图首页">
          <span className="atlas-seal" aria-hidden="true">凡<br />图</span>
          <span><strong>凡人残图</strong><small>天南寻迹图</small></span>
        </a>
        <p>第 {currentEpisode || "—"} 话 · {generatedLabel}</p>
        <a className="atlas-guide" href="#atlas-help">如何寻迹</a>
      </header>

      <section className="atlas-stage" id="atlas" aria-label="天南势力内容地图">
        <div className="map-viewport">
          <div className="map-board">
            <img src="/tiannan-map.png" alt="天南舆图" draggable={false} />
            <div className="map-wash" aria-hidden="true" />
            <svg
              className="realm-overlay"
              viewBox="0 0 1882 1044"
              role="group"
              aria-label="可探索区域"
              preserveAspectRatio="xMidYMid meet"
            >
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
                  <path className="realm-line" d={realm.path} />
                  <g className="realm-label" transform={`translate(${realm.labelX} ${realm.labelY})`}>
                    <rect x="-93" y="-41" width="186" height="82" rx="2" />
                    <text className="realm-name" textAnchor="middle" y="-7">{realm.name}</text>
                    <text className="realm-module" textAnchor="middle" y="21">{realm.module}</text>
                  </g>
                </g>
              ))}
            </svg>

            <div className="map-hint" id="atlas-help">
              <span aria-hidden="true">印</span>
              <p><strong>点击势力，展开古卷</strong><small>地图可横向拖动 · 九国盟尚未开放</small></p>
            </div>

            {hovered && (
              <div className={`realm-tooltip tooltip-${hovered}`} aria-hidden="true">
                {realms.find((realm) => realm.key === hovered)?.description}
              </div>
            )}
          </div>
        </div>
      </section>

      <div
        className={`scroll-backdrop ${active ? "visible" : ""}`}
        onClick={() => setActive(null)}
        aria-hidden={!active}
      />

      <section
        className={`ancient-scroll ${active ? "visible" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!active}
        aria-labelledby="scroll-title"
      >
        <div className="scroll-roller top" aria-hidden="true" />
        <button className="scroll-close" type="button" onClick={() => setActive(null)} aria-label="收起古卷">收</button>
        <div className="scroll-paper">
          <div className="scroll-heading">
            <p>{activeRealm?.name} · CONTENT ARCHIVE</p>
            <h1 id="scroll-title">{activeRealm?.module}</h1>
            <span>{activeRealm?.description}</span>
          </div>

          <div className="scroll-grid">
            {activeItems.map((item, index) => (
              <a className="scroll-card" href={item.url} target="_blank" rel="noreferrer" key={item.id}>
                <div className="scroll-cover">
                  <img src={item.cover} alt="" loading="lazy" referrerPolicy="no-referrer" />
                  <i>{String(index + 1).padStart(2, "0")}</i>
                  {item.badge && <b>{item.badge}</b>}
                </div>
                <div className="scroll-card-copy">
                  <h2>{item.title}</h2>
                  <p>{item.subtitle}</p>
                  <span>{item.play != null ? `${formatPlay(item.play)} 播放` : "前往官方观看"}<em>阅 →</em></span>
                </div>
              </a>
            ))}
          </div>
        </div>
        <div className="scroll-roller bottom" aria-hidden="true" />
      </section>
    </main>
  );
}
