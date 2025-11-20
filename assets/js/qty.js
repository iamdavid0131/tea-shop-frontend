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
/** 裝罐 Checkbox */
function handlePackToggle(e) {
  const chk = e.target;
  const id = chk.id.replace("pack-", "");
  
  // 取得數量輸入框容器
  const wrap = $(`packQtyWrap-${id}`);
  // 取得最外層 row
  const row = chk.closest(".pack-row");

  if (chk.checked) {
    // 🟢 開啟：顯示數量輸入區
    wrap.classList.remove("hidden");
    wrap.classList.add("fade-in"); // 可選：加上淡入動畫 class
    $(`packQty-${id}`).value = 1;
    
    // row 保持開啟樣式 (如果有需要)
    row.classList.add("active");
  } else {
    // 🔴 關閉：隱藏數量輸入區
    wrap.classList.add("hidden");
    wrap.classList.remove("fade-in");
    
    $(`packQty-${id}`).value = 0; 
    row.classList.remove("active");
  }
  
  // 儲存邏輯
  const qtyEl = getQtyEl(id);
  const qty = parseInt(qtyEl?.value || 0);
  const pack = chk.checked;
  const packQty = chk.checked ? Number($(`packQty-${id}`)?.value || 0) : 0;

  // updatePackUI(id); // ⚠️ 這裡暫時不呼叫 updatePackUI，避免邏輯打架
  saveCartItem(id, qty, pack, packQty);
  updateTotals();
}

/** 裝罐 UI 動態控制 */
export function updatePackUI(id) {
  const qtyEl = document.getElementById(`qty-${id}`);
  const qty = parseInt(qtyEl?.value || 0);

  const packToggle = $(`pack-${id}`);
  const wrap = $(`packQtyWrap-${id}`);
  const row = packToggle?.closest(".pack-row");

  if (!packToggle || !wrap) return;

  // 如果數量為 0，禁用並淡化整個裝罐區
  if (qty === 0) {
    packToggle.disabled = true;
    packToggle.checked = false; // 數量為 0 強制取消勾選
    wrap.classList.add("hidden");
    if (row) row.classList.add("disabled");
    return;
  }

  // 恢復可用狀態
  packToggle.disabled = false;
  if (row) row.classList.remove("disabled");

  // 根據是否勾選來決定顯示狀態
  if (packToggle.checked) {
    wrap.classList.remove("hidden");
    if (row) row.classList.add("active");
  } else {
    wrap.classList.add("hidden");
    if (row) row.classList.remove("active");
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
