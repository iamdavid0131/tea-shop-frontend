import { $, toast } from "./dom.js";
import { saveCartItem, updateTotals } from "./cart.js";
import { CONFIG } from "./config.js";
import { getQty } from "./cart.js";


/** 取得 qty input 元件 */
function getQtyEl(id) {
  return document.getElementById(`qty-${id}`);
}

/* ============================================================
✨ 防止多次綁定事件（最重要）
============================================================ */
let qtyEventsBound = false;

/** ➕➖ 數量更新 */
export function handleQtyClick(btn) {
  const id = btn.dataset.id;
  const dir = btn.dataset.dir;

  const qtyEl = getQtyEl(id);
  let qty = parseInt(qtyEl.value || 0);

  if (dir === "plus") {
    qty++;
    spawnQtyBubble(btn, "+1");
  }
  if (dir === "minus" && qty > 0) {
    qty--;
    spawnQtyBubble(btn, "-1");
  }

  qtyEl.value = qty;

  // ⭐ 重新抓 pack / packQty
  const pack = $(`pack-${id}`)?.checked || false;
  const packQty = Number($(`packQty-${id}`)?.value || 0);

  updatePackUI(id);
  saveCartItem(id, qty, pack, packQty);
  updateTotals();
}
/** 裝罐 +/- */
function handlePackBtn(btn) {
  const id = btn.dataset.pack;
  const dir = btn.dataset.dir;

  const qtyEl = getQtyEl(id);
  const qty = parseInt(qtyEl.value || 0);

  const packInput = $(`packQty-${id}`);
  let v = parseInt(packInput.value || 1);

  if (dir === "plus") v++;
  if (dir === "minus" && v > 1) v--;

  packInput.value = Math.min(qty, v);

  const pack = $(`pack-${id}`)?.checked || false;
  const packQty = Number(packInput.value || 0);

  updatePackUI(id);
  saveCartItem(id, qty, pack, packQty);
  updateTotals();
}

/** 裝罐 Checkbox */
function handlePackToggle(e) {
  const chk = e.target;
  const id = chk.id.replace("pack-", "");
  const wrap = $(`packQtyWrap-${id}`);
  const row = chk.closest(".pack-row");

  if (chk.checked) {
    // 1. 顯示邏輯：移除 hidden，加入 open
    wrap.classList.remove("hidden");
    row.classList.remove("close");
    row.classList.add("open");
    $(`packQty-${id}`).value = 1;
  } else {
    // 2. 隱藏邏輯：移除 open，加入 close
    row.classList.remove("open");
    row.classList.add("close");
    
    // ⭐️ 修正處 1：不使用 setTimeout 處理 wrap 的 hidden 類別
    // 讓 CSS (透過 .close 類別) 來處理動畫和最終的隱藏效果。
    
    // ⭐️ 修正處 2：立即重置值（在保存之前）
    $(`packQty-${id}`).value = 0; 
    
    // 為了確保 wrap 在動畫完成後被隱藏，我們可以在 row 元素上監聽 CSS 動畫結束事件
    // 或者，我們將 wrap 元素放入 setTimeout 內隱藏的邏輯移除，改為
    // 讓 row.classList.add("close") 配合 CSS 樣式來控制 wrap 的顯示/隱藏。

  }
  
  // 由於我們修改了 else 區塊，這裡確保 packQty 的值已經是 0 或 1
  const qtyEl = getQtyEl(id);
  const qty = parseInt(qtyEl?.value || 0);
  const pack = chk.checked;
  
  // 這裡需要根據 chk.checked 來決定 packQty 的值
  const packQty = chk.checked 
    ? Number($(`packQty-${id}`)?.value || 0)
    : 0; // 取消打勾時，packQty 必須傳 0

  updatePackUI(id);
  saveCartItem(id, qty, pack, packQty);
  updateTotals();
}

/** 裝罐 UI 動態控制 */
export function updatePackUI(id) {
  const qtyEl = document.getElementById(`qty-${id}`);
  const qty = parseInt(qtyEl?.value || 0);

  const packToggle = $(`pack-${id}`);
  const packInput = $(`packQty-${id}`);
  const wrap = $(`packQtyWrap-${id}`);

  if (!packToggle || !packInput) return;

  if (qty === 0) {
    packToggle.disabled = true;
    wrap.classList.add("disabled-wrap");
    return;
  }

  packToggle.disabled = false;
  wrap.classList.remove("disabled-wrap");

  if (packToggle.checked) {
    wrap.classList.remove("hidden");
  } else {
    wrap.classList.add("hidden");
  }
}


/* ============================================================
✨ 初始化：永遠只會綁一次事件（解決 +2 問題）
============================================================ */
export function initQtyControls() {
  if (qtyEventsBound) return;  // ⭐ 防止重複綁定

  qtyEventsBound = true;

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".qty-btn");
    if (btn) return handleQtyClick(btn);

    const pbtn = e.target.closest(".step");
    if (pbtn) return handlePackBtn(pbtn);
  });

  document.addEventListener("change", (e) => {
    if (e.target.matches("input[id^='pack-']")) return handlePackToggle(e);
  });

  CONFIG.PRODUCTS.forEach((p) => updatePackUI(p.id));
}

function spawnQtyBubble(btn, text) {
  const bubble = document.createElement("div");
  bubble.className = "qty-bubble";
  bubble.textContent = text;

  const rect = btn.getBoundingClientRect();
  bubble.style.left = rect.left + rect.width / 2 + "px";
  bubble.style.top = rect.top - 4 + "px";

  document.body.appendChild(bubble);
  setTimeout(() => bubble.remove(), 600);
}
