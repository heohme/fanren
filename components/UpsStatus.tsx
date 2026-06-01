import type { UpResult } from "@/lib/types";
import { formatRelative } from "@/lib/aggregate";

const STALE_THRESHOLD_MS = 6 * 60 * 60 * 1000;

export default function UpsStatus({ ups }: { ups: UpResult[] }) {
  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold text-ink-800">追踪中的 UP 主</h3>
      <ul className="mt-3 space-y-3">
        {ups.map((up) => {
          const hasData = up.videos.length > 0;
          const latestVideoAt = up.videos[0]?.pubTime || 0;
          const fetchedAt = up.lastFetched || 0;
          const successAt = up.lastSuccess || 0;
          const isStale =
            successAt > 0 && Date.now() - successAt > STALE_THRESHOLD_MS;
          const dotClass = !hasData
            ? "bg-ink-200"
            : isStale
            ? "bg-cinnabar-400"
            : "bg-jade-500";

          return (
            <li key={up.uid} className="flex items-start gap-3 text-sm">
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotClass}`}
                title={isStale ? "抓取持续失败" : ""}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <a
                    href={`https://space.bilibili.com/${up.uid}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-ink-800 hover:text-cinnabar-600 hover:underline"
                  >
                    {up.name}
                  </a>
                  {isStale && (
                    <span
                      className="rounded-full bg-cinnabar-500/10 px-1.5 py-0.5 text-[10px] text-cinnabar-600"
                      title="超过 6 小时未成功拉到数据，可能被 B 站风控"
                    >
                      抓取失败
                    </span>
                  )}
                </div>
                <div className="text-xs text-ink-400">
                  {hasData ? (
                    <>
                      {up.videos.length} 条相关
                      {latestVideoAt > 0 && (
                        <> · 最新视频 {formatRelative(latestVideoAt)}</>
                      )}
                    </>
                  ) : up.error ? (
                    "暂未拉到数据"
                  ) : (
                    "等待首次抓取"
                  )}
                </div>
                <div className="mt-0.5 text-[11px] text-ink-400/80">
                  {fetchedAt > 0 ? (
                    <>抓取 {formatRelative(fetchedAt)}</>
                  ) : (
                    "尚未抓取"
                  )}
                  {successAt > 0 && successAt !== fetchedAt && (
                    <> · 上次成功 {formatRelative(successAt)}</>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 border-t border-ink-100 pt-2 text-[11px] leading-relaxed text-ink-400">
        <span className="text-jade-500">●</span> 正常 ·{" "}
        <span className="text-cinnabar-400">●</span> 抓取持续失败 ·{" "}
        <span className="text-ink-400">●</span> 暂无数据
      </p>
    </div>
  );
}
