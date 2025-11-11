/**
 * ☕ 祥興茶行購物頁 app.js
 * 前端主控流程（初始化 + 頁面管理）
 */

import { api } from "./app.api.js";
import { $, $$, toast } from "./dom.js";
import { CONFIG } from "./config.js";
import { renderProducts } from "./products.js";
import { restoreCart, updateTotals, animateMoney } from "./cart.js";
import { initQtyControls, updatePackUI } from "./qty.js";
import { enableSmartSheetControl, showCartSheet } from "./sheetModal.js";
import { initMemberLookup } from "./member.js";
import { initShippingUI } from "./shippingUI.js";
import { initStorePicker } from "./storepicker.js";
import { initZipAuto } from "./zipcode.js";
import { initPaymentUI } from "./paymentUI.js";
import { initSubmitOrder } from "./submitOrder.js";

window.api = api; // Debug 可留

document.addEventListener("DOMContentLoaded", async () => {
  try {
    $("loading").style.display = "block";

    const cfg = await api.getConfig();
    CONFIG.PRODUCTS = (cfg.data || []).map(p => ({
      ...p,
      profile: p.profile || null
    }));

    // ✅ 渲染商品 UI
    renderProducts(CONFIG.PRODUCTS);

    // ✅ 購物車還原 & 控制初始化
    restoreCart();
    initQtyControls();

    // ✅ 各模組初始化
    enableSmartSheetControl(); // 購物明細 BottomSheet
    initShippingUI();          // 運送方式
    initStorePicker();         // 門市選擇器
    initZipAuto();             // 郵遞區號自動推斷
    initMemberLookup();        // 會員查詢
    initSubmitOrder();         // 送出訂單

    requestAnimationFrame(() => {
      CONFIG.PRODUCTS.forEach(p => updatePackUI(p.id));
      updateTotals();
    });

    // ✅ 延遲監測付款卡片載入
    const paymentObserver = new MutationObserver(() => {
      const paymentCard = document.getElementById("paymentCard");
      if (paymentCard) {
        console.log("✅ 偵測到 #paymentCard 出現，開始安全延遲初始化付款 UI");
        paymentObserver.disconnect();

        let tries = 0;
        const timer = setInterval(() => {
          const card = document.getElementById("paymentCard");
          if (card) {
            clearInterval(timer);
            console.log("🎬 #paymentCard 已穩定載入，執行 initPaymentUI()");
            initPaymentUI();
          } else if (++tries > 50) {
            clearInterval(timer);
            console.error("❌ 5 秒內仍找不到 #paymentCard，放棄初始化付款 UI");
          }
        }, 100);
      }
    });
    paymentObserver.observe(document.body, { childList: true, subtree: true });

    // ✅ 查看明細按鈕
    $("viewCartBtn")?.addEventListener("click", showCartSheet);

    // ✅ StickyBar 自動隱藏
    let lastScrollY = window.scrollY;
    window.addEventListener("scroll", () => {
      const bar = $("StickyBar");
      if (!bar) return;
      if (window.scrollY > lastScrollY + 20) bar.classList.add("hide");
      else bar.classList.remove("hide");
      lastScrollY = window.scrollY;
    });

    // ✅ 綁定送出訂單按鈕
    const submitBtn = $("submitOrderBtn");
    if (submitBtn) {
      submitBtn.addEventListener("click", async () => {
        if (submitBtn.disabled) return;
        await submitOrder();
      });
    }

  } catch (err) {
    console.error("初始化錯誤:", err);
    toast("⚠️ 載入失敗，請稍後再試");
  } finally {
    $("loading").style.display = "none";
  }
});
