// storepicker.js
import { $, $$, toast } from "./dom.js";
import { api } from "./app.api.js";

export function initStorePicker() {
  const picker = $("store-picker");
  if (!picker) return;

  // DOM 元件
  const results = $("sp-results");
  const input = $("sp-q");
  const brandSel = $("sp-brand");
  const radiusSel = $("sp-radius");
  const sheet = picker.querySelector(".sp-sheet");
  const backdrop = picker.querySelector(".sp-backdrop");
  const closeBtns = picker.querySelectorAll("[data-sp-close]");
  const openBtn = $("openStorePicker");
  const handle = sheet ? sheet.querySelector(".sp-handle") : null;

  if (!sheet || !backdrop) {
    console.warn("storepicker.js: 缺少 .sp-sheet 或 .sp-backdrop，請檢查 HTML 結構");
    return;
  }

  let map;
  let circleLayer;
  let pulseMarker;

  // =========================
  // 工具：計算兩點距離（公尺）
  // =========================
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

  // =========================
  // 使用者位置脈衝光暈
  // =========================
function createPulse(lat, lng) {
  if (!map) return;

  // 先刪掉舊的 pulse
  if (pulseMarker) {
    map.removeLayer(pulseMarker);
    pulseMarker = null;
  }

  // ✅ 正確 anchor，確保中心對齊座標
  const pulsingIcon = L.divIcon({
    className: "pulse-icon",
    iconSize: [20, 20],
    iconAnchor: [10, 10], // 中心點
  });

  // ✅ 直接用 pulse 取代原本藍點，不需再建立 circleMarker
  pulseMarker = L.marker([lat, lng], {
    icon: pulsingIcon,
    interactive: false,
    zIndexOffset: 500
  }).addTo(map);
}


  // =========================
  // 更新地圖
  // mode: "user" | "landmark"
  // =========================
  function updateMap(lat, lng, stores = [], mode = "user") {
    const mapEl = $("sp-map");
    if (!mapEl) return;

    if (!map) {
      map = L.map(mapEl).setView([lat, lng], 17);
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap &copy; CARTO"
        }
      ).addTo(map);
    } else {
      map.setView([lat, lng], 17);
    }

    // 清空圖層
    if (map._markerLayer) {
      map.removeLayer(map._markerLayer);
      map._markerLayer = null;
    }
    if (circleLayer) {
      map.removeLayer(circleLayer);
      circleLayer = null;
    }
    if (pulseMarker) {
      map.removeLayer(pulseMarker);
      pulseMarker = null;
    }

    const markers = [];

    // 中心點顯示：使用者 or 搜尋地標
    if (mode === "user") {
      // ✅ 使用者位置只顯示脈衝動畫
      createPulse(lat, lng);

    } else {
      const landmarkMarker = L.marker([lat, lng], {
        title: "搜尋中心點"
      })
        .addTo(map)
        .bindPopup("📍 搜尋中心點");
      markers.push(landmarkMarker);
    }

    // 只留下 7-11 / 全家
    const validStores = (stores || []).filter(
      (s) =>
        /7-?ELEVEN|7-11|SEVEN/i.test(s.name) ||
        /全家|FAMILY/i.test(s.name)
    );

    validStores.forEach((s) => {
      if (!s.lat || !s.lng) return;
      const m = L.marker([s.lat, s.lng], { title: s.name })
        .addTo(map)
        .bindPopup(`<b>${s.name}</b><br>${s.address}`);
      markers.push(m);
    });

    if (markers.length) {
      const group = L.featureGroup(markers);
      map._markerLayer = group;
      // 不用 fitBounds，鎖 17，維持 500m 視覺
      map.setView([lat, lng], 17);
    }

    // 畫 500m 範圍
    circleLayer = L.circle([lat, lng], {
      radius: 500,
      color: mode === "user" ? "#4CAF50" : "#2ecc71",
      fillColor: mode === "user" ? "#4CAF50" : "#2ecc71",
      fillOpacity: mode === "user" ? 0.08 : 0.1,
      weight: 1
    }).addTo(map);
  }

  // =========================
  // 渲染門市清單
  // =========================
  function showResults(stores = [], lat, lng) {
    // 先過濾 7-11 / 全家
    const filtered = (stores || []).filter(
      (s) =>
        /7-?ELEVEN|7-11|SEVEN/i.test(s.name) ||
        /全家|FAMILY/i.test(s.name)
    );

    if (!filtered.length) {
      results.innerHTML = `<div class="muted">附近沒有超商</div>`;
      return;
    }

    const withDistance = filtered
      .map((s) => ({
        ...s,
        distance: calculateDistance(lat, lng, s.lat, s.lng)
      }))
      .sort((a, b) => a.distance - b.distance);

    results.innerHTML = withDistance
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
        const name = el.dataset.name || "";
        const inputEl = $("storeName");
        if (inputEl) inputEl.value = name;
        closeSheet();
        toast("✅ 已選擇門市");
      });
    });
  }

  // =========================
  // 目前位置附近超商
  // =========================
  async function autoLoadNearby() {
    results.innerHTML = `<div class="muted">📍 取得位置中…</div>`;

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        const res = await api.searchStoresNear(
          lat,
          lng,
          brandSel?.value || "all",
          radiusSel?.value || 500
        );

        const stores = res?.stores || [];
        if (!stores.length) {
          results.innerHTML = `<div class="muted">附近沒有超商</div>`;
        } else {
          showResults(stores, lat, lng);
        }
        updateMap(lat, lng, stores, "user");
      },
      () => {
        toast("⚠️ 定位失敗，請手動搜尋");
        results.innerHTML = `<div class="muted">無法取得位置</div>`;
      }
    );
  }

  // =========================
  // 地標搜尋 → 地標附近超商
  // =========================
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

      const res = await api.searchStoresNear(
        lat,
        lng,
        brandSel?.value || "all",
        500
      );
      const stores = res?.stores || [];

      if (!stores.length) {
        results.innerHTML = `<div class="muted">「${keyword}」附近 500 m 內沒有超商</div>`;
        updateMap(lat, lng, [], "landmark");
        return;
      }

      showResults(stores, lat, lng);
      updateMap(lat, lng, stores, "landmark");
    } catch (err) {
      console.error("地標搜尋錯誤：", err);
      toast("⚠️ 搜尋發生錯誤");
      results.innerHTML = `<div class="muted">無法取得搜尋結果</div>`;
    }
  }

  // =========================
  // Bottom Sheet 開關控制（只控制 store-picker）
  // =========================
  const openSheet = () => {
    picker.setAttribute("aria-hidden", "false");
    sheet.classList.add("sp-open");
    autoLoadNearby();
  };

  const closeSheet = () => {
    picker.setAttribute("aria-hidden", "true");
    sheet.classList.remove("sp-open");
    sheet.style.transform = "";
  };

  if (openBtn) {
    openBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openSheet();
    });
  }

  backdrop.addEventListener("click", (e) => {
    e.stopPropagation();
    closeSheet();
  });

  closeBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeSheet();
    });
  });

  // =========================
  // 拖曳關閉（只對 sp-handle 生效）
  // =========================
  let startY = 0;
  let currentY = 0;
  let isDragging = false;

  if (handle) {
    sheet.addEventListener("touchstart", (e) => {
      if (!e.target.closest(".sp-handle")) return;
      startY = e.touches[0].clientY;
      currentY = startY;
      isDragging = true;
      sheet.classList.add("sp-dragging");
      e.stopPropagation();
    });

    sheet.addEventListener("touchmove", (e) => {
      if (!isDragging) return;
      const touch = e.touches[0];
      currentY = touch.clientY;
      const diff = currentY - startY;
      if (diff > 0) {
        sheet.style.transform = `translateY(${diff}px)`;
      }
      e.stopPropagation();
    });

    sheet.addEventListener("touchend", (e) => {
      if (!isDragging) return;
      isDragging = false;
      sheet.classList.remove("sp-dragging");

      const diff = currentY - startY;
      sheet.style.transform = "";

      // 拉夠遠就關閉
      if (diff > 100) {
        closeSheet();
      } else {
        sheet.classList.add("sp-open");
      }

      // 拉條 bounce 動畫
      if (handle) {
        handle.classList.remove("bounce");
        void handle.offsetWidth; // reset
        handle.classList.add("bounce");
      }

      e.stopPropagation();
    });
  }

  // =========================
  // 綁定按鈕事件
  // =========================
  const nearbyBtn = $("sp-nearby");
  const searchBtn = $("sp-search-btn");

  if (nearbyBtn) nearbyBtn.addEventListener("click", () => autoLoadNearby());
  if (searchBtn)
    searchBtn.addEventListener("click", () => quickSearch(input.value));
  if (input)
    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") quickSearch(input.value);
    });
}
