// ✅ paymentUI.js
import { $ } from "./dom.js";

export function initPaymentUI() {
  console.log("✅ paymentUI 初始化完成");

  const radios = document.querySelectorAll('input[name="payment"]');
  const onlineMethods = $("#onlineMethods");
  if (!radios.length || !onlineMethods) return;

  radios.forEach(radio => {
    radio.addEventListener("change", (e) => {
      const isOnline = e.target.value === "online";
      console.log("🔄 切換付款方式:", e.target.value, "isOnline =", isOnline);
      onlineMethods.style.display = isOnline ? "flex" : "none";
      onlineMethods.classList.toggle("show", isOnline);
    });
  });

  // 🍎 Apple Pay（僅 iOS Safari 顯示）
  if (window.ApplePaySession) {
    $(".apple-pay").style.display = "block";
  }

  // 💳 選擇線上支付方式
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
