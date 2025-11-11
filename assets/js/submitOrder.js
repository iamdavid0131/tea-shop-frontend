import { api } from "./app.api.js";
import { $, toast } from "./dom.js";
import { getCartItems, clearCart } from "./cart.js";

export async function submitOrder() {
  const btn = $("submitBtn");
  const loading = $("loading");

  // 防止重複點擊
  if (btn.disabled) return;

  try {
    btn.disabled = true;
    btn.textContent = "處理中...";
    loading.style.display = "block";

    // 1️⃣ 收集資料
    const order = {
      items: getCartItems(),                // 購物明細
      payment: $("paymentCard")?.dataset?.method || "COD", // 付款方式
      shipping: $("shippingType")?.value || "",
      store: $("storeName")?.value || "",
      receiver: {
        name: $("receiverName")?.value,
        phone: $("receiverPhone")?.value,
        address: $("receiverAddress")?.value
      },
      total: $("total_s")?.textContent.replace(/[^\d]/g, "") || 0,
      note: $("orderNote")?.value || ""
    };

    // 2️⃣ 驗證欄位
    if (!order.receiver.name || !order.receiver.phone) {
      toast("⚠️ 請輸入收件人資料");
      btn.disabled = false;
      btn.textContent = "送出訂單";
      loading.style.display = "none";
      return;
    }

    // 3️⃣ 傳送訂單
    const res = await api.submitOrder(order);
    console.log("🧾 submitOrder response:", res);

    // 4️⃣ 成功回饋
    toast("✅ 訂單送出成功！");
    clearCart();
    setTimeout(() => {
      window.location.href = `/order-success.html?id=${res.data.orderId}`;
    }, 1000);

  } catch (err) {
    console.error("❌ 送出訂單錯誤:", err);
    toast("❌ 訂單送出失敗，請稍後再試");
  } finally {
    btn.disabled = false;
    btn.textContent = "送出訂單";
    loading.style.display = "none";
  }
}
