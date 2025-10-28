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
// 🛍️ 商品渲染（含分類、裝罐、標籤、詳情收合、庫存）
// ============================================================
function renderProducts(products) {
  const list = $("categoryList");
  list.innerHTML = "";

  // 依分類群組
  const categories = {};
  products.forEach(p => {
    if (!categories[p.category]) categories[p.category] = [];
    categories[p.category].push(p);
  });

  // 渲染分類
  Object.entries(categories).forEach(([cat, items], i) => {
    const group = document.createElement("div");
    group.className = "cat-group";
    group.dataset.cat = cat;

    // 分類 header（第一個預設展開）
    const isOpen = i === 0 ? "true" : "false";
    group.innerHTML = `
      <div class="cat-head">
        <button class="cat-toggle" aria-expanded="${isOpen}">
          <span class="title">${cat}</span>
          <span class="chev">⌃</span>
        </button>
      </div>
      <div class="cat-panel" style="max-height:${i === 0 ? "none" : "0"};">
      </div>
    `;
    const panel = group.querySelector(".cat-panel");

    // === 商品卡 ===
    items.forEach(p => {
      const tags = (p.tags || []).filter(t => t.trim()).map(t => `<span class="tag">${t}</span>`).join("");
      const story = p.story ? `<div class="detailblock" hidden><p class="story">${p.story}</p></div>` : "";
      const profile = p.profile
            ? `
            <div class="profile-blocks">
              ${renderProfile('甜度', p.profile.sweetness)}
              ${renderProfile('香氣', p.profile.aroma)}
              ${renderProfile('焙火', p.profile.roast)}
              ${renderProfile('厚度', p.profile.body)}
              ${renderProfile('餘韻', p.profile.finish)}
            </div>`
            : "";
      const card = document.createElement("div");
      card.className = "itemcard";
      card.innerHTML = `
        <div class="title">${p.title}</div>
        <div class="quickblock">
          <span class="tagline">${p.tagline || ""}</span>
          <div class="tags">${tags}</div>
        </div>
        <div class="variant">
          <div class="v-meta">
            單價 <b>NT$ ${p.price}</b> / ${p.unit || "—"}
            <small class="muted">（剩餘 ${p.stock ?? 0}）</small>
          </div>
          <div class="qty">
            <button class="step" data-id="${p.id}" data-dir="minus">−</button>
            <span id="qty-${p.id}">0</span>
            <button class="step" data-id="${p.id}" data-dir="plus">＋</button>
          </div>
        </div>

        ${
          p.packable
            ? `
              <div class="pack-row">
                <label class="pack-toggle">
                  <input type="checkbox" id="pack-${p.id}">
                  裝罐
                </label>
                <div class="pack-qty hidden" id="packQtyWrap-${p.id}">
                  <button class="step" data-pack="${p.id}" data-dir="minus">−</button>
                  <input type="number" id="packQty-${p.id}" min="0" value="0">
                  <button class="step" data-pack="${p.id}" data-dir="plus">＋</button>
                </div>
              </div>
              <p class="pack-hint">可選裝罐數量 ≤ 購買數量</p>
              <p class="pack-err" id="packErr-${p.id}">⚠️ 裝罐數量不可超過購買數量</p>
            `
            : ""
        }

        <button class="more-btn" aria-expanded="false">收合詳情</button>
        ${story}
        ${profile}

      `;
      panel.appendChild(card);
    });

    list.appendChild(group);
  });
  function renderProfile(label, level) {
    const blocks = Array.from({length: 5}, (_, i) => 
      `<div class="blk ${i < level ? 'on' : ''}"></div>`
    ).join("");
    return `<div class="bar"><b>${label}</b>${blocks}</div>`;
  }
  // === 綁定：分類收合 ===
  list.addEventListener("click", e => {
    const toggle = e.target.closest(".cat-toggle");
    if (!toggle) return;
    const expanded = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", !expanded);
    const panel = toggle.parentElement.nextElementSibling;
    panel.style.maxHeight = expanded ? "0" : "none";
  });

  // === 數量控制 ===
  list.addEventListener("click", e => {
    const btn = e.target.closest(".step");
    if (!btn) return;
    const id = btn.dataset.id;
    const dir = btn.dataset.dir;
    const elQty = $(`qty-${id}`);
    let qty = parseInt(elQty.textContent) || 0;
    qty = dir === "plus" ? qty + 1 : Math.max(0, qty - 1);
    elQty.textContent = qty;
    saveCart();
    updateTotals();
  });

  // === 裝罐控制 ===
  list.addEventListener("change", e => {
    if (e.target.id?.startsWith("pack-")) {
      const pid = e.target.id.replace("pack-", "");
      $(`packQtyWrap-${pid}`).classList.toggle("hidden", !e.target.checked);
    }
  });

  // === 裝罐數量檢查 ===
  list.addEventListener("click", e => {
    if (e.target.dataset.pack) {
      const pid = e.target.dataset.pack;
      const dir = e.target.dataset.dir;
      const input = $(`packQty-${pid}`);
      let val = parseInt(input.value) || 0;
      val = dir === "plus" ? val + 1 : Math.max(0, val - 1);
      input.value = val;

      // 驗證裝罐 ≤ 購買數量
      const buyQty = parseInt($(`qty-${pid}`).textContent || 0);
      const err = $(`packErr-${pid}`);
      if (val > buyQty) {
        err.style.display = "block";
        input.classList.add("is-invalid");
      } else {
        err.style.display = "none";
        input.classList.remove("is-invalid");
      }
    }
  });

  console.log("✅ 商品渲染完成，共分類：", Object.keys(categories).length);
}

// 展開／收合詳情
document.addEventListener("click", e => {
  const btn = e.target.closest(".more-btn");
  if (!btn) return;
  const expanded = btn.getAttribute("aria-expanded") === "true";
  btn.setAttribute("aria-expanded", !expanded);
  const detail = btn.nextElementSibling;
  detail.hidden = expanded;
  btn.textContent = expanded ? "收合詳情" : "隱藏詳情";
});



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
      freeTip.textContent = `再消費 NT$${diff.toLocaleString("zh-TW")} 即可免運`;
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
