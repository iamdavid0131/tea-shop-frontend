// storepicker.js
import { $, $$, toast } from "./dom.js";
import { api } from "./app.api.js";

export function initStorePicker() {
  const picker = $("store-picker");
  if (!picker) return;

  const results = $("sp-results");
  const input = $("sp-q");
  const brandSel = $("sp-brand");
  const radiusSel = $("sp-radius");
  const sheet = picker.querySelector(".sp-sheet");
  const backdrop = picker.querySelector(".sp-backdrop");
  const closeBtns = picker.querySelectorAll("[data-sp-close]");
  const openBtn = $("openStorePicker");

  let map, circleLayer;

  // ===== 計算兩點距離（Haversine）=====
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

  // ===== 更新地圖 =====
  function updateMap(lat, lng, stores) {
    const mapEl = $("sp-map");
    if (!mapEl) return;

    if (!map) {
      map = L.map(mapEl).setView([lat, lng], 17);
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap &copy; CARTO",
        }
      ).addTo(map);
    } else {
      map.setView([lat, lng], 17);
    }

    // 清空舊圖層
    if (map._markerLayer) map.removeLayer(map._markerLayer);
    if (circleLayer) map.removeLayer(circleLayer);

    const markers = [];
    markers.push(L.marker([lat, lng], { title: "目前位置" }).addTo(map));

    // 只顯示超商
    const validStores = (stores || []).filter(
      (s) =>
        /7-?ELEVEN|7-11|SEVEN/i.test(s.name) ||
        /全家|FAMILY/i.test(s.name)
    );

    validStores.forEach((s) => {
      if (!s.lat || !s.lng) return;
      markers.push(
        L.marker([s.lat, s.lng], { title: s.name })
          .addTo(map)
          .bindPopup(`<b>${s.name}</b><br>${s.address}`)
      );
    });

    const group = L.featureGroup(markers);
    map._markerLayer = group;

    // 使用者 500 m 範圍
    circleLayer = L.circle([lat, lng], {
      radius: 500,
      color: "#4CAF50",
      fillColor: "#4CAF50",
      fillOpacity: 0.12,
      weight: 1,
    }).addTo(map);
  }

  // ===== 渲染結果 =====
  function showResults(stores, lat, lng) {
    if (!stores?.length) {
      results.innerHTML = `<div class="muted">查無門市</div>`;
      return;
    }

    stores = stores.filter(
      (s) =>
        /7-?ELEVEN|7-11|SEVEN/i.test(s.name) ||
        /全家|FAMILY/i.test(s.name)
    );

    if (!stores.length) {
      results.innerHTML = `<div class="muted">附近沒有超商</div>`;
      return;
    }

    stores = stores
      .map((s) => ({
        ...s,
        distance: calculateDistance(lat, lng, s.lat, s.lng),
      }))
      .sort((a, b) => a.distance - b.distance);

    results.innerHTML = stores
      .map(
        (s) => `
      <div class="store-option" data-name="${s.name}">
        <b>${s.name}</b><br>
        <span class="muted">${s.address}</span><br>
        <span class="distance">📍 ${s.distance} m</span>
      </div>
    `
      )
      .join("");

    $$(".store-option").forEach((el) => {
      el.addEventListener("click", () => {
        $("storeName").value = el.dataset.name;
        closeSheet();
        toast("✅ 已選擇門市");
      });
    });
  }

  // ===== 目前位置搜尋 =====
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
        showResults(res?.stores || [], lat, lng);
        updateMap(lat, lng, res?.stores || []);
      },
      () => {
        toast("⚠️ 定位失敗，請手動搜尋");
        results.innerHTML = `<div class="muted">無法取得位置</div>`;
      }
    );
  }

  // ===== 地標搜尋（找地標附近的超商）=====
  async function quickSearch(keyword) {
    if (!keyword) return autoLoadNearby();
    results.innerHTML = `<div class="muted">🔍 以地標搜尋中…</div>`;

    try {
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          keyword
        )}&limit=1`
      );
      const geoData = await geoRes.json();
      if (!geoData.length) {
        results.innerHTML = `<div class="muted">查無「${keyword}」相關地點</div>`;
        return;
      }

      const lat = parseFloat(geoData[0].lat);
      const lng = parseFloat(geoData[0].lon);
      const res = await api.searchStoresNear(lat, lng, brandSel.value, 500);
      const stores = (res?.stores || []).filter(
        (s) =>
          /7-?ELEVEN|7-11|SEVEN/i.test(s.name) ||
          /全家|FAMILY/i.test(s.name)
      );

      if (!stores.length) {
        results.innerHTML = `<div class="muted">「${keyword}」附近 500 m 內沒有超商</div>`;
        updateMap(lat, lng, []);
        return;
      }

      showResults(stores, lat, lng);
      updateMap(lat, lng, stores);
    } catch (err) {
      console.error("地標搜尋錯誤：", err);
      toast("⚠️ 搜尋發生錯誤");
      results.innerHTML = `<div class="muted">無法取得搜尋結果</div>`;
    }
  }

  // ===== Bottom Sheet 開關控制 =====
  const openSheet = () => {
    picker.setAttribute("aria-hidden", "false");
    sheet.setAttribute("data-open", "true");
  };
  const closeSheet = () => {
    picker.setAttribute("aria-hidden", "true");
    sheet.removeAttribute("data-open");
  };

  if (openBtn) openBtn.addEventListener("click", openSheet);
  backdrop.addEventListener("click", closeSheet);
  closeBtns.forEach((btn) => btn.addEventListener("click", closeSheet));

  // ===== 拖曳關閉 =====
  let startY = 0,
    currentY = 0,
    isDragging = false;

  sheet.addEventListener("touchstart", (e) => {
    if (!e.target.closest(".sheet-handle")) return;
    startY = e.touches[0].clientY;
    isDragging = true;
    sheet.classList.add("dragging");
  });

  sheet.addEventListener("touchmove", (e) => {
    if (!isDragging) return;
    currentY = e.touches[0].clientY;
    const diff = currentY - startY;
    if (diff > 0) sheet.style.transform = `translateY(${diff}px)`;
  });

  sheet.addEventListener("touchend", () => {
    if (!isDragging) return;
    isDragging = false;
    sheet.classList.remove("dragging");
    const diff = currentY - startY;
    sheet.style.transform = "";
    if (diff > 100) closeSheet();
    else sheet.setAttribute("data-open", "true");
  });

  // ===== 綁定搜尋事件 =====
  $("sp-nearby").addEventListener("click", autoLoadNearby);
  $("sp-search-btn").addEventListener("click", () => quickSearch(input.value));
  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") quickSearch(input.value);
  });
}
