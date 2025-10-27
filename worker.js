/**
 * ☁️ 祥興茶行 Worker（新版：代理到 Node.js API）
 * -------------------------------------------------------
 * ✅ 開發模式：代理 http://localhost:3000
 * ✅ 正式部署：代理你的 Node.js 雲端 API（非 Worker 自己）
 * -------------------------------------------------------
 */

export default {
  async fetch(req, env) {
    // 1️⃣ Node API 網址（不要指向自己）
    // ⚠️ 請確保 NODE_API 指向真正的 Node.js 伺服器，而非 hsianghsing.org/api
    const NODE_API = env.NODE_API || "http://localhost:3000";
    const ALLOW_ORIGIN = env.ALLOW_ORIGIN || "*";

    // 2️⃣ CORS 設定
    const CORS_HEADERS = {
      "Access-Control-Allow-Origin": ALLOW_ORIGIN,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    // 3️⃣ 處理預檢請求
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // 4️⃣ 只允許 GET / POST
    if (!["GET", "POST"].includes(req.method)) {
      return json({ ok: false, error: "Method Not Allowed" }, 405, CORS_HEADERS);
    }

    try {
      const url = new URL(req.url);

      // ✅ 轉發給 Node.js（完整 pathname + 查詢參數）
      const upstreamUrl = NODE_API + url.pathname + url.search;

      const init = {
        method: req.method,
        headers: new Headers(req.headers),
        body: req.method === "POST" ? await req.text() : undefined,
      };

      const upstream = await fetch(upstreamUrl, init);
      const headers = new Headers(upstream.headers);

      // 🔧 加上 CORS 回應頭
      headers.set("Access-Control-Allow-Origin", CORS_HEADERS["Access-Control-Allow-Origin"]);
      headers.set("Access-Control-Allow-Methods", CORS_HEADERS["Access-Control-Allow-Methods"]);
      headers.set("Access-Control-Allow-Headers", CORS_HEADERS["Access-Control-Allow-Headers"]);

      if (!headers.get("content-type")) headers.set("content-type", "application/json");

      return new Response(upstream.body, { status: upstream.status, headers });
    } catch (err) {
      return json({ ok: false, error: `Proxy failed: ${String(err)}` }, 502, CORS_HEADERS);
    }
  },
};

// ---- utils ----
function json(obj, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", ...extraHeaders },
  });
}
