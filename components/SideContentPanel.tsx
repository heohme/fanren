"use client";

import { useState } from "react";
import type { SideVideo } from "@/lib/aggregate";
import { formatRelative } from "@/lib/aggregate";

const TABS = [
  { key: "episodes" as const, label: "集解读" },
  { key: "characters" as const, label: "人物 / 专题" },
  { key: "pv-chat" as const, label: "PV · 物料 · 杂谈" },
];

export default function SideContentPanel({
  characterAndTopic,
  pvAndChat,
  total,
}: {
  characterAndTopic: SideVideo[];
  pvAndChat: SideVideo[];
  total: number;
}) {
  const [tab, setTab] = useState<"characters" | "pv-chat">("characters");
  const list = tab === "characters" ? characterAndTopic : pvAndChat;

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">周边解析</h2>
        <span className="text-xs text-ink-400">
          共 {total} 条 · 不分集的深度内容
        </span>
      </div>

      <div className="card overflow-hidden">
        <div className="flex border-b border-ink-100 bg-ink-50/50">
          <button
            className={`flex-1 px-4 py-2.5 text-sm transition ${
              tab === "characters"
                ? "border-b-2 border-cinnabar-500 font-medium text-cinnabar-600"
                : "text-ink-600 hover:bg-ink-100/50"
            }`}
            onClick={() => setTab("characters")}
          >
            人物与专题{" "}
            <span className="text-xs text-ink-400">
              {characterAndTopic.length}
            </span>
          </button>
          <button
            className={`flex-1 px-4 py-2.5 text-sm transition ${
              tab === "pv-chat"
                ? "border-b-2 border-cinnabar-500 font-medium text-cinnabar-600"
                : "text-ink-600 hover:bg-ink-100/50"
            }`}
            onClick={() => setTab("pv-chat")}
          >
            PV · 物料 · 杂谈{" "}
            <span className="text-xs text-ink-400">{pvAndChat.length}</span>
          </button>
        </div>

        {list.length === 0 ? (
          <div className="p-8 text-center text-sm text-ink-400">
            暂无该类内容
          </div>
        ) : (
          <ul className="divide-y divide-ink-100">
            {list.map(({ up, video }) => (
              <li key={video.bvid} className="px-5 py-3">
                <div className="flex items-start gap-3 text-sm">
                  <TypeBadge type={video.contentType || "other"} />
                  <a
                    href={video.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 text-ink-800 hover:text-cinnabar-600 hover:underline"
                    title={video.title}
                  >
                    {video.title}
                  </a>
                  <span className="shrink-0 text-xs text-ink-400">
                    {formatRelative(video.pubTime)}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2 pl-[78px] text-xs text-ink-400">
                  <span>{up.name}</span>
                  {video.characters.length > 0 && (
                    <>
                      <span className="text-ink-200">·</span>
                      <span className="flex flex-wrap gap-1">
                        {video.characters.slice(0, 4).map((c) => (
                          <span
                            key={c}
                            className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] text-ink-600"
                          >
                            {c}
                          </span>
                        ))}
                      </span>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    character: { label: "人物", cls: "bg-cinnabar-500/10 text-cinnabar-600" },
    topic: { label: "专题", cls: "bg-jade-500/10 text-jade-500" },
    pv: { label: "物料", cls: "bg-ink-200/40 text-ink-600" },
    chat: { label: "杂谈", cls: "bg-ink-200/40 text-ink-400" },
    compilation: { label: "合集", cls: "bg-ink-200/40 text-ink-600" },
    other: { label: "其他", cls: "bg-ink-200/40 text-ink-400" },
  };
  const it = map[type] || map.other;
  return (
    <span
      className={`w-14 shrink-0 rounded px-1.5 py-0.5 text-center text-[10px] font-medium ${it.cls}`}
    >
      {it.label}
    </span>
  );
}
