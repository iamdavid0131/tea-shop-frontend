import { $, $$, toast } from "./dom.js";
import { api } from "./app.api.js";

export function initStorePicker() {
  const picker = $("store-picker");
  const results = $("sp-results");
  const input = $("sp-q");
  const brandSel = $("sp-brand");
  const radiusSel = $("sp-radius");
  let map;
  // ✅ 計算兩點距離（Haversine）
  function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3; // 地球半徑（公尺）
    const toRad = (x) => (x * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c); // → 公尺
  }


  function updateMap(lat, lng, stores) {
    const mapEl = $("sp-map");
    if (!mapEl) return;

    // ✅ 如果地圖已存在 → 重設位置即可
    if (!map) {
      map = L.map(mapEl).setView([lat, lng], 15);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap"
      }).addTo(map);
    } else {
      map.setView([lat, lng], 15);
    }

    // ✅ 先清空所有 marker
    if (map._markerLayer) {
      map.removeLayer(map._markerLayer);
    }
    
    const markers = [];

    // ✅ 使用者位置 Marker
    markers.push(
      L.marker([lat, lng], { title: "目前位置" }).addTo(map)
    );

    // ✅ 門市 marker
    stores.forEach(s => {
      if (!s.lat || !s.lng) return;
      markers.push(
        L.marker([s.lat, s.lng], { title: s.name }).addTo(map)
          .bindPopup(`<b>${s.name}</b><br>${s.address}`)
      );
    });

    // ✅ 自動縮放顯示所有門市
    const group = L.featureGroup(markers);
    map.fitBounds(group.getBounds(), { padding: [30, 30] });

    // ✅ 記錄 marker layer 方便下次移除
    map._markerLayer = group;
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

  // ✅ 加入距離資訊 + 排序
  stores = stores
    .map(s => ({
      ...s,
      distance: calculateDistance(lat, lng, s.lat, s.lng)
    }))
    .sort((a, b) => a.distance - b.distance);

  results.innerHTML = stores.map(s => `
    <div class="store-option" data-name="${s.name}">
      <b>${s.name}</b><br>
      <span class="muted">${s.address}</span><br>
      <span class="distance">📍 ${s.distance}m</span>
    </div>
  `).join("");

  $$(".store-option").forEach(el => {
    el.addEventListener("click", () => {
      $("storeName").value = el.dataset.name;
      picker.setAttribute("aria-hidden", "true");
      toast("✅ 已選擇門市");
    });
  });
}


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

      showResults(res?.stores, lat, lng);
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
