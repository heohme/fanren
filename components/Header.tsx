"use client";

import { useEffect, useState } from "react";
import type { OfficialData, SeriesConfig } from "@/lib/types";
import { formatRelative } from "@/lib/aggregate";

function nextSaturdayAtEleven() {
  const now = Date.now();
  const china = new Date(now + 8 * 60 * 60 * 1000);
  let daysAhead = (6 - china.getUTCDay() + 7) % 7;
  let target = Date.UTC(
    china.getUTCFullYear(),
    china.getUTCMonth(),
    china.getUTCDate() + daysAhead,
    3,
    0,
    0
  );
  if (target <= now) target += 7 * 24 * 60 * 60 * 1000;
  return target;
}

function useCountdown() {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const update = () => setRemaining(Math.max(0, nextSaturdayAtEleven() - Date.now()));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return {
    days: Math.floor(remaining / 86_400_000),
    hours: Math.floor((remaining % 86_400_000) / 3_600_000),
    minutes: Math.floor((remaining % 3_600_000) / 60_000),
    seconds: Math.floor((remaining % 60_000) / 1_000),
  };
}

export default function Header({
  series,
  official,
  generatedAt,
}: {
  series: SeriesConfig;
  official: OfficialData;
  generatedAt: number;
}) {
  const countdown = useCountdown();
  const units = [
    [countdown.days, "日"],
    [countdown.hours, "时"],
    [countdown.minutes, "分"],
    [countdown.seconds, "秒"],
  ] as const;

  return (
    <>
      <header className="site-nav">
        <a className="brand" href="#top" aria-label="凡人残图首页">
          <span className="brand-seal" aria-hidden="true">凡<br />图</span>
          <span>
            <strong>凡人残图</strong>
            <small>道友寻番指南</small>
          </span>
        </a>
        <nav aria-label="主导航">
          <a href="#weekly-map">本周残图</a>
          <a href="#episodes">分集档案</a>
          <a href="#topics">万象志</a>
        </nav>
        <a className="nav-action" href="#episodes">查看分集</a>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><span /> 每周一片 · 循迹入仙途</p>
          <h1>正片散落四方，<br />此图为你<span>逐片寻回</span>。</h1>
          <p className="hero-description">
            自动整理《{official.title || series.title}》正片、分集解析与人物专题。
            不搬运作品，只为每一份好内容指路。
          </p>
          <div className="hero-actions">
            <a className="primary-action" href="#weekly-map">领取本周残图</a>
            <a className="secondary-action" href={series.officialUrl} target="_blank" rel="noreferrer">
              前往官方正片
            </a>
          </div>
          <p className="source-status">
            <span className="status-pulse" /> 数据巡检正常 · 快照更新于 {formatRelative(generatedAt)}
          </p>
        </div>

        <aside className="countdown-card" aria-label="下次更新倒计时">
          <p>下一片残图现世</p>
          <div className="countdown" aria-live="polite">
            {units.map(([value, label], index) => (
              <div className="countdown-unit" key={label}>
                {index > 0 && <i>:</i>}
                <span><b>{String(value).padStart(2, "0")}</b><small>{label}</small></span>
              </div>
            ))}
          </div>
          <div className="airtime">
            <span>每周六</span><strong>11:00</strong><em>{official.newEp?.title || "持续更新"}</em>
          </div>
        </aside>
      </section>
    </>
  );
}
