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
  const mapEl = $("sp-map");

  if (!sheet || !backdrop) {
    console.warn("storepicker.js: 缺少必要 DOM，請檢查 HTML");
    return;
  }

  let map = null;
  let pulseMarker = null;
  let userDot = null;
  let animationId = null; // 用來儲存動畫 ID 以便取消

  // =========================
  // Helper: 品牌識別 (集中管理)
  // =========================
  function identifyBrand(name = "") {
    if (/7-?ELEVEN|7-11|SEVEN/i.test(name)) return { type: "7-11", color: "#e67e22" };
    if (/全家|FAMILY/i.test(name)) return { type: "familymart", color: "#00a0e9" };
    return { type: "other", color: "#888" };
  }

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
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  }

  // =========================
  // 使用者位置：藍點 + 呼吸光暈
  // =========================
  function createPulse(lat, lng) {
    if (!map) return;

    // 停止舊的動畫與移除舊 Layer
    if (animationId) cancelAnimationFrame(animationId);
    if (pulseMarker) map.removeLayer(pulseMarker);
    if (userDot) map.removeLayer(userDot);

    // 🔵 中心點
    userDot = L.circleMarker([lat, lng], {
      radius: 6,
      color: "#1E90FF",
      fillColor: "#1E90FF",
      fillOpacity: 1,
      weight: 1,
    }).addTo(map);

    // 🔵 呼吸光暈
    pulseMarker = L.circle([lat, lng], {
      radius: 10,
      color: "#1E90FF",
      fillColor: "#1E90FF",
      fillOpacity: 0.25,
      stroke: false,
    }).addTo(map);

    // ✨ 呼吸動畫
    let t = 0;
    function animatePulse() {
      if (!pulseMarker) return;
      t += 0.015;
      const scale = 1 + 0.3 * Math.sin(t * Math.PI);
      const opacity = 0.2 + 0.1 * Math.cos(t * Math.PI);

      pulseMarker.setRadius(10 * scale);
      pulseMarker.setStyle({ fillOpacity: opacity });

      animationId = requestAnimationFrame(animatePulse);
    }
    animatePulse();
  }

  // =========================
  // 更新地圖
  // =========================
  // 防止地圖拖曳影響頁面捲動
  if (mapEl) {
    mapEl.addEventListener("touchmove", (e) => e.stopPropagation(), { passive: true });
  }

  function updateMap(lat, lng, stores = [], mode = "user") {
    if (!mapEl) return;

    // 🛠 修正：防止 Leaflet 重複初始化
    if (!map) {
      if (mapEl._leaflet_id && window.L) {
         // 嘗試清除舊的 map instance (如果 DOM 殘留)
         mapEl.innerHTML = ''; 
         // 注意：標準做法應是儲存 map instance 到全域或 module level，
         // 若無法取得舊 instance，直接清空 DOM 是最快解法
      }
      
      map = L.map(mapEl).setView([lat, lng], 17);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap &copy; CARTO",
      }).addTo(map);
    } else {
      map.setView([lat, lng], 17);
    }

    // 清除舊的商店 Markers
    if (map._markerLayer) {
      map.removeLayer(map._markerLayer);
      map._markerLayer = null;
    }

    const markers = [];

    // 處理中心點
    if (mode === "user") {
      createPulse(lat, lng);
    } else if (mode === "landmark") {
      // 若切換到地標模式，停止並移除藍點動畫
      if (animationId) cancelAnimationFrame(animationId);
      if (pulseMarker) map.removeLayer(pulseMarker);
      if (userDot) map.removeLayer(userDot);

      const landmarkMarker = L.marker([lat, lng], {
        title: "搜尋中心點",
        icon: L.icon({
          iconUrl: "https://maps.gstatic.com/mapfiles/api-3/images/spotlight-poi2_hdpi.png",
          iconSize: [24, 36],
          iconAnchor: [12, 36],
        }),
      }).addTo(map).bindPopup("📍 搜尋中心點");
      markers.push(landmarkMarker);
    }

    // 處理商店
    const validStores = (stores || []).filter((s) => {
      const { type } = identifyBrand(s.name);
      return type !== "other"; // 只顯示 7-11 和 全家
    });

    validStores.forEach((s) => {
      if (!s.lat || !s.lng) return;

      const { color } = identifyBrand(s.name);

      const customIcon = L.divIcon({
        html: `<div style="
          width:14px;height:14px;
          border-radius:50%;
          background:${color};
          border:2px solid #fff;
          box-shadow:0 0 6px rgba(0,0,0,0.3);
        "></div>`,
        className: "",
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      const m = L.marker([s.lat, s.lng], { icon: customIcon, title: s.name })
        .addTo(map)
        .bindPopup(`<b>${s.name}</b><br>${s.address}`);
      markers.push(m);
    });

    if (markers.length) {
      map._markerLayer = L.featureGroup(markers).addTo(map);
    }
  }

  // =========================
  // 渲染清單 & 事件委派
  // =========================
  function showResults(stores = [], lat, lng) {
    const filtered = (stores || []).filter(s => identifyBrand(s.name).type !== "other");

    if (!filtered.length) {
      results.innerHTML = `<div class="muted">附近沒有超商</div>`;
      return;
    }

    const withDistance = filtered
      .map((s) => ({
        ...s,
        distance: calculateDistance(lat, lng, s.lat, s.lng),
      }))
      .sort((a, b) => a.distance - b.distance);

    results.innerHTML = withDistance
      .map(
        (s) => `
      <div class="store-option" data-name="${s.name}" data-address="${s.address}">
        <b>${s.name}</b><br>
        <span class="muted">${s.address}</span><br>
        <span class="distance">📍 ${s.distance} m</span>
      </div>
    `
      )
      .join("");
  }

  // 🛠 優化：Event Delegation (只綁定一次)
  results.addEventListener("click", (e) => {
    const option = e.target.closest(".store-option");
    if (!option) return;

    const name = option.dataset.name || "";
    // const address = option.dataset.address || ""; // 如有需要
    const inputEl = $("storeName");
    const carrierSel = $("carrier");

    // 更新 UI
    if (inputEl) inputEl.value = name;

    // 設定選單
    if (carrierSel) {
      const { type } = identifyBrand(name);
      if (type === "7-11") carrierSel.value = "7-11";
      else if (type === "familymart") carrierSel.value = "familymart";
      else carrierSel.value = "all";
    }

    closeSheet();
    toast(`✅ 已選擇 ${name}`);
  });

  // =========================
  // 資料載入邏輯
  // =========================
  async function autoLoadNearby() {
    results.innerHTML = `<div class="muted">📍 取得位置中…</div>`;

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const brand = brandSel?.value || "all";
        const radius = radiusSel?.value || 500;

        try {
          const res = await api.searchStoresNear(lat, lng, brand, radius);
          const stores = res?.stores || [];
          
          if (!stores.length) {
             results.innerHTML = `<div class="muted">附近沒有超商</div>`;
          } else {
             showResults(stores, lat, lng);
          }
          updateMap(lat, lng, stores, "user");
        } catch (err) {
          console.error(err);
          results.innerHTML = `<div class="muted">載入失敗</div>`;
        }
      },
      () => {
        toast("⚠️ 定位失敗，請手動搜尋");
        results.innerHTML = `<div class="muted">無法取得位置</div>`;
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  }

  async function quickSearch(keyword) {
    if (!keyword) return autoLoadNearby();
    const brand = brandSel?.value || "all";
    results.innerHTML = `<div class="muted">🔍 以地標搜尋中…</div>`;

    try {
      const geoData = await api.searchStoresByLandmark(keyword, brand);

      if (!geoData.ok || !geoData.lat || !geoData.lng) {
        results.innerHTML = `<div class="muted">查無「${keyword}」相關地點</div>`;
        return;
      }

      const { lat, lng, stores } = geoData;
      if (!stores.length) {
        results.innerHTML = `<div class="muted">「${keyword}」附近無相關超商</div>`;
        updateMap(lat, lng, [], "landmark");
        return;
      }

      showResults(stores, lat, lng);
      updateMap(lat, lng, stores, "landmark");
    } catch (err) {
      console.error("搜尋錯誤：", err);
      toast("⚠️ 搜尋發生錯誤");
      results.innerHTML = `<div class="muted">搜尋失敗</div>`;
    }
  }

  // =========================
  // Sheet 控制與 Hammer.js 拖曳
  // =========================
  const openSheet = () => {
    picker.setAttribute("aria-hidden", "false");
    sheet.classList.add("sp-open");
    autoLoadNearby();
    if (window.bodyScrollLock) {
      window.bodyScrollLock.disableBodyScroll(sheet, { reserveScrollBarGap: true });
    }
  };

  const closeSheet = () => {
    picker.setAttribute("aria-hidden", "true");
    sheet.classList.remove("sp-open");
    sheet.style.opacity = "";
    sheet.style.transform = "";
    if (window.bodyScrollLock) {
      window.bodyScrollLock.enableBodyScroll(sheet);
    }
  };

  // ... (OpenBtn, CloseBtn, Backdrop 邏輯保持不變) ...
  if (openBtn) openBtn.addEventListener("click", openSheet);
  closeBtns.forEach((btn) => (btn.onclick = closeSheet));
  backdrop.addEventListener("click", () => {
     sheet.style.transition = "transform 0.25s ease, opacity 0.2s";
     sheet.style.opacity = 0;
     sheet.style.transform = "translateY(40px)";
     setTimeout(closeSheet, 200);
  });


  // Hammer.js 拖曳優化
  if (window.Hammer) {
    const dragArea = handle || sheet;
    const hammer = new window.Hammer(dragArea);
    hammer.get("pan").set({ direction: window.Hammer.DIRECTION_VERTICAL });

    let currentY = 0;

    hammer.on("panstart", () => {
      sheet.style.transition = "none";
    });

    hammer.on("panmove", (e) => {
      // 🛠 限制：不允許向上拖曳超過初始位置 (負值視為 0)
      if (e.deltaY > 0) {
        currentY = Math.min(e.deltaY * 0.9, 300);
        sheet.style.transform = `translateY(${currentY}px)`;
      }
    });

    hammer.on("panend", (e) => {
      sheet.style.transition = "transform 0.25s ease";
      // 下滑超過 120px 或 速度夠快才關閉
      if (currentY > 120 || (e.deltaY > 0 && e.velocityY > 0.5)) {
        closeSheet();
      } else {
        sheet.style.transform = "";
      }
      currentY = 0;
    });
  }

  // 按鈕事件
  const nearbyBtn = $("sp-nearby");
  const searchBtn = $("sp-search-btn");

  if (nearbyBtn) nearbyBtn.addEventListener("click", () => autoLoadNearby());
  if (searchBtn) searchBtn.addEventListener("click", () => quickSearch(input.value));
  if (input) {
    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") quickSearch(input.value);
    });
  }
}