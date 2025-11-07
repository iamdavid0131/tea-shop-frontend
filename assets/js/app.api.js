// ===============================
// ☕ app.api.js
// 祥興茶行前端專用 API 模組
// ===============================

const API_BASE = 'https://tea-order-server.onrender.com/api';

async function _get(path) {
  const url = path.startsWith("http")
    ? path
    : `${API_BASE}${path}`;
  const r = await fetch(url);
  return r.json();
}

async function _post(path, payload) {
  const url = `${API_BASE}${path}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
  return r.json();
}

export const api = {
  /** ✅ 商品資料 */
  getConfig() {
    return _get("/config");
  },

  /** ✅ 金額試算 */
  previewTotals(items, shippingMethod, promoCode) {
    return _post("/preview", { items, shippingMethod, promoCode });
  },

  /** ✅ 送出訂單 */
  submitOrder(payload) {
    return _post("/order", payload);
  },

  /** ✅ 查詢門市（後端 GET） */
  searchStores(q, lat, lng) {
    const params = new URLSearchParams({ q });
    if (lat && lng) {
      params.set("lat", lat);
      params.set("lng", lng);
    }
    return _get(`/stores/search?${params.toString()}`);
  },

  /** 查附近門市 */
  searchStoresNear(lat, lng, brand, radius) {
    const params = new URLSearchParams({
      lat, lng,
      brand: brand || "all",
      radius: radius || 1000
    });
    return _get(`/stores/near?${params.toString()}`);
  },


  /** ✅ 會員查詢 */
  memberSearch(phone) {
    return _get(`/member?phone=${encodeURIComponent(phone)}`);
  },
  
  /** ✅ 查地標附近的門市（Google Maps Geocode + Places） */
  searchStoresByLandmark(q, radius = 800) {
    const params = new URLSearchParams({
      q,
      radius
    });
    return _get(`/stores/landmark?${params.toString()}`);
  }

};

console.log("✅ app.api.js 重新載入成功，API_BASE =", API_BASE);
