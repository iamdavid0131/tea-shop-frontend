// ================================
// sheetModal.js
// 購物明細 Bottom Sheet 控制 (最終乾淨版)
// ================================
import { $, toast } from "./dom.js";
import { CONFIG } from "./config.js";
import { api } from "./app.api.js";
import { buildOrderItems, updateTotals } from "./cart.js";

// 🤫 隱藏商品備份 (UI 顯示用)
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
  // 1. UI 防呆：確保 CONFIG 裡有隱藏商品，不然列表會顯示不出來
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

  list.innerHTML = "";
  const items = buildOrderItems();

  // 空車處理
  if (!items.length) {
    list.innerHTML = `<div class="muted" style="padding:12px; text-align:center;">尚未選購商品</div>`;
    if($("cartSub")) $("cartSub").textContent = "NT$ 0";
    if($("cartTotal")) $("cartTotal").textContent = "NT$ 0";
    return; 
  }

  // 渲染列表
  items.forEach(i => {
    const row = document.createElement("div");
    row.className = "line-item clickable";
    row.dataset.id = i.id;

    const packStr = i.packQty > 0 ? `（裝罐 ${i.packQty}）` : "";
    
    // 隱藏版特殊樣式
    const isSecret = i.id === "secret_888";
    const titleHtml = isSecret ? `<span style="color:#b8860b; font-weight:800;">🤫 ${i.name}</span>` : i.name;

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

  // 金額試算
  try {
    const preview = await api.previewTotals(items, "store", promoCode);
    const data = preview.data || preview;

    // ✅ 直接使用後端回傳的正確金額 (假設後端已修復)
    $("cartSub").textContent = `NT$ ${(data.subtotal || 0).toLocaleString("zh-TW")}`;
    
    if($("cartDiscRow")) {
        $("cartDiscRow").style.display = data.discount > 0 ? "flex" : "none";
        $("cartDisc").textContent = data.discount > 0 ? `- NT$ ${data.discount.toLocaleString("zh-TW")}` : "";
    }
    
    $("cartShip").textContent = `NT$ ${(data.shippingFee || 0).toLocaleString("zh-TW")}`;
    $("cartTotal").textContent = `NT$ ${(data.total || 0).toLocaleString("zh-TW")}`;

    $("promoMsg").textContent =
      promoCode && data.discount > 0 ? `🎉 已套用優惠碼：${promoCode}` : 
      promoCode ? "❌ 無效的優惠碼" : "";

  } catch (err) {
    console.error("試算錯誤:", err);
    $("promoMsg").textContent = "⚠️ 無法取得金額資訊";
  }

  // 綁定點擊 (防止重複綁定)
  if (!sheet.dataset.listenerAdded) {
      document.addEventListener("click", handleItemClick);
      sheet.dataset.listenerAdded = "true";
  }
}

// 處理列表點擊
function handleItemClick(e) {
  const row = e.target.closest(".line-item.clickable");
  if (!row || e.target.classList.contains("swipe-delete")) return;

  const sheet = $("cartSheet");
  if (!sheet || sheet.dataset.open !== "true") return;

  const id = row.dataset.id;

  // 隱藏版提示
  if (id === "secret_888") {
    alert("🤫 這是阿興師的私房茶，請透過 AI 聊天室調整數量喔！");
    return;
  }

  hideCartSheet();
  const productCard = document.querySelector(`.tea-card[data-id="${id}"]`);
  if (productCard) productCard.click();
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
  // 🔥 關鍵：允許垂直滾動，只攔截水平
  hammer.get("pan").set({ direction: Hammer.DIRECTION_HORIZONTAL, touchAction: 'pan-y' });

  hammer.on("panstart", () => {
    // 如果已經打開，起點是 -90
    const currentTransform = content.style.transform;
    const isOpen = currentTransform.includes("-90px");
    startX = isOpen ? -90 : 0;
  });

  hammer.on("panmove", (e) => {
    let x = startX + e.deltaX;
    if (x < -90) x = -90; // 最多拉到 -90
    if (x > 0) x = 0;     // 不能往右拉
    content.style.transform = `translateX(${x}px)`;
    deleteBtn.style.transform = `translateX(${x + 90}px)`;
  });

  hammer.on("panend", (e) => {
    const shouldOpen = e.deltaX < -40; // 拉超過 40px 就定住
    const x = shouldOpen ? -90 : 0;
    content.style.transform = `translateX(${x}px)`;
    deleteBtn.style.transform = `translateX(${x + 90}px)`;
  });

  deleteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const id = deleteBtn.dataset.id;
    const cart = JSON.parse(localStorage.getItem("teaOrderCart") || "{}");
    delete cart[id];
    localStorage.setItem("teaOrderCart", JSON.stringify(cart));

    // 刪除動畫
    row.style.transition = "height .25s ease, opacity .25s ease";
    row.style.height = row.offsetHeight + "px";
    requestAnimationFrame(() => {
        row.style.opacity = "0";
        row.style.height = "0px";
    });

    setTimeout(() => {
        row.remove();
        updateTotals(); // 更新底部金額
        // 重新渲染列表 (為了處理空車狀態)
        if (document.querySelectorAll(".line-item").length === 0) {
            showCartSheet();
        }
    }, 250);
  });
}