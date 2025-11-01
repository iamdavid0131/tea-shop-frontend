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
  const items = CONFIG.PRODUCTS.map((p) => ({
    id: p.id,
    qty: parseInt($(`qty-${p.id}`)?.textContent || 0),
  })).filter((i) => i.qty > 0);

  const stickyBar = document.getElementById("StickyBar");

  // 🪫 若購物車為空 → 重置顯示
  if (items.length === 0) {
    $("total_s").textContent = "NT$ 0";
    $("sub_s").textContent = "—";
    $("disc_s").textContent = "—";
    $("ship_s").textContent = "—";
    $("free_tip_s").style.display = "none";
    $("freeProgress").style.display = "none";
    stickyBar.classList.remove("show");
    stickyBar.classList.add("hide");
    return;
  } else {
    stickyBar.classList.add("show");
    stickyBar.classList.remove("hide");
  }

  try {
    const preview = await api.previewTotals(items, "store", "");
    console.log("🧾 previewTotals 回傳", preview);

    const data = preview?.data ?? preview ?? {};

    const sub = data.subtotal ?? 0;
    const disc = data.discount ?? 0;
    const ship = data.shipping ?? data.shippingFee ?? 0;
    const total =
      data.total ??
      (data.totalAfterDiscount !== undefined
        ? data.totalAfterDiscount + ship
        : sub - disc + ship);

    const fmt = (n) => `NT$ ${Number(n || 0).toLocaleString("zh-TW")}`;

    $("sub_s").textContent = fmt(sub);
    $("disc_s").textContent = fmt(disc);
    $("ship_s").textContent = fmt(ship);
    $("total_s").textContent = fmt(total);

    // ✅ 金額動畫
    animateMoney();

    // 🧾 免運門檻提示
    const freeThreshold = CONFIG.FREE_SHIPPING_THRESHOLD || 1000;
    const progressBar = $("freeProgressBar");
    const progressWrap = $("freeProgress");
    const freeTip = $("free_tip_s");

    const progress = Math.min(100, (sub / freeThreshold) * 100);
    progressBar.style.width = `${progress}%`;

    if (sub >= freeThreshold) {
      freeTip.textContent = "🎉 已達免運門檻！";
      freeTip.style.display = "inline-block";
      progressWrap.style.display = "none";
      progressBar.classList.add("flash-free"); // ✅ Flash 達標亮燈
    } else {
      const diff = freeThreshold - sub;
      freeTip.textContent = `再消費 NT$${diff.toLocaleString("zh-TW")} 即可免運`;
      freeTip.style.display = "inline-block";
      progressWrap.style.display = "block";
      progressBar.classList.remove("flash-free");
    }

    // ✅ 折扣淡入
    document.getElementById("disc_wrap")
      .classList.toggle("show-disc", disc > 0);

  } catch (err) {
    console.error("試算錯誤:", err);
    toast("⚠️ 金額試算失敗");
  }
}

export function animateMoney() {
  const el = $("total_s");
  el.classList.remove("money-pop");
  void el.offsetWidth;
  el.classList.add("money-pop");
}
