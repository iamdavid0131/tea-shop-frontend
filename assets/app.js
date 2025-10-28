/**
 * ☕ 祥興茶行購物頁 app.js
 * ======================================================
 * 前端主程式（Cloudflare Pages + Render 後端相容）
 * ======================================================
 */

import { api } from "./app.api.js";
window.api = api;

// ------------------------------
// 🧩 DOM helper
// ------------------------------
window.$ = (id) => document.getElementById(id);
window.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// ------------------------------
// 💾 全域設定（後端載入後覆蓋）
// ------------------------------
let CONFIG = {
  PRODUCTS: [],
  PRICES: {},
  FREE_SHIPPING_THRESHOLD: 1000,
  BASE_SHIPPING_FEE: 60,
  COD_SHIP_FEE: 100,
  COD_FREE_SHIPPING_THRESHOLD: 2000,
};

// ------------------------------
// 🚀 初始化流程
// ------------------------------
document.addEventListener("DOMContentLoaded", async () => {
  try {
    $("loading").style.display = "block";
    const cfg = await api.getConfig();
    CONFIG = { ...CONFIG, PRODUCTS: cfg.data || [] };
    renderProducts(CONFIG.PRODUCTS);
    restoreCart();
    updateTotals();
  } catch (err) {
    console.error("載入設定失敗:", err);
    toast("⚠️ 無法載入商品設定，請稍後重試");
  } finally {
    $("loading").style.display = "none";
  }
});

// ============================================================
// 🛍️ 商品渲染（分類 + 商品 + 庫存 + 詳情收合）
// ============================================================
function renderProducts(products) {
  const list = $("categoryList");
  list.innerHTML = "";

  if (!products?.length) {
    list.innerHTML = "<p>目前沒有可販售商品。</p>";
    return;
  }

  // 依 category 分組
  const groups = {};
  for (const p of products) {
    const cat = p.category || "未分類";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(p);
  }

  let first = true; // ✅ 只展開第一個分類
  Object.entries(groups).forEach(([cat, items]) => {
    const groupEl = document.createElement("div");
    groupEl.className = "cat-group";
    groupEl.dataset.cat = cat;

    const catHead = document.createElement("div");
    catHead.className = "cat-head";
    catHead.innerHTML = `
      <button class="cat-toggle" aria-expanded="${first ? "true" : "false"}">
        <span class="title">${cat}</span>
        <span class="chev">⌄</span>
      </button>
    `;

    const catPanel = document.createElement("div");
    catPanel.className = "cat-panel";
    catPanel.style.maxHeight = first ? "none" : "0"; // ✅ 只第一分類展開

    // 商品卡
    items.forEach((p) => {
      const card = document.createElement("div");
      card.className = "itemcard";

      const tagHTML = (p.tags || [])
        .filter(Boolean)
        .map((t) => `<span class="tag">${t}</span>`)
        .join("");

      const stockInfo = p.stock ? `<span class="stock">（剩餘 ${p.stock}）</span>` : "";

      const storyHTML = p.story
        ? `
        <div class="detailblock more" hidden>
          <div class="story">${p.story}</div>
          <div class="brew">
            <div><b>熱泡：</b>${p.brew?.hot?.grams}g／${p.brew?.hot?.water_ml}ml／${p.brew?.hot?.temp_c}／${p.brew?.hot?.time_s}s × ${p.brew?.hot?.infusions}</div>
            <div><b>冷泡：</b>${p.brew?.cold?.grams}g／${p.brew?.cold?.water_ml}ml／${p.brew?.cold?.hours}小時</div>
          </div>
          <div class="profile-blocks">
            <div class="bar"><b>甜度</b>${renderBar(p.profile?.sweetness)}</div>
            <div class="bar"><b>香氣</b>${renderBar(p.profile?.aroma)}</div>
            <div class="bar"><b>焙火</b>${renderBar(p.profile?.roast)}</div>
            <div class="bar"><b>厚度</b>${renderBar(p.profile?.body)}</div>
            <div class="bar"><b>餘韻</b>${renderBar(p.profile?.finish)}</div>
          </div>
        </div>
        <button class="more-btn" type="button" aria-expanded="false">收合詳情</button>
      `
        : "";

      card.innerHTML = `
        <div class="title">${p.title}</div>
        ${
          p.tagline
            ? `<div class="quickblock"><span class="tagline">${p.tagline}</span></div>`
            : ""
        }
        ${tagHTML ? `<div class="quickblock tags">${tagHTML}</div>` : ""}
        <div class="variant">
          <div class="v-label">散茶</div>
          <div class="v-meta">NT$ ${p.price.toLocaleString("zh-TW")}／${p.unit || "包"} ${stockInfo}</div>
          <div class="qty">
            <button class="step minus" data-id="${p.id}">−</button>
            <input type="number" id="qty-${p.id}" value="0" min="0" />
            <button class="step plus" data-id="${p.id}">＋</button>
          </div>
        </div>
        ${
          p.packable
            ? `
          <div class="pack-row">
            <label class="pack-toggle">
              <input type="checkbox" id="pack-${p.id}" />
              裝罐
            </label>
          </div>
        `
            : ""
        }
        ${storyHTML}
      `;

      catPanel.appendChild(card);
    });

    groupEl.appendChild(catHead);
    groupEl.appendChild(catPanel);
    list.appendChild(groupEl);

    // 綁定分類展開/收合
    const toggle = catHead.querySelector(".cat-toggle");
    toggle.addEventListener("click", () => {
      const expanded = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", !expanded);
      groupEl.classList.toggle("is-open", !expanded);
      catPanel.style.maxHeight = expanded ? "0" : catPanel.scrollHeight + "px";
    });

    first = false; // 只有第一組打開
  });

  // 數量加減
  list.addEventListener("click", (e) => {
    const btn = e.target.closest(".step");
    if (!btn) return;
    const id = btn.dataset.id;
    const input = $(`qty-${id}`);
    let qty = parseInt(input.value) || 0;
    if (btn.classList.contains("plus")) qty++;
    if (btn.classList.contains("minus")) qty = Math.max(0, qty - 1);
    input.value = qty;
    saveCart();
    updateTotals();
  });

  // 詳情展開/收合
  list.addEventListener("click", (e) => {
    const btn = e.target.closest(".more-btn");
    if (!btn) return;
    const card = btn.closest(".itemcard");
    const detail = card.querySelector(".more");
    const expanded = btn.getAttribute("aria-expanded") === "true";
    btn.setAttribute("aria-expanded", !expanded);
    btn.textContent = expanded ? "收合詳情" : "收起詳情";
    detail.hidden = expanded;
  });
}

// 風味條顯示（五格填充）
function renderBar(level = 0) {
  return Array.from({ length: 5 }, (_, i) =>
    `<span class="blk ${i < level ? "on" : ""}"></span>`
  ).join("");
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
// 💰 金額試算 + sticky bar 更新（含免運提示與進度條）
// ============================================================
async function updateTotals() {
  const items = CONFIG.PRODUCTS.map((p) => ({
    id: p.id,
    qty: parseInt($(`qty-${p.id}`)?.textContent || 0),
  })).filter((i) => i.qty > 0);

  // 🪫 若購物車為空 → 重置顯示
  if (items.length === 0) {
    $("total_s").textContent = "NT$ 0";
    $("sub_s").textContent = "—";
    $("disc_s").textContent = "—";
    $("ship_s").textContent = "—";
    $("free_tip_s").style.display = "none";
    $("freeProgress").style.display = "none";
    return;
  }

  try {
    const preview = await api.previewTotals(items, "store", "");
    console.log("🧾 previewTotals 回傳", preview);

    // ✅ 萬用防呆解析（自動抓 data 層 or 直屬層）
    const data = preview.data ?? preview;

    // ✅ 同時支援 shipping / shippingFee / totalAfterDiscount
    const sub = data.subtotal ?? 0;
    const disc = data.discount ?? 0;
    const ship = data.shipping ?? data.shippingFee ?? 0;
    const total =
      data.total ??
      (data.totalAfterDiscount !== undefined
        ? data.totalAfterDiscount + ship
        : sub - disc + ship);

    // ✅ 安全數值轉換（防止 null）
    const fmt = (n) => `NT$ ${Number(n || 0).toLocaleString("zh-TW")}`;
    $("sub_s").textContent = fmt(sub);
    $("disc_s").textContent = fmt(disc);
    $("ship_s").textContent = fmt(ship);
    $("total_s").textContent = fmt(total);

    // 🧾 免運門檻提示
    const freeThreshold = CONFIG.FREE_SHIPPING_THRESHOLD || 1000;
    const progressBar = $("freeProgressBar");
    const progressWrap = $("freeProgress");
    const freeTip = $("free_tip_s");

    if (sub >= freeThreshold) {
      freeTip.textContent = "🎉 已達免運門檻！";
      freeTip.style.display = "inline-block";
      progressWrap.style.display = "none";
    } else {
      const diff = freeThreshold - sub;
      freeTip.textContent = `再消 NT$${diff.toLocaleString("zh-TW")} 即可免運`;
      freeTip.style.display = "inline-block";
      progressWrap.style.display = "block";
      progressBar.style.width = `${Math.min(100, (sub / freeThreshold) * 100)}%`;
    }
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
// 🧾 送單流程
// ============================================================
$("submitBtnSticky")?.addEventListener("click", async () => {
  try {
    const name = $("name")?.value.trim();
    const phone = $("phone")?.value.trim();
    const method = document.querySelector('input[name="ship"]:checked')?.value || "store";
    const promoCode = $("promoCode")?.value.trim();
    const note = $("note")?.value.trim();

    if (!name || !phone) {
      toast("請填寫姓名與電話");
      return;
    }

    const items = CONFIG.PRODUCTS.map((p) => ({
      id: p.id,
      qty: parseInt($(`qty-${p.id}`)?.textContent || 0),
    })).filter((i) => i.qty > 0);

    if (!items.length) {
      toast("請選擇至少一項商品");
      return;
    }

    const btn = $("submitBtnSticky");
    btn.disabled = true;
    btn.textContent = "送出中...";

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
    $("submitBtnSticky").disabled = false;
    $("submitBtnSticky").textContent = "送出訂單";
  }
});

/* ============================================================
   🧾 查看明細（整合後端折扣計算版）
   ============================================================ */
$("viewCartBtn")?.addEventListener("click", showCartSheet);
$("cartCloseBtn")?.addEventListener("click", hideCartSheet);

document.getElementById("cartSheetBackdrop")?.addEventListener("click", (e) => {
  if (e.target.id === "cartSheetBackdrop") hideCartSheet();
});

async function showCartSheet() {
  const backdrop = $("cartSheetBackdrop");
  const sheet = $("cartSheet");
  const list = $("cartItems");
  const promoCode = ($("promoCode")?.value || "").trim();

  // 收集購物車內容
  const items = (CONFIG.PRODUCTS || [])
    .map((p) => {
      const qty = Number($(`qty-${p.id}`)?.textContent || 0);
      return { id: p.id, name: p.title || p.name, price: p.price, qty };
    })
    .filter((i) => i.qty > 0);

  // 清空舊內容
  list.innerHTML = "";

  if (!items.length) {
    list.innerHTML = `<div class="muted" style="padding:12px;">尚未選購商品</div>`;
  } else {
    items.forEach((it) => {
      const row = document.createElement("div");
      row.className = "line-item";
      row.innerHTML = `
        <div class="li-title">${it.name}</div>
        <div class="li-qty">× ${it.qty}</div>
        <div class="li-sub">NT$ ${(it.price * it.qty).toLocaleString("zh-TW")}</div>
      `;
      list.appendChild(row);
    });
  }

  // ✅ 呼叫後端進行金額試算（含折扣與運費）
  try {
    const preview = await api.previewTotals(items, "store", promoCode);
    console.log("🧾 後端 previewTotals:", preview);

    const data = preview.data || preview;

    $("cartSub").textContent = `NT$ ${(data.subtotal || 0).toLocaleString("zh-TW")}`;
    $("cartDiscRow").style.display = data.discount > 0 ? "flex" : "none";
    $("cartDisc").textContent = data.discount > 0
      ? `- NT$ ${data.discount.toLocaleString("zh-TW")}`
      : "";
    $("cartShip").textContent = `NT$ ${(data.shipping || data.shippingFee || 0).toLocaleString("zh-TW")}`;
    $("cartTotal").textContent = `NT$ ${(data.total || 0).toLocaleString("zh-TW")}`;

    $("promoMsg").textContent =
      promoCode && data.discount > 0
        ? `🎉 已套用優惠碼：${promoCode}`
        : promoCode
        ? "❌ 無效的優惠碼"
        : "";

  } catch (err) {
    console.error("查看明細計算錯誤:", err);
    $("promoMsg").textContent = "⚠️ 無法取得折扣資料";
  }

  // 顯示 sheet（動畫）
  backdrop.style.display = "block";
  requestAnimationFrame(() => {
    backdrop.setAttribute("aria-hidden", "false");
    sheet.dataset.open = "true";
  });
}

function hideCartSheet() {
  const backdrop = $("cartSheetBackdrop");
  const sheet = $("cartSheet");
  sheet.dataset.open = "false";
  sheet.addEventListener(
    "transitionend",
    () => {
      backdrop.setAttribute("aria-hidden", "true");
      backdrop.style.display = "none";
    },
    { once: true }
  );
}


// ============================================================
// 🎁 優惠碼檢查
// ============================================================
$("applyPromoBtn")?.addEventListener("click", async () => {
  const code = $("promoCode")?.value.trim();
  if (!code) return;
  try {
    const result = await api.previewTotals([], "store", code);
    if (result.valid) {
      $("promoMsg").textContent = `🎉 已套用優惠碼：${code}`;
      toast("🎉 優惠碼已套用");
    } else {
      $("promoMsg").textContent = "❌ 無效的優惠碼";
      toast("❌ 無效的優惠碼");
    }
  } catch (err) {
    console.warn("優惠碼驗證錯誤:", err);
  }
});

// ============================================================
// 🧩 數量變化即時更新
// ============================================================
document.addEventListener("click", (e) => {
  if (e.target.matches(".plus, .minus")) {
    setTimeout(updateTotals, 100);
  }
});

console.log("祥興茶行 app.js 已載入 ✅");
