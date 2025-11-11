// ===============================
// ☕ submitOrder.js
// 送出訂單主流程模組
// ===============================

import { api } from "./app.api.js";
import { $, toast } from "./dom.js";
import { getCartItems, clearCart } from "./cart.js";

// ✅ 主送出流程
export async function submitOrder() {
  const btn = $("submitOrderBtn");
  const loading = $("loading");

  if (!btn || btn.disabled) return;

  try {
    btn.disabled = true;
    btn.textContent = "處理中…";
    if (loading) loading.style.display = "block";

    // 1️⃣ 組裝訂單資料
    const order = {
      items: getCartItems(),
      payment: document.querySelector(".pay-btn.active")?.dataset.method || "cod",
      shipping: document.querySelector("input[name='ship']:checked")?.value || "",
      store: $("storeName")?.value || "",
      receiver: {
        name: $("name")?.value?.trim(),
        phone: $("phone")?.value?.trim(),
        address: $("address")?.value?.trim(),
      },
      total: Number($("total_s")?.textContent.replace(/[^\d]/g, "") || 0),
      note: $("note")?.value?.trim() || "",
    };

    // 2️⃣ 基本驗證
    if (!order.receiver.name || !order.receiver.phone) {
      toast("⚠️ 請輸入收件人姓名與電話");
      return;
    }
    if (order.items.length === 0) {
      toast("🛒 您的購物車是空的");
      return;
    }

    // 3️⃣ 傳送到後端
    const res = await api.submitOrder(order);
    console.log("🧾 submitOrder response:", res);

    if (res.ok || res.orderId) {
      showSuccessModal(res.orderId || "—", order.total, res.lineBindUrl);
      clearCart();
    } else {
      toast("❌ 訂單送出失敗：" + (res.error || "未知錯誤"));
    }
  } catch (err) {
    console.error("❌ 送出訂單錯誤:", err);
    toast("⚠️ 網路異常，請稍後再試");
  } finally {
    btn.disabled = false;
    btn.textContent = "送出訂單";
    if (loading) loading.style.display = "none";
  }
}

// ✅ 顯示成功卡片
function showSuccessModal(orderId, total, lineUrl) {
  const backdrop = $("successBackdrop");
  const idEl = $("successOrderId");
  const totalEl = $("successTotal");
  const lineBox = $("lineBindBox");
  const lineBtn = $("lineBindBtn");

  if (idEl) idEl.textContent = orderId || "-";
  if (totalEl) totalEl.textContent = total?.toLocaleString("zh-TW") || "0";

  if (lineUrl) {
    lineBox.hidden = false;
    lineBtn.href = lineUrl;
  } else {
    lineBox.hidden = true;
  }

  backdrop.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");
}

// ✅ 初始化送出訂單 & 關閉事件
export function initSubmitOrder() {
  // 綁定送出按鈕
  $("submitOrderBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    submitOrder();
  });

  // 綁定成功卡片關閉按鈕
  $("successClose")?.addEventListener("click", () => {
    const backdrop = $("successBackdrop");
    backdrop.classList.remove("show");
    backdrop.setAttribute("aria-hidden", "true");
  });
}
