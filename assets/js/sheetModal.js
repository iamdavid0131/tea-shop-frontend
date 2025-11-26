// ================================
// sheetModal.js
// 購物明細 Bottom Sheet 控制 (最終乾淨版)
// ================================
import { $, toast } from "./dom.js";
import { CONFIG } from "./config.js";
import { api } from "./app.api.js";
import { buildOrderItems, updateTotals } from "./cart.js";
import { openSecretModal } from "./ai-shop.js";
import { removeGiftBox } from "./cart.js";
import { getGiftBox } from "./cart.js";
import { loadGiftBoxForEdit } from "./giftbox_ui.js";
import { openProductModal } from "./products.js";
// 🤫 隱藏商品備份 (UI 顯示用)
const SECRET_PRODUCT_DEF = {
  id: "secret_888",
  title: "👑 傳奇・80年代老凍頂",
  price: 8800,
  tags: "老饕限定",
  desc: "阿興師爺爺留下來的壓箱寶。"
};

// ========================================================
// 顯示購物明細 Sheet (防呆修復版)
// ========================================================
export async function showCartSheet() {
  
  const cart = JSON.parse(localStorage.getItem("teaOrderCart") || "{}");
  if (cart[SECRET_PRODUCT_DEF.id] && !CONFIG.PRODUCTS.find(p => p.id === SECRET_PRODUCT_DEF.id)) {
    CONFIG.PRODUCTS.push(SECRET_PRODUCT_DEF);
  }

  const backdrop = $("cartSheetBackdrop"); // 👈 就是少了這一行！
  const sheet = $("cartSheet");
  const list = $("cartItems");
  const promoCode = ($("promoCode")?.value || "").trim();

  if (!backdrop || !sheet) {
      console.error("找不到 cartSheet 或 cartSheetBackdrop 元素");
      return;
  }

// 🔄 同步箭頭狀態：轉向 (變向下)
  const arrow = document.querySelector("#viewCartBtn .arrow-icon");
  if (arrow) arrow.classList.add("rotated");

  // A. 先設定顯示 (但在畫面外)
  backdrop.style.display = "block";
  // 強制瀏覽器重繪 (Reflow)，確保 display: block 生效後才跑 transition
  void backdrop.offsetWidth; 

  // B. 執行進場動畫
  requestAnimationFrame(() => {
    backdrop.setAttribute("aria-hidden", "false");
    backdrop.style.opacity = "1";
    
    // 🔥 關鍵修正：確保這裡設定滑入位置
    sheet.style.transform = "translateY(0)";
    sheet.dataset.open = "true";
  });

  // 渲染列表邏輯 (維持你原本的代碼不變)
  list.innerHTML = "";
  const items = buildOrderItems();

  if (!items.length) {
    list.innerHTML = `<div class="muted" style="padding:12px; text-align:center;">尚未選購商品</div>`;
    ["cartSub", "cartShip", "cartTotal"].forEach(id => { if($(id)) $(id).textContent = "NT$ 0"; });
    if($("cartDiscRow")) $("cartDiscRow").style.display = "none";
    if($("promoMsg")) $("promoMsg").textContent = "";
    return; 
  }

  items.forEach(i => {
    const row = document.createElement("div");
    row.className = "line-item clickable";
    row.dataset.id = i.id;
    row.dataset.type = i.type || 'regular'; 

    let titleHtml = i.name;
    let qtyStr = `× ${i.qty}`;
    let displayPrice = i.price;
    // 針對禮盒顯示內容物詳情
    if (i.type === 'giftbox') {
        const d = i.details;
        // 禮盒內容顯示邏輯
        const s1Name = d.slot1.title + (d.slot1.qty > 1 ? ` x${d.slot1.qty}` : "");
        const s2Name = d.slot2.title + (d.slot2.qty > 1 ? ` x${d.slot2.qty}` : "");
        
        const detailText = `<span class="muted" style="font-size:12px; display:block; margin-top:2px; color:#888;">
            1. ${s1Name}<br>2. ${s2Name}
        </span>`;
        titleHtml += detailText;
    } else {
        const packStr = i.packQty > 0 ? `（裝罐 ${i.packQty}）` : "";
        const isSecret = i.id === "secret_888";
        titleHtml = isSecret ? `<span style="color:#b8860b; font-weight:800;">🤫 ${i.name}</span>` : i.name;
        qtyStr += ` ${packStr}`;
    }
    const lineTotal = (displayPrice || 0) * (i.qty || 1);

    row.innerHTML = `
        <div class="swipe-content">
          <div class="swipe-info">
              <div class="li-title">${titleHtml}</div>
              <div class="li-qty">${qtyStr}</div>
          </div>
          <div class="li-sub">NT$ ${lineTotal.toLocaleString("zh-TW")}</div>
        </div>
        <button class="swipe-delete" data-id="${i.id}" data-type="${i.type || 'regular'}">刪除</button>
    `;
    list.appendChild(row);
    
    enableSwipeDelete(row);
  });

  // 金額試算
  try {
    if (document.getElementById("total_s")) {
      if($("cartTotal")) $("cartTotal").textContent = $("total_s").textContent;
      if($("cartShip")) $("cartShip").textContent = $("ship_s").textContent;
      if($("cartSub")) $("cartSub").textContent = $("sub_s").textContent;
    }

    const selectedShip = document.querySelector("input[name='shipping']:checked")?.value || "store";
    const preview = await api.previewTotals(items, selectedShip, promoCode);
    const data = preview.data || preview;

    if ($("cartSub")) $("cartSub").textContent = `NT$ ${(data.subtotal || 0).toLocaleString("zh-TW")}`;
    
    const discRow = $("cartDiscRow");
    const discTxt = $("cartDisc");
    if (discRow) {
        const hasDiscount = data.discount > 0;
        discRow.style.display = hasDiscount ? "flex" : "none";
        if (discTxt) discTxt.textContent = hasDiscount ? `- NT$ ${data.discount.toLocaleString("zh-TW")}` : "";
    }
    
    if ($("cartShip")) $("cartShip").textContent = `NT$ ${(data.shipping ?? data.shippingFee ?? 0).toLocaleString("zh-TW")}`;
    if ($("cartTotal")) $("cartTotal").textContent = `NT$ ${(data.total ?? data.totalAfterDiscount ?? 0).toLocaleString("zh-TW")}`;

    if ($("promoMsg")) {
        $("promoMsg").textContent = promoCode && data.discount > 0 ? `🎉 已套用優惠碼：${promoCode}` : promoCode ? "❌ 無效的優惠碼" : "";
        $("promoMsg").style.color = data.discount > 0 ? "#5a7b68" : "#c9544d";
    }

  } catch (err) {
    if ($("promoMsg")) $("promoMsg").textContent = ""; 
  }

  if (!sheet.dataset.listenerAdded) {
      document.addEventListener("click", handleItemClick);
      sheet.dataset.listenerAdded = "true";
  }
}


// 處理列表點擊
function handleItemClick(e) {
  console.log("👆 點擊事件觸發！目標：", e.target);

  const row = e.target.closest(".line-item.clickable");
  if (!row) {
      console.log("❌ 點擊的不是 .line-item.clickable，忽略");
      return;
  }
  
  if (e.target.classList.contains("swipe-delete")) {
      console.log("🗑 點到刪除按鈕，忽略");
      return;
  }

  const sheet = document.getElementById("cartSheet");
  console.log("👀 Sheet 狀態:", sheet ? sheet.dataset.open : "找不到 Sheet");

  if (!sheet || sheet.dataset.open !== "true") return;

  const id = row.dataset.id;
  const type = row.dataset.type || 'regular'; 
  console.log(`📦 偵測到商品 ID: ${id}, 類型: ${type}`);

  // 1. 先關閉 Cart Sheet
  console.log("🚪 嘗試關閉購物車 Sheet...");
  hideCartSheet();

  const DELAY_TIME = 420; 

  // 2. 禮盒判斷
  if (type === 'giftbox') {
      console.log("🎁 是禮盒，準備開啟禮盒編輯");
      // ... (禮盒邏輯省略)
      return;
  }

  // 3. 隱藏商品判斷
  if (id === "secret_888") {
      console.log("🤫 是隱藏商品");
      // ... (隱藏商品邏輯省略)
      return;
  }

  // 4. 一般商品：查找並開啟
  console.log("🔍 開始在 CONFIG.PRODUCTS 尋找商品...");
  const product = CONFIG.PRODUCTS.find(p => p.id == id);
  
  if (product) {
      console.log("✅ 找到商品資料：", product.title);
      console.log(`⏳ 等待 ${DELAY_TIME}ms 後開啟視窗...`);
      
      setTimeout(() => {
          console.log("🚀 呼叫 openProductModal...");
          // 檢查函式是否存在
          if (typeof openProductModal === 'function') {
              openProductModal(product);
              console.log("🎉 openProductModal 已執行");
          } else {
              console.error("❌ 嚴重錯誤：openProductModal 不是一個函式！可能 import 失敗");
          }
      }, DELAY_TIME);
  } else {
      console.warn(`⚠️ 找不到 ID: ${id} 的商品資料！請檢查 config.js`);
      console.log("目前的 CONFIG.PRODUCTS:", CONFIG.PRODUCTS);
      toast("無法讀取商品資料");
  }
}

export function hideCartSheet() {
  const backdrop = $("cartSheetBackdrop");
  const sheet = $("cartSheet");
  
  // 1. 箭頭同步復原
  const arrow = document.querySelector("#viewCartBtn .arrow-icon");
  if (arrow) arrow.classList.remove("rotated");

  // 2. 狀態標記更新
  sheet.dataset.open = "false";

  // 🔥🔥🔥 核心修復開始 🔥🔥🔥
  
  // A. 強制恢復動畫屬性 (防止被拖曳邏輯的 transition: none 干擾)
  sheet.style.transition = "transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)";
  
  // B. 明確告訴瀏覽器：往下移動 100% (滑下去)
  // 這行 inline style 會覆蓋掉開啟時的 translateY(0)
  sheet.style.transform = "translateY(100%)";

  // C. 只有背景淡出 (背景不需要滑動，只需要淡出)
  backdrop.style.opacity = "0";

  // D. 等待動畫跑完 (400ms) 再真的隱藏 DOM
  setTimeout(() => {
    backdrop.setAttribute("aria-hidden", "true");
    backdrop.style.display = "none";
    document.body.classList.remove("modal-open");
    
    // (選用) 動畫結束後，清除所有 inline style，讓下次開啟保持乾淨
    sheet.style.transform = "";
    sheet.style.transition = ""; 
  }, 400); // 這裡的時間要跟上面 transition 的 0.4s 對應
}

// 綁定關閉按鈕
$("closeCartModal")?.addEventListener("click", hideCartSheet);

// 初始化
export function initSheetModal() {
  const sheet = $("cartSheet");
  const backdrop = $("cartSheetBackdrop");
  if (!sheet || !backdrop) return;

  sheet.style.transform = "translateY(100%)"; 
  sheet.style.transition = "transform 0.35s cubic-bezier(0.25, 1, 0.5, 1)";
  backdrop.style.display = "none";

  backdrop.addEventListener("touchmove", (e) => {
    if (e.target === backdrop) e.preventDefault();
  }, { passive: false });
}

// ========================================================
// 3. 切換開關 (Toggle) - 給箭頭按鈕用
// ========================================================
export function toggleCartSheet() {
  const sheet = $("cartSheet");
  const backdrop = $("cartSheetBackdrop");

  // 判斷是否開啟：檢查 dataset.open 或是 display 狀態
  const isOpen = sheet.dataset.open === "true" && backdrop.style.display !== "none";

  if (isOpen) {
    hideCartSheet();
  } else {
    showCartSheet();
  }
}

// ========================================================
// 4. 強制關閉所有視窗並前往結帳
// ========================================================
export function goToCheckout() {
  // A. 關閉購物明細 Sheet
  hideCartSheet();

  // B. 關閉所有 Bootstrap Modal (如果有用 Bootstrap)
  document.querySelectorAll('.modal.show').forEach(modal => {
    // 嘗試點擊關閉按鈕，或直接移除 class
    const closeBtn = modal.querySelector('[data-bs-dismiss="modal"]');
    if(closeBtn) closeBtn.click();
    else modal.classList.remove('show'); 
  });
  
  // C. 關閉任何自定義的 Modal (例如隱藏商品視窗)
  const customModals = document.querySelectorAll('.custom-modal-backdrop'); // 假設你的 class
  customModals.forEach(el => el.style.display = 'none');

  // D. 確保 Body 捲動鎖定被解除
  document.body.classList.remove("modal-open");
  document.body.style.overflow = "";

  // E. 平滑捲動到收件資料區
  const target = document.getElementById("submit-area");
  if (target) {
    // 稍微延遲一點點，確保視窗關閉動畫順暢後再捲動
    setTimeout(() => {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }
}

// ========================================================
// 5. 初始化互動 (請在 main.js 或 app 啟動時呼叫此函式)
// ========================================================
export function initStickyBarInteractions() {
  // 綁定「箭頭按鈕」
  const viewBtn = $("viewCartBtn");
  if (viewBtn) {
    // 移除舊的監聽器 (防呆)
    const newBtn = viewBtn.cloneNode(true);
    viewBtn.parentNode.replaceChild(newBtn, viewBtn);
    
    newBtn.addEventListener("click", (e) => {
      e.stopPropagation(); // 防止冒泡
      toggleCartSheet();
    });
  }

  // 綁定「去買單按鈕」
  const submitBtn = $("submitBtnSticky");
  if (submitBtn) {
    // 移除舊的監聽器
    const newSubmit = submitBtn.cloneNode(true);
    submitBtn.parentNode.replaceChild(newSubmit, submitBtn);

    newSubmit.addEventListener("click", (e) => {
      e.preventDefault();
      goToCheckout();
    });
  }
  
  // 綁定「背景遮罩」點擊關閉 (原本應該有了，再次確保)
  const backdrop = $("cartSheetBackdrop");
  if (backdrop) {
      backdrop.addEventListener("click", hideCartSheet);
  }
}

// ========================================================
// 智慧型手勢控制 (下拉關閉 + 列表滾動 完美共存版)
// ========================================================
export function enableSmartSheetControl() {
  const sheet = $("cartSheet");
  const backdrop = $("cartSheetBackdrop");
  const handle = sheet?.querySelector(".sheet-handle");

  if (!sheet || !backdrop) return;

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) hideCartSheet();
  });

  let startY = 0;
  let currentY = 0;
  let isDragging = false;
  let isAtTop = true;

  sheet.addEventListener("touchstart", (e) => {
    startY = e.touches[0].clientY;
    isDragging = false;
    isAtTop = sheet.scrollTop <= 0; // 檢查是否在頂部
    sheet.style.transition = "none";
  }, { passive: true });

  sheet.addEventListener("touchmove", (e) => {
    const touchY = e.touches[0].clientY;
    const deltaY = touchY - startY;
    const isHandle = e.target === handle || e.target.closest('.sheet-handle');

    // 只有在頂部且往下拉時，才攔截
    if (isHandle || (isAtTop && deltaY > 0)) {
        if (e.cancelable) e.preventDefault();
        isDragging = true;
        currentY = touchY;
        const translateY = deltaY * 0.7; // 阻尼感
        sheet.style.transform = `translateY(${translateY}px)`;
        backdrop.style.opacity = Math.max(0, 1 - translateY / 500);
    }
  }, { passive: false });

  sheet.addEventListener("touchend", () => {
    sheet.style.transition = "transform 0.35s cubic-bezier(0.25, 1, 0.5, 1)";
    backdrop.style.transition = "opacity 0.35s ease";

    if (isDragging) {
      const deltaY = currentY - startY;
      if (deltaY > 120) { // 拉超過 120px 關閉
        sheet.style.transform = "translateY(100%)";
        backdrop.style.opacity = "0";
        setTimeout(() => hideCartSheet(), 300);
      } else { // 回彈
        sheet.style.transform = "translateY(0)";
        backdrop.style.opacity = "1";
      }
    }
    isDragging = false;
  });
}

// 滑動刪除功能
function enableSwipeDelete(row) {
  const content = row.querySelector(".swipe-content");
  const deleteBtn = row.querySelector(".swipe-delete");
  let startX = 0;

  if (typeof Hammer === 'undefined') return; // 防呆

  const hammer = new Hammer(row);
  hammer.get("pan").set({ direction: Hammer.DIRECTION_HORIZONTAL, touchAction: 'pan-y' });

  hammer.on("panstart", () => {
    const currentTransform = content.style.transform;
    const isOpen = currentTransform.includes("-90px");
    startX = isOpen ? -90 : 0;
  });

  hammer.on("panmove", (e) => {
    let x = startX + e.deltaX;
    if (x < -90) x = -90; 
    if (x > 0) x = 0;     
    content.style.transform = `translateX(${x}px)`;
    deleteBtn.style.transform = `translateX(${x + 90}px)`;
  });

  hammer.on("panend", (e) => {
    const shouldOpen = e.deltaX < -40;
    const x = shouldOpen ? -90 : 0;
    content.style.transform = `translateX(${x}px)`;
    deleteBtn.style.transform = `translateX(${x + 90}px)`;
  });

  deleteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const id = deleteBtn.dataset.id;
    const type = deleteBtn.dataset.type;

    if (type === 'giftbox') {
        removeGiftBox(id);
    } else {
        const cart = JSON.parse(localStorage.getItem("teaOrderCart") || "{}");
        delete cart[id];
        localStorage.setItem("teaOrderCart", JSON.stringify(cart));
        
        const qtyEl = document.getElementById(`qty-${id}`);
        if(qtyEl) {
             if ("value" in qtyEl) qtyEl.value = 0;
             else qtyEl.textContent = 0;
        }
    }

    row.style.transition = "height .25s ease, opacity .25s ease";
    row.style.height = row.offsetHeight + "px";
    requestAnimationFrame(() => {
        row.style.opacity = "0";
        row.style.height = "0px";
    });

    setTimeout(async () => {
        row.remove();
        await updateTotals();
        
        const items = buildOrderItems();
        if (items.length === 0) {
            showCartSheet();
        } else {
             const promoCode = ($("promoCode")?.value || "").trim();
             const selectedShip = document.querySelector("input[name='shipping']:checked")?.value || "store";
             const preview = await api.previewTotals(items, selectedShip, promoCode);
             const data = preview.data || preview;
             
             if($("cartTotal")) $("cartTotal").textContent = `NT$ ${(data.total || 0).toLocaleString("zh-TW")}`;
             if($("cartSub")) $("cartSub").textContent = `NT$ ${(data.subtotal || 0).toLocaleString("zh-TW")}`;
        }
    }, 250);
  });
}