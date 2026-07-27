import assert from "node:assert/strict";
import {
  extractBfzyEpisodes,
  filterBfzyManifest,
  isAllowedBfzyStream,
} from "../functions/_lib/bfzy.js";

const episode184 = "https://v.fengbao11.com/video/fanrenxiuxianchuan/6e3b0e1131e1/index.m3u8";
assert.equal(isAllowedBfzyStream(episode184), true);
assert.equal(isAllowedBfzyStream("https://evil.example/video/fanrenxiuxianchuan/184/index.m3u8"), false);
assert.equal(isAllowedBfzyStream("https://v.fengbao11.com/video/other-show/184/index.m3u8"), false);

const episodes = extractBfzyEpisodes({
  list: [{
    vod_id: 9145,
    vod_play_url: `第183集$https://v.fengbao11.com/video/fanrenxiuxianchuan/fb95db2a51ba/index.m3u8#第184集$${episode184}`,
  }],
});
assert.deepEqual(episodes.map((item) => item.episode), [183, 184]);
assert.equal(episodes[1].url, episode184);
assert.deepEqual(extractBfzyEpisodes({
  list: [{ vod_id: 9999, vod_play_url: `第184集$${episode184}` }],
}), []);

const manifest = filterBfzyManifest(`#EXTM3U
#EXT-X-DISCONTINUITY
#EXTINF:3,
/video/adjump/time/ad.ts
#EXT-X-DISCONTINUITY
#EXTINF:4,
0000001.ts
#EXT-X-KEY:METHOD=AES-128,URI="key.bin"
#EXT-X-ENDLIST
`, episode184);
assert.equal(manifest.includes("adjump"), false);
assert.equal(manifest.includes("#EXT-X-DISCONTINUITY"), false);
assert.equal(manifest.includes("https://v.fengbao11.com/video/fanrenxiuxianchuan/6e3b0e1131e1/0000001.ts"), true);
assert.equal(manifest.includes('URI="https://v.fengbao11.com/video/fanrenxiuxianchuan/6e3b0e1131e1/key.bin"'), true);

console.log("bfzy stream tests passed");
