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
  // 1. Config 檢查
  const cart = JSON.parse(localStorage.getItem("teaOrderCart") || "{}");
  if (cart[SECRET_PRODUCT_DEF.id] && !CONFIG.PRODUCTS.find(p => p.id === SECRET_PRODUCT_DEF.id)) {
    CONFIG.PRODUCTS.push(SECRET_PRODUCT_DEF);
  }

  const backdrop = $("cartSheetBackdrop");
  const sheet = $("cartSheet");
  const list = $("cartItems");
  const promoCode = ($("promoCode")?.value || "").trim();

  // 開啟動畫
  backdrop.style.opacity = "0";
  backdrop.style.display = "block";
  requestAnimationFrame(() => {
    backdrop.setAttribute("aria-hidden", "false");
    backdrop.style.opacity = "1";
    sheet.style.transform = "translateY(0)";
    sheet.dataset.open = "true";
  });

  // 2. 渲染列表
  list.innerHTML = "";
  const items = buildOrderItems();

  if (!items.length) {
    list.innerHTML = `<div class="muted" style="padding:12px; text-align:center;">尚未選購商品</div>`;
    // 安全清空金額
    const els = ["cartSub", "cartShip", "cartTotal"];
    els.forEach(id => { if($(id)) $(id).textContent = "NT$ 0"; });
    if($("cartDiscRow")) $("cartDiscRow").style.display = "none";
    if($("promoMsg")) $("promoMsg").textContent = "";
    return; 
  }

  items.forEach(i => {
    const row = document.createElement("div");
    row.className = "line-item clickable";
    row.dataset.id = i.id;
    // 區分是一般商品還是禮盒
    row.dataset.type = i.type || 'regular'; 

    let titleHtml = i.name;
    let qtyStr = `× ${i.qty}`;
    
    // 針對禮盒顯示內容物詳情
    if (i.type === 'giftbox') {
        const d = i.details;
        // 顯示：第一罐 + 第二罐
        const detailText = `<span class="muted" style="font-size:12px; display:block; margin-top:2px;">
            1. ${d.slot1.title}<br>2. ${d.slot2.title}
        </span>`;
        titleHtml += detailText;
    } else {
        // 一般商品邏輯
        const packStr = i.packQty > 0 ? `（裝罐 ${i.packQty}）` : "";
        const isSecret = i.id === "secret_888";
        titleHtml = isSecret ? `<span style="color:#b8860b; font-weight:800;">🤫 ${i.name}</span>` : i.name;
        qtyStr += ` ${packStr}`;
    }

    row.innerHTML = `
        <div class="swipe-content">
          <div class="swipe-info">
              <div class="li-title">${titleHtml}</div>
              <div class="li-qty">${qtyStr}</div>
          </div>
          <div class="li-sub">NT$ ${(i.price * i.qty).toLocaleString("zh-TW")}</div>
        </div>
        <button class="swipe-delete" data-id="${i.id}" data-type="${i.type || 'regular'}">刪除</button>
    `;
    list.appendChild(row);
    
    // 只有一般商品能點進去修改，禮盒點了沒反應（或者你可以做成點了跳回去禮盒選單）
    if (i.type !== 'giftbox') {
        // row.addEventListener... (原本的綁定是綁在整個 sheet 上的 handleItemClick)
    }
    
    enableSwipeDelete(row);
  });

  // 3. 金額試算 (加上嚴格防呆)
  try {
    // 預填
    if (document.getElementById("total_s")) {
      if($("cartTotal")) $("cartTotal").textContent = $("total_s").textContent;
      if($("cartShip")) $("cartShip").textContent = $("ship_s").textContent;
      if($("cartSub")) $("cartSub").textContent = $("sub_s").textContent;
    }

    // 抓取運送方式
    const selectedShip = document.querySelector("input[name='shipping']:checked")?.value || "store";
    
    // Call API
    const preview = await api.previewTotals(items, selectedShip, promoCode);
    const data = preview.data || preview;

    // 🔥 安全更新 DOM (檢查元素存在才更新)
    if ($("cartSub")) {
        $("cartSub").textContent = `NT$ ${(data.subtotal || 0).toLocaleString("zh-TW")}`;
    }
    
    // 折扣列 (最容易報錯的地方)
    const discRow = $("cartDiscRow");
    const discTxt = $("cartDisc");
    if (discRow) {
        const hasDiscount = data.discount > 0;
        discRow.style.display = hasDiscount ? "flex" : "none";
        if (discTxt) {
            discTxt.textContent = hasDiscount ? `- NT$ ${data.discount.toLocaleString("zh-TW")}` : "";
        }
    }
    
    // 運費
    if ($("cartShip")) {
        const shipFee = data.shipping ?? data.shippingFee ?? 0;
        $("cartShip").textContent = `NT$ ${shipFee.toLocaleString("zh-TW")}`;
    }

    // 總金額
    if ($("cartTotal")) {
        const total = data.total ?? data.totalAfterDiscount ?? 0;
        $("cartTotal").textContent = `NT$ ${total.toLocaleString("zh-TW")}`;
    }

    // 優惠碼訊息
    if ($("promoMsg")) {
        $("promoMsg").textContent =
          promoCode && data.discount > 0 ? `🎉 已套用優惠碼：${promoCode}` : 
          promoCode ? "❌ 無效的優惠碼" : "";
        
        // 成功時字體改綠色，失敗改紅色 (選用)
        $("promoMsg").style.color = data.discount > 0 ? "#5a7b68" : "#c9544d";
    }

  } catch (err) {
    console.error("明細更新錯誤 (請查看詳細 Log):", err);
    // 只有在真的出錯時才顯示，但因為上面加了防呆，這裡應該不會再觸發了
    if ($("promoMsg")) $("promoMsg").textContent = ""; 
  }

  // 綁定點擊
  if (!sheet.dataset.listenerAdded) {
      document.addEventListener("click", handleItemClick);
      sheet.dataset.listenerAdded = "true";
  }
}

// 處理列表點擊
function handleItemClick(e) {
  const row = e.target.closest(".line-item.clickable");
  // 如果點到刪除按鈕，不觸發
  if (!row || e.target.classList.contains("swipe-delete")) return;

  const sheet = $("cartSheet");
  if (!sheet || sheet.dataset.open !== "true") return;

  const id = row.dataset.id;

  // 🚪 先關閉購物明細 (讓畫面乾淨)
  hideCartSheet();

  // 🟢 處理禮盒點擊
  if (type === 'giftbox') {
      const boxData = getGiftBox(id); // 從 cart.js 拿資料
      if (boxData) {
          loadGiftBoxForEdit(boxData); // 呼叫 giftbox_ui.js 的編輯功能
      } else {
          toast("讀取禮盒資料失敗");
      }
      return;
  }

  // 🕵️ 針對隱藏商品的特殊處理
  if (id === "secret_888") {
    // 🔥 修改這裡：不再 Alert，而是直接打開尊爵金 Modal
    // 我們直接傳入 SECRET_PRODUCT_DEF，因為隱藏商品只有這一款
    openSecretModal(SECRET_PRODUCT_DEF);
    return;
  }

  // 一般商品：開啟該商品 Modal
  const productCard = document.querySelector(`.tea-card[data-id="${id}"]`);
  if (productCard) {
      // 稍微延遲一點點，讓 sheet 關閉動畫順暢後再開商品
      setTimeout(() => productCard.click(), 150);
  }
}

export function hideCartSheet() {
  const backdrop = $("cartSheetBackdrop");
  const sheet = $("cartSheet");
  sheet.dataset.open = "false";

  setTimeout(() => {
    backdrop.setAttribute("aria-hidden", "true");
    backdrop.style.display = "none";
    document.body.classList.remove("modal-open");
  }, 400);
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

  // 鎖定背景捲動 (但不鎖 Sheet 內部)
  backdrop.addEventListener("touchmove", (e) => {
    if (e.target === backdrop) e.preventDefault();
  }, { passive: false });
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

  const hammer = new Hammer(row);
  hammer.get("pan").set({ direction: Hammer.DIRECTION_HORIZONTAL, touchAction: 'pan-y' });

  // ... (panstart, panmove, panend 的邏輯完全不用改，保留原樣) ...
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

  // 🗑️ 點擊刪除按鈕
  deleteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const id = deleteBtn.dataset.id;
    const type = deleteBtn.dataset.type; // 抓我們剛剛加的 data-type

    // 🟢 分流處理刪除
    if (type === 'giftbox') {
        // 刪除禮盒
        removeGiftBox(id); // 呼叫 cart.js 的函式
    } else {
        // 刪除一般商品 (原本的邏輯)
        const cart = JSON.parse(localStorage.getItem("teaOrderCart") || "{}");
        delete cart[id];
        localStorage.setItem("teaOrderCart", JSON.stringify(cart));
        
        // 也要記得把首頁 UI 的數字歸零
        const qtyEl = document.getElementById(`qty-${id}`);
        if(qtyEl) {
             if ("value" in qtyEl) qtyEl.value = 0;
             else qtyEl.textContent = 0;
        }
    }

    // 刪除動畫
    row.style.transition = "height .25s ease, opacity .25s ease";
    row.style.height = row.offsetHeight + "px";
    requestAnimationFrame(() => {
        row.style.opacity = "0";
        row.style.height = "0px";
    });

    setTimeout(async () => { // 這裡加 async
        row.remove();
        
        // 🔥 關鍵修正：確保金額即時更新
        // 因為 removeGiftBox 裡面已經呼叫 updateTotals() 了，
        // 但我們這裡為了保險起見（並且為了更新 Sheet 上面的數字），我們手動再呼叫一次 API
        await updateTotals(); // 更新底部 Sticky Bar
        
        // 重新渲染 Sheet 上面的金額 (因為 updateTotals 只更新 StickyBar)
        // 這裡我們偷懶一點，直接用我們剛剛寫好的邏輯再算一次
        const items = buildOrderItems();
        if (items.length === 0) {
            showCartSheet(); // 顯示「尚未選購」
        } else {
             // 這裡如果不重新呼叫 API，Sheet 上的金額不會變
             // 所以簡單的方法是：重新呼叫一次 showCartSheet()，或者把 updateTotals 的結果拿來用
             // 為了效能，我們這裡手動觸發一下重新渲染
             const promoCode = ($("promoCode")?.value || "").trim();
             const selectedShip = document.querySelector("input[name='shipping']:checked")?.value || "store";
             const preview = await api.previewTotals(items, selectedShip, promoCode);
             const data = preview.data || preview;
             
             if($("cartTotal")) $("cartTotal").textContent = `NT$ ${(data.total || 0).toLocaleString("zh-TW")}`;
             if($("cartSub")) $("cartSub").textContent = `NT$ ${(data.subtotal || 0).toLocaleString("zh-TW")}`;
             // ... 其他金額更新 ...
        }
        
    }, 250);
  });
}