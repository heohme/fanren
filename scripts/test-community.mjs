import assert from "node:assert/strict";
import { ApiError, normalizeSubmission } from "../functions/_lib/community.js";

const creator = normalizeSubmission({
  type: "creator",
  targetUrl: "https://space.bilibili.com/123456/?spm_id_from=333.999.0.0",
  upName: "测试道友",
  reason: "长期更新凡人解析内容",
});
assert.equal(creator.targetKey, "123456");
assert.equal(creator.targetUrl, "https://space.bilibili.com/123456");

const work = normalizeSubmission({
  type: "work",
  targetUrl: "http://www.bilibili.com/video/BV1AbCdEf123?p=1",
  upName: "测试道友",
  title: "凡人修仙传第183话解析",
  episode: "183",
  category: "逐集解析",
  reason: "观点清晰并且更新稳定",
});
assert.equal(work.targetKey, "BV1AbCdEf123");
assert.equal(work.episode, 183);
assert.equal(work.targetUrl, "https://www.bilibili.com/video/BV1AbCdEf123");

const quickWork = normalizeSubmission({
  type: "work",
  targetUrl: "https://www.bilibili.com/video/BV1QuickLink",
});
assert.equal(quickWork.title, null);
assert.equal(quickWork.reason, "道友推荐这部作品");

const quickCreator = normalizeSubmission({
  type: "creator",
  targetUrl: "https://space.bilibili.com/987654",
});
assert.equal(quickCreator.upName, null);
assert.equal(quickCreator.reason, "道友推荐这位 UP");

const namedCreator = normalizeSubmission({
  type: "creator",
  targetUrl: "骚人风希",
});
assert.equal(namedCreator.upName, "骚人风希");
assert.equal(namedCreator.targetKey, "name:骚人风希");
assert.match(namedCreator.targetUrl, /^https:\/\/search\.bilibili\.com\/upuser\?keyword=/);

assert.throws(
  () => normalizeSubmission({ type: "work", targetUrl: "https://example.com/video/BV1ABC", title: "错误链接", reason: "这个理由足够长" }),
  (error) => error instanceof ApiError && error.status === 400
);

assert.throws(
  () => normalizeSubmission({ type: "correction", targetUrl: "https://fanrenmap.pages.dev/", reason: "太短" }),
  (error) => error instanceof ApiError && error.status === 400
);

console.log("community validation tests passed");
