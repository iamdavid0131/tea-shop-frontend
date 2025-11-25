// ===============================
// ☕ app.api.js
// 祥興茶行前端專用 API 模組（強化穩定版 + API Key 防護）
// ===============================

const API_BASE = "https://tea-order-server.onrender.com/api";

// 🔥 [安全性設定] 請確保這裡的值跟後端 .env 的 API_SECRET_KEY 一模一樣
const API_KEY = "MySuperSecretKey123"; 

/** 共用錯誤處理 */
async function safeFetch(url, options = {}) {
  try {
    const r = await fetch(url, options);
    
    // 針對 API Key 錯誤的特別處理
    if (r.status === 403) {
      console.error("❌ API Key 錯誤或無權限");
      throw new Error("Forbidden: Invalid API Key");
    }

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

/** GET 封裝 (自動帶入 API Key) */
async function _get(path) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  return safeFetch(url, {
    method: "GET",
    headers: {
      "x-api-key": API_KEY // 👈 自動帶入 Key
    }
  });
}

/** POST 封裝 (自動帶入 API Key) */
async function _post(path, payload) {
  const url = `${API_BASE}${path}`;
  return safeFetch(url, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "x-api-key": API_KEY // 👈 自動帶入 Key
    },
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