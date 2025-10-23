export default {
  async fetch(req, env, ctx) {
    // ------- 基本檢查 -------
    const GAS_URL = env.GAS_URL;
    if (!GAS_URL) {
      return json({ ok: false, error: "Missing env.GAS_URL" }, 500);
    }

    // ------- CORS（若同源可保持 *；若要鎖網域，改成你的前端網域）-------
    const CORS_HEADERS = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (req.method !== "POST") {
      return json({ ok: false, error: "Only POST" }, 405, CORS_HEADERS);
    }

    try {
      // ------- 讀 body 並計算簽章（與 GAS 相同規則：ts:rawBody） -------
      const bodyText = await req.text();
      const ts = Date.now().toString();
      const secret = String(env.EDGE_SECRET || ""); // 未設也允許（GAS 端未設定會放行）
      const sig = await hmacHex(secret, `${ts}:${bodyText}`);

      // ------- 轉發到 GAS doPost -------
      const upstream = await fetch(GAS_URL, {
        method: "POST",
        headers: {
          "content-type": req.headers.get("content-type") || "application/json",
          "x-edge-ts": ts,
          "x-edge-sign": sig,
        },
        body: bodyText,
      });

      // ------- 回傳（維持 content-type；加上 CORS） -------
      const headers = new Headers(upstream.headers);
      headers.set("Access-Control-Allow-Origin", CORS_HEADERS["Access-Control-Allow-Origin"]);
      headers.set("Access-Control-Allow-Methods", CORS_HEADERS["Access-Control-Allow-Methods"]);
      headers.set("Access-Control-Allow-Headers", CORS_HEADERS["Access-Control-Allow-Headers"]);
      // 確保有 content-type
      if (!headers.get("content-type")) headers.set("content-type", "application/json");

      return new Response(upstream.body, { status: upstream.status, headers });
    } catch (err) {
      // GAS 掛點或網路錯誤 → 502
      return json({ ok: false, error: `Upstream failed: ${String(err)}` }, 502, CORS_HEADERS);
    }
  },
};

// ---- utils ----
async function hmacHex(secret, msg) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json(obj, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", ...extraHeaders },
  });
}
