"use client";

import { useState } from "react";

export interface MapNode {
  key: "official" | "episode" | "characters" | "side";
  marker: string;
  label: string;
  eyebrow: string;
  title: string;
  copy: string;
  href: string;
  action: string;
}

export default function WeeklyMap({
  nodes,
  stats,
  episode,
}: {
  nodes: MapNode[];
  stats: Array<{ value: string; label: string; note: string }>;
  episode: number | null;
}) {
  const [activeKey, setActiveKey] = useState<MapNode["key"]>("official");
  const active = nodes.find((node) => node.key === activeKey) || nodes[0];

  return (
    <section className="map-section" id="weekly-map" aria-labelledby="weekly-map-title">
      <div className="section-heading map-heading">
        <div>
          <p className="section-kicker">CURRENT FRAGMENT · LIVE DATA</p>
          <h2 id="weekly-map-title">天南卷 · 本周行迹</h2>
        </div>
        <div className="map-legend" aria-label="图例">
          <span><i className="legend-dot red" />官方正片</span>
          <span><i className="legend-dot green" />分集解析</span>
          <span><i className="legend-dot gold" />人物专题</span>
        </div>
      </div>

      <div className="map-canvas">
        <div className="map-terrain" aria-hidden="true">
          <span className="terrain terrain-one" />
          <span className="terrain terrain-two" />
          <span className="terrain terrain-three" />
          <span className="river river-one" />
          <span className="river river-two" />
          <span className="trail-route" />
        </div>
        <div className="map-stamp" aria-hidden="true">
          <small>凡人历 · 今朝</small><strong>天南寻迹图</strong>
        </div>

        {nodes.map((node) => (
          <button
            className={`map-marker marker-${node.key} ${activeKey === node.key ? "active" : ""}`}
            key={node.key}
            type="button"
            onClick={() => setActiveKey(node.key)}
            aria-pressed={activeKey === node.key}
          >
            <span>{node.marker}</span><b>{node.label}</b>
          </button>
        ))}

        <article className="map-detail-card">
          <p>{active.eyebrow}</p>
          <h3>{active.title}</h3>
          <div>{active.copy}</div>
          <a href={active.href}>{active.action}<span>→</span></a>
        </article>
        <div className="map-coordinate">FRAGMENT / EP-{episode || "---"} · 内容来自实时快照</div>
      </div>

      <div className="map-stats">
        {stats.map((stat) => (
          <article key={stat.label}>
            <strong>{stat.value}</strong>
            <span>{stat.label}<small>{stat.note}</small></span>
          </article>
        ))}
      </div>
    </section>
  );
}
