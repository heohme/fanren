"use client";

import { useEffect, useMemo, useState } from "react";
import type { EpisodeRow, UpResult } from "@/lib/types";
import { formatDate, formatRelative } from "@/lib/aggregate";

const LS_KEY = "fanren-cantu-last-seen";

function useLastSeen() {
  const [lastSeen, setLastSeen] = useState<number>(0);
  useEffect(() => {
    const v = localStorage.getItem(LS_KEY);
    setLastSeen(v ? parseInt(v, 10) : 0);
    const now = Date.now();
    localStorage.setItem(LS_KEY, String(now));
  }, []);
  return lastSeen;
}

export default function EpisodeList({
  rows,
  ups,
}: {
  rows: EpisodeRow[];
  ups: UpResult[];
}) {
  const lastSeen = useLastSeen();
  const [filter, setFilter] = useState<"all" | "updated">("all");

  const visibleRows = useMemo(() => {
    if (filter === "updated") {
      return rows.filter((r) => r.upVideos.length > 0 || r.official);
    }
    return rows;
  }, [rows, filter]);

  if (rows.length === 0) {
    const premiere = new Date("2026-06-13").getTime();
    const days = Math.max(0, Math.ceil((premiere - Date.now()) / 86400000));
    return (
      <div>
        <h2 className="mb-4 text-lg font-semibold">主线 · 集解读追踪</h2>
        <div className="card p-10 text-center">
          <div className="text-4xl font-bold text-cinnabar-600">
            {days > 0 ? `T-${days}` : "今日开播"}
          </div>
          <div className="mt-3 text-sm text-ink-600">
            新一季 6/13 开播 · 集解读视频会在此处自动归集
          </div>
          <div className="mt-2 text-xs text-ink-400">
            目前 UP 主们正在产出 PV 解析与人物专题，往下翻看 ↓
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">分集追踪</h2>
        <div className="flex gap-2 text-xs">
          <button
            className={`rounded-full px-3 py-1 transition ${
              filter === "all"
                ? "bg-ink-800 text-white"
                : "bg-ink-100 text-ink-600 hover:bg-ink-200"
            }`}
            onClick={() => setFilter("all")}
          >
            全部 {rows.length}
          </button>
          <button
            className={`rounded-full px-3 py-1 transition ${
              filter === "updated"
                ? "bg-ink-800 text-white"
                : "bg-ink-100 text-ink-600 hover:bg-ink-200"
            }`}
            onClick={() => setFilter("updated")}
          >
            已更新
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {visibleRows.map((row) => (
          <EpisodeCard key={row.ep} row={row} ups={ups} lastSeen={lastSeen} />
        ))}
      </div>
    </div>
  );
}

function EpisodeCard({
  row,
  ups,
  lastSeen,
}: {
  row: EpisodeRow;
  ups: UpResult[];
  lastSeen: number;
}) {
  const officialReleased = !!row.official?.pubTime && row.official.pubTime <= Date.now();
  const hasFreshUpdate = row.latestActivityAt > lastSeen && lastSeen > 0;

  return (
    <article className="card p-4">
      <div className="flex flex-wrap items-baseline gap-3 border-b border-ink-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold">第 {row.ep} 话</span>
          {hasFreshUpdate && <span className="pulse-dot" aria-label="新更新" />}
        </div>
        {row.official ? (
          <span className="text-xs text-ink-400">
            {row.official.longTitle && `《${row.official.longTitle}》 · `}
            {row.official.pubTime ? formatDate(row.official.pubTime) : "待播"}
          </span>
        ) : (
          <span className="text-xs text-ink-400">UP 主已开始解析 · 官方未上架</span>
        )}
        <span className="ml-auto text-xs text-ink-400">
          {formatRelative(row.latestActivityAt)}
        </span>
      </div>

      <ul className="mt-3 divide-y divide-ink-100/60">
        <RowItem
          name="官方正片"
          accent="cinnabar"
          status={officialReleased ? "released" : "pending"}
          link={row.official?.playUrl}
          title={
            row.official
              ? row.official.longTitle ||
                `第${row.official.ep || row.official.epRaw}话`
              : "等待官方更新"
          }
          time={row.official?.pubTime || 0}
        />
        {ups.map((up) => {
          const hit = row.upVideos.find((u) => u.up.uid === up.uid);
          return (
            <RowItem
              key={up.uid}
              name={up.name}
              status={hit ? "released" : "pending"}
              link={hit?.video.videoUrl}
              title={hit ? hit.video.title : "暂无解析"}
              time={hit?.video.pubTime || 0}
              isFresh={hit ? hit.video.pubTime > lastSeen && lastSeen > 0 : false}
            />
          );
        })}
      </ul>
    </article>
  );
}

function RowItem({
  name,
  accent,
  status,
  link,
  title,
  time,
  isFresh,
}: {
  name: string;
  accent?: "cinnabar" | "jade";
  status: "released" | "pending";
  link?: string;
  title: string;
  time: number;
  isFresh?: boolean;
}) {
  const dotColor =
    status === "released"
      ? accent === "cinnabar"
        ? "bg-cinnabar-500"
        : "bg-jade-500"
      : "bg-ink-200";

  return (
    <li className="flex items-center gap-3 py-2 text-sm">
      <span className={`h-2 w-2 shrink-0 rounded-full ${dotColor}`} />
      <span className="w-24 shrink-0 text-ink-600">{name}</span>
      {status === "released" && link ? (
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          className="flex-1 truncate text-ink-800 hover:text-cinnabar-600 hover:underline"
        >
          {title}
        </a>
      ) : (
        <span className="flex-1 truncate text-ink-400">{title}</span>
      )}
      {isFresh && (
        <span className="badge-new">
          <span className="pulse-dot" /> NEW
        </span>
      )}
      {time > 0 && (
        <span className="shrink-0 text-xs text-ink-400">{formatRelative(time)}</span>
      )}
    </li>
  );
}
