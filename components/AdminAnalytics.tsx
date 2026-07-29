"use client";

import { useCallback, useEffect, useState } from "react";

interface CountRow {
  count?: number;
  sessions?: number;
  event_name?: string;
  realm?: string;
  object_id?: string;
  label?: string;
  source?: string;
  device?: string;
  day?: string;
  event_count?: number;
}

interface AnalyticsPayload {
  days: number;
  summary: { eventCount: number; sessions: number };
  events: CountRow[];
  realms: CountRow[];
  creators: CountRow[];
  videos: CountRow[];
  sources: CountRow[];
  devices: CountRow[];
  daily: CountRow[];
}

const EVENT_LABELS: Record<string, string> = {
  realm_open: "展开区域",
  realm_locked_click: "点击未开放区域",
  creator_open: "查看 UP 主",
  video_open: "打开视频",
  onboarding_start: "开始指引",
  onboarding_step: "指引翻页",
  onboarding_complete: "完成指引",
  onboarding_skip: "跳过指引",
  analysis_mode: "切换解析模式",
  content_filter: "切换内容筛选",
  share_link_copy: "复制专属入口",
};
const REALM_LABELS: Record<string, string> = {
  righteous: "正道",
  demonic: "魔道",
  heaven: "天道盟",
  nine: "九国盟",
};

function Ranking({
  title,
  rows,
  label,
}: {
  title: string;
  rows: CountRow[];
  label: (row: CountRow) => string;
}) {
  return (
    <section className="analytics-panel">
      <h2>{title}</h2>
      <ol>
        {rows.slice(0, 10).map((row, index) => (
          <li key={`${label(row)}-${index}`}>
            <span>{label(row)}</span>
            <strong>{row.count ?? row.sessions ?? 0}</strong>
            {row.sessions != null && row.count != null && <small>{row.sessions} 个会话</small>}
          </li>
        ))}
        {rows.length === 0 && <li className="analytics-no-data">等待第一批行为数据</li>}
      </ol>
    </section>
  );
}

export default function AdminAnalytics() {
  const [token, setToken] = useState("");
  const [days, setDays] = useState(7);
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setToken(sessionStorage.getItem("fanrenmap-admin-token") || ""), []);
  useEffect(() => {
    if (token) sessionStorage.setItem("fanrenmap-admin-token", token);
    else sessionStorage.removeItem("fanrenmap-admin-token");
  }, [token]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/analytics?days=${days}`, {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
      const result = await response.json().catch(() => ({
        error: "本地 Next.js 预览不包含 Cloudflare 数据接口；部署后可读取真实统计。",
      }));
      if (!response.ok) throw new Error(result.error || "读取失败");
      setData(result);
    } catch (caught) {
      setData(null);
      setError(caught instanceof Error ? caught.message : "读取失败");
    } finally {
      setLoading(false);
    }
  }, [days, token]);

  useEffect(() => { void load(); }, [load]);

  return (
    <main className="admin-shell">
      <header className="admin-heading">
        <div><span className="atlas-seal">数</span><div><p>残图 · BEHAVIOR ANALYTICS</p><h1>行为统计</h1></div></div>
        <nav><a href="/admin/submissions/">投稿审核</a><a href="/">返回天南舆图</a></nav>
      </header>
      <section className="admin-toolbar analytics-toolbar">
        <label><span>本地管理员令牌</span><input type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder="已通过 Cloudflare Access 登录可留空" /></label>
        <label><span>统计范围</span><select value={days} onChange={(event) => setDays(Number(event.target.value))}><option value={1}>最近 24 小时</option><option value={7}>最近 7 天</option><option value={30}>最近 30 天</option></select></label>
        <button type="button" onClick={() => void load()}>刷新数据</button>
      </section>
      {error && <div className="admin-banner">{error}</div>}
      {loading && <div className="admin-empty">正在读取行为数据…</div>}
      {data && !loading && (
        <>
          <section className="analytics-summary">
            <article><span>行为会话</span><strong>{data.summary.sessions}</strong><small>有实际互动的访问</small></article>
            <article><span>行为总数</span><strong>{data.summary.eventCount}</strong><small>点击、播放与引导操作</small></article>
            <article><span>人均行为</span><strong>{data.summary.sessions ? (data.summary.eventCount / data.summary.sessions).toFixed(1) : "0"}</strong><small>每个行为会话</small></article>
          </section>
          <section className="analytics-grid">
            <Ranking title="行为构成" rows={data.events} label={(row) => EVENT_LABELS[row.event_name || ""] || row.event_name || "其他"} />
            <Ranking title="区域热度" rows={data.realms} label={(row) => REALM_LABELS[row.realm || ""] || row.realm || "未知区域"} />
            <Ranking title="最常查看的 UP" rows={data.creators} label={(row) => row.label || row.object_id || "未知 UP"} />
            <Ranking title="最常打开的视频" rows={data.videos} label={(row) => row.label || row.object_id || "未知视频"} />
            <Ranking title="访问来源" rows={data.sources} label={(row) => row.source || "direct"} />
            <Ranking title="设备分布" rows={data.devices} label={(row) => row.device === "mobile" ? "移动端" : "桌面端"} />
          </section>
        </>
      )}
    </main>
  );
}
