import { $, toast } from "./dom.js";
import { CONFIG } from "./config.js";
import { api } from "./app.api.js";

console.log("🧪 cart.js loaded v3.1 (Enhanced)");

// 🤫 隱藏版商品定義 (必須跟 aiTea.js 一致)
const SECRET_PRODUCT_DEF = {
  id: "secret_888",
  title: "👑 傳奇・80年代老凍頂",
  price: 8800,
  tags: "老饕限定",
  desc: "阿興師爺爺留下來的壓箱寶。"
};

// 🛠️ 自動修復 CONFIG：確保隱藏商品不會因重整而消失
function ensureSecretProduct() {
  const cart = JSON.parse(localStorage.getItem("teaOrderCart") || "{}");
  // 如果購物車有隱藏商品，但 CONFIG 裡沒有
  if (cart[SECRET_PRODUCT_DEF.id] && !CONFIG.PRODUCTS.find(p => p.id === SECRET_PRODUCT_DEF.id)) {
    CONFIG.PRODUCTS.push(SECRET_PRODUCT_DEF);
    // console.log("♻️ cart.js: 已自動補回隱藏商品定義");
  }
}

// ============================================================
// 🟩 儲存「單一商品」進購物車
// ============================================================
export function saveCartItem(id, qty, pack, packQty) {
  const cart = JSON.parse(localStorage.getItem("teaOrderCart") || "{}");

  if (qty > 0) {
    cart[id] = { qty, pack, packQty };
  } else {
    delete cart[id];
  }

  // 同步更新首頁 UI (如果有對應的 qty input)
  const qtyEl = document.getElementById(`qty-${id}`);
  if (qtyEl) {
    if ("value" in qtyEl) qtyEl.value = qty;
    else qtyEl.textContent = qty;
  }

  localStorage.setItem("teaOrderCart", JSON.stringify(cart));
}


// ============================================================
// 🔄 還原購物車
// ============================================================
export function restoreCart() {
  try {
    // 🔥 關鍵：還原前先檢查是否有隱藏商品，確保 UI 能正常運作
    ensureSecretProduct();

    const saved = JSON.parse(localStorage.getItem("teaOrderCart") || "{}");

    Object.entries(saved).forEach(([id, data]) => {
      const { qty, pack, packQty } = data;

      // qty
      const qtyEl = $(`qty-${id}`);
      if (qtyEl) {
        if ("value" in qtyEl) qtyEl.value = qty;
        else qtyEl.textContent = qty;
      }

      // pack checkbox
      const packEl = $(`pack-${id}`);
      if (packEl) packEl.checked = pack;

      // packQty input
      const pq = $(`packQty-${id}`);
      if (pq) pq.value = packQty;

      // 假設有外部函式 updatePackUI，這裡嘗試呼叫
      if (typeof window.updatePackUI === "function") {
          // window.updatePackUI(id); 
          // 注意：如果不確定 updatePackUI 是否全域可用，建議在這裡 import 它
      }
    });
    
    // 初始化後更新一次總金額
    updateTotals();

  } catch (err) {
    console.warn("⚠️ restoreCart 錯誤:", err);
  }
}


// ============================================================
// 💰 金額試算 + Sticky Bar 更新
// ============================================================
export async function updateTotals() {
  // 🔥 關鍵：確保試算時包含隱藏商品
  ensureSecretProduct();
  
  const items = buildOrderItems();
  const stickyBar = $("StickyBar");
  
  if (!stickyBar) return;

  // 🪫 購物車為空
  if (items.length === 0) {
    $("total_s").textContent = "NT$ 0";
    $("sub_s").textContent = "—";
    $("disc_s").textContent = "—";
    $("ship_s").textContent = "—";
    
    // 隱藏進度條與提示
    const progressWrap = $("freeProgress");
    if(progressWrap) progressWrap.classList.add("hidden");
    
    const freeHint = $("freeHint");
    if(freeHint) freeHint.classList.remove("show");

    stickyBar.classList.add("hide");
    stickyBar.classList.remove("show");
    
    window.dispatchEvent(new Event("cart:update"));
    return;
  }

  // 顯示 Sticky Bar
  stickyBar.classList.add("show");
  stickyBar.classList.remove("hide");

  try {
    const preview = await api.previewTotals(items, "store", "");
    const data = preview?.data ?? preview ?? {};

    const sub = data.subtotal || 0;
    const disc = data.discount || 0;
    const ship = data.shipping ?? data.shippingFee ?? 0;
    const total = sub - disc + ship;

    const fmt = n => `NT$ ${Number(n || 0).toLocaleString("zh-TW")}`;
    
    if($("sub_s")) $("sub_s").textContent = fmt(sub);
    if($("disc_s")) $("disc_s").textContent = fmt(disc);
    if($("ship_s")) $("ship_s").textContent = fmt(ship);
    if($("total_s")) $("total_s").textContent = fmt(total);
    
    animateMoney();

    const discWrap = $("disc_wrap");
    if (discWrap) discWrap.style.display = disc > 0 ? "inline" : "none";

    // ✅ 免運提示強化區塊
    const freeThreshold = CONFIG.FREE_SHIPPING_THRESHOLD || 1000;
    const isFree = sub >= freeThreshold;

    const progressWrap = $("freeProgress");
    const progressBar = $("freeProgressBar");
    const freeHint = $("freeHint"); 

    if (progressWrap) {
      progressWrap.classList.remove("hidden");
      progressWrap.style.display = "block";
    }

    if (progressBar) {
      const progress = Math.min(100, (sub / freeThreshold) * 100);
      progressBar.style.width = `${progress}%`;
      progressBar.classList.toggle("flash-free", isFree);
    }

    // 🌿 高質感免運浮出提示
    if (freeHint) {
      if (isFree) {
        // 只有當還沒有內容時才隨機，避免每次數字跳動文案一直換
        if (!freeHint.textContent || freeHint.classList.contains("hide")) {
             freeHint.textContent = randomTeaQuote();
        }
        freeHint.classList.add("show");
        freeHint.classList.remove("hide");
      } else {
        freeHint.classList.remove("show");
        freeHint.classList.add("hide");
      }
    }

  } catch (err) {
    console.error("試算錯誤:", err);
  }

  window.dispatchEvent(new Event("cart:update"));
}

// ============================================================
// ✨ 金額動畫
// ============================================================
export function animateMoney() {
  const el = $("total_s");
  if (!el) return;
  // 移除 class 再加回去觸發動畫
  el.classList.remove("money-pop");
  void el.offsetWidth; // 強制重繪
  el.classList.add("money-pop");
}

// ============================================================
// 🛒 取得購物車內容（供訂單送出用）
// ============================================================
export function getCartItems() {
  try {
    ensureSecretProduct(); // 🔥 確保
    const cart = JSON.parse(localStorage.getItem("teaOrderCart") || "{}");

    return Object.entries(cart).map(([id, data]) => {
      const p = CONFIG.PRODUCTS.find(x => x.id == id);
      if (!p) return null;

      return {
        id: p.id,
        name: p.title || p.name || "",
        qty: data.qty,
        pack: data.pack,
        packQty: data.packQty
      };
    }).filter(Boolean);

  } catch (err) {
    console.error("⚠️ getCartItems 失敗:", err);
    return [];
  }
}


// ============================================================
// 🧹 清空購物車（送出訂單成功後）
// ============================================================
export function clearCart() {
  try {
    localStorage.removeItem("teaOrderCart");

    CONFIG.PRODUCTS.forEach(p => {
      const qtyEl = $(`qty-${p.id}`);
      if (!qtyEl) return;

      if ("value" in qtyEl) {
        qtyEl.value = "0";
      } else {
        qtyEl.textContent = "0";
      }
    });

    updateTotals();
    console.log("🧹 購物車已清空");
  } catch (err) {
    console.error("⚠️ clearCart 錯誤:", err);
  }
}

// 🌿 動態茶語隨機顯示（免運提示）
function randomTeaQuote() {
  const quotes = [
    "🌿 已達免運門檻，香氣隨風入心。",
    "🍃 茶香已備，免運送到家。",
    "☕ 一壺好茶，一路好運！",
    "🫖 已達免運，再添一份茶香更圓滿～",
    "🌸 香氣滿溢，免運已成！",
  ];
  return quotes[Math.floor(Math.random() * quotes.length)];
}

// ============================================================
// 📊 取得購物車數量（供 sheetModal 用）
// ============================================================
export function getQty(id) {
  const el = document.getElementById(`qty-${id}`);
  if (!el) return 0;

  let q = el.value !== undefined ? parseInt(el.value) : parseInt(el.textContent);
  return isNaN(q) ? 0 : q;
}

// ============================================================
// 📊 建立訂單物件列表（核心函式）
// ============================================================
export function buildOrderItems() {
  ensureSecretProduct(); // 🔥 確保隱藏商品在 CONFIG 裡
  const cart = JSON.parse(localStorage.getItem("teaOrderCart") || "{}");

  return Object.entries(cart).map(([id, data]) => {
    const p = CONFIG.PRODUCTS.find(x => x.id == id);
    if (!p) return null;

    return {
      id: p.id,
      name: p.title || p.name || "",
      price: p.price,
      qty: data.qty,
      pack: data.pack,
      packQty: data.packQty
    };
  }).filter(Boolean);
}

// ============================================================
// 📊 重新渲染購物明細（sheetModal 內容）
// ============================================================
export function refreshSheetTotals() {
  const items = buildOrderItems();
  if (!items.length) {
    if($("cartSub")) $("cartSub").textContent = "NT$ 0";
    if($("cartDiscRow")) $("cartDiscRow").style.display = "none";
    if($("cartShip")) $("cartShip").textContent = "NT$ 0";
    if($("cartTotal")) $("cartTotal").textContent = "NT$ 0";
    return;
  }

  api.previewTotals(items, "store", "")
    .then((preview) => {
      const data = preview.data || preview;

      if($("cartSub")) $("cartSub").textContent = `NT$ ${data.subtotal.toLocaleString("zh-TW")}`;
      
      if($("cartDiscRow")) {
          $("cartDiscRow").style.display = data.discount > 0 ? "flex" : "none";
          if($("cartDisc")) $("cartDisc").textContent = data.discount > 0 ? `- NT$ ${data.discount.toLocaleString("zh-TW")}` : "";
      }
      
      if($("cartShip")) $("cartShip").textContent = `NT$ ${(data.shippingFee || 0).toLocaleString("zh-TW")}`;
      if($("cartTotal")) $("cartTotal").textContent = `NT$ ${(data.total || 0).toLocaleString("zh-TW")}`;
    });
}