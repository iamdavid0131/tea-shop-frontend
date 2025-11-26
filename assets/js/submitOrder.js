// ===============================
// ☕ submitOrder.js（旗艦優化版 - 支援禮盒）
// ===============================
import { api } from "./app.api.js";
import { $, toast } from "./dom.js";
import { buildOrderItems, clearCart } from "./cart.js"; // 🟢 關鍵：改用 buildOrderItems
import { CONFIG } from "./config.js";

// 🤫 隱藏版商品備份
const SECRET_PRODUCT_DEF = {
  id: "secret_888",
  title: "👑 傳奇・80年代老凍頂",
  price: 8800,
  tags: "老饕限定",
  desc: "阿興師爺爺留下來的壓箱寶。"
};



// -------------------------------
// 封裝 validate (維持原樣，但 getCartItems 必須已經包含禮盒)
// -------------------------------
// 封裝 validate
export function validateSubmit() {
  const btn = $("submitOrderBtn");
  if (!btn) return false;

  const consent = $("consentAgree");
  const name = $("name");
  const phone = $("phone");
  const shipRadios = document.querySelectorAll("input[name='shipping']");
  const payRadios = document.querySelectorAll("input[name='payment']");

  // 🟢 檢查：使用 buildOrderItems 來判斷購物車是否有東西 (含禮盒)
  const cartItems = buildOrderItems();
  const hasItem = (cartItems && cartItems.length > 0);
  
  const hasName = name?.value.trim().length > 0;
  const hasPhone = phone?.value.trim().length >= 8;
  const hasShip = [...shipRadios].some((r) => r.checked);
  const hasPay = [...payRadios].some((r) => r.checked) || document.querySelector(".pay-btn.active") !== null;
  const agreed = consent?.checked;

  const isValid = hasItem && hasName && hasPhone && hasShip && hasPay && agreed;

  btn.disabled = !isValid;
  return isValid;
}

// -------------------------------
// 主送出流程 (Form Post)
// -------------------------------
export async function submitOrder() {
  if (!validateSubmit()) {
    toast("⚠️ 請檢查資料是否填寫完整");
    return;
  }

  const btn = $("submitOrderBtn");
  const loadingOverlay = $("globalLoading");

  try {
    btn.disabled = true;
    btn.textContent = "處理中…";
    loadingOverlay?.classList.add("show");
    loadingOverlay?.setAttribute("aria-hidden", "false");

    const shippingMethod = document.querySelector("input[name='shipping']:checked")?.value || "";
    const payBtn = document.querySelector(".pay-btn.active");
    const payMethod = payBtn ? payBtn.dataset.method : (document.querySelector("input[name='payment']:checked")?.value || "cod");

    // 🟢 關鍵修正：直接取得處理好的商品陣列 (包含禮盒)
    const items = buildOrderItems();

    const order = {
      timestamp: new Date().toLocaleString("zh-TW", { hour12: false }),
      orderId: "O" + Date.now(),
      buyerName: $("name")?.value?.trim() || "",
      buyerPhone: $("phone")?.value?.trim() || "",
      shippingMethod,
      storeCarrier: shippingMethod === "store" ? $("carrier")?.value || "" : "",
      storeName: shippingMethod === "store" ? $("storeName")?.value?.trim() || "" : "",
      codAddress: shippingMethod === "cod" 
        ? `${$("city")?.value || ""}${$("district")?.value || ""}${$("address")?.value?.trim() || ""}`.replace(/\s+/g, "")
        : "",
      promoCode: $("promoCode")?.value?.trim() || "",
      note: $("note")?.value?.trim() || "",
      consent: $("consentAgree")?.checked ? "Y" : "N",
      paymentMethod: payMethod,
      paymentStatus: "pending",
      items, // 這裡現在一定會有禮盒資料了
      subtotal: 0, 
      discount: 0, 
      shippingFee: 0,
      total: Number($("total_s")?.textContent.replace(/[^\d]/g, "") || 0),
      status: "created",
    };

    if (!order.buyerName || !order.buyerPhone) {
      toast("⚠️ 請完整填寫收件人資料");
      loadingOverlay?.classList.remove("show");
      btn.disabled = false;
      return;
    }
    if (order.items.length === 0) {
      toast("🛒 您的購物車是空的");
      loadingOverlay?.classList.remove("show");
      btn.disabled = false;
      return;
    }

    const form = document.createElement("form");
    form.method = "POST";
    form.action = "https://tea-order-server.onrender.com/api/order/submit"; // 確認網址
    form.style.display = "none";

    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "orderJSON";
    input.value = JSON.stringify(order);

    form.appendChild(input);
    document.body.appendChild(form);
    form.submit(); 

  } catch (err) {
    console.error("❌ submitOrder error", err);
    toast("⚠️ 系統繁忙，請稍後再試");
    btn.disabled = false;
    btn.textContent = "送出訂單";
    loadingOverlay?.classList.remove("show");
  }
}

// -------------------------------
// 初始化 (UX 優化版)
// -------------------------------
export function initSubmitOrder() {
  const btn = $("submitOrderBtn");
  if (!btn) return;

  // 定義欄位與檢查規則
  const inputs = [
    { el: $("name"), check: val => val.trim().length > 0, err: "err-name" },
    { el: $("phone"), check: val => val.trim().length >= 8, err: "err-phone" }
  ];

  // 🔥 核心 UX 優化：輸入時不報錯，離開時才報錯
  inputs.forEach(({ el, check, err }) => {
    if (!el) return;

    // 1. 離開欄位 (Blur)：檢查並顯示紅框/紅字
    el.addEventListener("blur", () => {
      const isValid = check(el.value);
      toggleError(el, err, !isValid);
      validateSubmit(); // 更新按鈕狀態
    });

    // 2. 輸入中 (Input)：只消除錯誤，不顯示錯誤
    el.addEventListener("input", () => {
      toggleError(el, err, false); // 只要打字就先當作是對的，消除紅框
      validateSubmit();
    });
  });

  // 其他欄位監聽 (Change)
  const otherInputs = [
    $("consentAgree"),
    ...document.querySelectorAll("input[name='shipping']"),
    ...document.querySelectorAll("input[name='payment']")
  ];
  otherInputs.forEach(el => el?.addEventListener("change", validateSubmit));

  // 購物車變動監聽
  window.addEventListener("cart:update", validateSubmit);

  // 送出按鈕監聽
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    if (!btn.disabled) submitOrder();
  });

  // 支付方式按鈕監聽 (相容 .pay-btn 樣式)
  document.querySelectorAll(".pay-btn").forEach((b) => {
    b.addEventListener("click", () => {
      document.querySelectorAll(".pay-btn").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      validateSubmit();
    });
  });

  bindSuccessButtons();
  validateSubmit(); // 初始檢查
  checkEcpayReturn(); // 檢查是否剛付款回來
}

// 🛠️ 輔助函式：切換錯誤狀態 UI
function toggleError(inputEl, errId, isError) {
  const errEl = document.getElementById(errId);
  if (isError) {
    inputEl.classList.add("input-error"); // 紅框 (需配合 CSS)
    if (errEl) errEl.classList.add("show"); // 紅字 (需配合 CSS)
  } else {
    inputEl.classList.remove("input-error");
    if (errEl) errEl.classList.remove("show");
  }
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
    clearCart?.();
    document.getElementById("aiTeaHelperHost")?.classList.remove("active");
    $("globalLoading")?.classList.remove("show");

    const backdrop = $("successBackdrop");
    $("successOrderId").textContent = orderId;
    $("successTotal").textContent = `NT$${Number(total).toLocaleString()}`;
    
    backdrop.classList.remove("hidden");
    requestAnimationFrame(() => backdrop.classList.add("show"));

    bindSuccessButtons();
    history.replaceState({}, "", window.location.pathname); // 清除網址參數
  }
}

// -------------------------------
// 成功畫面按鈕綁定
// -------------------------------
function bindSuccessButtons() {
  const backdrop = $("successBackdrop");
  const closeBtn = $("successClose");
  const lineBtn = $("successLine");

  if (closeBtn) {
    closeBtn.onclick = () => {
      backdrop.classList.remove("show");
      setTimeout(() => backdrop.classList.add("hidden"), 380);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
  }

  if (lineBtn) {
    lineBtn.onclick = () => {
      window.location.href = "https://line.me/R/ti/p/@agw3661i";
    };
  }
}