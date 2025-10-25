/**
 * ☕ 祥興茶行購物頁 app.js
 * ======================================================
 * 前端主程式（Cloudflare Pages + Node.js 雙環境相容）
 *
 * 🌍 環境自動偵測：
 *   - 開發模式（localhost）→ 使用 http://localhost:3000/api
 *   - 正式部署（hsianghsing.org）→ 使用 https://hsianghsing.org/api
 *
 * 📦 後端 API 對應：
 *   - GET  /api/config          → 後端組態（產品、運費等）
 *   - POST /api/previewTotals   → 試算金額（含折扣與免運）
 *   - POST /api/order           → 送出訂單
 *   - POST /api/stores          → 門市查詢（Google Places）
 *
 * 🧭 功能模組：
 *   - 商品渲染與數量調整
 *   - sticky bar 顯示總金額
 *   - localStorage 快取購物狀態
 *   - 優惠碼與運費動態試算
 *   - LINE / Cloudflare Pages 相容設計
 * ======================================================
 */

// ------------------------------
// 🔧 API 基本設定
// ------------------------------
const API_BASE = location.hostname.includes("localhost")
  ? "http://localhost:3000/api"
  : "https://hsianghsing.org/api";

// 包一層通用的 API fetch
async function post(endpoint, payload) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[HTTP ${res.status}] ${text}`);
  }
  return res.json();
}

async function get(endpoint) {
  const res = await fetch(`${API_BASE}${endpoint}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[HTTP ${res.status}] ${text}`);
  }
  return res.json();
}

// ------------------------------
// 📦 API 模組
// ------------------------------
const api = {
  /** 取得伺服器設定與商品清單 */
  getConfig() {
    return get("/config");
  },

  /** 試算金額（含折扣與運費） */
  previewTotals(items, shippingMethod, promoCode) {
    return post("/preview", { items, shippingMethod, promoCode });
  },

  /** 提交訂單 */
  submitOrder(payload) {
    return post("/order", payload);
  },

  /** 查詢 Google 門市資料 */
  searchStores(keyword) {
    return post("/stores", { keyword });
  },
};

// ============================================================
// 🧭 主購物頁邏輯
// ============================================================

// DOM helper
window.$ = (id) => document.getElementById(id);
window.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// 全域設定（會在載入後覆蓋）
let CONFIG = {
  PRODUCTS: [],
  PRICES: {},
  FREE_SHIPPING_THRESHOLD: 1000,
  BASE_SHIPPING_FEE: 60,
  COD_SHIP_FEE: 100,
  COD_FREE_SHIPPING_THRESHOLD: 2000,
};

// ------------------------------
// 🧩 初始化流程
// ------------------------------
document.addEventListener("DOMContentLoaded", async () => {
  try {
    $("loading").style.display = "block";
    const cfg = await api.getConfig();
    CONFIG = { ...CONFIG, ...cfg };
    renderProducts(CONFIG.PRODUCTS);
    restoreCart();
    updateTotals();
  } catch (err) {
    console.error("載入設定失敗:", err);
    toast("⚠️ 無法載入商品，請稍後重試");
  } finally {
    $("loading").style.display = "none";
  }
});

// ------------------------------
// 🛍️ 商品渲染
// ------------------------------
function renderProducts(products) {
  const list = $("product-list");
  list.innerHTML = "";

  products.forEach((p) => {
    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
      <div class="product-title">${p.name}</div>
      <div class="product-price">NT$ ${p.price}</div>
      <div class="product-controls">
        <button class="minus" data-id="${p.id}">−</button>
        <span class="qty" id="qty-${p.id}">0</span>
        <button class="plus" data-id="${p.id}">＋</button>
      </div>
    `;
    list.appendChild(card);
  });

  // 綁定按鈕事件
  list.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const id = btn.dataset.id;
    const elQty = $(`qty-${id}`);
    let qty = parseInt(elQty.textContent) || 0;
    if (btn.classList.contains("plus")) qty++;
    if (btn.classList.contains("minus")) qty = Math.max(0, qty - 1);
    elQty.textContent = qty;
    saveCart();
    updateTotals();
  });
}

// ============================================================
// 💾 localStorage 快取
// ============================================================
function saveCart() {
  const cart = {};
  CONFIG.PRODUCTS.forEach((p) => {
    const qty = parseInt($(`qty-${p.id}`)?.textContent || 0);
    if (qty > 0) cart[p.id] = qty;
  });
  localStorage.setItem("teaOrderCart", JSON.stringify(cart));
}

function restoreCart() {
  try {
    const saved = JSON.parse(localStorage.getItem("teaOrderCart") || "{}");
    Object.entries(saved).forEach(([id, qty]) => {
      const elQty = $(`qty-${id}`);
      if (elQty) elQty.textContent = qty;
    });
  } catch (e) {
    console.warn("無法還原購物車:", e);
  }
}

// ============================================================
// 💰 金額試算 + sticky bar 更新
// ============================================================
async function updateTotals() {
  const items = CONFIG.PRODUCTS.map((p) => ({
    id: p.id,
    qty: parseInt($(`qty-${p.id}`)?.textContent || 0),
  })).filter((i) => i.qty > 0);

  if (items.length === 0) {
    $("sticky-total").textContent = "NT$ 0";
    return;
  }

  try {
    const preview = await api.previewTotals(items, "store", "");
    $("sticky-total").textContent = `NT$ ${preview.total.toLocaleString("zh-TW")}`;
  } catch (err) {
    console.error("試算錯誤:", err);
    toast("⚠️ 金額試算失敗");
  }
}

// ============================================================
// 🔔 Toast 提示
// ============================================================
function toast(msg) {
  const bar = document.createElement("div");
  bar.className = "toast";
  bar.textContent = msg;
  document.body.appendChild(bar);
  setTimeout(() => (bar.style.opacity = 1), 10);
  setTimeout(() => (bar.style.opacity = 0), 3000);
  setTimeout(() => bar.remove(), 3500);
}
// ============================================================
// 🧾 送單流程 submitOrder()
// ============================================================
$("submit-btn")?.addEventListener("click", async () => {
  try {
    const name = $("buyer-name")?.value.trim();
    const phone = $("buyer-phone")?.value.trim();
    const method = $("shipping-method")?.value || "store";
    const promoCode = $("promo-code")?.value.trim();
    const note = $("buyer-note")?.value.trim();

    // 驗證基本欄位
    if (!name || !phone) {
      toast("請填寫姓名與電話");
      return;
    }

    // 收集購物項目
    const items = CONFIG.PRODUCTS.map((p) => ({
      id: p.id,
      qty: parseInt($(`qty-${p.id}`)?.textContent || 0),
    })).filter((i) => i.qty > 0);

    if (!items.length) {
      toast("請選擇至少一項商品");
      return;
    }

    // 顯示載入中狀態
    const btn = $("submit-btn");
    btn.disabled = true;
    btn.textContent = "送出中...";

    // 傳送到後端
    const res = await api.submitOrder({
      buyerName: name,
      buyerPhone: phone,
      shippingMethod: method,
      promoCode,
      note,
      items,
    });

    if (res.ok) {
      toast("✅ 訂單已送出！");
      localStorage.removeItem("teaOrderCart");
      setTimeout(() => location.reload(), 1500);
    } else {
      toast("❌ 訂單送出失敗：" + (res.error || "未知錯誤"));
    }
  } catch (err) {
    console.error("送單錯誤:", err);
    toast("⚠️ 系統錯誤，請稍後再試");
  } finally {
    $("submit-btn").disabled = false;
    $("submit-btn").textContent = "送出訂單";
  }
});

// ============================================================
// 🎁 優惠碼檢查
// ============================================================
$("promo-code")?.addEventListener("blur", async (e) => {
  const code = e.target.value.trim();
  if (!code) return;
  try {
    const result = await api.previewTotals([], "store", code);
    if (result.valid) {
      toast("🎉 優惠碼已套用：" + code);
    } else {
      toast("❌ 無效的優惠碼");
    }
  } catch (err) {
    console.warn("優惠碼驗證錯誤:", err);
  }
});

// ============================================================
// 🎯 Google Analytics 追蹤（可選）
// ============================================================
function trackEvent(category, action, label) {
  if (typeof gtag === "function") {
    gtag("event", action, {
      event_category: category,
      event_label: label,
    });
  }
}

// ============================================================
// 🧱 Sticky bar 與 UI 更新
// ============================================================
window.addEventListener("scroll", () => {
  const sticky = $("sticky-bar");
  if (!sticky) return;
  if (window.scrollY > 200) {
    sticky.classList.add("visible");
  } else {
    sticky.classList.remove("visible");
  }
});

// ============================================================
// 🔄 全域事件監聽（偵測數量變化 → 即時試算）
// ============================================================
document.addEventListener("click", (e) => {
  if (e.target.matches(".plus, .minus")) {
    setTimeout(updateTotals, 100);
  }
});

// ============================================================
// 🧩 工具函式
// ============================================================
function money(n) {
  return "NT$ " + Number(n || 0).toLocaleString("zh-TW");
}

// ============================================================
// 🏁 初始化完成
// ============================================================
console.log("祥興茶行 app.js 已載入 ✅");
