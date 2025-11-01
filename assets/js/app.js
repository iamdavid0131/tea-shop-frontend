import { api } from "./app.api.js";
import { $, $$, toast } from "./dom.js";
import { CONFIG } from "./config.js";
import { renderProducts } from "./products.js";
import { restoreCart, updateTotals } from "./cart.js";
import { handleQtyClick, updatePackUI } from "./qty.js";
import { enableSmartSheetControl } from "./sheetModal.js";

window.api = api; // 可選保留

document.addEventListener("DOMContentLoaded", async () => {
  $("loading").style.display = "block";
  try {
    const cfg = await api.getConfig();
    CONFIG.PRODUCTS = (cfg.data || []).map((p) => ({
      ...p,
      profile: p.profile || null
    }));

    renderProducts(CONFIG.PRODUCTS);
    restoreCart();
    updateTotals();

    enableSmartSheetControl();

    requestAnimationFrame(() => {
      CONFIG.PRODUCTS.forEach((p) => updatePackUI(p.id));
    });
  } catch (err) {
    console.error(err);
    toast("⚠️ 無法載入商品設定");
  } finally {
    $("loading").style.display = "none";
  }
});

// 綁定數量按鈕
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".qty-btn");
  if (!btn) return;
  handleQtyClick(btn);
});
