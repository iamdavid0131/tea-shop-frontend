// ===============================
// ☕ submitOrder.js
// 送出訂單主流程模組（逐品項版本）
// ===============================

import { api } from "./app.api.js";
import { $, toast } from "./dom.js";
import { getCartItems, clearCart } from "./cart.js";
import { CONFIG } from "./config.js";

// ✅ 格式化購物車品項（對應 Sheet 欄位名稱）
function formatCartItems(rawItems) {
  return rawItems.map((i) => {
    const product = CONFIG.PRODUCTS.find((p) => p.id === i.id);
    return {
      id: i.id,
      name: product?.name || product?.title || i.name || "",
      qty: Number(i.qty) || 0,
      pack: i.pack || false,
    };
  });
}

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

    // === 組裝訂單資料 ===
    const shippingMethod =
      document.querySelector("input[name='ship']:checked")?.value || "";
    const payMethod =
      document.querySelector(".pay-btn.active")?.dataset.method ||
      document.querySelector("input[name='payment']:checked")?.value ||
      "cod";

    const items = formatCartItems(getCartItems());

    const order = {
      timestamp: new Date().toLocaleString("zh-TW", { hour12: false }),
      orderId: "O" + Date.now(),
      buyerName: $("name")?.value?.trim() || "",
      buyerPhone: $("phone")?.value?.trim() || "",
      shippingMethod,
      storeCarrier:
        shippingMethod === "store" ? $("carrier")?.value || "" : "",
      storeName:
        shippingMethod === "store"
          ? $("storeName")?.value?.trim() || ""
          : "",
      codAddress:
        shippingMethod === "cod"
          ? $("address")?.value?.trim() || ""
          : "",
      promoCode: $("promoCode")?.value?.trim() || "",
      note: $("note")?.value?.trim() || "",
      consent: $("consentAgree")?.checked ? "Y" : "N",

      // 🟢 支付欄位
      paymentMethod: payMethod,
      paymentStatus: "pending",
      paymentTxId: "",
      paymentTime: "",

      // 🫖 商品與金額區
      items,
      pricingPolicy: {},
      subtotal: 0,
      discount: 0,
      shippingFee: 0,
      total: Number(
        $("total_s")?.textContent.replace(/[^\d]/g, "") || 0
      ),

      status: "created",
    };

    // === 基本驗證 ===
    const nameInput = $("name");
    const phoneInput = $("phone");
    const errName = $("err-name");
    const errPhone = $("err-phone");

    [nameInput, phoneInput].forEach((i) =>
      i?.classList.remove("form-error")
    );
    [errName, errPhone].forEach((e) => e?.classList.remove("show"));

    let invalidField = null;

    if (!order.buyerName) {
      nameInput?.classList.add("form-error");
      errName?.classList.add("show");
      invalidField = nameInput;
    } else if (!order.buyerPhone) {
      phoneInput?.classList.add("form-error");
      errPhone?.classList.add("show");
      invalidField = phoneInput;
    }

    if (invalidField) {
      toast("⚠️ 請完整填寫收件人資料");
      invalidField.scrollIntoView({ behavior: "smooth", block: "center" });
      resetUI();
      return;
    }

    if (order.items.length === 0) {
      toast("🛒 您的購物車是空的");
      resetUI();
      return;
    }

    // === 傳送到後端 ===
    console.log("🧾 order.items", order.items);
    const res = await api.submitOrder(order);
    console.log("🧾 submitOrder response:", JSON.stringify(res, null, 2));

    // ✅ 後端成功
    if (res.ok && res.orderId) {
      showSuccessModal(res.orderId, order.total);
      clearCart();

      // ✅ 同步更新會員紀錄
      try {
        await api.memberOrder({
          phone: order.buyerPhone,
          orderTotal: order.total,
          method: order.shippingMethod,
          carrier: order.storeCarrier,
          storeName: order.storeName,
          address: order.codAddress,
          orderId: res.orderId,
        });
      } catch (err) {
        console.warn("⚠️ 更新會員資料失敗:", err);
      }

      return;
    }

    console.warn("❌ 後端回傳錯誤:", res);
    toast("❌ 訂單送出失敗：" + (res?.error || "伺服器未回應"));
  } catch (err) {
    console.error("❌ 送出訂單錯誤:", err);
    toast("⚠️ 網路異常，請稍後再試");
  } finally {
    resetUI();
  }

  function resetUI() {
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
  if (totalEl) totalEl.textContent = `NT$${Number(total).toLocaleString()}`;

  if (lineUrl) {
    lineBox.hidden = false;
    lineBtn.href = lineUrl;
  } else {
    lineBox.hidden = true;
  }

  backdrop.classList.remove("hidden");
  requestAnimationFrame(() => backdrop.classList.add("show"));

  // ✅ 清空表單與購物車
  clearCart();
  ["name", "phone", "address", "note"].forEach(id => {
    const el = $(id);
    if (el) el.value = "";
  });

  const agree = $("consentAgree");
  if (agree) agree.removeAttribute("checked");
  document.querySelectorAll("input[name='ship'],input[name='payment']")
    .forEach(r => r.checked = false);
  $("submitOrderBtn")?.setAttribute("disabled", "true");
}

// ✅ 初始化送出訂單 & 關閉事件
export function initSubmitOrder() {
  const btn = $("submitOrderBtn");
  if (!btn) return;

  // ✅ 若 URL 帶 ?paid=1 → 顯示成功畫面
  const params = new URLSearchParams(location.search);
  if (params.get("paid") === "1") {
    const orderId = params.get("orderId");
    const total = params.get("total");
    showSuccessModal(orderId, total);
    const cleanUrl = location.origin + location.pathname;
    history.replaceState({}, document.title, cleanUrl);
  }

  const consent = $("consentAgree");
  const name = $("name");
  const phone = $("phone");
  const shipRadios = document.querySelectorAll("input[name='ship']");
  const payRadios = document.querySelectorAll("input[name='payment']");

  const validate = () => {
    const hasItem = (getCartItems()?.length || 0) > 0;
    const hasName = name?.value.trim().length > 0;
    const hasPhone = phone?.value.trim().length >= 8;
    const hasShip = [...shipRadios].some((r) => r.checked);
    const hasPay = [...payRadios].some((r) => r.checked);
    const agreed = consent?.checked;
    btn.disabled = !(
      hasItem &&
      hasName &&
      hasPhone &&
      hasShip &&
      hasPay &&
      agreed
    );
  };

  [name, phone, consent, ...shipRadios, ...payRadios].forEach((el) => {
    el?.addEventListener("input", validate);
    el?.addEventListener("change", validate);
  });

  window.addEventListener("cart:update", validate);

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    if (!btn.disabled) submitOrder();
  });

  validate();

  $("successClose")?.addEventListener("click", () => {
    const backdrop = $("successBackdrop");
    backdrop.classList.remove("show");
    backdrop.setAttribute("aria-hidden", "true");
    window.scrollTo({ top: 0, behavior: "smooth" });
    clearCart();
  });
}
