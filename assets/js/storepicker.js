//storepicker.js
import { $, $$, toast } from "./dom.js";
import { api } from "./app.api.js";

export function initStorePicker() {
  const picker = $("store-picker");
  const results = $("sp-results");
  const input = $("sp-q");
  const brandSel = $("sp-brand");
  const radiusSel = $("sp-radius");
  let map;
  let circleLayer;

  // ✅ 計算兩點距離（Haversine）
  function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3;
    const toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  }

  function updateMap(lat, lng, stores) {
    const mapEl = $("sp-map");
    if (!mapEl) return;

    if (!map) {
      map = L.map(mapEl).setView([lat, lng], 17);

      // ✅ 更簡約地圖
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap &copy; CARTO'
      }).addTo(map);
    } else {
      map.setView([lat, lng], 17);
    }

    // ✅ 清除之前 markerLayer
    if (map._markerLayer) {
      map.removeLayer(map._markerLayer);
    }

    if (circleLayer) {
      map.removeLayer(circleLayer);
    }

    const markers = [];

    // 使用者位置
    markers.push(
      L.marker([lat, lng], { title: "目前位置" }).addTo(map)
    );

    // ✅ 僅顯示 7-11 ＆ 全家
    const validStores = stores.filter(s =>
      /7-?ELEVEN|7-11|SEVEN/i.test(s.name) ||
      /全家|FAMILY/i.test(s.name)
    );

    validStores.forEach(s => {
      if (!s.lat || !s.lng) return;
      markers.push(
        L.marker([s.lat, s.lng], { title: s.name }).addTo(map)
          .bindPopup(`<b>${s.name}</b><br>${s.address}`)
      );
    });


    map._markerLayer = group;

    // ✅ 限制視野 500m範圍
    circleLayer = L.circle([lat, lng], {
      radius: 500,
      color: "#4CAF50",
      fillColor: "#4CAF50",
      fillOpacity: 0.12,
      weight: 1
    }).addTo(map);
  }

  if (!picker) return;

  const openBtn = $("openStorePicker");
  const backdrop = picker.querySelector(".sp-backdrop");
  const closeBtn = picker.querySelector(".sp-close");

  openBtn.addEventListener("click", () => {
    picker.setAttribute("aria-hidden", "false");
    autoLoadNearby();
  });

  backdrop.addEventListener("click", () => {
    picker.setAttribute("aria-hidden", "true");
  });

  closeBtn.addEventListener("click", () => {
    picker.setAttribute("aria-hidden", "true");
  });

  $("sp-nearby").addEventListener("click", autoLoadNearby);

  $("sp-search-btn").addEventListener("click", () => quickSearch(input.value));
  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") quickSearch(input.value);
  });



  function showResults(stores, lat, lng) {
    if (!stores?.length) {
      results.innerHTML = `<div class="muted">查無門市</div>`;
      return;
    }

    // ✅ 僅顯示 7/11 & 全家
    stores = stores.filter(s =>
      /7-?ELEVEN|7-11|SEVEN/i.test(s.name) ||
      /全家|FAMILY/i.test(s.name)
    );

    if (!stores.length) {
      results.innerHTML = `<div class="muted">附近沒有超商</div>`;
      return;
    }

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


  async function autoLoadNearby() {
    results.innerHTML = `<div class="muted">📍 取得位置中…</div>`;

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        const res = await api.searchStoresNear(lat, lng, brandSel.value, radiusSel.value);
        showResults(res?.stores || [], lat, lng);
        updateMap(lat, lng, res?.stores || []);
      },
      () => {
        toast("⚠️ 定位失敗，請手動搜尋");
        results.innerHTML = `<div class="muted">無法取得位置</div>`;
      }
    );
  }


  async function quickSearch(keyword) {
    if (!keyword) return autoLoadNearby();

    results.innerHTML = "搜尋中…";

    navigator.geolocation.getCurrentPosition(async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      const res = await api.searchStoresNear(lat, lng, brandSel.value, radiusSel.value);

      showResults(
        res?.stores.filter(
          (s) => s.name.includes(keyword) || s.address.includes(keyword)
        ),
        lat,
        lng
      );
    }, autoLoadNearby);
  }
}
