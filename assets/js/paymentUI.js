import { $ } from "/assets/js/dom.js";

export function initPaymentUI() {
  console.log("✅ paymentUI 初始化完成");

  // 💡 監聽整個文件變化，只要 payment radio 改變都會觸發
  document.addEventListener("change", (e) => {
    if (e.target.matches('input[name="payment"]')) {
      const isOnline = e.target.value === "online";
      const onlineMethods = document.getElementById("onlineMethods");
      if (!onlineMethods) {
        console.warn("⚠️ 找不到 #onlineMethods，略過切換");
        return;
      }
      onlineMethods.style.display = isOnline ? "flex" : "none";
      onlineMethods.classList.toggle("show", isOnline);
      console.log("🔄 切換付款方式:", e.target.value, "isOnline =", isOnline);
    }
  });

  // 🍎 Apple Pay（僅 iOS Safari 顯示）
  if (window.ApplePaySession) {
    const appleBtn = document.querySelector(".apple-pay");
    if (appleBtn) appleBtn.style.display = "block";
  }

  // 💳 選擇線上支付方式
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("pay-btn")) {
      const payButtons = document.querySelectorAll(".pay-btn");
      payButtons.forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");
      sessionStorage.setItem("paymentMethod", e.target.dataset.method);
      console.log("💳 已選擇支付方式：", e.target.dataset.method);
    }
  });
}
