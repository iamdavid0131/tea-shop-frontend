// Cloudflare Pages Functions - dynamic route: /api/:action
export const onRequestPost = async ({ request, env, params }) => {
    const action = params.action; // 'quote' | 'submitOrder' | 'products' | 'checkPromo' ...
    if (!action) return json({ ok: false, error: 'Missing action' }, 400);
  
    const bodyText = await request.text();
    const ts = Math.floor(Date.now() / 1000); // 秒級 timestamp
  
    // 以 API_TOKEN 產 HMAC 簽章：message = body + '.' + ts
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(env.API_TOKEN),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const message = encoder.encode(`${bodyText}.${ts}`);
    const sigBuffer = await crypto.subtle.sign('HMAC', key, message);
    const sigHex = [...new Uint8Array(sigBuffer)].map(b => b.toString(16).padStart(2,'0')).join('');
  
    const url = `${env.GAS_URL}?action=${encodeURIComponent(action)}&ts=${ts}&sig=${sigHex}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' }, // 避免預檢，與 GAS 相容
      body: bodyText
    });
  
    const text = await res.text(); // GAS 回應 JSON 字串
    return new Response(text, {
      status: res.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
  };
  
  function json(obj, status = 200) {
    return new Response(JSON.stringify(obj), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  