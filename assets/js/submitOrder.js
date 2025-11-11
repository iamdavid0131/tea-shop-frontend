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
  const loadingOverlay = $("globalLoading");
  if (!btn || btn.disabled) return;

  try {
    btn.disabled = true;
    btn.textContent = "處理中…";
    loadingOverlay?.classList.add("show");
    loadingOverlay?.setAttribute("aria-hidden", "false");

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
    let invalidField = null;
    const nameInput = $("name");
    const phoneInput = $("phone");
    const errName = $("err-name");
    const errPhone = $("err-phone");

    // 清除先前錯誤
    [nameInput, phoneInput].forEach(i => i?.classList.remove("form-error"));
    [errName, errPhone].forEach(e => e?.classList.remove("show"));

    if (!order.receiver.name) {
      nameInput?.classList.add("form-error");
      errName?.classList.add("show");
      invalidField = nameInput;
    } else if (!order.receiver.phone) {
      phoneInput?.classList.add("form-error");
      errPhone?.classList.add("show");
      invalidField = phoneInput;
    }

    if (invalidField) {
      toast("⚠️ 請完整填寫收件人資料");
      invalidField.scrollIntoView({ behavior: "smooth", block: "center" });
      loadingOverlay?.classList.remove("show");
      loadingOverlay?.setAttribute("aria-hidden", "true");
      return;
    }

    if (order.items.length === 0) {
      toast("🛒 您的購物車是空的");
      loadingOverlay?.classList.remove("show");
      loadingOverlay?.setAttribute("aria-hidden", "true");
      return;
    }

    // 3️⃣ 傳送到後端
    const res = await api.submitOrder(order);
    console.log("🧾 submitOrder response:", res);

    if (res.ok || res.orderId) {
      showSuccessModal(res.orderId || "—", order.total, res.lineBindUrl);
      clearCart();
    } else {
      console.warn("❌ 後端回傳錯誤:", res);
      toast("❌ 訂單送出失敗：" + (res?.error || "伺服器未回應"));
    }
  } catch (err) {
    console.error("❌ 送出訂單錯誤:", err);
    toast("⚠️ 網路異常，請稍後再試");
  } finally {
    btn.disabled = false;
    btn.textContent = "送出訂單";
    loadingOverlay?.classList.remove("show");
    loadingOverlay?.setAttribute("aria-hidden", "true");
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

  // ✅ 重設表單
  ["name", "phone", "address", "note"].forEach(id => {
    const el = $(id);
    if (el) el.value = "";
  });
  $("consentAgree")?.removeAttribute("checked");
  document.querySelectorAll("input[name='ship']").forEach(r => r.checked = false);
  document.querySelectorAll("input[name='payment']").forEach(r => r.checked = false);
  $("submitOrderBtn")?.setAttribute("disabled", "true");
}

// ✅ 初始化送出訂單 & 關閉事件
export function initSubmitOrder() {
  const btn = $("submitOrderBtn");
  if (!btn) return;

  const consent = $("consentAgree");
  const name = $("name");
  const phone = $("phone");
  const shipRadios = document.querySelectorAll("input[name='ship']");
  const payRadios = document.querySelectorAll("input[name='payment']");

  // ✅ 動態驗證
  const validate = () => {
    const hasItem = (getCartItems()?.length || 0) > 0;
    const hasName = name?.value.trim().length > 0;
    const hasPhone = phone?.value.trim().length >= 8;
    const hasShip = [...shipRadios].some(r => r.checked);
    const hasPay = [...payRadios].some(r => r.checked);
    const agreed = consent?.checked;

    btn.disabled = !(hasItem && hasName && hasPhone && hasShip && hasPay && agreed);
  };

  // ✅ 綁定變更監聽
  [name, phone, consent, ...shipRadios, ...payRadios].forEach(el => {
    el?.addEventListener("input", validate);
    el?.addEventListener("change", validate);
  });

  // ✅ 每次購物車更新時也重新檢查
  window.addEventListener("cart:update", validate);

  // ✅ 綁定送出
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    if (!btn.disabled) submitOrder();
  });

  // 初始狀態
  validate();

  // ✅ 關閉成功卡片
  $("successClose")?.addEventListener("click", () => {
    const backdrop = $("successBackdrop");
    backdrop.classList.remove("show");
    backdrop.setAttribute("aria-hidden", "true");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}
