import { $, toast } from "./dom.js";
import { saveCart, updateTotals } from "./cart.js";
import { CONFIG } from "./config.js";

/** ✅ 裝罐 UI 動態控制 */
export function updatePackUI(id) {
  const qty = parseInt($(`qty-${id}`)?.textContent || 0);

  const packToggle = $(`pack-${id}`);
  if (!packToggle) return; // ✅ 非 packable 商品直接忽略

  const packInput = $(`packQty-${id}`);
  const wrap = $(`packQtyWrap-${id}`);
  const minusBtn = document.querySelector(`.qty-btn[data-id="${id}"][data-dir="minus"]`);
  const label = packToggle.closest(".pack-row").querySelector("label.pack-toggle");

  if (qty === 0) {
    packToggle.checked = false;
    packToggle.disabled = true;
    label.classList.add("disabled");
    wrap.classList.add("hidden");
    if (packInput) packInput.value = 0;
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

  if (qty <= 0) minusBtn.classList.add("disabled");
  else minusBtn.classList.remove("disabled");
}

/** ✅ 數量按鈕處理 */
export function handleQtyClick(btn) {
  const id = btn.dataset.id;
  const dir = btn.dataset.dir;

  const qtyEl = $(`qty-${id}`);
  let qty = parseInt(qtyEl.textContent || 0);

  if (dir === "plus") qty++;
  if (dir === "minus" && qty > 0) qty--;

  qtyEl.textContent = qty;
  updatePackUI(id);
  saveCart();
  updateTotals();
}

/** ✅ 裝罐數量 */
function handlePackBtn(btn) {
  const id = btn.dataset.pack;
  const dir = btn.dataset.dir;

  const qty = parseInt($(`qty-${id}`)?.textContent || 0);
  const packInput = $(`packQty-${id}`);
  let v = parseInt(packInput.value || 1);

  if (dir === "plus") v++;
  if (dir === "minus" && v > 1) v--;

  packInput.value = Math.min(qty, v);
  updatePackUI(id);
  saveCart();
  updateTotals();
}

/** ✅ 裝罐 checkbox */
function handlePackToggle(e) {
  const chk = e.target;
  const id = chk.id.replace("pack-", "");
  if (!chk.checked) {
    $(`packQtyWrap-${id}`)?.classList.add("hidden");
    $(`packQty-${id}`).value = 0;
  } else {
    $(`packQtyWrap-${id}`)?.classList.remove("hidden");
    $(`packQty-${id}`).value = 1;
  }
  updatePackUI(id);
  saveCart();
  updateTotals();
}

/** ✅ 初始化 */
export function initQtyControls() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".qty-btn");
    if (btn) return handleQtyClick(btn);

    const pbtn = e.target.closest(".step");
    if (pbtn) return handlePackBtn(pbtn);
  });

  document.addEventListener("change", (e) => {
    if (e.target.matches("input[id^='pack-']")) handlePackToggle(e);
  });

  CONFIG.PRODUCTS.forEach((p) => updatePackUI(p.id));
}
