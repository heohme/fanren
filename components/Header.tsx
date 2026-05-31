import type { OfficialData, SeriesConfig } from "@/lib/types";
import { formatRelative } from "@/lib/aggregate";

export default function Header({
  series,
  official,
  generatedAt,
}: {
  series: SeriesConfig;
  official: OfficialData;
  generatedAt: number;
}) {
  return (
    <header className="pt-12 pb-2">
      <div className="flex items-baseline gap-3">
        <h1 className="text-4xl font-bold tracking-tight">凡人残图</h1>
        <span className="text-sm text-ink-400">凡人修仙传 · 更新追踪</span>
      </div>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-600">
        <a
          className="text-cinnabar-600 hover:underline"
          href={series.officialUrl}
          target="_blank"
          rel="noreferrer"
        >
          《{official.title || series.title}》
        </a>{" "}
        — {series.schedule} · 当前进度：{official.newEp?.title || "—"}
      </p>
      <div className="mt-3 text-xs text-ink-400">
        快照时间 {formatRelative(generatedAt)} · 每 10 分钟自动同步
      </div>
    </header>
  );
}
