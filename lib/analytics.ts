"use client";

export type AnalyticsEventName =
  | "landing_view"
  | "realm_open"
  | "realm_locked_click"
  | "creator_open"
  | "video_open"
  | "onboarding_start"
  | "onboarding_step"
  | "onboarding_complete"
  | "onboarding_skip"
  | "analysis_mode"
  | "content_filter"
  | "share_link_copy";

export interface AnalyticsEvent {
  eventName: AnalyticsEventName;
  realm?: string;
  objectType?: "page" | "realm" | "creator" | "video" | "filter" | "guide";
  objectId?: string;
  objectLabel?: string;
  context?: string;
  position?: number;
}

interface QueuedAnalyticsEvent extends AnalyticsEvent {
  source: string;
  sessionId: string;
  path: string;
  device: "mobile" | "desktop";
  clientAt: string;
}

const SESSION_KEY = "fanrenmap-analytics-session-v1";
const LANDING_KEY = "fanrenmap-analytics-landing-v1";
const MAX_QUEUE_SIZE = 12;
let queue: QueuedAnalyticsEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let listenersInstalled = false;

function bounded(value: string | undefined, maxLength: number) {
  return value?.normalize("NFKC").trim().slice(0, maxLength) || undefined;
}

function sessionId() {
  const saved = sessionStorage.getItem(SESSION_KEY);
  if (saved) return saved;
  const id = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  sessionStorage.setItem(SESSION_KEY, id);
  return id;
}

function trafficSource() {
  const params = new URLSearchParams(window.location.search);
  const tagged = params.get("f")
    || params.get("from")
    || params.get("src")
    || params.get("utm_source");
  if (tagged) return bounded(tagged, 80);
  if (!document.referrer) return "direct";
  try {
    return new URL(document.referrer).hostname.slice(0, 80);
  } catch {
    return "unknown";
  }
}

function isLocalPreview() {
  return ["localhost", "127.0.0.1"].includes(window.location.hostname);
}

function flushAnalytics(useBeacon = false) {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (!queue.length) return;
  const events = queue.splice(0, MAX_QUEUE_SIZE);
  if (isLocalPreview()) return;

  const body = JSON.stringify({ events });
  if (useBeacon && navigator.sendBeacon) {
    navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
    return;
  }
  void fetch("/api/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // 行为统计不能影响用户正常浏览。
  });
}

function installFlushListeners() {
  if (listenersInstalled) return;
  listenersInstalled = true;
  window.addEventListener("pagehide", () => flushAnalytics(true));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushAnalytics(true);
  });
}

export function trackEvent(event: AnalyticsEvent) {
  if (typeof window === "undefined") return;
  installFlushListeners();
  const detail: QueuedAnalyticsEvent = {
    eventName: event.eventName,
    realm: bounded(event.realm, 32),
    objectType: event.objectType,
    objectId: bounded(event.objectId, 120),
    objectLabel: bounded(event.objectLabel, 180),
    context: bounded(event.context, 80),
    source: trafficSource() || "direct",
    position: Number.isInteger(event.position) ? event.position : undefined,
    sessionId: sessionId(),
    path: window.location.pathname.slice(0, 160),
    device: window.matchMedia("(max-width: 820px), (pointer: coarse)").matches ? "mobile" : "desktop",
    clientAt: new Date().toISOString(),
  };

  document.dispatchEvent(new CustomEvent("fanren:analytics", { detail }));
  if (isLocalPreview()) document.documentElement.dataset.lastAnalyticsEvent = JSON.stringify(detail);
  queue.push(detail);
  if (queue.length >= MAX_QUEUE_SIZE) {
    flushAnalytics();
    return;
  }
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => flushAnalytics(), 1200);
}

export function trackLandingView() {
  if (typeof window === "undefined") return;
  const currentSessionId = sessionId();
  if (sessionStorage.getItem(LANDING_KEY) === currentSessionId) return;
  sessionStorage.setItem(LANDING_KEY, currentSessionId);
  trackEvent({
    eventName: "landing_view",
    objectType: "page",
    objectId: window.location.pathname,
    objectLabel: document.title || "凡人残图",
    context: window.location.search ? "tagged" : "plain",
  });
}
