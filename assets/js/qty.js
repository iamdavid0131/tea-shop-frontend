import { $, toast } from "./dom.js";
import { saveCart, updateTotals } from "./cart.js";

export function updatePackUI(id) {
  const qty = parseInt($(`qty-${id}`)?.textContent || 0);
  const packToggle = $(`pack-${id}`);
  const packInput = $(`packQty-${id}`);
  const packWrap = $(`packQtyWrap-${id}`);
  const packLabel = packToggle.closest(".pack-row")?.querySelector("label.pack-toggle");
  const minusBtn = document.querySelector(`.qty-btn[data-id="${id}"][data-dir="minus"]`);
  if (qty === 0) minusBtn.classList.add("disabled");
  else minusBtn.classList.remove("disabled");

  if (qty === 0) {
    minusBtn.classList.add("disabled");
    packToggle.checked = false;
    packToggle.disabled = true;
    packLabel.classList.add("disabled");
    packWrap.classList.add("hidden");
    if (packInput) packInput.value = 0;
  } else {
    minusBtn.classList.remove("disabled");
    packToggle.disabled = false;
    packLabel.classList.remove("disabled");

    if (packToggle.checked) {
      packWrap.classList.remove("hidden");
      packInput.value = Math.max(1, Math.min(qty, parseInt(packInput.value || 1)));
    } else {
      packWrap.classList.add("hidden");
    }
  }
}

export function handleQtyClick(btn) {
  const id = btn.dataset.id || btn.dataset.pack;
  const dir = btn.dataset.dir;
  const isPack = btn.hasAttribute("data-pack");

  const qtyEl = $(`qty-${id}`);
  const packInput = $(`packQty-${id}`);

  if (!isPack) {
    let qty = parseInt(qtyEl.textContent || 0);
    if (dir === "plus") qty++;
    if (dir === "minus" && qty > 0) qty--;
    qtyEl.textContent = qty;
  } else {
    const buyQty = parseInt(qtyEl.textContent || 0);
    let qty = parseInt(packInput.value || 1);
    if (dir === "plus") qty++;
    if (dir === "minus" && qty > 1) qty--;
    packInput.value = Math.min(buyQty, qty);
  }

  updatePackUI(id);
  saveCart();
  updateTotals();
}
