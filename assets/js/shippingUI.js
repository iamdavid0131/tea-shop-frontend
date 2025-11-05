import { $ } from "./dom.js";

export function initShippingUI() {
  const radios = document.querySelectorAll('input[name="ship"]');
  const storeFields = $("storeFields");
  const codFields = $("codFields");

  if (!storeFields || !codFields) return;

  radios.forEach(r => {
    r.addEventListener("change", () => {
      const isStore = r.value === "store";
      storeFields.style.display = isStore ? "block" : "none";
      codFields.style.display = isStore ? "none" : "block";
    });
  });
}
