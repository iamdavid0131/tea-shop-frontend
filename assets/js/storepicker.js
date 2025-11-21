// ============================================================
// 🏪 storepicker.js (地圖修復 + 體驗優化版)
// ============================================================
import { $, $$, toast } from "./dom.js";
import { api } from "./app.api.js";

// 全域變數 (放在模組頂層，確保單例)
let map = null;
let userLayer = null; // 存放藍點的 LayerGroup
let storeLayer = null; // 存放商店的 LayerGroup
let animationId = null;

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

  if (!sheet || !backdrop || !mapEl) {
    console.warn("storepicker.js: 缺少必要 DOM");
    return;
  }

  // =========================
  // 🛠 地圖核心邏輯
  // =========================
  function initMap(lat, lng) {
    // 1. 如果地圖容器還沒初始化，就建立
    if (!map) {
        // 防呆：清除可能殘留的 DOM 內容
        if (mapEl._leaflet_id) mapEl.innerHTML = "";
        
        map = L.map(mapEl, {
            zoomControl: false, // 我們自訂 Zoom 樣式，或不需要
            attributionControl: false // 簡化介面
        }).setView([lat, lng], 16);

        L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png", {
            maxZoom: 19
        }).addTo(map);

        // 初始化圖層群組
        userLayer = L.layerGroup().addTo(map);
        storeLayer = L.layerGroup().addTo(map);
    } else {
        // 2. 如果已經有地圖，就飛過去
        map.setView([lat, lng], 16);
        // 🔥 關鍵修復：強制重算大小 (解決 display:none 切換後地圖空白問題)
        setTimeout(() => map.invalidateSize(), 300);
    }
  }

  function updateMapMarkers(lat, lng, stores = [], mode = "user") {
    if (!map) initMap(lat, lng);

    // --- A. 繪製中心點 ---
    userLayer.clearLayers();
    if (animationId) cancelAnimationFrame(animationId);

    if (mode === "user") {
        // 🔵 藍點 + 呼吸光暈
        const pulse = L.circle([lat, lng], {
            radius: 20, color: "transparent", fillColor: "#1E90FF", fillOpacity: 0.2
        }).addTo(userLayer);

        const dot = L.circleMarker([lat, lng], {
            radius: 6, color: "#fff", weight: 2, fillColor: "#1E90FF", fillOpacity: 1
        }).addTo(userLayer);

        // 呼吸動畫
        let t = 0;
        function animate() {
            t += 0.03;
            const scale = 1 + 0.3 * Math.sin(t);
            pulse.setRadius(20 * scale);
            animationId = requestAnimationFrame(animate);
        }
        animate();
    } else {
        // 📍 地標模式
        L.marker([lat, lng]).addTo(userLayer).bindPopup("📍 搜尋中心").openPopup();
    }

    // --- B. 繪製商店 ---
    storeLayer.clearLayers();
    
    const validStores = stores.filter(s => {
        const type = identifyBrand(s.name).type;
        return type !== "other";
    });

    validStores.forEach(s => {
        if (!s.lat || !s.lng) return;
        const { color } = identifyBrand(s.name);

        // 自訂漂亮 Icon
        const icon = L.divIcon({
            className: "",
            html: `<div style="
                width:12px; height:12px; background:${color};
                border: 2px solid white; border-radius: 50%;
                box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            "></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8]
        });

        L.marker([s.lat, s.lng], { icon })
            .addTo(storeLayer)
            .bindPopup(`
                <div style="font-weight:bold; margin-bottom:4px;">${s.name}</div>
                <div style="color:#666; font-size:12px;">${s.address}</div>
            `);
    });
  }

  // =========================
  // Helper: 品牌識別
  // =========================
  function identifyBrand(name = "") {
    if (/7-?ELEVEN|7-11|SEVEN/i.test(name)) return { type: "7-11", color: "#e67e22" }; // 橘色
    if (/全家|FAMILY/i.test(name)) return { type: "familymart", color: "#00a0e9" }; // 藍色
    return { type: "other", color: "#999" };
  }

  function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
  }

  // =========================
  // 渲染列表
  // =========================
  function showResults(stores, lat, lng) {
    // 只顯示 7-11 和 全家
    const filtered = (stores || []).filter(s => identifyBrand(s.name).type !== "other");

    if (!filtered.length) {
      results.innerHTML = `<div class="muted" style="text-align:center; padding:20px;">📭 附近沒有符合的超商</div>`;
      return;
    }

    const sorted = filtered.map(s => ({
        ...s, distance: calculateDistance(lat, lng, s.lat, s.lng)
    })).sort((a, b) => a.distance - b.distance);

    results.innerHTML = sorted.map(s => {
        const { color } = identifyBrand(s.name);
        return `
        <div class="sp-item" data-name="${s.name}" style="display:flex; justify-content:space-between; align-items:center;">
            <div>
                <div style="font-weight:700; color:#333;">
                    <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${color}; margin-right:6px;"></span>
                    ${s.name}
                </div>
                <div style="font-size:13px; color:#888; margin-top:2px;">${s.address}</div>
            </div>
            <div style="font-size:12px; color:#5a7b68; font-weight:600; white-space:nowrap;">
                ${s.distance < 1000 ? s.distance + ' m' : (s.distance/1000).toFixed(1) + ' km'}
            </div>
        </div>`;
    }).join("");
  }

  // 事件委派 (選擇門市)
  results.addEventListener("click", (e) => {
    const item = e.target.closest(".sp-item");
    if (!item) return;

    const name = item.dataset.name;
    const storeInput = $("storeName");
    const carrierSel = $("carrier");

    if (storeInput) storeInput.value = name;
    if (carrierSel) {
        const { type } = identifyBrand(name);
        if (type === "7-11") carrierSel.value = "7-11";
        else if (type === "familymart") carrierSel.value = "familymart";
    }

    closeSheet();
    toast(`✅ 已選擇：${name}`);
  });

  // =========================
  // Sheet 控制邏輯
  // =========================
  const openSheet = () => {
    picker.setAttribute("aria-hidden", "false");
    // 強制重繪以觸發 transition
    requestAnimationFrame(() => {
        sheet.classList.add("sp-open");
        backdrop.style.opacity = "1";
    });
    
    autoLoadNearby();
  };

  const closeSheet = () => {
    sheet.classList.remove("sp-open");
    backdrop.style.opacity = "0";
    setTimeout(() => picker.setAttribute("aria-hidden", "true"), 300);
  };

  // 綁定開關
  if (openBtn) openBtn.addEventListener("click", openSheet);
  closeBtns.forEach(btn => btn.addEventListener("click", closeSheet));
  backdrop.addEventListener("click", closeSheet);

  // =========================
  // Hammer.js 拖曳 (優化版)
  // =========================
  if (window.Hammer) {
    const hammer = new window.Hammer(sheet);
    // 🔥 關鍵：允許垂直滾動 (pan-y)，否則列表會滑不動！
    hammer.get('pan').set({ direction: window.Hammer.DIRECTION_VERTICAL, touchAction: 'pan-y' });

    hammer.on("panmove", (e) => {
        // 只有在列表置頂時，往下拉才觸發關閉拖曳
        if (sheet.scrollTop <= 0 && e.deltaY > 0) {
            sheet.style.transform = `translateY(${e.deltaY}px)`;
        }
    });

    hammer.on("panend", (e) => {
        if (e.deltaY > 100) closeSheet(); // 拉超過 100px 關閉
        else sheet.style.transform = ""; // 回彈
    });
  }

  // =========================
  // 搜尋邏輯
  // =========================
  async function autoLoadNearby() {
    results.innerHTML = `<div class="muted" style="text-align:center; padding:20px;">📍 定位中...</div>`;
    
    navigator.geolocation.getCurrentPosition(async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        
        // 第一次初始化地圖 (很重要！一定要在顯示後呼叫)
        initMap(lat, lng);
        
        try {
            const res = await api.searchStoresNear(lat, lng, "all", 800);
            const stores = res?.stores || [];
            showResults(stores, lat, lng);
            updateMapMarkers(lat, lng, stores, "user");
        } catch (e) {
            results.innerHTML = `<div class="muted">載入失敗，請手動搜尋</div>`;
        }
    }, () => {
        results.innerHTML = `<div class="muted">無法取得定位，請手動搜尋</div>`;
        // 預設台北車站
        initMap(25.0478, 121.5170);
    });
  }

  // 綁定搜尋按鈕
  const searchBtn = $("sp-search-btn");
  if (searchBtn) {
      searchBtn.addEventListener("click", async () => {
          const keyword = input.value.trim();
          if (!keyword) return autoLoadNearby();
          
          results.innerHTML = `<div class="muted" style="text-align:center;">🔍 搜尋中...</div>`;
          try {
              const res = await api.searchStoresByLandmark(keyword, "all");
              if (res.ok && res.stores.length) {
                  showResults(res.stores, res.lat, res.lng);
                  updateMapMarkers(res.lat, res.lng, res.stores, "landmark");
                  // 地圖飛過去
                  map.flyTo([res.lat, res.lng], 16);
              } else {
                  results.innerHTML = `<div class="muted">查無結果</div>`;
              }
          } catch (e) {
              results.innerHTML = `<div class="muted">搜尋錯誤</div>`;
          }
      });
  }
}