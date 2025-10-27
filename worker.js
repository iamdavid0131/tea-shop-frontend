/**
 * ☁️ 祥興茶行 Cloudflare 前端 Worker（正式版）
 * -------------------------------------------------------
 * ✅ 自動代理 /api/* 到雲端後端 Worker
 * ✅ 其他請求交給 Pages 靜態資產
 * -------------------------------------------------------
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // === 後端雲端 API 網址（請改成你實際部署的 Worker 網址） ===
    const API_BASE = "https://tea-order-server.onrender.com/api";

    // ✅ 攔截 /api/* → 轉發到雲端後端
    if (url.pathname.startsWith("/api/")) {
      const target = API_BASE + url.pathname + url.search;

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

    // ✅ 其他請求 → 靜態頁面
    return env.ASSETS.fetch(request);
  },
};
