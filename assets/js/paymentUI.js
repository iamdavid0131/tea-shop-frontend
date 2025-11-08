import { $ } from "/assets/js/dom.js";

export function initPaymentUI() {
  console.log("✅ paymentUI 初始化完成");

  const radios = document.querySelectorAll('input[name="payment"]');
  const onlineMethods = $("#onlineMethods");

  console.log("📡 綁定付款方式事件數量 =", radios.length);

  if (!radios.length || !onlineMethods) {
    console.warn("⚠️ 沒找到付款 radio 或 #onlineMethods");
    return;
  }

  // 🎯 切換付款方式：線上支付展開 / 收起
  radios.forEach((radio) => {
    radio.addEventListener("change", (e) => {
      const value = e.target.value;
      const isOnline = value === "online";

      console.log("💳 切換付款方式:", value);

      if (isOnline) {
        onlineMethods.classList.add("show");
        onlineMethods.style.display = "flex";
        console.log("✅ 顯示線上支付區塊");
      } else {
        onlineMethods.classList.remove("show");
        // 🔧 延遲收起以配合動畫
        setTimeout(() => {
          if (!onlineMethods.classList.contains("show")) {
            onlineMethods.style.display = "none";
          }
        }, 250);
        console.log("🚫 隱藏線上支付區塊");
      }
    });
  });

  // 🍎 Apple Pay（僅 iOS Safari 顯示）
  if (window.ApplePaySession) {
    const appleBtn = $(".apple-pay");
    if (appleBtn) appleBtn.style.display = "block";
  }

  // 💰 點擊線上支付方式按鈕
  const payButtons = document.querySelectorAll(".pay-btn");
  payButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      payButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      sessionStorage.setItem("paymentMethod", btn.dataset.method);
      console.log("💳 已選擇支付方式：", btn.dataset.method);
    });
  });
}
