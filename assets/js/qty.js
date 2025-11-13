import { $, toast } from "./dom.js";
import { saveCart, updateTotals } from "./cart.js";
import { CONFIG } from "./config.js";

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

  if (dir === "plus") qty++;
  if (dir === "minus" && qty > 0) qty--;

  qtyEl.value = qty;

  updatePackUI(id);
  saveCart();
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
  saveCart();
  updateTotals();
}

/** 裝罐 Checkbox */
function handlePackToggle(e) {
  const chk = e.target;
  const id = chk.id.replace("pack-", "");
  const wrap = $(`packQtyWrap-${id}`);

  if (!chk.checked) {
    wrap.classList.add("hidden");
    $(`packQty-${id}`).value = 0;
  } else {
    wrap.classList.remove("hidden");
    $(`packQty-${id}`).value = 1;
  }

  updatePackUI(id);
  saveCart();
  updateTotals();
}

/** 裝罐 UI 動態控制 */
export function updatePackUI(id) {
  const qtyEl = getQtyEl(id);
  const qty = parseInt(qtyEl?.value || 0);

  const packToggle = $(`pack-${id}`);
  if (!packToggle) return;

  const packInput = $(`packQty-${id}`);
  const wrap = $(`packQtyWrap-${id}`);
  const label = packToggle.closest(".pack-row").querySelector(".pack-toggle");

  if (qty === 0) {
    packToggle.checked = false;
    packToggle.disabled = true;
    label.classList.add("disabled");
    wrap.classList.add("hidden");
    packInput.value = 0;
  } else {
    packToggle.disabled = false;
    label.classList.remove("disabled");

    if (packToggle.checked) {
      wrap.classList.remove("hidden");
      packInput.value = Math.min(qty, parseInt(packInput.value || 1));
    } else {
      wrap.classList.add("hidden");
    }
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
