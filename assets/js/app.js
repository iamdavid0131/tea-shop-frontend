import { api } from "./app.api.js";
import { $, toast } from "./dom.js";
import { CONFIG } from "./config.js";
import { renderProducts } from "./products.js";
import { restoreCart, updateTotals } from "./cart.js";
import { initQtyControls } from "./qty.js";
import { enableSmartSheetControl } from "./sheetModal.js";
import { initMemberLookup } from "./member.js";

window.api = api;

document.addEventListener("DOMContentLoaded", async () => {
  try {
    $("loading").style.display = "block";

    const cfg = await api.getConfig();
    CONFIG.PRODUCTS = (cfg.data || []).map(p => ({
      ...p,
      profile: p.profile || null
    }));

    // ✅ 渲染商品卡片
    renderProducts(CONFIG.PRODUCTS);

    // ✅ 還原購物車
    restoreCart();

    // ✅ 初始化 UI 控制（依序執行）
    initQtyControls();
    enableSmartSheetControl();
    initMemberLookup();

    // ✅ DOM 和 UI 都準備好後再更新金額
    await updateTotals();

  } catch (err) {
    console.error(err);
    toast("⚠️ 載入錯誤");
  } finally {
    $("loading").style.display = "none";
  }
});
