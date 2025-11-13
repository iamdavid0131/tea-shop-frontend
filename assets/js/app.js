/**
 * ☕ 祥興茶行購物頁 app.js
 * 前端主控流程（初始化 + 頁面管理）
 */

import { api } from "./app.api.js";
import { $, $$, toast } from "./dom.js";
import { CONFIG } from "./config.js";
import { renderTeaScenes, initTeaModal } from "./products.js";
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
    $("loading")?.style && ($("loading").style.display = "block");

    // ✅ 載入商品設定
    const cfg = await api.getConfig();
    CONFIG.PRODUCTS = (cfg.data || []).map(p => ({
      ...p,
      profile: p.profile || null
    }));

    // ✅ 渲染商品區
    renderTeaScenes();
    initTeaModal(CONFIG.PRODUCTS);

    // 🟢 「裝罐」按鈕事件
    document.querySelectorAll(".pack-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        btn.classList.toggle("active");
        updateTotals();
        window.dispatchEvent(new Event("cart:update"));
      });
    });

    // ✅ 初始化購物邏輯
    restoreCart();
    initQtyControls();

    // ✅ 初始化各模組
    enableSmartSheetControl(); // BottomSheet 明細
    initShippingUI();          // 運送方式
    initStorePicker();         // 門市選擇器
    initZipAuto();             // 郵遞區號自動推斷
    initMemberLookup();        // 會員查詢

    // ✅ 延遲更新 UI
    requestAnimationFrame(() => {
      CONFIG.PRODUCTS.forEach(p => updatePackUI(p.id));
      updateTotals();
    });

    // ✅ 安全偵測付款 UI 是否載入完成
    const paymentObserver = new MutationObserver(() => {
      const paymentCard = document.getElementById("paymentCard");
      if (paymentCard) {
        console.log("✅ 偵測到 #paymentCard 出現，開始延遲初始化付款 UI");
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

    // ✅ 查看購物明細
    $("viewCartBtn")?.addEventListener("click", showCartSheet);

    // ✅ StickyBar 滾動隱藏
    let lastScrollY = window.scrollY;
    window.addEventListener("scroll", () => {
      const bar = $("StickyBar");
      if (!bar) return;
      if (window.scrollY > lastScrollY + 20) bar.classList.add("hide");
      else bar.classList.remove("hide");
      lastScrollY = window.scrollY;
    });

    // ✅ 初始化訂單送出功能
    initSubmitOrder();

  } catch (err) {
    console.error("初始化錯誤:", err);
    toast("⚠️ 載入失敗，請稍後再試");
  } finally {
    $("loading")?.style && ($("loading").style.display = "none");
  }

});
