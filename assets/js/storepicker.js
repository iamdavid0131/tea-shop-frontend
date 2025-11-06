import { $, toast } from "./dom.js";
import { api } from "./app.api.js";

export function initStorePicker() {
  const picker = $("store-picker");
  const results = $("sp-results");
  const input = $("sp-q");
  const brandSel = $("sp-brand");
  const radiusSel = $("sp-radius");

  if (!picker) return;

  // ✅ 預設開啟 Nearby 模式
  autoLoadNearby();

  // ✅ 手動搜尋：使用地理位置
  $("sp-nearby").addEventListener("click", autoLoadNearby);

  // ✅ 文字搜尋
  $("sp-search-btn").addEventListener("click", () => quickSearch(input.value));
  input.addEventListener("keypress", e => {
    if (e.key === "Enter") quickSearch(input.value);
  });

  function showResults(stores) {
    if (!stores?.length) {
      results.innerHTML = `<div class="muted">查無門市</div>`;
      return;
    }

    results.innerHTML = stores.map(s => `
      <div class="store-option" data-name="${s.name}">
        <b>${s.name}</b><br>
        <span class="muted">${s.address}</span>
      </div>
    `).join("");

    document.querySelectorAll(".store-option").forEach(el => {
      el.addEventListener("click", () => {
        $("storeName").value = el.dataset.name;
        $("storeResults").innerHTML = "";
        toast("✅ 已選擇門市");
      });
    });
  }

  // ✅ 自動定位 + 搜尋附近門市
  async function autoLoadNearby() {
    results.innerHTML = `<div class="muted">📍 取得位置中…</div>`;

    navigator.geolocation.getCurrentPosition(async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const brand = brandSel.value;
      const radius = radiusSel.value;

      const res = await api.searchStoresNear(lat, lng, brand, radius);
      showResults(res?.stores);
    }, () => {
      toast("⚠️ 請允許定位後再試");
      results.innerHTML = `<div class="muted">無法取得位置</div>`;
    });
  }

  // ✅ 依文字輸入 (使用地理位置篩選)
  async function quickSearch(keyword) {
    if (!keyword) return autoLoadNearby();

    results.innerHTML = "搜尋中…";

    navigator.geolocation.getCurrentPosition(async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const brand = brandSel.value;
      const radius = radiusSel.value;

      const res = await api.searchStoresNear(lat, lng, brand, radius);
      const filtered = res.stores.filter(s =>
        s.name.includes(keyword) || s.address.includes(keyword)
      );
      showResults(filtered);
    }, autoLoadNearby);
  }
}
