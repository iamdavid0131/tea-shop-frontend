export default {
  async fetch(req, env) {
    // 同源就不需要 CORS，僅處理 OPTIONS 以防瀏覽器預檢
    if (req.method === "OPTIONS") return new Response(null, { status: 204 });

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ ok:false, error:"Only POST" }), {
        status: 405, headers: { "content-type": "application/json" }
      });
    }

    const body = await req.text();
    const ts = Date.now().toString();
    const sig = await hmacHex(env.EDGE_SECRET, `${ts}:${body}`);

    const r = await fetch(env.GAS_URL, {
      method: "POST",
      headers: {
        "content-type": req.headers.get("content-type") || "application/json",
        "x-edge-ts": ts,
        "x-edge-sign": sig
      },
      body
    });

    return new Response(r.body, {
      status: r.status,
      headers: { "content-type": r.headers.get("content-type") || "application/json" }
    });
  }
};

async function hmacHex(secret, msg) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), {name:"HMAC", hash:"SHA-256"}, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
