// ✅ paymentUI.js — 控制付款方式互動與 UI 切換
import { $ } from "./dom.js";

export function initPaymentUI() {
  console.log("✅ paymentUI 初始化完成");

  const paymentContainer = document.querySelector(".payment-options");
  const onlineMethods = $("#onlineMethods");
  if (!paymentContainer || !onlineMethods) return;

  // === 🔄 切換付款方式（事件代理）
  paymentContainer.addEventListener("click", (e) => {
    const target = e.target.closest("input[name='payment'], .payment-radio");
    if (!target) return;

    const selected = document.querySelector('input[name="payment"]:checked')?.value;
    const isOnline = selected === "online";
    console.log("🔄 切換付款方式:", selected, "isOnline =", isOnline);

    // 顯示 / 隱藏線上支付選項
    onlineMethods.style.display = isOnline ? "flex" : "none";
    onlineMethods.classList.toggle("show", isOnline);
  });

  // === 🍎 Apple Pay（僅 iOS Safari 顯示）
  if (window.ApplePaySession) {
    const applePayBtn = $(".apple-pay");
    if (applePayBtn) applePayBtn.style.display = "block";
  }

  // === 💳 選擇線上支付方式（信用卡 / Apple Pay / ATM）
  const payButtons = document.querySelectorAll(".pay-btn");
  payButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      payButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const selected = btn.dataset.method;
      console.log("💳 已選擇支付方式：", selected);
      sessionStorage.setItem("paymentMethod", selected);
    });
  });
}
