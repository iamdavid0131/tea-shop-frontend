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

    // ✅ UI 控制
    enableSmartSheetControl(); // 購物明細 BottomSheet
    initShippingUI();          // 運送方式
    initStorePicker();         // 門市選擇器
    initZipAuto();             // 郵遞區號自動推斷
    initMemberLookup();        // 會員查詢
   
    

    requestAnimationFrame(() => {
      CONFIG.PRODUCTS.forEach(p => updatePackUI(p.id));
      updateTotals();
    });

  let paymentInitialized = false;

const paymentObserver = new MutationObserver(() => {
  const onlineMethods = document.getElementById("onlineMethods");

  if (onlineMethods && !paymentInitialized) {
    console.log("✅ 監測到 #onlineMethods 出現，初始化付款 UI");
    initPaymentUI();
    paymentInitialized = true;
  } else if (!onlineMethods && paymentInitialized) {
    console.log("♻️ #onlineMethods 被移除，下次出現將重新初始化");
    paymentInitialized = false;
  }
});

paymentObserver.observe(document.body, { childList: true, subtree: true });


    // ✅ 查看明細按鈕事件（唯一綁定）
    $("viewCartBtn")?.addEventListener("click", showCartSheet);


    // StickyBar 自動隱藏
    let lastScrollY = window.scrollY;
    window.addEventListener("scroll", () => {
      const bar = $("StickyBar");
      if (!bar) return;
      if (window.scrollY > lastScrollY + 20) bar.classList.add("hide");
      else bar.classList.remove("hide");
      lastScrollY = window.scrollY;
    });

  } catch (err) {
    console.error("初始化錯誤:", err);
    toast("⚠️ 載入失敗，請稍後再試");
  } finally {
    $("loading").style.display = "none";
  }
});

