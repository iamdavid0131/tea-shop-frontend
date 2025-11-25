/**
 * ☕ 祥興茶行購物頁 app.js
 * 前端主控流程（初始化 + 頁面管理）
 */

import { api } from "./app.api.js";
import { $, $$, toast } from "./dom.js";
import { CONFIG } from "./config.js";
import { renderTeaScenes, initTeaModal } from "./products.js";
import { restoreCart, updateTotals } from "./cart.js";
import { initQtyControls, updatePackUI } from "./qty.js";
import { enableSmartSheetControl, showCartSheet } from "./sheetModal.js";
import { initMemberLookup } from "./member.js";
import { initShippingUI } from "./shippingUI.js";
import { initStorePicker } from "./storepicker.js";
import { initZipAuto } from "./zipcode.js";
import { initPaymentUI } from "./paymentUI.js";
import { initSubmitOrder } from "./submitOrder.js";
import { initGiftBox } from "./giftbox_ui.js";
// window.api = api; // Debug 用，正式上線可移除

document.addEventListener("DOMContentLoaded", async () => {
  // 🛠️ 修正 1: 對應 HTML 的 globalLoading ID
  const loadingEl = $("globalLoading");
  
  try {
    // 顯示 Loading
    if (loadingEl) loadingEl.classList.remove("hidden");

    // ✅ 載入商品設定
    const cfg = await api.getConfig();
    CONFIG.PRODUCTS = (cfg.data || []).map(p => ({
      ...p,
      story: p.story || "",
      unit: p.unit || "",

      // ------- PROFILE 五項 -------
      profile_sweetness: p.profile?.sweetness ?? p.profile_sweetness ?? 0,
      profile_aroma:     p.profile?.aroma     ?? p.profile_aroma     ?? 0,
      profile_roast:     p.profile?.roast     ?? p.profile_roast     ?? 0,
      profile_body:      p.profile?.body      ?? p.profile_body      ?? 0,
      profile_finish:    p.profile?.finish    ?? p.profile_finish    ?? 0,
      
      // ===== HOT BREW =====
      brew_hot_grams:      p.brew?.hot?.grams      ?? "",
      brew_hot_water_ml:   p.brew?.hot?.water_ml   ?? "",
      brew_hot_temp_c:     p.brew?.hot?.temp_c     ?? "",
      brew_hot_time_s:     p.brew?.hot?.time_s     ?? "",
      brew_hot_infusions:  p.brew?.hot?.infusions  ?? "",

      // ===== COLD BREW =====
      brew_cold_grams:     p.brew?.cold?.grams     ?? "",
      brew_cold_water_ml:  p.brew?.cold?.water_ml  ?? "",
      brew_cold_hours:     p.brew?.cold?.hours     ?? "",
    }));

    // ✅ 渲染商品區 (這裡會觸發 Aurora Mist 動畫)
    renderTeaScenes();
    
    // ✅ 初始化 Modal
    initTeaModal();

    // 🟢 「裝罐」按鈕事件 (這是針對非 Modal 內的按鈕，若無此需求可忽略)
    // 注意：Modal 內的按鈕是在 renderSingleProduct 生成的，不在此處綁定
    const packBtns = document.querySelectorAll(".pack-btn");
    if (packBtns.length > 0) {
      packBtns.forEach(btn => {
        btn.addEventListener("click", () => {
          btn.classList.toggle("active");
          updateTotals();
          window.dispatchEvent(new Event("cart:update"));
        });
      });
    }

    // ✅ 初始化購物邏輯
    restoreCart();
    initQtyControls();

    // ✅ 初始化各模組
    enableSmartSheetControl(); // BottomSheet 明細
    initShippingUI();          // 運送方式
    initStorePicker();         // 門市選擇器
    initZipAuto();             // 郵遞區號自動推斷
    initMemberLookup();        // 會員查詢
    // 🟢 2. 初始化禮盒系統 (必須在 CONFIG 載入後)
    initGiftBox();

    // ✅ 延遲更新 UI (確保 DOM 已完全繪製)
    requestAnimationFrame(() => {
      CONFIG.PRODUCTS.forEach(p => updatePackUI(p.id));
      updateTotals();
    });

    // ✅ 安全偵測付款 UI 是否載入完成
    const paymentObserver = new MutationObserver(() => {
      const paymentCard = document.getElementById("paymentCard");
      if (paymentCard) {
        // console.log("✅ 偵測到 #paymentCard 出現，初始化付款 UI");
        paymentObserver.disconnect();

        // 給一點緩衝時間確保內容穩定
        setTimeout(() => {
             initPaymentUI();
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
      
      const currentScrollY = window.scrollY;
      // 增加一點閾值，避免手指微動就一直閃爍
      if (currentScrollY > lastScrollY + 10 && currentScrollY > 100) {
        bar.classList.add("hide");
      } else if (currentScrollY < lastScrollY - 5) {
        bar.classList.remove("hide");
      }
      lastScrollY = currentScrollY;
    }, { passive: true }); // 效能優化

    // ✅ 初始化訂單送出功能
    initSubmitOrder();

  } catch (err) {
    console.error("初始化錯誤:", err);
    toast("⚠️ 載入失敗，請重新整理");
  } finally {
    // 隱藏 Loading (使用 class 操作)
    if (loadingEl) {
        loadingEl.classList.add("hidden");
        // 確保動畫結束後完全隱藏（如果 CSS 有 transition）
        setTimeout(() => loadingEl.style.display = 'none', 500);
    }
  }

  // ✅ 綁定 StickyBar 的「去買單」按鈕
const stickyBtn = document.getElementById("submitBtnSticky");
if (stickyBtn) {
  stickyBtn.addEventListener("click", () => {
    // 1. 找到收件資料區塊 (我們之前修復的 .section)
    // 通常第一個輸入框是電話或姓名
    const target = document.querySelector(".section"); 
    
    if (target) {
      // 2. 平滑滾動
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      
      // 3. (選用) 讓姓名欄位聚焦，引導輸入
      setTimeout(() => {
        const phoneInput = document.getElementById("phone");
        if (phoneInput) phoneInput.focus();
      }, 800); // 等滾動完再聚焦
    }
  });
}
});

