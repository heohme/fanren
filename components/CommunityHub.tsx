"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { CommunityItem, SubmissionReceipt, SubmissionStatus, SubmissionType } from "@/lib/community-types";
import { SUBMISSION_STATUS_LABELS } from "@/lib/community-types";

const RECEIPTS_KEY = "fanrenmap-submission-receipts-v1";

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: Record<string, unknown>) => string;
      remove: (widgetId: string) => void;
    };
  }
}

function TurnstileWidget({ siteKey, onToken }: { siteKey: string; onToken: (token: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!siteKey) {
      onToken("local-dev");
      return;
    }

    const render = () => {
      if (!containerRef.current || !window.turnstile || widgetIdRef.current) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: "light",
        language: "zh-cn",
        appearance: "interaction-only",
        callback: onToken,
        "expired-callback": () => onToken(""),
        "error-callback": () => onToken(""),
      });
    };
    const scriptId = "cloudflare-turnstile-script";
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    if (window.turnstile) render();
    else script.addEventListener("load", render, { once: true });

    return () => {
      script?.removeEventListener("load", render);
      if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    };
  }, [siteKey, onToken]);

  if (!siteKey) return <small className="turnstile-local">本地测试模式</small>;
  return <div ref={containerRef} className="turnstile-slot" />;
}

function sourceChannel() {
  const params = new URLSearchParams(window.location.search);
  const campaign = params.get("f")
    || params.get("from")
    || params.get("src")
    || params.get("utm_source");
  if (campaign) return campaign;
  try {
    return document.referrer ? new URL(document.referrer).hostname : "direct";
  } catch {
    return "direct";
  }
}

function inferRecommendationType(input: string): SubmissionType {
  const trimmed = input.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    if (trimmed.length >= 2 && trimmed.length <= 50) return "creator";
    throw new Error("请输入 UP 名称，或粘贴完整的 B 站链接");
  }
  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  if (hostname === "space.bilibili.com" && /^\/\d+/.test(url.pathname)) return "creator";
  if ((hostname === "bilibili.com" || hostname.endsWith(".bilibili.com")) && /\/video\/(BV[0-9A-Za-z]+|av\d+)/i.test(url.pathname)) return "work";
  throw new Error("支持 UP 名称、B 站 UP 主页或视频链接");
}

type StatusResult = {
  id: string;
  status: SubmissionStatus;
  title: string;
  publicNote?: string | null;
  updatedAt: string;
};

export default function CommunityHub({ items, onRefresh, variant = "community" }: { items: CommunityItem[]; onRefresh: () => void; variant?: "community" | "discovery" }) {
  const [mode, setMode] = useState<"submit" | "status" | "published">("submit");
  const [intent, setIntent] = useState<"recommend" | "correction">("recommend");
  const [targetUrl, setTargetUrl] = useState("");
  const [reason, setReason] = useState("");
  const [submitterAlias, setSubmitterAlias] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileKey, setTurnstileKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [receipt, setReceipt] = useState<SubmissionReceipt | null>(null);
  const [savedReceipts, setSavedReceipts] = useState<SubmissionReceipt[]>([]);
  const [queryId, setQueryId] = useState("");
  const [queryToken, setQueryToken] = useState("");
  const [statusResult, setStatusResult] = useState<StatusResult | null>(null);
  const [querying, setQuerying] = useState(false);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
  const discoveryMode = variant === "discovery";

  useEffect(() => {
    try {
      setSavedReceipts(JSON.parse(localStorage.getItem(RECEIPTS_KEY) || "[]") as SubmissionReceipt[]);
    } catch {
      localStorage.removeItem(RECEIPTS_KEY);
    }
  }, []);

  const saveReceipt = (next: SubmissionReceipt) => {
    const receipts = [next, ...savedReceipts.filter((item) => item.id !== next.id)].slice(0, 20);
    setSavedReceipts(receipts);
    localStorage.setItem(RECEIPTS_KEY, JSON.stringify(receipts));
  };

  const resetChallenge = () => {
    setTurnstileToken("");
    setTurnstileKey((value) => value + 1);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    let type: SubmissionType;
    try {
      type = intent === "correction" ? "correction" : inferRecommendationType(targetUrl);
      if (type === "correction" && reason.trim().length < 4) throw new Error("请简单说明需要修改的地方");
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "链接格式不正确" });
      return;
    }
    if (siteKey && !turnstileToken) {
      setMessage({ kind: "error", text: "请先完成人机验证" });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type,
          targetUrl,
          reason,
          submitterAlias,
          sourceChannel: sourceChannel(),
          turnstileToken,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "投稿失败，请稍后重试");
      const next = result.submission as SubmissionReceipt;
      setReceipt(next);
      saveReceipt(next);
      setTargetUrl("");
      setReason("");
      setMessage({ kind: "success", text: next.status === "duplicate" ? "已经有道友推荐过了，我们仍记录了你的支持" : discoveryMode ? "已收到，审核后会进入每日发现候选" : "已收到，审核后会进入道友推荐" });
      resetChallenge();
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "投稿失败，请稍后重试" });
      resetChallenge();
    } finally {
      setSubmitting(false);
    }
  };

  const loadStatus = async (id: string, token: string) => {
    setMessage(null);
    setStatusResult(null);
    setQuerying(true);
    try {
      const response = await fetch(`/api/submissions/${encodeURIComponent(id.trim())}/status?token=${encodeURIComponent(token.trim())}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "查询失败");
      setStatusResult(result.submission);
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "查询失败" });
    } finally {
      setQuerying(false);
    }
  };

  const queryStatus = (event: FormEvent) => {
    event.preventDefault();
    void loadStatus(queryId, queryToken);
  };

  const chooseReceipt = (item: SubmissionReceipt) => {
    setMode("status");
    setQueryId(item.id);
    setQueryToken(item.receiptToken);
    void loadStatus(item.id, item.receiptToken);
  };

  const changeIntent = (next: "recommend" | "correction") => {
    setIntent(next);
    setDetailsOpen(next === "correction");
    setMessage(null);
  };

  return (
    <div className="community-hub">
      <div className="quick-community-nav" aria-label="道友共建功能">
        <button className={mode === "submit" ? "active" : ""} type="button" onClick={() => setMode("submit")}>{discoveryMode ? "举荐好作品" : "九国举荐"}</button>
        {!discoveryMode && <button className={mode === "published" ? "active" : ""} type="button" onClick={() => setMode("published")}>道友推荐 <small>{items.length}</small></button>}
        <button className={mode === "status" ? "active" : ""} type="button" onClick={() => setMode("status")}>{discoveryMode ? "我的举荐" : "我的投稿"} <small>{savedReceipts.length}</small></button>
      </div>

      {message && <div className={`community-message ${message.kind}`}>{message.text}</div>}

      {mode === "submit" && (
        <section className="quick-submit-card">
          <header>
            <span className="atlas-seal">荐</span>
            <div><small className="quick-campaign">{discoveryMode ? "天道盟 · 道友寻宝帖" : "慕兰之战 · 九国盟征募令"}</small><h2>{discoveryMode ? "举荐一部值得被看见的作品" : "举荐你喜欢的 UP 主参战"}</h2><p>输入名字或者粘贴 B 站链接，一步完成举荐；重名账号由审核时确认。</p></div>
          </header>
          <form onSubmit={submit}>
            <div className="quick-intent">
              <button className={intent === "recommend" ? "active" : ""} type="button" onClick={() => changeIntent("recommend")}>{discoveryMode ? "举荐作品 / UP" : "举荐 UP / 作品"}</button>
              <button className={intent === "correction" ? "active" : ""} type="button" onClick={() => changeIntent("correction")}>纠错 / 补档</button>
            </div>
            <div className="quick-link-row">
              <label>
                <span>{intent === "recommend" ? "UP 名称或 B 站链接" : "需要纠错的本站或 B 站链接"}</span>
                <input type={intent === "recommend" ? "text" : "url"} value={targetUrl} onChange={(event) => setTargetUrl(event.target.value)} placeholder={intent === "recommend" ? "例如：骚人风希，或粘贴 UP / 视频链接" : "https://fanrenmap.pages.dev/…"} required />
              </label>
              <button className="submit-button" type="submit" disabled={submitting}>{submitting ? "递交中…" : intent === "recommend" ? discoveryMode ? "送入候选" : "举荐参战" : "提交纠错"}</button>
            </div>
            <button className="quick-details-toggle" type="button" onClick={() => setDetailsOpen((value) => !value)}>{detailsOpen ? "收起补充" : "+ 补充一句（可选）"}</button>
            {detailsOpen && (
              <div className="quick-details">
                <label><span>{intent === "correction" ? "需要修改什么" : "为什么推荐（可选）"}</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} required={intent === "correction"} /></label>
                <label><span>你的称呼（可选）</span><input value={submitterAlias} onChange={(event) => setSubmitterAlias(event.target.value)} maxLength={50} /></label>
              </div>
            )}
            <div className="quick-verification"><TurnstileWidget key={turnstileKey} siteKey={siteKey} onToken={setTurnstileToken} /></div>
          </form>
          <footer>
            <span>{discoveryMode ? "无需登录 · 审核后进入推荐候选 · 不保证当天上榜" : "只填名字也可以 · 无需登录 · 先审核再公开"}</span>
            {receipt && <button type="button" onClick={() => chooseReceipt(receipt)}>已收到 {receipt.id} · 查看进度</button>}
          </footer>
        </section>
      )}

      {mode === "status" && (
        <div className="status-layout quick-status-layout">
          <header><h2>我的投稿</h2><p>这台设备提交过的内容会自动保存在这里。</p></header>
          {savedReceipts.length > 0 ? <section className="saved-receipts"><div>{savedReceipts.map((item) => <button type="button" onClick={() => chooseReceipt(item)} key={item.id}><span>{item.id}</span><small>{SUBMISSION_STATUS_LABELS[item.status]}</small></button>)}</div></section> : <div className="empty-ranking"><strong>还没有投稿记录</strong><p>回到“{discoveryMode ? "举荐好作品" : "九国举荐"}”，输入名字或链接即可完成。</p></div>}
          {querying && <div className="community-message">正在查询…</div>}
          {statusResult && <section className="status-result"><small>{statusResult.id}</small><strong>{SUBMISSION_STATUS_LABELS[statusResult.status]}</strong><h2>{statusResult.title}</h2>{statusResult.publicNote && <p>{statusResult.publicNote}</p>}<time>最近更新：{new Date(statusResult.updatedAt).toLocaleString("zh-CN")}</time></section>}
          <details className="manual-query">
            <summary>换了设备？用编号查询</summary>
            <form className="status-form" onSubmit={queryStatus}>
              <label><span>投稿编号</span><input value={queryId} onChange={(event) => setQueryId(event.target.value.toUpperCase())} placeholder="FR-20260719-XXXX" required /></label>
              <label><span>查询凭证</span><input value={queryToken} onChange={(event) => setQueryToken(event.target.value.toUpperCase())} placeholder="XXXX-XXXX" required /></label>
              <button className="submit-button" type="submit">查询</button>
            </form>
          </details>
        </div>
      )}

      {mode === "published" && (
        <div className="published-community">
          <div className="ranking-head"><strong>道友推荐榜</strong><div className="ranking-head-aside"><span>{items.length} 条已审核内容</span><button type="button" onClick={onRefresh}>刷新</button></div></div>
          <div className="community-grid">
            {items.map((item) => <a href={item.targetUrl} target="_blank" rel="noreferrer" key={item.id}><span>{item.type === "creator" ? "推荐 UP" : item.category || "推荐作品"}</span><strong>{item.title || item.upName || item.targetKey}</strong><small>{item.episode ? `第 ${item.episode} 话 · ` : ""}{item.upName || "道友共建"}</small>{item.recommendationReason && <p>{item.recommendationReason}</p>}<em>前往查看 →</em></a>)}
            {items.length === 0 && <div className="empty-ranking"><strong>道友推荐榜正在等待第一份仙缘</strong><p>审核通过的 UP 与作品会出现在这里。</p></div>}
          </div>
        </div>
      )}
    </div>
  );
}
