const BFZY_STREAM_HOST = /(^|\.)(?:ddbbffcdn|rrcdnbf\d+|fengbao\d+|baofeng\d+|bfllvip|bvvvvvvvvv1f)\.com$/i;
const FANREN_STREAM_PATH = /^\/video\/fanrenxiuxianchuan\//i;

export function isAllowedBfzyStream(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && BFZY_STREAM_HOST.test(url.hostname)
      && FANREN_STREAM_PATH.test(url.pathname)
      && url.pathname.toLowerCase().endsWith(".m3u8");
  } catch {
    return false;
  }
}

export function extractBfzyEpisodes(payload) {
  const item = payload?.list?.find((entry) => String(entry?.vod_id) === "9145");
  if (!item || typeof item.vod_play_url !== "string") return [];

  return item.vod_play_url
    .split("$$$")
    .flatMap((source) => source.split("#"))
    .map((entry) => {
      const separator = entry.indexOf("$");
      if (separator < 0) return null;
      const label = entry.slice(0, separator).trim();
      const url = entry.slice(separator + 1).trim();
      const episode = Number(label.match(/(\d+)/)?.[1]);
      if (!Number.isInteger(episode) || episode < 1 || !isAllowedBfzyStream(url)) return null;
      return { episode, url };
    })
    .filter(Boolean);
}

function rewriteUriAttribute(line, baseUrl) {
  return line.replace(/URI=(["'])(.*?)\1/i, (match, quote, uri) => {
    try {
      return `URI=${quote}${new URL(uri, baseUrl).toString()}${quote}`;
    } catch {
      return match;
    }
  });
}

export function filterBfzyManifest(content, baseUrl) {
  const output = [];
  for (const rawLine of String(content || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line === "#EXT-X-DISCONTINUITY") continue;

    if (!line.startsWith("#")) {
      let absolute;
      try {
        absolute = new URL(line, baseUrl);
      } catch {
        continue;
      }
      if (absolute.pathname.includes("/video/adjump/")) {
        if (output.at(-1)?.startsWith("#EXTINF")) output.pop();
        continue;
      }
      output.push(absolute.toString());
      continue;
    }

    output.push(line.includes("URI=") ? rewriteUriAttribute(line, baseUrl) : line);
  }
  return `${output.join("\n")}\n`;
}
