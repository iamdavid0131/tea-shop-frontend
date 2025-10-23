const BASE = "https://api.hsianghsing.org/"; // 你的 Worker 網址，結尾要有「/」

export const api = {
  async getConfig() {
    const r = await fetch(BASE, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "getConfig" }),
    });
    return r.json(); // 會是 { ok:true, data:{...} } 結構（你 GAS 的 doPost 會包 ok/data）
  },

  async previewTotals(items, shippingMethod, promoCode) {
    const r = await fetch(BASE, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "previewTotals",
        payload: { items, shippingMethod, promoCode },
      }),
    });
    return r.json();
  },

  async submitOrder(payload) {
    const r = await fetch(BASE, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "submitOrder", payload }),
    });
    return r.json();
  },

  async searchStores(payload) {
    const r = await fetch(BASE, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "searchStores", payload }),
    });
    return r.json();
  },

  async getPlaceDetail(placeId) {
    const r = await fetch(BASE, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "getPlaceDetail", payload: { place_id: placeId } }),
    });
    return r.json();
  },
};