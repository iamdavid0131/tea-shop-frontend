import { $, toast } from "./dom.js";
import { CONFIG } from "./config.js";
import { api } from "./app.api.js";

// ============================================================
// 💾 儲存購物車
// ============================================================
export function saveCart() {
  const cart = {};
  CONFIG.PRODUCTS.forEach((p) => {
    const qty = getQty(p.id);
    if (qty > 0) cart[p.id] = qty;
  });
  localStorage.setItem("teaOrderCart", JSON.stringify(cart));
}

// ============================================================
// 🔄 還原購物車
// ============================================================
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
// 💰 金額試算 + Sticky Bar 更新
// ============================================================
export async function updateTotals() {
    const items = buildOrderItems();

  const stickyBar = $("StickyBar");
  if (!stickyBar) return;

  // 🪫 購物車為空
  if (items.length === 0) {
    $("total_s").textContent = "NT$ 0";
    $("sub_s").textContent = "—";
    $("disc_s").textContent = "—";
    $("ship_s").textContent = "—";
    $("free_tip_s").textContent = "";
    $("freeProgress").style.display = "none";
    stickyBar.classList.add("hide");
    stickyBar.classList.remove("show");
    window.dispatchEvent(new Event("cart:update"));
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
    animateMoney();

    const discWrap = $("disc_wrap");
    if (discWrap) discWrap.style.display = disc > 0 ? "inline" : "none";

    // ✅ 免運提示強化區塊
    const freeThreshold = CONFIG.FREE_SHIPPING_THRESHOLD || 1000;
    const diff = freeThreshold - sub;
    const isFree = sub >= freeThreshold;

    const progressWrap = $("freeProgress");
    const progressBar = $("freeProgressBar");
    const freeTip = $("free_tip_s");
    const freeHint = $("freeHint"); // 🌿 新增免運浮出提示元素

    if (progressWrap) {
      progressWrap.classList.remove("hidden");
      progressWrap.style.display = "block";
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

    // 🌿 高質感免運浮出提示控制
    if (freeHint) {
      if (isFree) {
        freeHint.textContent = randomTeaQuote(); // 💬 隨機茶語
        freeHint.classList.add("show");
        freeHint.classList.remove("hide");
      } else {
        freeHint.classList.remove("show");
        freeHint.classList.add("hide");
      }
    }

  } catch (err) {
    console.error("試算錯誤:", err);
  }

  window.dispatchEvent(new Event("cart:update"));
}

// ============================================================
// ✨ 金額動畫
// ============================================================
export function animateMoney() {
  const el = $("total_s");
  if (!el) return;
  el.classList.remove("money-pop");
  void el.offsetWidth;
  el.classList.add("money-pop");
}

// ============================================================
// 🛒 取得購物車內容（供訂單送出用）
// ============================================================
export function getCartItems() {
  try {
    const items = CONFIG.PRODUCTS.map(p => {
      const qty = getQty(p.id);
      const packEl = $(`pack-${p.id}`);
      const pack = packEl?.classList?.contains("active") || packEl?.checked || false;

      return {
        id: p.id,
        name: p.name || "",
        qty,
        pack,
      };
    }).filter(i => i.qty > 0);

    return items;
  } catch (err) {
    console.error("⚠️ getCartItems 失敗:", err);
    return [];
  }
}

// ============================================================
// 🧹 清空購物車（送出訂單成功後）
// ============================================================
export function clearCart() {
  try {
    localStorage.removeItem("teaOrderCart");

    CONFIG.PRODUCTS.forEach(p => {
      const qtyEl = $(`qty-${p.id}`);
      if (qtyEl) qtyEl.textContent = "0";
    });

    updateTotals();
    console.log("🧹 購物車已清空");
  } catch (err) {
    console.error("⚠️ clearCart 錯誤:", err);
  }
}

// 🌿 動態茶語隨機顯示（免運提示）
function randomTeaQuote() {
  const quotes = [
    "🌿 已達免運門檻，香氣隨風入心。",
    "🍃 茶香已備，免運送到家。",
    "☕ 一壺好茶，一路好運！",
    "🫖 已達免運，再添一份茶香更圓滿～",
    "🌸 香氣滿溢，免運已成！",
  ];
  return quotes[Math.floor(Math.random() * quotes.length)];
}

function getQty(id) {
  const el = document.getElementById(`qty-${id}`);
  if (!el) return 0;

  let q = el.value !== undefined ? parseInt(el.value) : parseInt(el.textContent);
  return isNaN(q) ? 0 : q;
}

function buildOrderItems() {
  return CONFIG.PRODUCTS.map(p => {
    const qty = getQty(p.id);
    if (qty <= 0) return null;

    const pack = $(`pack-${p.id}`)?.checked || false;
    const packQty = Number($(`packQty-${p.id}`)?.value || 0);

    return {
      id: p.id,
      name: p.title,
      price: p.price,
      qty,
      pack,
      packQty
    };
  }).filter(Boolean);
}
