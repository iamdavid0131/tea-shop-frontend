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
    // 確保 packData 是物件，如果舊程式傳數字進來，做相容
    let safePackData = { small: 0, large: 0 };
    if (typeof packData === 'number') {
        safePackData.small = packData; // 舊邏輯視為小罐
    } else if (packData) {
        safePackData = packData;
    }

    cart[id] = { 
        qty, 
        pack, 
        packQty: safePackData // 統一存在 packQty 欄位，但內容變成物件
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
      const { qty, pack, packQty } = data; // packQty 可能是物件

      // 1. 還原總數
      const qtyEl = $(`qty-${id}`);
      if (qtyEl) qtyEl.value = qty;

      // 2. 還原 Checkbox
      const packEl = $(`pack-${id}`);
      if (packEl) packEl.checked = pack;

      // 3. 還原裝罐 inputs
      // 解析 packQty (可能是舊版數字 或 新版物件)
      let sVal = 0, lVal = 0;
      if (typeof packQty === 'number') {
          sVal = packQty;
      } else if (packQty) {
          sVal = packQty.small || 0;
          lVal = packQty.large || 0;
      }

      const sInput = $(`packQtySmall-${id}`);
      const lInput = $(`packQtyLarge-${id}`);
      
      if (sInput) sInput.value = sVal;
      if (lInput) lInput.value = lVal;

      // 觸發 UI 狀態文字更新
      if(typeof window.updatePackUI === "function") {
         // 這裡假設 updatePackUI 沒有被 export 到 window，
         // 實際上它在 qty.js 裡被呼叫，qty.js init 時會處理，所以這裡可以略過，
         // 或是在 main.js 裡做一次全域 refresh
      }
    });

    updateTotals();
  } catch (err) {
    console.warn("⚠️ restoreCart 錯誤:", err);
  }
}


// ============================================================
// 💰 金額試算 + Sticky Bar 更新 (完整修正版)
// ============================================================
export async function updateTotals() {
  // 1. 確保隱藏商品在列
  ensureSecretProduct();
  
  const items = buildOrderItems();
  const stickyBar = $("StickyBar");
  
  if (!stickyBar) return;

  // 2. 🪫 空車狀態處理
  if (items.length === 0) {
    $("total_s").textContent = "NT$ 0";
    if($("sub_s")) $("sub_s").textContent = "—";
    if($("disc_s")) $("disc_s").textContent = "—";
    if($("ship_s")) $("ship_s").textContent = "—";
    
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

  // 3. 顯示 Sticky Bar
  stickyBar.classList.add("show");
  stickyBar.classList.remove("hide");

  try {
    // 🔥【關鍵修正 1】抓取目前勾選的運送方式，而不是寫死 "store"
    // 邏輯：先找有沒有被勾選的 radio，沒有的話預設 "store"
    const selectedShip = document.querySelector("input[name='shipping']:checked")?.value || "store";
    const promoCode = document.getElementById("promoCode")?.value || "";

    // 🔥【關鍵修正 2】呼叫後端時傳入正確參數
    const preview = await api.previewTotals(items, selectedShip, promoCode);
    const data = preview?.data ?? preview ?? {};
    console.log("🔍 後端回傳的完整資料:", data);

    // 💰 前端修正：加上裝罐費 (如果後端沒算的話)
    // 我們遍歷 items 算出總裝罐費
    let totalPackFee = 0;
    items.forEach(it => {
        if (it.packFee) totalPackFee += it.packFee;
    });

    // 取得後端算出來的茶葉小計
    let finalSubtotal = data.subtotal || 0;
    
    // 如果後端沒算裝罐費 (通常後端只算 price * qty)，我們手動加上
    // 判斷依據：看你的後端邏輯。假設後端還沒改好，我們前端先加。
    // 如果後端已經會算 packFee，這裡就不用加。
    // 這裡假設：後端只回傳原本茶葉價格，我們要自己加 Pack Fee 到 Subtotal 和 Total
    
    finalSubtotal += totalPackFee;
    let finalTotal = (data.total || data.totalAfterDiscount || 0) + totalPackFee;

    // 格式化
    const fmt = n => `NT$ ${Number(n || 0).toLocaleString("zh-TW")}`;

    if($("sub_s")) $("sub_s").textContent = fmt(finalSubtotal);
    if($("disc_s")) $("disc_s").textContent = fmt(data.discount);
    
    const shipVal = data.shipping ?? data.shippingFee ?? 0;
    if($("ship_s")) $("ship_s").textContent = fmt(shipVal);
    
    if($("total_s")) $("total_s").textContent = fmt(finalTotal);
    
    animateMoney();

    // 5. 控制折扣標籤顯示
    const discWrap = $("disc_wrap");
    if (discWrap) discWrap.style.display = data.discount > 0 ? "inline" : "none";

    // 6. 免運進度條邏輯 (保留你原本的完整寫法)
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

    // 7. 免運提示氣泡
    if (freeHint) {
      if (isFree) {
        // 防止文字一直跳動，只有剛顯示或文字為空時才隨機
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
      let packDetails = { small: 0, large: 0 };
      if (data.pack && data.packQty) {
          if (typeof data.packQty === 'number') packDetails.small = data.packQty;
          else packDetails = data.packQty;
      }

      return {
        id: p.id,
        name: p.title || p.name || "",
        qty: data.qty,
        pack: data.pack,
        packDetails: packDetails, // 送給後端的新欄位
        packQty: (packDetails.small || 0) + (packDetails.large || 0) // 保持一個總數給舊後端參考 (可選)
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

  // --- 1. 處理單品茶 (包含裝罐費計算) ---
  const cart = JSON.parse(localStorage.getItem("teaOrderCart") || "{}");
  
  Object.entries(cart).forEach(([id, data]) => {
    const p = CONFIG.PRODUCTS.find(x => x.id == id);
    if (p) {
      // 解析裝罐資料
      let packSmall = 0;
      let packLarge = 0;
      if (data.pack && data.packQty) {
          if (typeof data.packQty === 'number') {
              packSmall = data.packQty;
          } else {
              packSmall = data.packQty.small || 0;
              packLarge = data.packQty.large || 0;
          }
      }

      // 💰 裝罐費計算：不管大小罐，一律 +10 元
      // 但我們這裡不直接改 p.price，而是要把這筆費用算進 item subtotal 或者 create extra fee
      // 為了後端方便，通常有兩種做法：
      // A. 把裝罐費加在單價 (如果後端支援動態單價)
      // B. 傳送 original price，後端根據 packQty * 10 另外算
      // 這裡採用前端計算總價供預覽，後端參數傳遞 details

      // 我們透過 "items" 陣列傳給後端 api.previewTotals
      // 這裡我們需要確認後端怎麼算錢。
      // 假設後端只看 price * qty，那我們需要把裝罐費「灌水」進去嗎？
      // 或者後端會讀取 packQty 欄位自動加錢？
      
      // 👉 為了讓前端 updateTotals 顯示正確，我們這裡計算一個 virtual price
      // 注意：這會影響顯示的 subtotal。
      
      // 但比較好的做法是：把「裝罐服務」當作一個隱性成本，
      // 或是我們手動在這裡算好 total 給 previewTotals 用 (如果 API 支援 override total)
      
      // 在此範例中，我們假設 api.previewTotals 會根據我們傳入的 `packFee` 參數加總
      // 或是我們把 item 拆成兩個：茶葉本體 & 裝罐費 (這樣最準)
      
      // ⚠️ 修正策略：我們將 pack details 完整傳給後端，
      // 並在前端顯示時，自行加上裝罐費。
      
      items.push({
        type: 'regular',
        id: p.id,
        name: p.title,
        price: p.price,
        qty: data.qty,
        pack: data.pack, // bool
        packDetails: { small: packSmall, large: packLarge }, // 傳給後端看
        // 🔥 為了讓前端預覽金額正確，我們把裝罐費加進一個自訂欄位讓 API 處理，或是 API 本來就會算
        // 這裡假設 API 只會算 price*qty。
        // 我們手動在此函式外部 (updateTotals) 補算 pack fee 比較安全
        packFee: (packSmall + packLarge) * 10 
      });
    }
  });
  // --- 2. 處理客製化禮盒 [新增這段] ---
  const giftboxes = JSON.parse(localStorage.getItem("teaGiftBoxCart") || "[]");
  giftboxes.forEach(box => {
    items.push({
      type: 'giftbox',      // 標記為禮盒
      id: box.id,           // 例如 giftbox_1715000000
      name: "客製雙罐禮盒",   // 顯示在購物明細的名稱
      price: box.totalPrice,// 禮盒總價
      qty: box.qty,               // 讀取總數
      details: {            // 把內容物傳給後端備查
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