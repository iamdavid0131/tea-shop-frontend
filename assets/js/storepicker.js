import { $, toast } from "./dom.js";
import { api } from "./app.api.js";

export function initStorePicker() {
  const picker = $("store-picker");
  const results = $("sp-results");
  const input = $("sp-q");
  const brandSel = $("sp-brand");
  const radiusSel = $("sp-radius");
  let map;

  function updateMap(lat, lng, stores) {
    const mapEl = $("sp-map");
    if (!mapEl) return;

    // ✅ 初始化地圖
    map = new google.maps.Map(mapEl, {
      center: { lat, lng },
      zoom: 14,
      disableDefaultUI: true,
    });

    // ✅ 使用者位置標示
    new google.maps.Marker({
      map,
      position: { lat, lng },
      label: "我",
    });

    // ✅ 標示搜尋店家
    stores.forEach((s) => {
      new google.maps.Marker({
        map,
        position: { lat: s.lat, lng: s.lng },
        title: s.name,
      });
    });
  }


  if (!picker) return;

  // ✅ 開關 BottomSheet UI
  const openBtn = $("openStorePicker");
  const backdrop = picker.querySelector(".sp-backdrop");
  const closeBtn = picker.querySelector(".sp-close");

  openBtn.addEventListener("click", () => {
    picker.setAttribute("aria-hidden", "false");
    autoLoadNearby(); // 🔥 一打開就自動找附近門市
  });

  backdrop.addEventListener("click", () => {
    picker.setAttribute("aria-hidden", "true");
  });

  closeBtn.addEventListener("click", () => {
    picker.setAttribute("aria-hidden", "true");
  });

  // ✅ 點擊後自動定位
  $("sp-nearby").addEventListener("click", autoLoadNearby);

  // ✅ 文字搜尋
  $("sp-search-btn").addEventListener("click", () => quickSearch(input.value));
  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") quickSearch(input.value);
  });

  // -----------------------------
  // 🧠 統一渲染結果 UI 區塊
  function showResults(stores) {
    if (!stores?.length) {
      results.innerHTML = `<div class="muted">查無門市</div>`;
      return;
    }

    results.innerHTML = stores
      .map(
        (s) => `
      <div class="store-option" data-name="${s.name}">
        <b>${s.name}</b><br>
        <span class="muted">${s.address}</span>
      </div>
    `
      )
      .join("");

    $$(".store-option").forEach((el) => {
      el.addEventListener("click", () => {
        $("storeName").value = el.dataset.name;
        picker.setAttribute("aria-hidden", "true"); // ✅ 自動關閉
        toast("✅ 已選擇門市");
      });
    });
  }

  // ✅ 自動找附近門市
  // ✅ 自動找附近門市
async function autoLoadNearby() {
  results.innerHTML = `<div class="muted">📍 取得位置中…</div>`;

  navigator.geolocation.getCurrentPosition(
    async (pos) => {

      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      const res = await api.searchStoresNear(
        lat,
        lng,
        brandSel.value,
        radiusSel.value
      );

      showResults(res?.stores);
      updateMap(lat, lng, res?.stores);
    },
    () => {
      toast("⚠️ 定位失敗，請手動搜尋");
      results.innerHTML = `<div class="muted">無法取得位置</div>`;
    }
  );
}


  // ✅ 文字 + 位置搜尋
  async function quickSearch(keyword) {
    if (!keyword) return autoLoadNearby();

    results.innerHTML = "搜尋中…";

    navigator.geolocation.getCurrentPosition(async (pos) => {
      const res = await api.searchStoresNear(
        pos.coords.latitude,
        pos.coords.longitude,
        brandSel.value,
        radiusSel.value
      );

      showResults(
        res.stores.filter(
          (s) => s.name.includes(keyword) || s.address.includes(keyword)
        )
      );
    }, autoLoadNearby);
  }
}
