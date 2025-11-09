import { $ } from "/assets/js/dom.js";

export function initPaymentUI() {
  console.log("✅ paymentUI 初始化完成");

  document.addEventListener("change", (e) => {
    if (e.target.matches('input[name="payment"]')) {
      console.log("🔥 change 事件觸發", e.target.value);
      const isOnline = e.target.value === "online";
      const onlineMethods = $("#onlineMethods");
      if (!onlineMethods) return;

      if (isOnline) {
        onlineMethods.classList.add("show");
        onlineMethods.style.display = "flex";
        console.log("✅ 顯示線上支付");
      } else {
        onlineMethods.classList.remove("show");
        setTimeout(() => {
          if (!onlineMethods.classList.contains("show")) {
            onlineMethods.style.display = "none";
          }
        }, 250);
        console.log("🚫 隱藏線上支付");
      }
    }
  });
}
