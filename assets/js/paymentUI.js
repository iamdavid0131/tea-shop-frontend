import { $ } from "/assets/js/dom.js";
export function initPaymentUI() {
  console.log("✅ paymentUI 初始化完成");

  const radios = document.querySelectorAll('input[name="payment"]');
  const onlineMethods = $("#onlineMethods");

  console.log("📡 綁定付款方式事件數量 =", radios.length);
  if (!radios.length || !onlineMethods) {
    console.warn("⚠️ 沒找到付款 radio 或 onlineMethods");
    return;
  }

  radios.forEach(radio => {
    radio.addEventListener("change", (e) => {
      console.log("🟢 收到 change 事件", e.target.value);
      const isOnline = e.target.value === "online";
      onlineMethods.style.display = isOnline ? "flex" : "none";
      onlineMethods.classList.toggle("show", isOnline);
      console.log("🔄 切換付款方式:", e.target.value, "isOnline =", isOnline);
    });
  });

  // 🍎 Apple Pay
  if (window.ApplePaySession) {
    $(".apple-pay").style.display = "block";
  }

  // 💳 按鈕事件
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
