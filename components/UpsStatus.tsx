import type { UpResult } from "@/lib/types";
import { formatRelative } from "@/lib/aggregate";

export default function UpsStatus({ ups }: { ups: UpResult[] }) {
  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold text-ink-800">追踪中的 UP 主</h3>
      <ul className="mt-3 space-y-3">
        {ups.map((up) => {
          const ok = up.videos.length > 0;
          return (
            <li key={up.uid} className="flex items-start gap-3 text-sm">
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                  ok ? "bg-jade-500" : "bg-ink-200"
                }`}
              />
              <div className="flex-1">
                <a
                  href={`https://space.bilibili.com/${up.uid}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-ink-800 hover:text-cinnabar-600 hover:underline"
                >
                  {up.name}
                </a>
                <div className="text-xs text-ink-400">
                  {ok
                    ? `${up.videos.length} 条相关 · 最近 ${formatRelative(up.lastSuccess || 0)}`
                    : up.error
                    ? "暂未拉到数据"
                    : "等待首次抓取"}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
