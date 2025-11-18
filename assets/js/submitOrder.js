// ===============================
// ☕ submitOrder.js（模組版）
// ===============================

import { api } from "./app.api.js";
import { $, toast } from "./dom.js";
import { getCartItems, clearCart } from "./cart.js";
import { CONFIG } from "./config.js";

// -------------------------------
// 格式化品項
// -------------------------------
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

// -------------------------------
// 封裝 validate（export 給外部使用）
// -------------------------------
export function validateSubmit() {
  const btn = $("submitOrderBtn");
  if (!btn) return;

  const consent = $("consentAgree");
  const name = $("name");
  const phone = $("phone");
  const shipRadios = document.querySelectorAll("input[name='shipping']");
  const payRadios = document.querySelectorAll("input[name='payment']");

  const hasItem = (getCartItems()?.length || 0) > 0;
  const hasName = name?.value.trim().length > 0;
  const hasPhone = phone?.value.trim().length >= 8;
  const hasShip = [...shipRadios].some((r) => r.checked);
  const hasPay =
    [...payRadios].some((r) => r.checked) ||
    document.querySelector(".pay-btn.active") !== null;
  const agreed = consent?.checked;

  // 🔥 這裡印出全部條件，馬上知道哪個是 false
  console.log("=== validateSubmit Debug ===");
  console.log("🛒 商品數量 hasItem:", hasItem, getCartItems());
  console.log("👤 姓名 hasName:", hasName, name?.value);
  console.log("📱 電話 hasPhone:", hasPhone, phone?.value);
  console.log("🚚 運送方式 hasShip:", hasShip);
  console.log("💳 付款方式 hasPay:", hasPay);
  console.log("✔️ 同意條款 agreed:", agreed);
  console.log("🔍 disabled 結果 =", !(hasItem && hasName && hasPhone && hasShip && hasPay && agreed));

  btn.disabled = !(hasItem && hasName && hasPhone && hasShip && hasPay && agreed);
}


// -------------------------------
// 主送出流程（後端直接開綠界版本）
// -------------------------------
export async function submitOrder() {
  const btn = $("submitOrderBtn");
  const loadingOverlay = $("globalLoading");
  if (!btn || btn.disabled) return;

  try {
    btn.disabled = true;
    btn.textContent = "處理中…";
    loadingOverlay?.classList.add("show");
    loadingOverlay?.setAttribute("aria-hidden", "false");

    const shippingMethod =
      document.querySelector("input[name='shipping']:checked")?.value || "";

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
          ? `${$("city")?.value || ""}${$("district")?.value || ""}${$("address")?.value?.trim() || ""}`
              .replace(/\s+/g, "")
          : "",
      promoCode: $("promoCode")?.value?.trim() || "",
      note: $("note")?.value?.trim() || "",
      consent: $("consentAgree")?.checked ? "Y" : "N",

      // 支付欄位
      paymentMethod: payMethod,
      paymentStatus: "pending",

      // 金額
      items,
      subtotal: 0,
      discount: 0,
      shippingFee: 0,
      total: Number($("total_s")?.textContent.replace(/[^\d]/g, "") || 0),
      status: "created",
    };

    // === 基本驗證 ===
    if (!order.buyerName || !order.buyerPhone) {
      toast("⚠️ 請完整填寫收件人資料");
      validateSubmit();
      return;
    }

    if (order.items.length === 0) {
      toast("🛒 您的購物車是空的");
      validateSubmit();
      return;
    }

    // =====================================================
    // ⭐ 最重要修改：不再用 fetch！改用 form POST
    // =====================================================

    const form = document.createElement("form");
    form.method = "POST";
    form.action = "https://tea-order-server.onrender.com/api/order/submit"; 
    form.style.display = "none";

    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "orderJSON";
    input.value = JSON.stringify(order);

    form.appendChild(input);
    document.body.appendChild(form);

    // ⭐ 提交表單 → 後端 res.send(htmlForm) → 瀏覽器立即跳綠界
    form.submit();
    return;

  } catch (err) {
    console.error("❌ submitOrder error", err);
    toast("⚠️ 網路異常，請稍後再試");
  } finally {
    btn.disabled = false;
    btn.textContent = "送出訂單";
    loadingOverlay?.classList.remove("show");
  }
}

// -------------------------------
// 成功畫面
// -------------------------------
function showSuccessModal(orderId, total) {
  const backdrop = $("successBackdrop");
  $("successOrderId").textContent = orderId || "-";
  $("successTotal").textContent = `NT$${Number(total).toLocaleString()}`;

  backdrop.classList.remove("hidden");
  requestAnimationFrame(() => backdrop.classList.add("show"));

  clearCart();

  // 清空表單
  ["name", "phone", "address", "note"].forEach((id) => {
    const el = $(id);
    if (el) el.value = "";
  });

  $("consentAgree").checked = false;
  $("submitOrderBtn").setAttribute("disabled", "true");

  $("successClose").onclick = () => {
    backdrop.classList.remove("show");
    setTimeout(() => backdrop.classList.add("hidden"), 400);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
}

// -------------------------------
// 初始化
// -------------------------------
export function initSubmitOrder() {
  const btn = $("submitOrderBtn");
  if (!btn) return;

  const allInputs = [
    $("name"),
    $("phone"),
    $("consentAgree"),
    ...document.querySelectorAll("input[name='shipping']"),
    ...document.querySelectorAll("input[name='payment']")
  ];

  allInputs.forEach((el) => {
    el?.addEventListener("input", validateSubmit);
    el?.addEventListener("change", validateSubmit);
  });

  window.addEventListener("cart:update", validateSubmit);

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    if (!btn.disabled) submitOrder();
  });

  // 支付按鈕
  document.querySelectorAll(".pay-btn").forEach((b) => {
    b.addEventListener("click", () => {
      document.querySelectorAll(".pay-btn").forEach((x) =>
        x.classList.remove("active")
      );
      b.classList.add("active");
      validateSubmit();
    });
  });

  validateSubmit();
  checkEcpayReturn();
}

// ===============================
// ⛩ 付款後自動跳成功畫面
// ===============================
export function checkEcpayReturn() {
  const url = new URL(window.location.href);
  const paid = url.searchParams.get("paid");
  const orderId = url.searchParams.get("orderId");
  const total = url.searchParams.get("total");

  if (paid === "1" && orderId) {
    // 清除購物車
    clearCart?.();

    // 開啟成功視窗（你原本的函式）
    const backdrop = $("successBackdrop");
    $("successOrderId").textContent = orderId;
    $("successTotal").textContent = `NT$${Number(total).toLocaleString()}`;

    backdrop.classList.remove("hidden");
    requestAnimationFrame(() => backdrop.classList.add("show"));

    // 清掉網址參數，避免刷新又跳一次
    history.replaceState({}, "", window.location.pathname);
  }
}
