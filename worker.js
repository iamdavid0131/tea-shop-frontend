/**
 * ☁️ 祥興茶行 Worker（修正版：正確代理 Node.js /api 路徑）
 * -------------------------------------------------------
 * ✅ 開發模式：代理 http://localhost:3000/api
 * ✅ 正式部署：代理你的雲端 Node.js API
 * -------------------------------------------------------
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ✅ 代理所有 /api/* 請求到本地 Node.js
    if (url.pathname.startsWith("/api/")) {
      const target = "http://127.0.0.1:3000" + url.pathname + url.search;
      const init = {
        method: request.method,
        headers: request.headers,
      };
      if (request.method !== "GET" && request.method !== "HEAD") {
        init.body = request.body;
      }

      const response = await fetch(target, init);
      const res = new Response(response.body, response);
      res.headers.set("Access-Control-Allow-Origin", "*");
      return res;
    }

    // 否則回傳靜態頁（index.html）
    return env.ASSETS.fetch(request);
  },
};


// ---- utils ----
function json(obj, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", ...extraHeaders },
  });
}
