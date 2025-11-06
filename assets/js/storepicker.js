import { $, $$, toast } from "./dom.js";
import { api } from "./app.api.js";


export function initStorePicker() {
  const picker = $("store-picker");
  const openBtn = $("openStorePicker"); // ✅ 修正
  const backdrop = picker?.querySelector(".sp-backdrop");
  const closeBtn = picker?.querySelector(".sp-close");
  const results = $("sp-results");
  const input = $("sp-q");

  if (!picker || !openBtn) return;

  const open = () => picker.setAttribute("aria-hidden", "false");
  const close = () => {
    picker.setAttribute("aria-hidden", "true");
    results.innerHTML = "";
    input.value = "";
  };

  openBtn.addEventListener("click", open);
  backdrop?.addEventListener("click", close);
  closeBtn?.addEventListener("click", close);

  $("sp-search-btn")?.addEventListener("click", handleSearch);
  input.addEventListener("keydown", e => e.key === "Enter" && handleSearch());

  $("sp-nearby").addEventListener("click", () => {
  navigator.geolocation.getCurrentPosition(async pos => {
    const { latitude: lat, longitude: lng } = pos.coords;
    const brand = $("sp-brand").value;
    const radius = $("sp-radius").value;

    const res = await api.searchStores("", lat, lng, brand, radius);
    updateResults(res);
  }, () => toast("⚠️ 請開啟定位權限"));
});


  async function handleSearch() {
    const q = input.value.trim();
    if (!q) return;

    results.innerHTML = `<div class="store-result">搜尋中…</div>`;
    const res = await api.searchStores(q);

    if (!res?.stores?.length)
      return results.innerHTML = `<div class="muted">查無資料</div>`;

    results.innerHTML = res.stores.map(s => `
      <div class="store-option" data-name="${s.name}">
        <b>${s.name}</b><br>
        <span class="muted">${s.address}</span>
      </div>
    `).join("");

    $$(".store-option").forEach(el =>
      el.addEventListener("click", () => {
        $("storeName").value = el.dataset.name;
        close();
      })
    );
    console.log("🔍 search query =", q);
    console.log("API搜尋結果 =", res);

  }
}
