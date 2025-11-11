// ===============================
// ☕ app.api.js
// 祥興茶行前端專用 API 模組（強化穩定版）
// ===============================

const API_BASE = "https://tea-order-server.onrender.com/api";

/** 共用錯誤處理 */
async function safeFetch(url, options = {}) {
  try {
    const r = await fetch(url, options);
    if (!r.ok) {
      throw new Error(`HTTP ${r.status}: ${r.statusText}`);
    }
    const data = await r.json().catch(() => ({}));
    return data;
  } catch (err) {
    console.error("❌ Fetch 失敗:", err);
    // 針對外掛干擾的偵測
    if (err.message.includes("Failed to fetch") || err.stack?.includes("inspector.js")) {
      alert("⚠️ 無法連線伺服器，可能被瀏覽器外掛阻擋，請使用無痕模式或關閉擴充功能後再試。");
    }
    throw err;
  }
}

/** GET 封裝 */
async function _get(path) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  return safeFetch(url);
}

/** POST 封裝 */
async function _post(path, payload) {
  const url = `${API_BASE}${path}`;
  return safeFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
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
    return _post("/order/submit", payload);
  },

  /** ✅ 查詢門市 */
  searchStores(q, lat, lng) {
    const params = new URLSearchParams({ q });
    if (lat && lng) {
      params.set("lat", lat);
      params.set("lng", lng);
    }
    return _get(`/stores/search?${params.toString()}`);
  },

  /** ✅ 查附近門市 */
  searchStoresNear(lat, lng, brand = "all", radius = 1000) {
    const params = new URLSearchParams({ lat, lng, brand, radius });
    return _get(`/stores/near?${params.toString()}`);
  },

  /** ✅ 會員查詢 */
  memberSearch(phone) {
    return _get(`/member?phone=${encodeURIComponent(phone)}`);
  },

  /** ✅ 查地標附近門市（Google Maps Geocode + Places） */
  async searchStoresByLandmark(q, brand = "all") {
    const params = new URLSearchParams({ q, brand });
    return _get(`/stores/landmark?${params.toString()}`);
  },
};

console.log("✅ app.api.js 重新載入成功，API_BASE =", API_BASE);
