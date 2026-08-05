import assert from "node:assert/strict";
import { onRequestPost } from "../functions/api/events.js";

const batched = [];
const db = {
  prepare(sql) {
    return {
      bind(...args) {
        return {
          args,
          sql,
          async run() { return { success: true }; },
          async first() { return { request_count: 1 }; },
        };
      },
    };
  },
  async batch(statements) {
    batched.push(...statements);
    return statements.map(() => ({ success: true }));
  },
};

const request = new Request("https://fanrenmap.pages.dev/api/events", {
  method: "POST",
  headers: { "content-type": "application/json", "CF-Connecting-IP": "127.0.0.1" },
  body: JSON.stringify({
    events: [{
      eventName: "landing_view",
      objectType: "page",
      objectId: "/",
      objectLabel: "凡人残图",
      context: "tagged",
      source: "xhs_qr",
      sessionId: "analytics-test-session",
      path: "/",
      device: "mobile",
      clientAt: "2026-08-05T08:00:00.000Z",
    }],
  }),
});

const response = await onRequestPost({ request, env: { COMMUNITY_DB: db, RATE_LIMIT_SALT: "test" } });
assert.equal(response.status, 202);
assert.deepEqual(await response.json(), { ok: true, accepted: 1 });
assert.equal(batched.length, 1);
assert.match(batched[0].sql, /INSERT INTO analytics_events/);
assert.equal(batched[0].args[1], "landing_view");
assert.equal(batched[0].args[8], "xhs_qr");
assert.equal(batched[0].args[9], "mobile");

const invalidRequest = new Request("https://fanrenmap.pages.dev/api/events", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ events: [{ eventName: "unknown", sessionId: "analytics-test-session" }] }),
});
const invalidResponse = await onRequestPost({ request: invalidRequest, env: { COMMUNITY_DB: db } });
assert.equal(invalidResponse.status, 400);

console.log("analytics ingestion tests passed");
