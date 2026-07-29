"use client";

import { useCallback, useEffect, useState } from "react";
import type { SubmissionStatus, SubmissionType } from "@/lib/community-types";
import { SUBMISSION_STATUS_LABELS } from "@/lib/community-types";

interface AdminSubmission {
  id: string;
  type: SubmissionType;
  status: SubmissionStatus;
  target_url: string;
  target_key: string;
  up_uid: string | null;
  up_name: string | null;
  title: string | null;
  episode: number | null;
  category: string | null;
  reason: string;
  submitter_alias: string | null;
  contact: string | null;
  source_channel: string | null;
  public_note: string | null;
  created_at: string;
}

const FILTERS: SubmissionStatus[] = ["pending", "reviewing", "needs_info", "approved", "rejected", "duplicate"];

function ReviewCard({ item, token, onDone }: { item: AdminSubmission; token: string; onDone: () => void }) {
  const actionable = ["pending", "reviewing", "needs_info"].includes(item.status);
  const [title, setTitle] = useState(item.title || "");
  const [targetUrl, setTargetUrl] = useState(item.target_url);
  const [upName, setUpName] = useState(item.up_name || "");
  const [episode, setEpisode] = useState(item.episode?.toString() || "");
  const [category, setCategory] = useState(item.category || "");
  const [publicNote, setPublicNote] = useState(item.public_note || "");
  const [reviewNote, setReviewNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const act = async (action: "approve" | "reject" | "duplicate") => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/submissions/${encodeURIComponent(item.id)}/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ targetUrl, title, upName, episode, category, publicNote, reviewNote }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "操作失败");
      onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "操作失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="admin-review-card">
      <header><div><span>{item.type === "creator" ? "推荐 UP" : item.type === "work" ? "推荐作品" : "纠错补档"}</span><strong>{item.id}</strong></div><time>{new Date(item.created_at).toLocaleString("zh-CN")}</time></header>
      <a href={item.target_url} target="_blank" rel="noreferrer">{item.target_url}</a>
      <blockquote>{item.reason}</blockquote>
      <div className="admin-edit-grid">
        <label className="wide"><span>准确链接</span><input value={targetUrl} onChange={(event) => setTargetUrl(event.target.value)} /></label>
        <label><span>标题</span><input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label><span>UP 名称</span><input value={upName} onChange={(event) => setUpName(event.target.value)} /></label>
        <label><span>集数</span><input type="number" value={episode} onChange={(event) => setEpisode(event.target.value)} /></label>
        <label><span>分类</span><input value={category} onChange={(event) => setCategory(event.target.value)} /></label>
        <label className="wide"><span>公开回复</span><textarea value={publicNote} onChange={(event) => setPublicNote(event.target.value)} /></label>
        <label className="wide"><span>内部审核备注</span><textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} /></label>
      </div>
      <footer><small>{item.submitter_alias || "匿名道友"}{item.contact ? ` · ${item.contact}` : ""}{item.source_channel ? ` · 来源 ${item.source_channel}` : ""}</small>{actionable && <div><button type="button" onClick={() => act("duplicate")} disabled={busy}>合并重复</button><button type="button" onClick={() => act("reject")} disabled={busy}>不收录</button><button className="approve" type="button" onClick={() => act("approve")} disabled={busy}>审核通过</button></div>}</footer>
      {error && <p className="admin-error">{error}</p>}
    </article>
  );
}

export default function AdminSubmissions() {
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<SubmissionStatus>("pending");
  const [items, setItems] = useState<AdminSubmission[]>([]);
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
      const response = await fetch(`/api/admin/submissions?status=${status}`, {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "读取失败");
      setItems(result.items || []);
    } catch (caught) {
      setItems([]);
      setError(caught instanceof Error ? caught.message : "读取失败");
    } finally {
      setLoading(false);
    }
  }, [status, token]);

  useEffect(() => { void load(); }, [load]);

  return (
    <main className="admin-shell">
      <header className="admin-heading"><div><span className="atlas-seal">审</span><div><p>九国盟 · COMMUNITY REVIEW</p><h1>投稿审核</h1></div></div><nav><a href="/admin/analytics/">行为统计</a><a href="/">返回天南舆图</a></nav></header>
      <section className="admin-toolbar">
        <label><span>本地管理员令牌</span><input type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder="已通过 Cloudflare Access 登录可留空" /></label>
        <label><span>审核状态</span><select value={status} onChange={(event) => setStatus(event.target.value as SubmissionStatus)}>{FILTERS.map((item) => <option value={item} key={item}>{SUBMISSION_STATUS_LABELS[item]}</option>)}</select></label>
        <button type="button" onClick={() => void load()}>刷新队列</button>
      </section>
      {error && <div className="admin-banner">{error}</div>}
      <section className="admin-list">
        {items.map((item) => <ReviewCard item={item} token={token} onDone={() => void load()} key={item.id} />)}
        {!loading && !error && items.length === 0 && <div className="admin-empty">当前队列没有投稿</div>}
        {loading && <div className="admin-empty">正在读取审核队列…</div>}
      </section>
    </main>
  );
}
