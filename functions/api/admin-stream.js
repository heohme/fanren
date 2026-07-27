import { extractBfzyEpisodes, filterBfzyManifest } from "../_lib/bfzy.js";

const BFZY_DETAIL_URL = "https://bfzyapi.com/api.php/provide/vod/?ac=videolist&ids=9145";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function onRequestGet({ request }) {
  const requestUrl = new URL(request.url);
  if (requestUrl.searchParams.get("mode") !== "admin") {
    return json({ ok: false, error: "管理员片源模式未开启" }, 404);
  }

  const episode = Number(requestUrl.searchParams.get("ep"));
  if (!Number.isInteger(episode) || episode < 1 || episode > 999) {
    return json({ ok: false, error: "集数参数不正确" }, 400);
  }

  try {
    const detailResponse = await fetch(BFZY_DETAIL_URL, {
      headers: {
        accept: "application/json",
        "user-agent": "fanrenmap-admin-stream/1.0",
      },
    });
    if (!detailResponse.ok) throw new Error(`bfzy detail ${detailResponse.status}`);

    const episodes = extractBfzyEpisodes(await detailResponse.json());
    const stream = episodes.find((item) => item.episode === episode);
    if (!stream) return json({ ok: false, error: `暴风资源暂未收录第 ${episode} 话` }, 404);

    const manifestResponse = await fetch(stream.url, {
      headers: {
        accept: "application/vnd.apple.mpegurl, application/x-mpegURL, */*",
        referer: "https://bfzyapi.com/",
        "user-agent": "Mozilla/5.0",
      },
    });
    if (!manifestResponse.ok) throw new Error(`bfzy manifest ${manifestResponse.status}`);

    const rawManifest = await manifestResponse.text();
    if (!rawManifest.trimStart().startsWith("#EXTM3U")) {
      throw new Error("bfzy manifest format invalid");
    }
    const manifest = filterBfzyManifest(rawManifest, stream.url);
    return new Response(manifest, {
      status: 200,
      headers: {
        "content-type": "application/vnd.apple.mpegurl; charset=utf-8",
        "cache-control": "public, max-age=300, stale-while-revalidate=1800",
        "access-control-allow-origin": "*",
        "x-content-type-options": "nosniff",
        "x-fanren-stream-source": "bfzy",
        "x-fanren-stream-episode": String(episode),
      },
    });
  } catch (error) {
    console.error("admin stream unavailable", error);
    return json({ ok: false, error: "暴风片源暂时不可用，请稍后重试或前往 B 站" }, 502);
  }
}
