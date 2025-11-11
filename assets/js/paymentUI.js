import { $ } from "./dom.js";

export function initPaymentUI(retry = 0) {
  const radios = document.querySelectorAll('input[name="payment"]');
  if (!radios.length && retry < 10) {
    console.warn(`⚠️ 第 ${retry + 1} 次找不到付款 radio，50ms 後重試`);
    setTimeout(() => initPaymentUI(retry + 1), 50);
    return;
  }

  console.log("✅ paymentUI 初始化完成");
  console.log("🔍 檢查 radio input 數量：", radios.length);

  radios.forEach((radio) => {
    radio.addEventListener("change", (e) => {
      const isOnline = e.target.value === "online";
      console.log("🔥 change 事件觸發", e.target.value, "isOnline =", isOnline);

      // ✅ 每次都重新抓 DOM，避免被重新渲染造成 null
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
  });
}
