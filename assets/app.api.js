// app.api.js
const API_BASE = 'https://tea-order-server.onrender.com/api';

async function post(action, payload) {
  const r = await fetch(`${API_BASE}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
  if (!r.ok) throw new Error("http_" + r.status);
  const json = await r.json();
  if (json && json.ok && "data" in json) return json.data;
  return json;
}

export const api = {
  getConfig() {
    return fetch(`${API_BASE}/config`).then(r => r.json());
  },
  previewTotals(items, shippingMethod, promoCode) {
    return post("previewTotals", { items, shippingMethod, promoCode });
  },
  submitOrder(payload) {
    return post("submitOrder", payload);
  },
  searchStores(payload) {
    return post("searchStores", payload);
  },
  getPlaceDetail(place_id) {
    return post("getPlaceDetail", { place_id });
  },
};

// ✅ 掛到全域，方便 Console 測試與其他檔案共用
window.api = api;

// ✅ 附贈簡短測試指令
window.get = (endpoint) =>
  fetch(`${API_BASE}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`)
    .then(r => r.json());
