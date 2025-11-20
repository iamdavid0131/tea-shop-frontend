// ================================
// sheetModal.js
// 購物明細 Bottom Sheet 控制
// ================================
import { $, toast } from "./dom.js";
import { CONFIG } from "./config.js";
import { api } from "./app.api.js";
import { buildOrderItems, updateTotals, refreshSheetTotals } from "./cart.js";

// 🤫 定義隱藏商品備份 (防止 F5 重新整理後 CONFIG 被重置導致找不到商品)
// 必須跟 aiTea.js 裡的定義一致
const SECRET_PRODUCT_DEF = {
  id: "secret_888",
  title: "👑 傳奇・80年代老凍頂",
  price: 8800,
  tags: "老饕限定",
  desc: "阿興師爺爺留下來的壓箱寶。"
};

// ========================================================
// 顯示購物明細 Sheet
// ========================================================
export async function showCartSheet() {
  // 🛠️ FIX: 在顯示前，檢查 CONFIG 是否遺失了隱藏商品？如果有，補回去
  const cart = JSON.parse(localStorage.getItem("teaOrderCart") || "{}");
  if (cart[SECRET_PRODUCT_DEF.id] && !CONFIG.PRODUCTS.find(p => p.id === SECRET_PRODUCT_DEF.id)) {
    CONFIG.PRODUCTS.push(SECRET_PRODUCT_DEF);
    console.log("♻️ sheetModal: 已自動補回隱藏商品定義");
  }

  const backdrop = $("cartSheetBackdrop");
  const sheet = $("cartSheet");
  const list = $("cartItems");
  const promoCode = ($("promoCode")?.value || "").trim();

  backdrop.style.opacity = "0";
  backdrop.style.display = "block";

  requestAnimationFrame(() => {
    backdrop.setAttribute("aria-hidden", "false");
    backdrop.style.opacity = "1";
    sheet.style.transform = "translateY(0)";
    sheet.dataset.open = "true";
  });

  list.innerHTML = "";

  const items = buildOrderItems();
  console.log("🧪 sheetModal items =", items);

  if (!items.length) {
    list.innerHTML = `<div class="muted" style="padding:12px;">尚未選購商品</div>`;
    $("cartSub").textContent = "NT$ 0";
    $("cartDiscRow").style.display = "none";
    $("cartDisc").textContent = "";
    $("cartShip").textContent = "NT$ 0";
    $("cartTotal").textContent = "NT$ 0";
    $("promoMsg").textContent = "";
    return; 
  }

  // 有商品才畫明細
  items.forEach(i => {
    const row = document.createElement("div");

    row.className = "line-item clickable";
    row.dataset.id = i.id;

    const packStr = i.packQty > 0 ? `（裝罐 ${i.packQty}）` : "";

    // ✨ 針對隱藏商品加一點特殊標記 (金色字體)
    const isSecret = i.id === "secret_888";
    const titleHtml = isSecret ? `<span style="color:#b8860b">🤫 ${i.name}</span>` : i.name;

    row.innerHTML = `
        <div class="swipe-content">
        <div class="swipe-info">
            <div class="li-title">${titleHtml}</div>
            <div class="li-qty">× ${i.qty} ${packStr}</div>
        </div>
            <div class="li-sub">NT$ ${(i.price * i.qty).toLocaleString("zh-TW")}</div>
        </div>
        <button class="swipe-delete" data-id="${i.id}">刪除</button>
        `;
    list.appendChild(row);
    enableSwipeDelete(row);
  });

  try {
    const preview = await api.previewTotals(items, "store", promoCode);
    const data = preview.data || preview;

    $("cartSub").textContent = `NT$ ${(data.subtotal || 0).toLocaleString("zh-TW")}`;
    $("cartDiscRow").style.display = data.discount > 0 ? "flex" : "none";
    $("cartDisc").textContent =
      data.discount > 0 ? `- NT$ ${data.discount.toLocaleString("zh-TW")}` : "";
    $("cartShip").textContent = `NT$ ${(data.shippingFee || data.shipping || 0).toLocaleString("zh-TW")}`;
    $("cartTotal").textContent = `NT$ ${(data.total || data.totalAfterDiscount || 0).toLocaleString("zh-TW")}`;

    $("promoMsg").textContent =
      promoCode && data.discount > 0
        ? `🎉 已套用優惠碼：${promoCode}`
        : promoCode
        ? "❌ 無效的優惠碼"
        : "";

  } catch (err) {
    console.error("查看明細試算錯誤:", err);
    $("promoMsg").textContent = "⚠️ 無法取得折扣資料";
  }

  // 🛑 防止重複綁定 click 事件 (你的原始碼直接放在 showCartSheet 裡，每次打開都會重複綁定)
  // 建議改為在 initSheetModal 綁定一次，或者用具名函數移除。
  // 這裡我做個簡單的 Flag 保護
  if (!sheet.dataset.listenerAdded) {
      document.addEventListener("click", handleItemClick);
      sheet.dataset.listenerAdded = "true";
  }
}

// 🛠️ 獨立出來的點擊處理函式
function handleItemClick(e) {
  const row = e.target.closest(".line-item.clickable");
  // 如果點到刪除按鈕，不觸發
  if (!row || e.target.classList.contains("swipe-delete")) return;

  // 只有當 sheet 開啟時才作用
  const sheet = $("cartSheet");
  if (!sheet || sheet.dataset.open !== "true") return;

  const id = row.dataset.id;

  // 🕵️ 針對隱藏商品的特殊處理
  if (id === "secret_888") {
    alert("🤫 這是阿興師的私房茶，請透過 AI 聊天室調整數量喔！");
    return;
  }

  // 關閉 sheet
  hideCartSheet();

  // 開啟該商品 modal
  const productCard = document.querySelector(`.tea-card[data-id="${id}"]`);
  if (productCard) productCard.click();
}

// ========================================================
// 關閉購物明細 Sheet
// ========================================================
export function hideCartSheet() {
  const backdrop = $("cartSheetBackdrop");
  const sheet = $("cartSheet");
  sheet.dataset.open = "false";

  setTimeout(() => {
    backdrop.setAttribute("aria-hidden", "true");
    backdrop.style.display = "none";
    document.body.classList.remove("modal-open");
  }, 400);

  // 移除一次性監聽器，避免重複堆疊 (這裡不需移除 document click，因為上面加了 flag 保護)
}

// ... (enableSmartSheetControl, initSheetModal 維持原樣，不需要動) ...
// ========================================================
// 智慧型手勢控制 (下拉關閉 + 列表滾動 完美共存版)
// ========================================================
export function enableSmartSheetControl() {
  const sheet = $("cartSheet");
  const backdrop = $("cartSheetBackdrop");
  const handle = sheet?.querySelector(".sheet-handle"); // 抓取拉桿(如果有的話)

  if (!sheet || !backdrop) return;

  // ✅ 1. 點擊背景關閉 (這部分不變)
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) hideCartSheet();
  });

  // --- 👇 手勢核心邏輯開始 👇 ---

  let startY = 0;
  let currentY = 0;
  let isDragging = false;
  let isAtTop = true; // 標記是否在頂部

  // A. 手指按下
  sheet.addEventListener("touchstart", (e) => {
    startY = e.touches[0].clientY;
    isDragging = false;
    
    // 關鍵判斷：檢查目前捲軸是否在最頂端
    // scrollTop <= 0 代表在頂部 (有的瀏覽器會有彈性效果變成負的，所以用 <=)
    isAtTop = sheet.scrollTop <= 0;

    // 移除過渡動畫，讓拖曳跟手沒有延遲
    sheet.style.transition = "none";
  }, { passive: true });

  // B. 手指移動 (最關鍵的地方)
  sheet.addEventListener("touchmove", (e) => {
    const touchY = e.touches[0].clientY;
    const deltaY = touchY - startY;

    // 情況 1: 如果手指按在「拉桿 (handle)」上，無條件允許拖曳
    const isHandle = e.target === handle || e.target.closest('.sheet-handle');

    // 情況 2: 在頂端 + 往下拉 (deltaY > 0)
    if (isHandle || (isAtTop && deltaY > 0)) {
        // 🚫 阻止瀏覽器原生捲動 (這行最重要，不然會變成重新整理網頁)
        if (e.cancelable) e.preventDefault();
        
        isDragging = true;
        currentY = touchY;

        // 阻尼效果：讓拉動感覺有點重量 (乘 0.7)
        const translateY = deltaY * 0.7;
        
        sheet.style.transform = `translateY(${translateY}px)`;
        
        // 背景漸漸變透明
        const opacity = Math.max(0, 1 - translateY / 500);
        backdrop.style.opacity = opacity;
    }
    // 其他情況 (往上滑、或是還沒到頂端)：
    // 什麼都不做，讓瀏覽器處理原生捲動 (Native Scroll)
  }, { passive: false }); // ⚠️ 這裡必須是 false 才能呼叫 preventDefault

  // C. 手指放開
  sheet.addEventListener("touchend", () => {
    // 恢復動畫曲線
    sheet.style.transition = "transform 0.35s cubic-bezier(0.25, 1, 0.5, 1)";
    backdrop.style.transition = "opacity 0.35s ease";

    if (isDragging) {
      const deltaY = currentY - startY;
      const CLOSE_THRESHOLD = 120; // 拉超過 120px 就關閉

      if (deltaY > CLOSE_THRESHOLD) {
        // 🚪 關閉
        sheet.style.transform = "translateY(100%)";
        backdrop.style.opacity = "0";
        setTimeout(() => hideCartSheet(), 300);
      } else {
        // ↩️ 回彈 (沒拉過門檻)
        sheet.style.transform = "translateY(0)";
        backdrop.style.opacity = "1";
      }
    }
    
    // 重置狀態
    isDragging = false;
  });
}


// 在 sheetModal.js 的 initSheetModal 函式
export function initSheetModal() {
  const sheet = $("cartSheet");
  const backdrop = $("cartSheetBackdrop");

  if (!sheet || !backdrop) return;

  sheet.style.transform = "translateY(100%)"; 
  sheet.style.transition = "transform 0.35s cubic-bezier(0.25, 1, 0.5, 1)";
  backdrop.style.display = "none";

  // ✅ 在這裡綁定一次就好，防止這行代碼重複執行導致滑動鎖死
  // 只有當點擊 backdrop 本身時，阻止滑動 (防止穿透)，但不要阻止 sheet 內部滑動
  backdrop.addEventListener("touchmove", (e) => {
    if (e.target === backdrop) {
        e.preventDefault();
    }
  }, { passive: false });
}

function enableSwipeDelete(row) {
  const content = row.querySelector(".swipe-content");
  const deleteBtn = row.querySelector(".swipe-delete");

  let open = false;
  let startX = 0;

  const hammer = new Hammer(row);
  hammer.get("pan").set({ 
    direction: Hammer.DIRECTION_HORIZONTAL, 
    touchAction: 'pan-y' 
  });

  hammer.on("panstart", () => {
    startX = open ? -90 : 0;
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
    open = shouldOpen;

    const x = open ? -90 : 0;
    content.style.transform = `translateX(${x}px)`;
    deleteBtn.style.transform = `translateX(${x + 90}px)`;
  });

  deleteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();

    const id = deleteBtn.dataset.id;

    const cart = JSON.parse(localStorage.getItem("teaOrderCart") || "{}");
    delete cart[id];
    localStorage.setItem("teaOrderCart", JSON.stringify(cart));

    row.style.height = row.offsetHeight + "px";
    row.style.transition = "height .25s ease, opacity .25s ease";
    row.style.opacity = "0";
    row.style.height = "0px";

    setTimeout(() => {
        row.remove();
        updateTotals();
        
        // 🛠️ FIX: 不用 import，直接遞迴呼叫自己即可
        showCartSheet(); 
        
        // refreshSheetTotals 其實在 showCartSheet 裡已經包含了 (call api.previewTotals)，所以這行可以省略
        // refreshSheetTotals(); 
    }, 250);
  });
}