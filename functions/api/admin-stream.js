import { extractBfzyEpisodes } from "../_lib/bfzy.js";

const BFZY_DETAIL_URL = "https://bfzyapi.com/api.php/provide/vod/?ac=videolist&ids=9145";
const DETAIL_FETCH_ATTEMPTS = 3;
const DETAIL_FETCH_TIMEOUT_MS = 8000;

function json(data, status = 200, cacheControl = "no-store") {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": cacheControl,
      "access-control-allow-origin": "*",
      "x-content-type-options": "nosniff",
    },
  });
}

async function fetchBfzyEpisodes() {
  let lastError;
  for (let attempt = 1; attempt <= DETAIL_FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(BFZY_DETAIL_URL, {
        headers: {
          accept: "application/json",
          "user-agent": "Mozilla/5.0",
        },
        signal: AbortSignal.timeout(DETAIL_FETCH_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`bfzy detail ${response.status}`);

      const episodes = extractBfzyEpisodes(await response.json());
      if (!episodes.length) throw new Error("bfzy detail contains no playable episodes");
      return episodes;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("bfzy detail unavailable");
}

export async function onRequestGet({ request }) {
  const requestUrl = new URL(request.url);
  const mode = requestUrl.searchParams.get("m") || requestUrl.searchParams.get("mode");
  if (mode !== "admin") {
    return json({ ok: false, error: "管理员片源模式未开启" }, 404);
  }

  try {
    const episodes = await fetchBfzyEpisodes();
    return json({
      ok: true,
      source: "bfzy",
      episodes,
    }, 200, "public, max-age=300, stale-while-revalidate=3600");
  } catch (error) {
    console.error("admin stream index unavailable", error);
    return json({ ok: false, error: "暴风剧集地址暂时不可用，请稍后重试或前往 B 站" }, 502);
  }
}
