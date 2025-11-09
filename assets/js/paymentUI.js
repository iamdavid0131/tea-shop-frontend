import { $ } from "/assets/js/dom.js";

export function initPaymentUI() {
  console.log("✅ paymentUI 初始化完成");

  const radios = document.querySelectorAll('input[name="payment"]');
  const onlineMethods = $("#onlineMethods");

  console.log("🔍 檢查 radio input 數量：", radios.length);
  if (!radios.length || !onlineMethods) {
    console.warn("⚠️ 沒找到付款 radio 或 onlineMethods");
    return;
  }

  radios.forEach((radio) => {
    radio.addEventListener("change", (e) => {
      const isOnline = e.target.value === "online";
      console.log("🔥 change 事件觸發", e.target.value, "isOnline =", isOnline);

      if (isOnline) {
        onlineMethods.classList.add("show");
        onlineMethods.style.setProperty("display", "flex", "important");
        onlineMethods.style.opacity = "1";
        onlineMethods.style.transform = "translateY(0)";
      } else {
        onlineMethods.classList.remove("show");
        onlineMethods.style.opacity = "0";
        onlineMethods.style.transform = "translateY(-6px)";
        setTimeout(() => {
          if (!onlineMethods.classList.contains("show")) {
            onlineMethods.style.setProperty("display", "none", "important");
          }
        }, 300);
      }
    });
  });
}
