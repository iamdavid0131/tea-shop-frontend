import { $ } from "./dom.js";

export function initPaymentUI(retry = 0) {
  const paymentCard = $("#paymentCard");

  if (!paymentCard) {
    if (retry < 10) {
      console.warn(`⚠️ 找不到付款卡片 #paymentCard，第 ${retry + 1} 次重試`);
      setTimeout(() => initPaymentUI(retry + 1), 100);
    } else {
      console.error("❌ 多次重試仍找不到付款卡片，放棄初始化付款 UI");
    }
    return;
  }

  console.log("✅ paymentUI 初始化完成（付款卡片已載入）");

  // ✅ 事件委派監聽付款方式變更
  paymentCard.addEventListener("change", (e) => {
    if (e.target.name !== "payment") return;
    const isOnline = e.target.value === "online";
    console.log("🔥 change 事件觸發", e.target.value, "isOnline =", isOnline);

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

  // 💳 線上支付按鈕事件
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
