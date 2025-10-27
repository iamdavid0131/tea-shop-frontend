/**
 * ☁️ 祥興茶行 Worker（新版：代理到 Node.js API）
 * -------------------------------------------------------
 * ✅ 開發模式：可改成 http://localhost:3000/api
 * ✅ 正式部署：使用 https://hsianghsing.org/api
 * -------------------------------------------------------
 */

export default {
  async fetch(req, env, ctx) {
    // 1️⃣ 預設為你的正式 Node API 網域
    const NODE_API = env.NODE_API || "https://hsianghsing.org/api";

    // 2️⃣ 基本 CORS 設定
    const CORS_HEADERS = {
      "Access-Control-Allow-Origin": "*", // 若要限制，改成你的正式網域
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    // 3️⃣ CORS 預檢請求
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // 僅允許 GET / POST
    if (!["GET", "POST"].includes(req.method)) {
      return json({ ok: false, error: "Method Not Allowed" }, 405, CORS_HEADERS);
    }

    try {
      const url = new URL(req.url);

      // 4️⃣ 正確拼接代理網址（避免重複 /api/api）
      const upstreamUrl = `${NODE_API}${url.pathname.replace(/^\/api/, "")}${url.search}`;

      // 5️⃣ 保留原請求體（POST 需轉為 text()，避免重複讀取）
      const init = {
        method: req.method,
        headers: new Headers(req.headers),
        body: req.method === "POST" ? await req.text() : undefined,
      };

      const upstream = await fetch(upstreamUrl, init);

      // 6️⃣ 合併回應（加上 CORS）
      const headers = new Headers(upstream.headers);
      headers.set("Access-Control-Allow-Origin", CORS_HEADERS["Access-Control-Allow-Origin"]);
      headers.set("Access-Control-Allow-Methods", CORS_HEADERS["Access-Control-Allow-Methods"]);
      headers.set("Access-Control-Allow-Headers", CORS_HEADERS["Access-Control-Allow-Headers"]);

      // 7️⃣ 確保 Content-Type 存在（以防 text/plain）
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
