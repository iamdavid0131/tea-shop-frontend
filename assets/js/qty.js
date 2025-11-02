// qty.js ✅ 統一商品數量 + 裝罐邏輯
import { $, toast } from "./dom.js";
import { saveCart, updateTotals } from "./cart.js";

function getQty(id) {
  return parseInt($(`qty-${id}`)?.textContent || 0);
}
function setQty(id, v) {
  $(`qty-${id}`).textContent = v;
}

export function updatePackUI(id) {
  const qty = getQty(id);
  const packToggle = $(`pack-${id}`);
  const packInput = $(`packQty-${id}`);
  const packWrap = $(`packQtyWrap-${id}`);

  if (!packToggle) return;

  if (qty === 0) {
    packToggle.checked = false;
    packToggle.disabled = true;
    packWrap?.classList.add("hidden");
    if (packInput) packInput.value = 0;
  } else {
    packToggle.disabled = false;
    if (packToggle.checked) {
      packWrap.classList.remove("hidden");
      packInput.value = Math.min(qty, Math.max(1, parseInt(packInput.value || 1)));
    } else {
      packWrap.classList.add("hidden");
    }
  }
}

/* ✅ 點擊 +- 數量 */
export function handleQtyClick(btn) {
  const id = btn.dataset.id;
  const dir = btn.dataset.dir;
  if (!id || !dir) return;

  let qty = getQty(id);

  if (dir === "plus") qty++;
  if (dir === "minus" && qty > 0) qty--;

  setQty(id, qty);
  updatePackUI(id);
  saveCart();
  updateTotals();
}

/* ✅ 勾選裝罐開關 */
export function handlePackToggle(e) {
  const id = e.target.id.replace("pack-", "");
  const wrap = $(`packQtyWrap-${id}`);
  const input = $(`packQty-${id}`);
  const qty = getQty(id);

  if (e.target.checked) {
    wrap.classList.remove("hidden");
    input.value = qty > 0 ? 1 : 0;
  } else {
    wrap.classList.add("hidden");
    input.value = 0;
  }

  saveCart();
  updateTotals();
}

/* ✅ 裝罐數量手動輸入 */
export function handlePackInput(e) {
  const id = e.target.id.replace("packQty-", "");
  const qty = getQty(id);
  let v = parseInt(e.target.value || 0);

  if (v > qty) v = qty;
  if (v < 0) v = 0;

  e.target.value = v;
  saveCart();
  updateTotals();
}

/* ✅ 統一掛載事件 */
export function initQtyControls() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".qty-btn");
    if (!btn) return;
    handleQtyClick(btn);
  });

  document.addEventListener("change", (e) => {
    if (e.target.matches("input[id^='pack-']")) {
      handlePackToggle(e);
    }
  });

  document.addEventListener("input", (e) => {
    if (e.target.matches("input[id^='packQty-']")) {
      handlePackInput(e);
    }
  });
}
