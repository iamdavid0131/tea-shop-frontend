import { $ } from "./dom.js";
import { validateSubmit } from "./submitOrder.js";

export function initPaymentUI(retry = 0) {
  const paymentCard = document.getElementById("paymentCard");

  if (!paymentCard) {
    if (retry < 10) {
      console.warn(`⚠️ 找不到付款卡片 #paymentCard，第 ${retry + 1} 次重試`);
      setTimeout(() => initPaymentUI(retry + 1), 100);
    } else {
      console.error("❌ 多次重試仍找不到付款卡片，放棄初始化付款 UI");
    }
    return;
  }

  console.log("✅ paymentUI 初始化完成");

  // 所有付款方式按鈕
  const payButtons = paymentCard.querySelectorAll(".pay-btn");
  if (!payButtons.length) {
    console.warn("⚠️ 找不到 .pay-btn 按鈕");
    return;
  }

  payButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      // 清除舊的 active 樣式
      payButtons.forEach((b) => b.classList.remove("active"));

      // 設定新的 active 狀態
      btn.classList.add("active");

      // 寫入 sessionStorage
      const method = btn.dataset.method;
      sessionStorage.setItem("paymentMethod", method);
      console.log("💳 已選擇付款方式：", method);

      // 🔄 觸發全局事件（讓 submitOrder.js 重新驗證）
      validateSubmit();
    });
  });
  document.querySelectorAll(".pay-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".pay-btn").forEach((b) =>
      b.classList.remove("active")
    );
    btn.classList.add("active");

    // 觸發重新驗證
    validateSubmit();
  });
});
}


/**
 * ✅ 表單完成度檢查（可依實際欄位需求調整）
 */
function checkFormComplete() {
  const name = $("#name")?.value.trim();
  const phone = $("#phone")?.value.trim();
  const agree = $("#agree")?.checked;
  const shipping = document.querySelector("input[name='shipping']:checked")?.value;
  const payment = sessionStorage.getItem("paymentMethod");
  return name && phone && agree && shipping && payment;
}
