// ✅ paymentUI.js — 控制付款方式互動與 UI 切換
import { $ } from "./dom.js";

export function initPaymentUI() {
    console.log("✅ paymentUI 初始化完成");
    const radios = document.querySelectorAll('input[name="payment"]');
    const onlineMethods = $("#onlineMethods");
    if (!radios.length || !onlineMethods) return;

  

  // 付款方式切換：貨到付款 / 線上支付
  radios.forEach(radio => {
    radio.addEventListener("change", () => {
      console.log("🔄 切換付款方式:", radio.value);
      const selected = document.querySelector('input[name="payment"]:checked')?.value;
      const isOnline = selected === "online";
      console.log("isOnline =", isOnline);

      // 使用 class 控制顯示
      onlineMethods.classList.toggle("show", isOnline);
    });
  });

  // Apple Pay 偵測（僅 iOS Safari 顯示）
  if (window.ApplePaySession) {
    const applePayBtn = $(".apple-pay");
    if (applePayBtn) applePayBtn.style.display = "block";
  }

  // 點擊選擇線上支付方式（信用卡 / Apple Pay / ATM）
  const payButtons = document.querySelectorAll(".pay-btn");
  payButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      payButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const selected = btn.dataset.method;
      console.log("💳 已選擇支付方式：", selected);
      sessionStorage.setItem("paymentMethod", selected);
    });
  });
}
