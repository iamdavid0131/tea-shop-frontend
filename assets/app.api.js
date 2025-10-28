// ===============================
// ☕ app.api.js
// 祥興茶行前端專用 API 模組
// ===============================

const API_BASE = 'https://tea-order-server.onrender.com/api';

// -------------------------------
// 🔧 通用 POST 封裝
// -------------------------------
async function post(endpoint, payload) {
  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
  if (!r.ok) throw new Error(`[HTTP ${r.status}] ${await r.text()}`);
  return r.json();
}

// -------------------------------
// 📦 API 模組
// -------------------------------
export const api = {
  /** 取得伺服器設定與商品清單 */
  async getConfig() {
    const r = await fetch(`${API_BASE}/config`);
    if (!r.ok) throw new Error(`[HTTP ${r.status}] ${await r.text()}`);
    return r.json();
  },

  /** 試算金額（含折扣與運費） */
  previewTotals(items, shippingMethod, promoCode) {
    return post('/preview', { items, shippingMethod, promoCode });
  },

  /** 提交訂單 */
  submitOrder(payload) {
    return post('/order', payload);
  },

  /** 查詢 Google 門市資料 */
  searchStores(payload) {
    return post('/stores', payload);
  },

  /** 查詢地點詳細資訊 */
  getPlaceDetail(place_id) {
    return post('/place-detail', { place_id });
  },
};

// -------------------------------
// 🌍 掛到全域（方便 Console 測試）
// -------------------------------
window.api = api;

window.get = (endpoint) =>
  fetch(`${API_BASE}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`)
    .then(r => {
      if (!r.ok) throw new Error(`[HTTP ${r.status}]`);
      return r.json();
    });

window.post = post;

console.log("✅ app.api.js 已載入，API_BASE =", API_BASE);
