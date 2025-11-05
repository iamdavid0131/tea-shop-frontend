// storePicker.js
import { $ } from "./dom.js";
import { api } from "./app.api.js";

export function initStorePicker() {
  const picker = $("store-picker");
  const openBtn = $("openStorePicker");
  const backdrop = picker.querySelector(".sp-backdrop");
  const closeBtn = picker.querySelector(".sp-close");
  const results = $("sp-results");
  const input = $("sp-q");

  if (!picker || !openBtn) return;

  const open = () => {
    picker.setAttribute("aria-hidden", "false");
  };

  const close = () => {
    picker.setAttribute("aria-hidden", "true");
    results.innerHTML = "";
    input.value = "";
  };

  openBtn.addEventListener("click", open);
  backdrop.addEventListener("click", close);
  closeBtn.addEventListener("click", close);

  // ✅ 搜尋功能
  $("sp-search-btn").addEventListener("click", handleSearch);
  input.addEventListener("keypress", e => {
    if (e.key === "Enter") handleSearch();
  });

  async function handleSearch() {
    const q = input.value.trim();
    if (!q) return;

    results.innerHTML = "搜尋中…";
    const res = await api.searchStores(q);

    if (!res?.stores?.length) {
      results.innerHTML = `<div class="muted">查無資料</div>`;
      return;
    }

    results.innerHTML = res.stores.map(s => `
      <div class="store-option" data-name="${s.name}">
        <b>${s.name}</b><br>
        <span class="muted">${s.address}</span>
      </div>
    `).join("");

    document.querySelectorAll(".store-option").forEach(el => {
      el.addEventListener("click", () => {
        $("storeName").value = el.dataset.name;
        close();
      });
    });
  }
}
