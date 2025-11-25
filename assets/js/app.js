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

document.addEventListener("DOMContentLoaded", async () => {
  const loadingEl = $("globalLoading");
  
  try {
    if (loadingEl) loadingEl.classList.remove("hidden");

    const cfg = await api.getConfig();
    CONFIG.PRODUCTS = (cfg.data || []).map(p => ({
      ...p,
      story: p.story || "",
      unit: p.unit || "",
      profile_sweetness: p.profile?.sweetness ?? p.profile_sweetness ?? 0,
      profile_aroma:     p.profile?.aroma     ?? p.profile_aroma     ?? 0,
      profile_roast:     p.profile?.roast     ?? p.profile_roast     ?? 0,
      profile_body:      p.profile?.body      ?? p.profile_body      ?? 0,
      profile_finish:    p.profile?.finish    ?? p.profile_finish    ?? 0,
      brew_hot_grams:      p.brew?.hot?.grams      ?? "",
      brew_hot_water_ml:   p.brew?.hot?.water_ml   ?? "",
      brew_hot_temp_c:     p.brew?.hot?.temp_c     ?? "",
      brew_hot_time_s:     p.brew?.hot?.time_s     ?? "",
      brew_hot_infusions:  p.brew?.hot?.infusions  ?? "",
      brew_cold_grams:     p.brew?.cold?.grams     ?? "",
      brew_cold_water_ml:  p.brew?.cold?.water_ml  ?? "",
      brew_cold_hours:     p.brew?.cold?.hours     ?? "",
    }));

    renderTeaScenes();
    initTeaModal();

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

    restoreCart();
    initQtyControls();
    enableSmartSheetControl();
    initShippingUI();
    initStorePicker();
    initZipAuto();
    initMemberLookup();
    initGiftBox();

    requestAnimationFrame(() => {
      CONFIG.PRODUCTS.forEach(p => updatePackUI(p.id));
      updateTotals();
    });

    const paymentObserver = new MutationObserver(() => {
      const paymentCard = document.getElementById("paymentCard");
      if (paymentCard) {
        paymentObserver.disconnect();
        setTimeout(() => { initPaymentUI(); }, 100);
      }
    });
    paymentObserver.observe(document.body, { childList: true, subtree: true });

    $("viewCartBtn")?.addEventListener("click", showCartSheet);

    // 🔥【關鍵修正】移除原本的 Scroll Hide 邏輯
    // 讓 Sticky Bar 永遠顯示，不要自動隱藏
    const bar = $("StickyBar");
    if (bar) {
        bar.classList.remove("hide");
        bar.classList.add("show");
    }

    initSubmitOrder();

  } catch (err) {
    console.error("初始化錯誤:", err);
    toast("⚠️ 載入失敗，請重新整理");
  } finally {
    if (loadingEl) {
        loadingEl.classList.add("hidden");
        setTimeout(() => loadingEl.style.display = 'none', 500);
    }
  }

  const stickyBtn = document.getElementById("submitBtnSticky");
  if (stickyBtn) {
    stickyBtn.addEventListener("click", () => {
      const target = document.querySelector(".section"); 
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        setTimeout(() => {
          const phoneInput = document.getElementById("phone");
          if (phoneInput) phoneInput.focus();
        }, 800);
      }
    });
  }
});