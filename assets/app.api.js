// app.api.js
// 將 BASE 改為 Node.js API 伺服器的實際網址
// 若前端與後端同域，可用相對路徑 "/api"
// 若本地測試在 3000 port，可改成 "http://localhost:3000/api"
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
