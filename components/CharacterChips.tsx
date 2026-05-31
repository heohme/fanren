"use client";

import { useState } from "react";
import type { SideVideo } from "@/lib/aggregate";
import { formatRelative } from "@/lib/aggregate";

export default function CharacterChips({
  groups,
}: {
  groups: Array<{ character: string; videos: SideVideo[] }>;
}) {
  const [active, setActive] = useState<string | null>(null);
  if (groups.length === 0) return null;

  const top = groups.filter((g) => g.videos.length >= 2).slice(0, 12);
  if (top.length === 0) return null;

  const activeGroup = active ? groups.find((g) => g.character === active) : null;

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-ink-800">按人物 / 专题串联</h3>
        <span className="text-xs text-ink-400">点击查看相关视频</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {top.map((g) => (
          <button
            key={g.character}
            className={`rounded-full px-3 py-1 text-xs transition ${
              active === g.character
                ? "bg-cinnabar-500 text-white"
                : "bg-white border border-ink-100 text-ink-600 hover:border-cinnabar-400 hover:text-cinnabar-600"
            }`}
            onClick={() =>
              setActive(active === g.character ? null : g.character)
            }
          >
            {g.character}
            <span
              className={`ml-1.5 ${
                active === g.character ? "text-white/80" : "text-ink-400"
              }`}
            >
              {g.videos.length}
            </span>
          </button>
        ))}
      </div>

      {activeGroup && (
        <div className="card mt-4 p-4">
          <h4 className="mb-3 text-sm font-medium text-cinnabar-600">
            「{activeGroup.character}」相关 · {activeGroup.videos.length} 条
          </h4>
          <ul className="space-y-2">
            {activeGroup.videos.map(({ up, video }) => (
              <li key={video.bvid} className="text-sm">
                <a
                  href={video.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-ink-800 hover:text-cinnabar-600 hover:underline"
                >
                  {video.title}
                </a>
                <div className="text-xs text-ink-400">
                  {up.name} · {formatRelative(video.pubTime)}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
