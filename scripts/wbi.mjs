/**
 * B 站 WBI 签名实现
 * 参考: https://github.com/SocialSisterYi/bilibili-API-collect/blob/master/docs/misc/sign/wbi.md
 */
import { createHash } from "node:crypto";

const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35,
  27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
  37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4,
  22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52,
];

function getMixinKey(orig) {
  return MIXIN_KEY_ENC_TAB.map((n) => orig[n]).join("").slice(0, 32);
}

/**
 * 对参数对象进行 WBI 签名，返回包含 w_rid 和 wts 的查询字符串
 */
export function encWbi(params, imgKey, subKey) {
  const mixinKey = getMixinKey(imgKey + subKey);
  const currTime = Math.round(Date.now() / 1000);
  const chrFilter = /[!'()*]/g;

  const merged = { ...params, wts: currTime };
  const query = Object.keys(merged)
    .sort()
    .map((key) => {
      const value = String(merged[key]).replace(chrFilter, "");
      return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    })
    .join("&");

  const wbiSign = createHash("md5").update(query + mixinKey).digest("hex");
  return `${query}&w_rid=${wbiSign}`;
}

/**
 * 从 nav 接口获取 wbi_img 的 img_key / sub_key
 */
export async function getWbiKeys(cookie = "") {
  const res = await fetch("https://api.bilibili.com/x/web-interface/nav", {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      Referer: "https://www.bilibili.com/",
      Cookie: cookie,
    },
  });
  const json = await res.json();
  const { img_url, sub_url } = json.data.wbi_img;
  const imgKey = img_url.slice(img_url.lastIndexOf("/") + 1, img_url.lastIndexOf("."));
  const subKey = sub_url.slice(sub_url.lastIndexOf("/") + 1, sub_url.lastIndexOf("."));
  return { imgKey, subKey };
}
