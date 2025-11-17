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
    wrap.classList.remove("hidden");
    row.classList.remove("close");
    row.classList.add("open");
    $(`packQty-${id}`).value = 1;
  } else {
    row.classList.remove("open");
    row.classList.add("close");
    setTimeout(() => {
      wrap.classList.add("hidden");
      $(`packQty-${id}`).value = 0;
    }, 260);
  }

  updatePackUI(id);
  saveCartItem(id, qty, pack, packQty);
  updateTotals();
}

/** 裝罐 UI 動態控制 */
export function updatePackUI(id) {
  const qtyEl = getQty(id);
  const qty = qtyEl;

  const packToggle = $(`pack-${id}`);
  const packInput = $(`packQty-${id}`);
  const wrap = $(`packQtyWrap-${id}`);

  if (!packToggle || !packInput) return;

  // === qty = 0 不要重設使用者的 pack 設定，只要禁用 UI ===
  if (qty === 0) {
    packToggle.disabled = true;
    wrap.classList.add("disabled-wrap");
    return;
  }

  // qty > 0 → 可編輯
  packToggle.disabled = false;
  wrap.classList.remove("disabled-wrap");

  // === 不要重置 packQty，只在勾選 pack 時才顯示 ===
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
