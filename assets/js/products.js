// products.js — Aurora Mist（極光茶霧）Final Clean Version
// ============================================================

import { $, $$ } from "./dom.js";
import { updatePackUI, initQtyControls } from "./qty.js";
import { CATEGORY_MAP } from "./category-map.js";
import { CONFIG } from "./config.js";

// ============================================================
// 🌌 Aurora Mist Engine — 極光茶霧
// ============================================================
const AURORA = {
  layers: [],
  init() {
    this.layers = [
      document.querySelector(".layer-1"),
      document.querySelector(".layer-2"),
      document.querySelector(".layer-3"),
    ].filter(Boolean);

    if (!window.gsap || this.layers.length === 0) return;

    // 初始流動
    this.layers.forEach((layer, i) => {
      gsap.to(layer, {
        x: "+=90",
        y: "+=50",
        duration: 26 + i * 6,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    });
  },

  setColor(colorA, colorB) {
    if (!window.gsap || this.layers.length === 0) return;

    this.layers.forEach((layer, i) => {
      // 顏色漸變
      gsap.to(layer, {
        background: `radial-gradient(circle at 30% 30%, ${colorA}, ${colorB}, transparent 70%)`,
        duration: 1.8,
        ease: "sine.out",
      });

      // 位置擾動（模擬極光流動）
      gsap.to(layer, {
        x: "+=100",
        duration: 2 + i * 0.2,
        ease: "power1.out",
      });
      gsap.to(layer, {
        x: "-=70",
        delay: 2,
        duration: 3 + i * 0.3,
        ease: "power2.out",
      });
    });
  },
};

// ============================================================
// 🟩 主畫面渲染（分類 + 卡片）
// ============================================================
export function renderTeaScenes() {
  const items = CONFIG.PRODUCTS || [];
  const container = $("teaScenes");
  if (!container) return;

  container.innerHTML = "";

  // 資料分組
  const categories = {};
  items.forEach((p) => {
    if (!categories[p.category]) categories[p.category] = [];
    categories[p.category].push(p);
  });

  const sortedCats = CATEGORY_MAP
    .map((c) => ({ ...c, list: categories[c.key] || [] }))
    .filter((c) => c.list.length > 0)
    .sort((a, b) => (a.order || 999) - (b.order || 999));

  if (typeof AURORA !== 'undefined') AURORA.init();

  sortedCats.forEach((cat) => {
    const sec = document.createElement("section");
    sec.className = "tea-scene";
    sec.dataset.cat = cat.key;

    sec.style.setProperty("--auroraA", cat.colorA);
    sec.style.setProperty("--auroraB", cat.colorB);
    sec.style.setProperty("--catA", darkenRGBA(cat.colorA, 0.75));
    sec.style.setProperty("--catB", darkenRGBA(cat.colorB, 0.75));
    
    sec.innerHTML = `
    <header class="tea-scene-header">
        <div class="cat-zh">${cat.title_zh}</div>
        <div class="cat-en">${cat.title_en}</div>
    </header>

    <div class="embla tea-scroll">
        <div class="embla__viewport">
        <div class="embla__container">
            ${cat.list
            .map(
                (p) => `
                <div class="embla__slide">
                <article class="tea-card" data-id="${p.id}" data-cat="${cat.key}">
                    <div class="title">${p.title}</div>
                    <div class="meta">${p.tagline || ""}</div>
                    <div class="meta price-line">NT$ ${p.price} / ${p.unit || ""}</div>
                </article>
                </div>
                `
            )
            .join("")}
        </div>
        </div>
    </div>
    `;
    
    container.appendChild(sec);
  });

  // 🔥 修正點：元素都上畫面了，才執行初始化
  initTeaScenesCarousel();
  // === 優化後的 Scroll Listener (節流版) ===
  const scenes = $$(".tea-scene");

  const updateAurora = () => {
    let best = null;
    let minDist = Infinity;

    scenes.forEach((sec) => {
      const rect = sec.getBoundingClientRect();
      // 視窗外優化
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;

      const mid = rect.top + rect.height / 2;
      const dist = Math.abs(mid - window.innerHeight / 2);

      if (dist < minDist) {
        minDist = dist;
        best = sec.dataset.cat;
      }
    });

    if (best) {
        const cfg = CATEGORY_MAP.find((c) => c.key === best);
        if (cfg) AURORA.setColor(cfg.colorA, cfg.colorB);
    }
  };

  let ticking = false;
  window.addEventListener("scroll", () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        updateAurora();
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
  
  updateAurora(); // 初始執行
}

// ============================================================
// 🟩 單品 Modal（開啟 / 關閉 / 拖曳）- 適配 Sticky Header 版
// ============================================================
export function initTeaModal() {
  const modal = $("teaModal");
  const sheet = $("teaSheet");
  const container = $("teaCollection");
  const modalTitle = $("modalTitle");
  const closeBtn = $("closeModalBtn");

  if (!modal || !sheet || !container) return;

  // === 1. 開啟 Modal ===
  document.addEventListener("click", (e) => {
    const card = e.target.closest(".tea-card");
    if (!card) return; // 防止 Carousel 拖曳誤觸

    const id = card.dataset.id;
    const product = CONFIG.PRODUCTS.find((p) => p.id == id);
    if (!product) return;

    // 🔍 查找分類資訊
    const catInfo = CATEGORY_MAP.find((c) => c.key === product.category);

    // 顯示 Modal
    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
    
    // 🔥【關鍵修正】標題改成「分類名稱」，並加上分類的主題色
    if (catInfo) {
        // 加上一個小葉子圖示 🌿 + 分類中文名
        modalTitle.innerHTML = `🌿 ${catInfo.title_zh}`; 
        modalTitle.style.color = catInfo.profileColor; // 讓標題顏色跟著分類變
    } else {
        modalTitle.textContent = "精選茗茶";
        modalTitle.style.color = "#5a7b68";
    }
    
    // 渲染內容
    renderSingleProduct(product, container, catInfo);

    // 鎖定背景捲動
    if (window.bodyScrollLock) window.bodyScrollLock.disableBodyScroll(container);

    setTimeout(() => initQtyControls(), 50);
    
    // 同步極光背景顏色
    if (typeof AURORA !== 'undefined' && catInfo) {
        AURORA.setColor(catInfo.colorA, catInfo.colorB);
    }
  });

  // === 2. 關閉 Modal ===
  const close = () => {
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
    
    sheet.style.transition = "transform 0.3s ease";
    sheet.style.transform = "";
    
    if (window.bodyScrollLock) window.bodyScrollLock.enableBodyScroll(container);

    setTimeout(() => {
      container.innerHTML = "";
      modalTitle.textContent = "";
      sheet.style.transition = ""; 
    }, 300);
  };

  if (closeBtn) closeBtn.addEventListener("click", close);
  modal.addEventListener("click", (e) => {
    if (e.target === modal || e.target.classList.contains("tea-modal-bg")) {
      close();
    }
  });

  // === 3. Hammer.js 拖曳下拉 (綁定在 Header 上) ===
  if (window.Hammer) {
    const headerEl = document.querySelector(".tea-modal-header");
    if (headerEl) {
        const hammer = new Hammer(headerEl);
        hammer.get('pan').set({ direction: Hammer.DIRECTION_VERTICAL, threshold: 10 });

        let currentY = 0;
        let isDragging = false;

        hammer.on("panstart", (e) => {
            if (e.deltaY > 0) { // 只允許下拉
                isDragging = true;
                sheet.style.transition = "none";
            }
        });

        hammer.on("panmove", (e) => {
          if (!isDragging) return;
          if (e.deltaY > 0) {
            currentY = e.deltaY * 0.7;
            sheet.style.transform = `translateY(${currentY}px)`;
          }
        });

        hammer.on("panend", (e) => {
          if (!isDragging) return;
          isDragging = false;
          sheet.style.transition = "transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)";

          if (currentY > 120 || (e.deltaY > 0 && e.velocityY > 0.6)) {
            sheet.style.transform = `translateY(100%)`;
            close();
          } else {
            sheet.style.transform = "";
          }
          currentY = 0;
        });
    }
  }
}

// ============================================================
// 🟩 Modal 內單品渲染 (內容保持不變)
// ============================================================
function renderSingleProduct(p, container, catInfo) {
  container.innerHTML = "";
  
  // 1. 設定主題色
  const themeColor = catInfo?.profileColor || "#5a7b68";
  container.style.setProperty('--pcolor', themeColor);
  
  // 2. 主卡片 (Hero Card)
  const item = document.createElement("article");
  item.className = "itemcard";

  const saved = (JSON.parse(localStorage.getItem("teaOrderCart") || "{}"))[p.id] || { qty: 0, pack: false, packQty: 0 };
  const savedQty = saved.qty || 0;
  const savedPack = saved.pack || false;
  const savedPackQty = saved.packQty || 1;
  const stock = Number(p.stock || 0);

  function renderStockTag(stock) {
    if (stock === 0) return `<div class="stock-tag soldout">🚫 缺貨中</div>`;
    if (stock <= 5) return `<div class="stock-tag low">⚡ 僅剩 ${stock} 件</div>`;
    return `<div class="stock-tag ok">🟢 庫存充足</div>`;
  }

  // 裝罐選項
  const packHtml = p.packable ? `
      <div class="pack-row ${savedPack ? 'active' : ''}">
        <label class="pack-toggle">
          <input type="checkbox" id="pack-${p.id}" ${savedPack ? "checked" : ""}>
          ✨ 加購精緻茶罐裝
        </label>
        <div class="pack-qty ${savedPack ? "" : "hidden"}" id="packQtyWrap-${p.id}">
          <button class="step" data-dir="minus" data-pack="${p.id}">−</button>
          <input type="number" id="packQty-${p.id}" value="${savedPackQty}" min="1">
          <button class="step" data-dir="plus" data-pack="${p.id}">＋</button>
        </div>
      </div>` : "";

  // 主卡片 HTML
  item.innerHTML = `
    <div class="title">${p.title}</div>
    <div class="meta">${p.tagline || ""}</div>
    <div class="meta price-line" style="font-family:'Noto Serif TC', serif; font-weight:700; font-size:18px; color:#b8860b;">
       NT$ ${Number(p.price).toLocaleString()} <span style="font-size:13px; color:#888; font-weight:400;">/ ${p.unit}</span>
    </div>
    ${renderStockTag(stock)}
    
    <div style="display:flex; align-items:center; justify-content:space-between; margin-top:12px;">
        <span style="font-size:15px; font-weight:700; color:#2f4b3c;">購買數量</span>
        <div class="qty-row">
          <button class="qty-btn" data-id="${p.id}" data-dir="minus">−</button>
          <input class="qty-input" id="qty-${p.id}" type="number" value="${savedQty}" min="0">
          <button class="qty-btn" data-id="${p.id}" data-dir="plus">＋</button>
        </div>
    </div>
  `;
  container.appendChild(item);
  
  // 插入裝罐選項 (在主卡片後)
  if (packHtml) {
      const packContainer = document.createElement("div");
      packContainer.innerHTML = packHtml;
      container.appendChild(packContainer.firstElementChild);
  }

  // 3. 描述區塊
  if (p.story) {
    const detail = document.createElement("div");
    detail.className = "detailblock open"; // 預設展開
    detail.innerHTML = `<p>${p.story}</p>`;
    container.appendChild(detail);
  }

  // 4. 性格分析
  const profileHtml = renderProfileGroup(p);
  if (profileHtml) {
      container.insertAdjacentHTML('beforeend', profileHtml);
  }

  // 5. 泡法指南
  const brewHtml = renderBrewGuide(p);
  if (brewHtml) {
      container.insertAdjacentHTML('beforeend', brewHtml);
  }

  // 庫存控制邏輯 (維持原樣)
  const qtyInput = container.querySelector(`#qty-${p.id}`);
  const plusBtn = container.querySelector(`.qty-btn[data-dir="plus"]`);
  const minusBtn = container.querySelector(`.qty-btn[data-dir="minus"]`);

  if (stock === 0) {
    if(qtyInput) { qtyInput.value = 0; qtyInput.disabled = true; }
    if(plusBtn) plusBtn.disabled = true;
    if(minusBtn) minusBtn.disabled = true;
  } else {
    if(qtyInput) {
        qtyInput.addEventListener("input", () => {
          let v = parseInt(qtyInput.value, 10);
          if (isNaN(v)) v = 0;
          if (v > stock) v = stock;
          if (v < 0) v = 0;
          qtyInput.value = v;
        });
    }
    if (plusBtn) {
      plusBtn.addEventListener("click", (e) => {
        let v = parseInt(qtyInput.value, 10) || 0;
        if (v >= stock) {
          e.stopImmediatePropagation();
          e.preventDefault();
          qtyInput.value = stock;
          // 可以加個 toast 提示庫存不足
        }
      });
    }
  }

  setTimeout(() => updatePackUI(p.id), 10);
}
// 🌈 茶性格渲染 (旗艦儀表板結構)
function renderProfileGroup(p) {
  const labels = ["甜度", "香氣", "焙火", "厚度", "餘韻"];
  const values = [p.profile_sweetness, p.profile_aroma, p.profile_roast, p.profile_body, p.profile_finish];
  
  if (!values.some((v) => v)) return ""; // 如果沒資料就不顯示

  let barsHtml = "";
  labels.forEach((label, i) => {
      const val = values[i] || 0;
      let blocks = "";
      for(let k=1; k<=5; k++) {
          blocks += `<div class="blk ${k <= val ? 'on' : ''}"></div>`;
      }
      barsHtml += `
        <div class="profile-row">
            <span class="profile-label">${label}</span>
            <div class="profile-bar">${blocks}</div>
        </div>
      `;
  });

  return `
    <div class="profile-section">
        <div class="profile-title">風味分析 PROFILE</div>
        <div class="profile-blocks">
            ${barsHtml}
        </div>
    </div>
  `;
}
// ♨️ 泡法指南渲染 (卡片化結構)
function renderBrewGuide(p) {
    const hot = [["茶葉量", p.brew_hot_grams], ["熱水量", p.brew_hot_water_ml], ["水溫", p.brew_hot_temp_c], ["浸泡時間", p.brew_hot_time_s], ["可回沖", p.brew_hot_infusions]].filter(x => x[1] && x[1] !== "");
    const cold = [["茶葉量", p.brew_cold_grams], ["冷水量", p.brew_cold_water_ml], ["冷泡時間", p.brew_cold_hours]].filter(x => x[1] && x[1] !== "");

    if (hot.length === 0 && cold.length === 0) return "";

    let html = `<div class="brew-section open">`;
    
    if (hot.length) {
        html += `<div class="brew-title">♨️ 熱泡 Hot Brew</div>`;
        hot.forEach(h => {
            html += `<div class="brew-row"><span>${h[0]}</span><span>${h[1]}</span></div>`;
        });
    }

    if (cold.length) {
        html += `<div class="brew-title" style="margin-top:24px;">🧊 冷泡 Cold Brew</div>`;
        cold.forEach(c => {
            html += `<div class="brew-row"><span>${c[0]}</span><span>${c[1]}</span></div>`;
        });
    }

    html += `</div>`;
    return html;
}

function darkenRGBA(rgba, factor = 0.35) {
  const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/);
  if (!match) return rgba;
  let [_, r, g, b, a] = match;
  r = Math.round(r * (1 - factor));
  g = Math.round(g * (1 - factor));
  b = Math.round(b * (1 - factor));
  a = a !== undefined ? a : 1;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// ============================================================
// 🌌 Tea Scenes Carousel (必須在元素加入 DOM 後執行)
// ============================================================
function initTeaScenesCarousel() {
  const viewports = document.querySelectorAll(".tea-scene .embla__viewport");

  viewports.forEach(vp => {
    if (vp.__emblaInstance) return; 

    if (window.EmblaCarousel) {
        const embla = EmblaCarousel(vp, {
          align: "start",
          containScroll: "trimSnaps",
          dragFree: true, // ✅ 改成 true，滑起來更像原生 App 的商品列
        });
        vp.__emblaInstance = embla;
    }
  });
}