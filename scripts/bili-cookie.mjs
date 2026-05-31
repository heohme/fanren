/**
 * 获取 B 站匿名访问所需的 buvid3/buvid4 等 cookie
 * 通过访问首页 + spi 接口拿
 */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

export async function getAnonymousCookie() {
  // 1. 访问首页获取基础 cookie
  const homeRes = await fetch("https://www.bilibili.com/", {
    headers: { "User-Agent": UA },
  });
  const setCookies = homeRes.headers.getSetCookie?.() || [];
  const cookieMap = {};
  for (const sc of setCookies) {
    const [kv] = sc.split(";");
    const idx = kv.indexOf("=");
    if (idx > 0) cookieMap[kv.slice(0, idx).trim()] = kv.slice(idx + 1).trim();
  }

  // 2. 调用 spi 接口补 buvid3/buvid4（更稳）
  try {
    const spiRes = await fetch(
      "https://api.bilibili.com/x/frontend/finger/spi",
      { headers: { "User-Agent": UA, Referer: "https://www.bilibili.com/" } }
    );
    const spi = await spiRes.json();
    if (spi?.data?.b_3) cookieMap.buvid3 = spi.data.b_3;
    if (spi?.data?.b_4) cookieMap.buvid4 = spi.data.b_4;
  } catch {
    /* ignore */
  }

  const cookie = Object.entries(cookieMap)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
  return cookie;
}

export { UA };
