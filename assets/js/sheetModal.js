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

    // 🟢 UX 優化 1：開啟購物車前，先強制關閉商品詳細 Modal (teaModal)
  const productModal = document.getElementById("teaModal");
  if (productModal && productModal.classList.contains("show")) {
      productModal.classList.remove("show");
      productModal.setAttribute("aria-hidden", "true");
      // 注意：這裡不清除 body 的 overflow，因為購物車打開後還是需要鎖定背景
  }
  
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
  sheet.dataset.open = "true";

  // 🎨 2. 動畫準備 (關鍵修復步驟)
  // 強制設定好 transition，防止被之前的 cleanup 移除
  sheet.style.transition = "transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)";
  
  // 先把 Sheet 放到下面 (起始點)，並顯示背景
  sheet.style.transform = "translateY(100%)";
  backdrop.style.display = "flex";
  document.body.classList.add("modal-open");
  document.body.style.overflow = "hidden"; // 強制鎖定
  
  // 強制瀏覽器 Reflow (讀取一次 offsetWidth)，讓瀏覽器意識到 "它現在在下面"
  void backdrop.offsetWidth; 

  // 🚀 3. 執行進場動畫
  requestAnimationFrame(() => {
    backdrop.setAttribute("aria-hidden", "false");
    backdrop.style.opacity = "1";
    sheet.style.transform = "translateY(0)"; // 滑上來
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
    // 🕵️‍♂️ Debug (保留以便除錯)
    console.log(`[Debug] 商品: ${i.name}, 數量: ${i.qty}, 裝罐總數: ${i.packQty}`);

    const row = document.createElement("div");
    row.className = "line-item clickable";
    row.dataset.id = i.id;
    row.dataset.type = i.type || 'regular'; 

    let titleHtml = i.name;
    let qtyStr = `× ${i.qty}`;
    
    // 🔥🔥🔥 修正重點 1：金額計算邏輯 🔥🔥🔥
    const PACK_PRICE = 10; 
    const packQtyNum = Number(i.packQty) || 0; 
    const totalPackCost = packQtyNum * PACK_PRICE; // 這是「總」裝罐費
    
    // 錯誤寫法 (舊的): const lineTotal = (i.price + totalPackCost) * i.qty;
    // ✅ 正確寫法: 商品總價 + 裝罐總價
    const lineTotal = ((i.price || 0) * (i.qty || 1)) + totalPackCost;

    // 顯示邏輯
    if (i.type === 'giftbox') {
        const d = i.details;
        const s1Name = d.slot1.title + (d.slot1.qty > 1 ? ` x${d.slot1.qty}` : "");
        const s2Name = d.slot2.title + (d.slot2.qty > 1 ? ` x${d.slot2.qty}` : "");
        titleHtml += `<span class="muted" style="font-size:12px; display:block; margin-top:4px; color:#888;">1. ${s1Name}<br>2. ${s2Name}</span>`;
    } else {
        const isSecret = i.id === "secret_888";
        if (isSecret) {
            titleHtml = `<span style="color:#b8860b; font-weight:800;">🤫 ${i.name}</span>`;
        }
        
        // 裝罐文字顯示
        if (packQtyNum > 0) {
            qtyStr += ` <span style="font-size:13px; color:#858585; margin-left: 4px;">(裝罐x${packQtyNum} +NT$${totalPackCost})</span>`;
        }
    }

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
  // 1. 抓取點擊的行
  const row = e.target.closest(".line-item.clickable");
  
  // 防呆：沒點到行、或是點到刪除按鈕 -> 不處理
  if (!row || e.target.classList.contains("swipe-delete")) return;

  // 🔥 修正重點：不再檢查 sheet.dataset.open
  // 原因：只要使用者點得到這個元素，代表它一定是顯示的。
  // 我們不需要依賴 dataset.open 這個變數來證明它存在。
  
  const id = row.dataset.id;
  const type = row.dataset.type || 'regular'; 

  console.log(`🚀 點擊確認！準備開啟商品 ID: ${id}`);

  // 🚪 2. 先關閉購物明細
  hideCartSheet();

  const DELAY_TIME = 420; 

  // 🟢 3. 禮盒處理
  if (type === 'giftbox') {
      const boxData = getGiftBox(id);
      if (boxData) {
          setTimeout(() => { loadGiftBoxForEdit(boxData); }, DELAY_TIME);
      }
      return;
  }

  // 🤫 4. 隱藏商品
  if (id === "secret_888") {
    setTimeout(() => { openSecretModal(SECRET_PRODUCT_DEF); }, DELAY_TIME);
    return;
  }

  // 🍵 5. 一般商品
  const product = CONFIG.PRODUCTS.find(p => p.id == id);
  
  if (product) {
      setTimeout(() => {
          console.log("⚡️ 嘗試呼叫 openProductModal...");
          
          // 檢查函式有沒有被 import 進來
          if (typeof openProductModal === 'function') {
              openProductModal(product);
          } else {
              console.error("❌ 嚴重錯誤：openProductModal 未定義！請確認檔案最上方有 import");
              // 備用方案：如果真的 import 失敗，死馬當活馬醫，試試看舊方法
              const card = document.querySelector(`.tea-card[data-id="${id}"]`);
              if(card) card.click();
          }
      }, DELAY_TIME);
  } else {
      console.warn(`⚠️ 找不到 ID: ${id} 的商品資料`);
      toast("無法讀取商品資料");
  }
}

export function hideCartSheet() {
  const backdrop = $("cartSheetBackdrop");
  const sheet = $("cartSheet");
  
  if (!sheet || !backdrop) return;

  // 1. 箭頭同步復原
  const arrow = document.querySelector("#viewCartBtn .arrow-icon");
  if (arrow) arrow.classList.remove("rotated");

  // 2. 狀態標記更新
  sheet.dataset.open = "false";

  // 強制瀏覽器 Reflow，確保動畫順暢
  void sheet.offsetWidth; 

  requestAnimationFrame(() => {
      // 確保 Transition 存在
      sheet.style.transition = "transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)";
      backdrop.style.transition = "opacity 0.4s ease";
      
      // 設定目標位置 (滑下去)
      sheet.style.transform = "translateY(100%)";
      // 背景淡出
      backdrop.style.opacity = "0";
  });

  // 3. 等待動畫結束後才隱藏 DOM 並解鎖 Body
  setTimeout(() => {
    // 只有當確實是關閉狀態時才執行 (防止使用者快速開關導致錯亂)
    if (sheet.dataset.open === "false") {
        backdrop.setAttribute("aria-hidden", "true");
        backdrop.style.display = "none";
        
        // 🔥🔥🔥 修正重點在此 🔥🔥🔥
        // 1. 移除 Bootstrap 或其他庫加上的 class
        document.body.classList.remove("modal-open");
        
        // 2. 強制清空 overflow 樣式 (這是導致卡死的主因)
        document.body.style.overflow = ""; 
        document.body.style.paddingRight = ""; // 清除可能因 scrollbar 加上的 padding
    }
  }, 400); // 時間對應 transition 的 0.4s
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
  sheet.dataset.open = "false"; 

  backdrop.addEventListener("touchmove", (e) => {
    if (e.target === backdrop) e.preventDefault();
  }, { passive: false });
}

// ========================================================
// 3. 切換開關 (Toggle) - 給箭頭按鈕用
// ========================================================
export function toggleCartSheet() {
  const sheet = $("cartSheet");
  if (!sheet) return;

  const isOpen = sheet.dataset.open === "true";

  console.log(`點擊切換 | 目前狀態: ${isOpen ? "開啟中 (準備關閉)" : "關閉中 (準備開啟)"}`);

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
  // 1. 關閉購物明細 Sheet
  hideCartSheet();

  // 2. 關閉商品單品 Modal (teaModal)
  const productModal = document.getElementById("teaModal");
  if (productModal) {
      productModal.classList.remove("show");
      productModal.setAttribute("aria-hidden", "true");
  }
  
  // 3. 關閉禮盒選擇器 (selector-modal) - 如果有的話
  const selectorModal = document.getElementById("selector-modal");
  if (selectorModal) selectorModal.style.display = 'none';

  // 4. 關閉其他 Bootstrap Modals (防呆)
  document.querySelectorAll('.modal.show').forEach(modal => {
    modal.classList.remove('show'); 
  });
  
  // 5. 解除背景鎖定
  document.body.classList.remove("modal-open");
  document.body.style.overflow = "";

  // 6. 🚀 精準捲動邏輯
  setTimeout(() => {
      // 策略：直接抓「電話輸入框」，因為它在收件資料的第一欄，絕對不會跑錯
      const phoneInput = document.getElementById("phone");

      if (phoneInput) {
          // 抓取整個「收件資料區塊」(.section)
          const targetSection = phoneInput.closest('.section');
          
          if (targetSection) {
              // 計算位置：扣除 Header 高度 (假設 iOS Header 約 100px) + 一點留白
              const headerOffset = 110; 
              const elementPosition = targetSection.getBoundingClientRect().top;
              const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

              window.scrollTo({
                  top: offsetPosition,
                  behavior: "smooth"
              });

              // (選用) 體驗加分：直接幫使用者聚焦在電話欄位，方便輸入
              setTimeout(() => phoneInput.focus({preventScroll: true}), 600);
          }
      } else {
          // 備案：如果真的找不到電話欄，就滾到 #paymentCard 的上方
          const fallback = document.getElementById("paymentCard");
          if(fallback) fallback.scrollIntoView({ behavior: 'smooth' });
      }
  }, 350); // 等待視窗關閉動畫結束
}

// ========================================================
// 5. 初始化互動 (請在 main.js 或 app 啟動時呼叫此函式)
// ========================================================
export function initStickyBarInteractions() {
  const viewBtn = $("viewCartBtn");
  
  if (viewBtn) {
    // 移除舊的監聽器 (透過複製節點大法)
    const newBtn = viewBtn.cloneNode(true);
    viewBtn.parentNode.replaceChild(newBtn, viewBtn);
    
    // 綁定新的點擊事件
    newBtn.addEventListener("click", (e) => {
      e.stopPropagation(); // 防止事件穿透到後面
      e.preventDefault();  // 防止按鈕預設行為
      toggleCartSheet();
    });
  }

  // 綁定「去買單按鈕」
  const submitBtn = $("submitBtnSticky");
  if (submitBtn) {
    const newSubmit = submitBtn.cloneNode(true);
    submitBtn.parentNode.replaceChild(newSubmit, submitBtn);

    newSubmit.addEventListener("click", (e) => {
      e.preventDefault();
      goToCheckout();
    });
  }
  
  // 綁定「背景遮罩」點擊關閉
  const backdrop = $("cartSheetBackdrop");
  if (backdrop) {
      // 移除舊的 (防呆)
      const newBackdrop = backdrop.cloneNode(true);
      backdrop.parentNode.replaceChild(newBackdrop, backdrop);
      
      newBackdrop.addEventListener("click", (e) => {
          // 只有點擊遮罩本身才關閉 (防止點到底下的 Sheet 也關掉)
          if (e.target === newBackdrop) {
              hideCartSheet();
          }
      });
      // 手機滑動防護
      newBackdrop.addEventListener("touchmove", (e) => {
        if (e.target === newBackdrop) e.preventDefault();
      }, { passive: false });
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