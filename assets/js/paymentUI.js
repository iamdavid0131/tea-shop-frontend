import { $ } from "./dom.js";

export function initPaymentUI(retry = 0) {
  const radios = document.querySelectorAll('input[name="payment"]');
  const onlineMethods = $("#onlineMethods");

  if ((!radios.length || !onlineMethods) && retry < 10) {
    console.warn(`⚠️ 第 ${retry + 1} 次找不到付款 radio 或 onlineMethods，50ms 後重試`);
    setTimeout(() => initPaymentUI(retry + 1), 50);
    return;
  }

  console.log("✅ paymentUI 初始化完成");
  console.log("🔍 檢查 radio input 數量：", radios.length);

  radios.forEach((radio) => {
    radio.addEventListener("change", (e) => {
      const isOnline = e.target.value === "online";
      console.log("🔥 change 事件觸發", e.target.value, "isOnline =", isOnline);

      if (isOnline) {
        onlineMethods.classList.add("show");
        onlineMethods.style.display = "flex";
      } else {
        onlineMethods.classList.remove("show");
        onlineMethods.style.display = "none";
      }
    });
  });
}
