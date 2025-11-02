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
}

export function animateMoney() {
  const el = $("total_s");
  if (!el) return;
  el.classList.remove("money-pop");
  void el.offsetWidth; // ✅ reflow 重新觸發動畫
  el.classList.add("money-pop");
}
