// assets/app.api.js
const API = '/api'; // Cloudflare Worker 在 hsianghsing.org 綁的路徑

async function call(action, payload = {}) {
  const r = await fetch(API, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ action, payload })
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok || json.ok === false) {
    throw new Error(json.error || `HTTP ${r.status}`);
  }
  return json;
}

export const api = {
  // 這裡回傳結構直接「攤平」成你前端現有使用方式
  async getConfig() {
    const res = await call('getConfig');
    // doPost 版是 { ok, data }，doGet 版可能直接回資料，統一一下
    const d = res.data || res;
    return {
      PRICES: d.PRICES || {},
      PRODUCTS: d.PRODUCTS || [],
      FREE_SHIPPING_THRESHOLD: d.FREE_SHIPPING_THRESHOLD ?? 1000,
      BASE_SHIPPING_FEE: d.BASE_SHIPPING_FEE ?? 60,
      COD_SHIP_FEE: d.COD_SHIP_FEE ?? 100,
      COD_FREE_SHIPPING_THRESHOLD: d.COD_FREE_SHIPPING_THRESHOLD ?? 2000,
      STOCKS: d.STOCKS || {}
    };
  },
  async previewTotals(items, shippingMethod, promoCode) {
    const res = await call('previewTotals', { items, shippingMethod, promoCode });
    return res.data || res; // { subtotal, discount, freeship, shippingFee, total, appliedCode }
  },
  async submitOrder(payload) {
    const res = await call('submitOrder', payload);
    return res.data || res; // { orderId, subtotal, shippingFee, total, lineBindUrl, appliedCode }
  },
  async searchStores(opt) {
    const res = await call('searchStores', opt);
    return res.data || res; // { ok, results }
  },
  async getPlaceDetail(placeId) {
    const res = await call('getPlaceDetail', { placeId });
    return res.data || res; // { ok, result }
  },
  async apiGetCustomerByPhone(phone) {
    const res = await call('apiGetCustomerByPhone', { phone });
    return res.data || res;
  },
  async apiUpsertCustomer(obj) {
    const res = await call('apiUpsertCustomer', obj);
    return res.data || res;
  }
};
