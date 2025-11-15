// ================================
// sheetModal.js
// 購物明細 Bottom Sheet 控制
// ================================
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

// ========================================================
// 關閉購物明細 Sheet
// ========================================================
export function hideCartSheet() {
  const backdrop = $("cartSheetBackdrop");
  const sheet = $("cartSheet");
  sheet.dataset.open = "false";

  setTimeout(() => {
    backdrop.setAttribute("aria-hidden", "true");
    backdrop.style.display = "none";
    document.body.classList.remove("modal-open");
  }, 400);

  sheet.addEventListener(
    "transitionend",
    () => {
      backdrop.setAttribute("aria-hidden", "true");
      backdrop.style.display = "none";
      document.body.classList.remove("modal-open");
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
    },
    { once: true }
  );
}

// ========================================================
// 點擊背景關閉
// ========================================================
export function enableSmartSheetControl() {
  const sheet = $("cartSheet");
  const backdrop = $("cartSheetBackdrop");
  if (!sheet || !backdrop) return;

  // ✅ 點 backdrop 關閉
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) hideCartSheet();
  });

  // ✅ 手勢拖曳判定
  let startY = 0;
  let currentY = 0;
  let startTime = 0;
  let isDragging = false;
  let isScrollable = false;

  const CLOSE_THRESHOLD = 100;
  const VELOCITY_THRESHOLD = 0.6;

  sheet.addEventListener("touchstart", (e) => {
    startY = e.touches[0].clientY;
    currentY = startY;
    startTime = Date.now();
    isDragging = false;
    isScrollable = sheet.scrollTop > 0;
    sheet.style.transition = "none";
  });

  sheet.addEventListener(
    "touchmove",
    (e) => {
      const touchY = e.touches[0].clientY;
      const deltaY = touchY - startY;
      if (deltaY > 0 && !isScrollable) {
        e.preventDefault();
        isDragging = true;
        currentY = touchY;

        sheet.classList.add("dragging");
        sheet.style.transform = `translateY(${deltaY * 0.6}px)`;
        backdrop.style.opacity = `${Math.max(0, 1 - deltaY / 400)}`;
      }
    },
    { passive: false }
  );

  sheet.addEventListener("touchend", () => {
    if (!isDragging) return;

    sheet.classList.remove("dragging");
    const deltaY = currentY - startY;
    const elapsed = Date.now() - startTime;
    const velocity = deltaY / elapsed;

    const shouldClose = deltaY > CLOSE_THRESHOLD || velocity > VELOCITY_THRESHOLD;

    sheet.style.transition = "transform 0.35s cubic-bezier(0.25, 1, 0.5, 1)";
    backdrop.style.transition = "opacity 0.35s ease";

    if (shouldClose) {
      sheet.style.transform = "translateY(100%)";
      backdrop.style.opacity = "0";
      setTimeout(() => hideCartSheet(), 350);
    } else {
      sheet.style.transform = "translateY(0)";
      backdrop.style.opacity = "1";
    }
  });
}

// ========================================================
// 綁定 UI 按鈕事件（交由 main app.js 呼叫）
// ========================================================

$("closeCartModal")?.addEventListener("click", hideCartSheet);

export function initSheetModal() {
  const sheet = $("cartSheet");
  const backdrop = $("cartSheetBackdrop");

  if (!sheet || !backdrop) return;

  sheet.style.transform = "translateY(100%)"; // ✅ 正確初始位置
  sheet.style.transition = "transform 0.35s cubic-bezier(0.25, 1, 0.5, 1)";
  backdrop.style.display = "none";
}
