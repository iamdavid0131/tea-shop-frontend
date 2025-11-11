import { $, toast } from "./dom.js";
import { CONFIG } from "./config.js";
import { api } from "./app.api.js";

export function saveCart() {
  const cart = {};
  CONFIG.PRODUCTS.forEach((p) => {
    const qty = parseInt($(`qty-${p.id}`)?.textContent || 0);
    if (qty > 0) cart[p.id] = qty;
  });
  localStorage.setItem("teaOrderCart", JSON.stringify(cart));
}

export function restoreCart() {
  try {
    const saved = JSON.parse(localStorage.getItem("teaOrderCart") || "{}");
    Object.entries(saved).forEach(([id, qty]) => {
      const elQty = $(`qty-${id}`);
      if (elQty) elQty.textContent = qty;
    });
  } catch (e) {
    console.warn("⚠️ 無法還原購物車:", e);
  }
}

// ============================================================
// 💰 金額試算 + sticky bar 更新（含免運提示與進度條）
// ============================================================
export async function updateTotals() {
  const items = CONFIG.PRODUCTS.map(p => ({
    id: p.id,
    qty: parseInt($(`qty-${p.id}`)?.textContent || 0),
  })).filter(i => i.qty > 0);

  const stickyBar = $("StickyBar");
  if (!stickyBar) return;

  if (items.length === 0) {
    $("total_s").textContent = "NT$ 0";
    $("sub_s").textContent = "—";
    $("disc_s").textContent = "—";
    $("ship_s").textContent = "—";
    $("free_tip_s").textContent = "";
    $("freeProgress").style.display = "none";
    stickyBar.classList.add("hide");
    stickyBar.classList.remove("show");
    return;
  }

  stickyBar.classList.add("show");
  stickyBar.classList.remove("hide");

  try {
    const preview = await api.previewTotals(items, "store", "");
    const data = preview?.data ?? preview ?? {};

    const sub = data.subtotal || 0;
    const disc = data.discount || 0;
    const ship = data.shipping ?? data.shippingFee ?? 0;
    const total = sub - disc + ship;

    const fmt = n => `NT$ ${Number(n || 0).toLocaleString("zh-TW")}`;

    $("sub_s").textContent = fmt(sub);
    $("disc_s").textContent = fmt(disc);
    $("ship_s").textContent = fmt(ship);
    $("total_s").textContent = fmt(total);

    // ✅ 金額彈跳動畫
    animateMoney();

    // ✅ 折扣列淡入
    const discWrap = $("disc_wrap");
    if (discWrap) discWrap.style.display = disc > 0 ? "inline" : "none";

    // ✅ 免運門檻進度條
    const freeThreshold = CONFIG.FREE_SHIPPING_THRESHOLD || 1000;
    const diff = freeThreshold - sub;
    const isFree = sub >= freeThreshold;

    const progressWrap = $("freeProgress");
    const progressBar = $("freeProgressBar");
    const freeTip = $("free_tip_s");

    if (progressWrap) {
      progressWrap.classList.remove("hidden");
      progressWrap.style.display = isFree ? "none" : "block";
    }

    if (progressBar) {
      const progress = Math.min(100, (sub / freeThreshold) * 100);
      progressBar.style.width = `${progress}%`;

      progressBar.classList.toggle("flash-free", isFree);
    }

    if (freeTip) {
      freeTip.textContent = isFree
        ? "🎉 已達免運門檻！"
        : `再消費 NT$${diff.toLocaleString("zh-TW")} 即可免運`;
    }

  } catch (err) {
    console.error("試算錯誤:", err);
  }
  window.dispatchEvent(new Event("cart:update"));
}

export function animateMoney() {
  const el = $("total_s");
  if (!el) return;
  el.classList.remove("money-pop");
  void el.offsetWidth; // ✅ reflow 重新觸發動畫
  el.classList.add("money-pop");
}

// ============================================================
// 🛒 取得目前購物車內容（供訂單送出用）
// ============================================================
export function getCartItems() {
  try {
    const items = CONFIG.PRODUCTS.map(p => {
      const qty = parseInt($(`qty-${p.id}`)?.textContent || 0);
      const packEl = $(`pack-${p.id}`); // ✅ 假設裝罐按鈕或 checkbox id 為 pack-xxx
      const pack = packEl?.classList?.contains("active") || packEl?.checked || false;

      return {
        id: p.id,
        name: p.name || "",
        qty,
        pack,
      };
    }).filter(i => i.qty > 0);

    // ✅ 對外觸發更新事件（供驗證用）
    window.dispatchEvent(new Event("cart:update"));

    return items;
  } catch (err) {
    console.error("⚠️ getCartItems 失敗:", err);
    return [];
  }
}

// ============================================================
// 🧹 清空購物車（用於訂單送出成功後）
// ============================================================
export function clearCart() {
  try {
    // 1️⃣ 清空 localStorage
    localStorage.removeItem("teaOrderCart");

    // 2️⃣ 重設畫面上的數量顯示
    CONFIG.PRODUCTS.forEach(p => {
      const qtyEl = $(`qty-${p.id}`);
      if (qtyEl) qtyEl.textContent = "0";
    });

    // 3️⃣ 更新金額
    updateTotals();

    console.log("🧹 購物車已清空");
  } catch (err) {
    console.error("⚠️ clearCart 錯誤:", err);
  }
}