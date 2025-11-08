import { $ } from "/assets/js/dom.js";

export function initPaymentUI() {
  console.log("✅ paymentUI 初始化完成");

  // 🔍 找出所有運送方式 radio
  const radios = document.querySelectorAll('input[name="payment"]');
  const onlineMethods = $("#onlineMethods");

  console.log("📡 綁定運送方式事件數量 =", radios.length);
  if (!radios.length || !onlineMethods) {
    console.warn("⚠️ 沒找到運送 radio 或 onlineMethods");
    return;
  }

  // 📦 當切換運送方式時，判斷是否要展開線上支付
  radios.forEach(radio => {
    radio.addEventListener("change", (e) => {
      const paymentValue = e.target.value;
      console.log("🚚 切換運送方式:", paymentValue);

      // 🔧 依據運送方式決定是否顯示線上支付
      const isOnline = paymentValue === "online"; 
      // ↑ 可依實際命名調整，例如：home=宅配, pickup=超取付款, store=店取等

      onlineMethods.style.display = isOnline ? "flex" : "none";
      onlineMethods.classList.toggle("show", isOnline);

      console.log("🔄 切換付款區塊: isOnline =", isOnline);
    });
  });

  // 🍎 Apple Pay（僅 iOS Safari 顯示）
  if (window.ApplePaySession) {
    const appleBtn = document.querySelector(".apple-pay");
    if (appleBtn) appleBtn.style.display = "block";
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
