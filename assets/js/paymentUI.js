import { $ } from "./dom.js";

export function initPaymentUI() {
  console.log("✅ paymentUI 初始化完成");

  const paymentCard = $("#paymentCard");
  if (!paymentCard) {
    console.warn("⚠️ 找不到付款卡片 #paymentCard");
    return;
  }

  // ✅ 使用事件委派，監聽子元素的 change
  paymentCard.addEventListener("change", (e) => {
    if (e.target.name !== "payment") return; // 只針對付款 radio
    const isOnline = e.target.value === "online";
    console.log("🔥 change 事件觸發", e.target.value, "isOnline =", isOnline);

    // 每次都重新抓，確保是最新的 DOM
    const onlineMethods = $("#onlineMethods");
    if (!onlineMethods) {
      console.warn("⚠️ 找不到 #onlineMethods，略過這次事件");
      return;
    }

    if (isOnline) {
      onlineMethods.classList.add("show");
      onlineMethods.style.display = "flex";
      onlineMethods.style.opacity = "1";
      onlineMethods.style.transform = "translateY(0)";
    } else {
      onlineMethods.classList.remove("show");
      onlineMethods.style.opacity = "0";
      onlineMethods.style.transform = "translateY(-6px)";
      setTimeout(() => {
        if (!onlineMethods.classList.contains("show")) {
          onlineMethods.style.display = "none";
        }
      }, 300);
    }
  });

  // 🍎 Apple Pay 顯示（僅 iOS Safari）
  if (window.ApplePaySession) {
    const appleBtn = document.querySelector(".apple-pay");
    if (appleBtn) appleBtn.style.display = "block";
  }

  // 💳 綁定線上支付按鈕事件（重新 render 後也能動）
  paymentCard.addEventListener("click", (e) => {
    const btn = e.target.closest(".pay-btn");
    if (!btn) return;
    const payButtons = paymentCard.querySelectorAll(".pay-btn");
    payButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    sessionStorage.setItem("paymentMethod", btn.dataset.method);
    console.log("💳 已選擇支付方式：", btn.dataset.method);
  });
}
