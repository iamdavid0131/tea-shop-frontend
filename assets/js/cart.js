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

// 🛠️ 自動修復 CONFIG：確保隱藏商品在計算金額時存在
function ensureSecretProduct() {
  const cart = JSON.parse(localStorage.getItem("teaOrderCart") || "{}");
  // 只要購物車裡有這個 ID，但 CONFIG 裡沒有，就補進去
  if (cart[SECRET_PRODUCT_DEF.id] && !CONFIG.PRODUCTS.find(p => p.id === SECRET_PRODUCT_DEF.id)) {
    CONFIG.PRODUCTS.push(SECRET_PRODUCT_DEF);
    // console.log("♻️ cart.js: 已自動補回隱藏商品，確保金額正確");
  }
}

// ============================================================
// 🟩 儲存「單一商品」進購物車
// ============================================================
// packData 格式預期為: { small: number, large: number }
export function saveCartItem(id, qty, pack, packData) {
  const cart = JSON.parse(localStorage.getItem("teaOrderCart") || "{}");

  if (qty > 0) {
    let safePackData = { small: 0, large: 0, standard: 0 }; // 🔥 初始化包含 standard
    if (typeof packData === 'number') {
        safePackData.small = packData; 
    } else if (packData) {
        safePackData = packData;
    }

    cart[id] = { 
        qty, 
        pack, 
        packQty: safePackData 
    };
  } else {
    delete cart[id];
  }

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
    ensureSecretProduct();
    const saved = JSON.parse(localStorage.getItem("teaOrderCart") || "{}");

    Object.entries(saved).forEach(([id, data]) => {
      const { qty, pack, packQty } = data;

      // 1. 還原總數
      const qtyEl = $(`qty-${id}`);
      if (qtyEl) qtyEl.value = qty;

      // 2. 還原 Checkbox
      const packEl = $(`pack-${id}`);
      if (packEl) packEl.checked = pack;

      // 3. 還原裝罐 inputs
      let sVal = 0, lVal = 0, stdVal = 0; // 🔥 新增 stdVal
      
      if (typeof packQty === 'number') {
          sVal = packQty;
      } else if (packQty) {
          sVal = packQty.small || 0;
          lVal = packQty.large || 0;
          stdVal = packQty.standard || 0; // 🔥 讀取 standard
      }

      const sInput = $(`packQtySmall-${id}`);
      const lInput = $(`packQtyLarge-${id}`);
      const stdInput = $(`packQtyStandard-${id}`); // 🔥 取得 150g 的 input
      
      if (sInput) sInput.value = sVal;
      if (lInput) lInput.value = lVal;
      if (stdInput) stdInput.value = stdVal; // 🔥 還原數值
    });

    // 不需要在此呼叫 updateTotals，因為 main.js 通常會做，避免重複呼叫
    // updateTotals(); 
  } catch (err) {
    console.warn("⚠️ restoreCart 錯誤:", err);
  }
}


// ============================================================
// 💰 金額試算 + Sticky Bar 更新 (完整修正版)
// ============================================================
export async function updateTotals() {
  ensureSecretProduct();
  
  const items = buildOrderItems();
  const stickyBar = $("StickyBar");
  
  if (!stickyBar) return;

  // 空車處理
  if (items.length === 0) {
    $("total_s").textContent = "NT$ 0";
    if($("sub_s")) $("sub_s").textContent = "—";
    if($("disc_s")) $("disc_s").textContent = "—";
    if($("ship_s")) $("ship_s").textContent = "—";
    
    const progressWrap = $("freeProgress");
    if(progressWrap) progressWrap.classList.add("hidden");
    
    const freeHint = $("freeHint");
    if(freeHint) freeHint.classList.remove("show");

    stickyBar.classList.add("hide");
    stickyBar.classList.remove("show");
    
    window.dispatchEvent(new Event("cart:update"));
    return;
  }

  stickyBar.classList.add("show");
  stickyBar.classList.remove("hide");

  try {
    const selectedShip = document.querySelector("input[name='shipping']:checked")?.value || "store";
    const promoCode = document.getElementById("promoCode")?.value || "";

    const preview = await api.previewTotals(items, selectedShip, promoCode);
    const data = preview?.data ?? preview ?? {};
    
    // console.log("🔍 後端金額:", data);

    const fmt = n => `NT$ ${Number(n || 0).toLocaleString("zh-TW")}`;

    // 🔥 修正重點：直接使用後端回傳的 subtotal 與 total
    // 後端已經把 (小+大+標準)*10 的費用算在 subtotal 裡了，前端不要再加一次！
    
    if($("sub_s")) $("sub_s").textContent = fmt(data.subtotal);
    if($("disc_s")) $("disc_s").textContent = fmt(data.discount);
    
    const shipVal = data.shipping ?? data.shippingFee ?? 0;
    if($("ship_s")) $("ship_s").textContent = fmt(shipVal);
    
    const totalVal = data.total ?? data.totalAfterDiscount ?? 0;
    if($("total_s")) $("total_s").textContent = fmt(totalVal);
    
    animateMoney();

    // 折扣與免運邏輯
    const discWrap = $("disc_wrap");
    if (discWrap) discWrap.style.display = data.discount > 0 ? "inline" : "none";

    const sub = data.subtotal || 0;
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

    if (freeHint) {
      if (isFree) {
        if (!freeHint.textContent || !freeHint.classList.contains("show")) {
             freeHint.textContent = randomTeaQuote();
        }
        freeHint.classList.add("show");
      } else {
        freeHint.classList.remove("show");
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
    ensureSecretProduct(); 
    const cart = JSON.parse(localStorage.getItem("teaOrderCart") || "{}");

    return Object.entries(cart).map(([id, data]) => {
      const p = CONFIG.PRODUCTS.find(x => x.id == id);
      if (!p) return null;

      // 整理 packQty 為物件格式
      let packDetails = { small: 0, large: 0, standard: 0 }; // 補上 standard 初始值
      if (data.pack && data.packQty) {
          if (typeof data.packQty === 'number') {
             packDetails.small = data.packQty;
          } else {
             // 確保完整複製
             packDetails = { 
                 small: data.packQty.small || 0,
                 large: data.packQty.large || 0,
                 standard: data.packQty.standard || 0
             };
          }
      }

      return {
        id: p.id,
        name: p.title || p.name || "",
        qty: data.qty,
        pack: data.pack,
        packDetails: packDetails, 
        
        // 🔥 修正：總數計算要包含 standard
        packQty: (packDetails.small || 0) + (packDetails.large || 0) + (packDetails.standard || 0)
      };
    }).filter(Boolean);

  } catch (err) {
    console.error("⚠️ getCartItems 失敗:", err);
    return [];
  }
}

// ============================================================
// 🧹 清空購物車
// ============================================================
export function clearCart() {
  try {
    // 1. 清除單品茶
    localStorage.removeItem("teaOrderCart");
    
    // 2. [新增] 清除禮盒
    localStorage.removeItem("teaGiftBoxCart");

    // 3. 重置 UI 數字
    CONFIG.PRODUCTS.forEach(p => {
      const qtyEl = $(`qty-${p.id}`);
      if (!qtyEl) return;
      if ("value" in qtyEl) qtyEl.value = "0";
      else qtyEl.textContent = "0";
    });

    // 4. 更新總計
    updateTotals();
    console.log("🧹 購物車 (含禮盒) 已全部清空");
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
// 📊 建立訂單物件列表（核心函式 - 已整合禮盒）
// ============================================================
export function buildOrderItems() {
  ensureSecretProduct(); 
  const items = [];

  // 1. 單品茶
  const cart = JSON.parse(localStorage.getItem("teaOrderCart") || "{}");
  
  Object.entries(cart).forEach(([id, data]) => {
    const p = CONFIG.PRODUCTS.find(x => x.id == id);
    if (p) {
      let packSmall = 0;
      let packLarge = 0;
      let packStandard = 0; 

      if (data.pack && data.packQty) {
          if (typeof data.packQty === 'number') {
              packSmall = data.packQty;
          } else {
              packSmall = data.packQty.small || 0;
              packLarge = data.packQty.large || 0;
              packStandard = data.packQty.standard || 0; 
          }
      }

      // 🔥 計算總裝罐數
      const totalPacks = packSmall + packLarge + packStandard;

      items.push({
        type: 'regular',
        id: p.id,
        name: p.title,
        price: p.price,
        qty: data.qty,
        pack: data.pack, 
        
        // 🔥🔥🔥 補上這一行！ UI (sheetModal) 就是在找這個！ 🔥🔥🔥
        packQty: totalPacks, 

        packDetails: { small: packSmall, large: packLarge, standard: packStandard },
        packFee: totalPacks * 10 
      });
    }
  });

  // 2. 禮盒 (維持不變)
  const giftboxes = JSON.parse(localStorage.getItem("teaGiftBoxCart") || "[]");
  giftboxes.forEach(box => {
    items.push({
      type: 'giftbox',      
      id: box.id,           
      name: "客製雙罐禮盒",   
      price: box.totalPrice,
      qty: box.qty,               
      details: {            
        slot1: box.slot1,
        slot2: box.slot2
      }
    });
  });

  return items;
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


// ============================================================
// 🎁 [新增] 儲存禮盒進購物車 (存入 LocalStorage)
// ============================================================
export function addGiftBoxToCart(giftboxData) {
  // 1. 讀取目前的禮盒清單
  const boxes = JSON.parse(localStorage.getItem("teaGiftBoxCart") || "[]");
  
  // 2. 加入新禮盒
  boxes.push({
    ...giftboxData,
    id: `giftbox_${Date.now()}`, // 給每個禮盒唯一的 ID，方便刪除
    qty: giftboxData.qty || 1 // 🟢 修正：儲存傳入的組數
  });

  // 3. 存回 LocalStorage
  localStorage.setItem("teaGiftBoxCart", JSON.stringify(boxes));

  // 4. 立即更新金額與介面
  updateTotals();
  
  console.log("🎁 禮盒已加入購物車:", boxes);
}

// 🗑️ [新增] 移除單個禮盒
export function removeGiftBox(giftboxId) {
  let boxes = JSON.parse(localStorage.getItem("teaGiftBoxCart") || "[]");
  boxes = boxes.filter(b => b.id !== giftboxId);
  localStorage.setItem("teaGiftBoxCart", JSON.stringify(boxes));
  updateTotals();
}

// ============================================================
// 🎁 [新增] 禮盒編輯功能支援
// ============================================================

// 取得單一禮盒資料 (供編輯用)
export function getGiftBox(id) {
  const boxes = JSON.parse(localStorage.getItem("teaGiftBoxCart") || "[]");
  return boxes.find(b => b.id === id);
}

// 更新禮盒資料 (編輯完成後儲存)
export function updateGiftBoxInCart(id, newData) {
  const boxes = JSON.parse(localStorage.getItem("teaGiftBoxCart") || "[]");
  const index = boxes.findIndex(b => b.id === id);
  
  if (index !== -1) {
    // 🟢 修正：讀取並更新組數 (newData.qty 來自前端提交)
    boxes[index] = { 
        ...newData, 
        id: id, 
        qty: newData.qty || boxes[index].qty || 1 // 使用新的組數
    };
    localStorage.setItem("teaGiftBoxCart", JSON.stringify(boxes));
    updateTotals(); // 重新算錢
    return true;
  }
  return false;
}