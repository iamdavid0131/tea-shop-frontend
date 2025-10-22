// _worker.js (Cloudflare Pages Functions 入口)
const GAS_BASE = 'https://script.google.com/macros/s/AKfycbwc09A_Sj_kxrZZYn1y0QXgNbTVuQ0159ok6zUrg6u9xOEenrBFUXVwoxVJB_Zs6qANlA/exec'; // 你的 GAS 部署 URL

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);

    // 只代理 /api/*；其他交給 Pages 靜態檔
    if (url.pathname.startsWith('/api/')) {
      // 轉到 GAS，保留路徑與查詢字串
      const upstream = new URL(GAS_BASE);
      upstream.search = url.search;
      // 將 /api/... 當成 fn 參數傳回 GAS（也可保留 pathname）
      const apiPath = url.pathname.replace(/^\/api\//, ''); // e.g. "quote"
      upstream.searchParams.set('fn', apiPath);

      const init = {
        method: req.method,
        headers: new Headers(req.headers),
        body: ['GET','HEAD'].includes(req.method) ? undefined : await req.arrayBuffer()
      };
      // 清掉可能引發問題的標頭
      init.headers.delete('host');
      init.headers.delete('cf-connecting-ip');
      init.headers.delete('x-forwarded-host');

      const resp = await fetch(upstream.toString(), init);

      // 統一 CORS（同網域其實不一定需要，但保險）
      const h = new Headers(resp.headers);
      h.set('Access-Control-Allow-Origin', 'https://hsianghsing.org');
      h.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      h.set('Access-Control-Allow-Headers', 'content-type');
      if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });

      return new Response(resp.body, { status: resp.status, headers: h });
    }

    // 非 /api：交給 Pages 靜態資源（此處不處理，讓預設行為接手）
    return env.ASSETS.fetch(req);
  }
};
