import { reviewRequest } from "../../../../_lib/review.js";
import { json } from "../../../../_lib/community.js";

export function onRequestPost(context) {
  return reviewRequest(context, "duplicate");
}

export function onRequest() {
  return json({ ok: false, error: "请求方法不受支持" }, 405, { allow: "POST" });
}
