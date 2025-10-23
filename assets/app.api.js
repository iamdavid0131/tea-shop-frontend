// app.api.js
// 將 BASE 換成你的 Worker 網址（建議用子網域，例如 https://api.hsianghsing.org/ ）
// 若先用 workers.dev 測試，也可以填 https://<你的 workers 子網域>.workers.dev/
const BASE = "/api"; // 結尾保留斜線

async function post(action, payload) {
  const r = await fetch(BASE, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(
      payload === undefined ? { action } : { action, payload }
    ),
    // credentials: "omit" // 同網域不需要帶 cookie
  });
  if (!r.ok) throw new Error("http_" + r.status);
  const json = await r.json();
  // GAS doPost 有兩種回傳型態，這裡統一處理：
  // 1) { ok:true, data: {...} } → 回傳 data
  // 2) { ok:true, ...直接是資料... } → 原樣回傳
  if (json && json.ok && Object.prototype.hasOwnProperty.call(json, "data")) {
    return json.data;
  }
  return json;
}

export const api = {
  getConfig() {
    return post("getConfig");
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
