import { $, toast } from "./dom.js";
import { CONFIG } from "./config.js";
import { api } from "./app.api.js";
import { buildOrderItems } from "./cart.js";

// ========================================================
// 顯示購物明細 Sheet
// ========================================================
export async function showCartSheet() {
  const backdrop = $("cartSheetBackdrop");
  const sheet = $("cartSheet");
  const list = $("cartItems");
  const promoCode = ($("promoCode")?.value || "").trim();

  backdrop.style.opacity = "0";
  backdrop.style.display = "block";

  requestAnimationFrame(() => {
    backdrop.setAttribute("aria-hidden", "false");
    backdrop.style.opacity = "1";
    sheet.style.transform = "translateY(0)";
    sheet.dataset.open = "true";
  });

  list.innerHTML = "";

  // ⭐⭐ 用統一格式建構購物車（包含 name, price, packQty）
  const items = buildOrderItems();

  if (!items.length) {
    list.innerHTML = `<div class="muted" style="padding:12px;">尚未選購商品</div>`;
  } else {
    items.forEach(i => {
      const row = document.createElement("div");
      row.className = "line-item";

      const packStr = i.packQty > 0 ? `（裝罐 ${i.packQty}）` : "";

      row.innerHTML = `
        <div class="li-title">${i.name}</div>
        <div class="li-qty">× ${i.qty} ${packStr}</div>
        <div class="li-sub">NT$ ${(i.price * i.qty).toLocaleString("zh-TW")}</div>
      `;
      list.appendChild(row);
    });
  }

  try {
    const preview = await api.previewTotals(items, "store", promoCode);
    const data = preview.data || preview;

    $("cartSub").textContent = `NT$ ${(data.subtotal || 0).toLocaleString("zh-TW")}`;
    $("cartDiscRow").style.display = data.discount > 0 ? "flex" : "none";
    $("cartDisc").textContent =
      data.discount > 0 ? `- NT$ ${data.discount.toLocaleString("zh-TW")}` : "";
    $("cartShip").textContent = `NT$ ${(data.shippingFee || data.shipping || 0).toLocaleString("zh-TW")}`;
    $("cartTotal").textContent = `NT$ ${(data.total || data.totalAfterDiscount || 0).toLocaleString("zh-TW")}`;

    $("promoMsg").textContent =
      promoCode && data.discount > 0
        ? `🎉 已套用優惠碼：${promoCode}`
        : promoCode
        ? "❌ 無效的優惠碼"
        : "";

  } catch (err) {
    console.error("查看明細試算錯誤:", err);
    $("promoMsg").textContent = "⚠️ 無法取得折扣資料";
  }

  backdrop.addEventListener("touchmove", e => e.preventDefault(), { passive: false });
}
