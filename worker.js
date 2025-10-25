/**
 * ☁️ 祥興茶行 Worker（新版：代理到 Node.js API）
 * -------------------------------------------------------
 * ✅ 開發模式：可以改為 http://localhost:3000/api
 * ✅ 正式部署：使用 https://hsianghsing.org/api
 * -------------------------------------------------------
 */

export default {
  async fetch(req, env, ctx) {
    const NODE_API = env.NODE_API || "http://localhost:3000/api";

    // 基本 CORS 設定
    const CORS_HEADERS = {
      "Access-Control-Allow-Origin": "*", // 若要限制，改成你的正式網域
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    // 處理預檢請求（CORS）
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // 只允許 GET / POST
    if (!["GET", "POST"].includes(req.method)) {
      return json({ ok: false, error: "Method Not Allowed" }, 405, CORS_HEADERS);
    }

    try {
      const url = new URL(req.url);

      // 把 /api/... 的請求轉發給 Node.js 伺服器
      const upstreamUrl = NODE_API + url.pathname.replace(/^\/api/, "");
      const init = {
        method: req.method,
        headers: req.headers,
        body: req.method === "POST" ? await req.text() : undefined,
      };

      const upstream = await fetch(upstreamUrl, init);
      const headers = new Headers(upstream.headers);

      // 加上 CORS
      headers.set("Access-Control-Allow-Origin", CORS_HEADERS["Access-Control-Allow-Origin"]);
      headers.set("Access-Control-Allow-Methods", CORS_HEADERS["Access-Control-Allow-Methods"]);
      headers.set("Access-Control-Allow-Headers", CORS_HEADERS["Access-Control-Allow-Headers"]);

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
