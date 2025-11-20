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
      gsap.to(layer, {
        background: `radial-gradient(circle at 30% 30%, ${colorA}, ${colorB}, transparent 70%)`,
        duration: 1.8,
        ease: "sine.out",
      });

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

  const categories = {};
  items.forEach((p) => {
    if (!categories[p.category]) categories[p.category] = [];
    categories[p.category].push(p);
  });

  const sortedCats = CATEGORY_MAP
    .map((c) => ({ ...c, list: categories[c.key] || [] }))
    .filter((c) => c.list.length > 0)
    .sort((a, b) => (a.order || 999) - (b.order || 999));

  AURORA.init();

  sortedCats.forEach((cat) => {
    const sec = document.createElement("section");
    sec.className = "tea-scene";
    sec.dataset.cat = cat.key;

    /* ⭐ 自動注入 Aurora 主色、次色 */
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
    initTeaScenesCarousel();
    container.appendChild(sec);
  });

  const scenes = $$(".tea-scene");

  const updateAurora = () => {
    let best = null;
    let minDist = Infinity;

    scenes.forEach((sec) => {
      const rect = sec.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      const dist = Math.abs(mid - window.innerHeight / 2);

      if (dist < minDist) {
        minDist = dist;
        best = sec.dataset.cat;
      }
    });

    const cfg = CATEGORY_MAP.find((c) => c.key === best);
    if (cfg) AURORA.setColor(cfg.colorA, cfg.colorB);
  };

  updateAurora();
  window.addEventListener("scroll", updateAurora, { passive: true });
}

// ============================================================
// 🟩 單品 Modal（開啟 / 關閉 / 拖曳）
// ============================================================
export function initTeaModal() {
  const modal = $("teaModal");
  const modalC = $("teaCollection"); // 內容容器
  const modalTitle = $("modalTitle");
  const closeBtn = $("closeModalBtn");
  const modalBg = $(".tea-modal-bg"); // 背板

  if (!modal || !modalC) return;

  // === 1. 開啟 Modal 邏輯 ===
  document.addEventListener("click", (e) => {
    const card = e.target.closest(".tea-card");
    if (!card) return;

    const id = card.dataset.id;
    const product = CONFIG.PRODUCTS.find((p) => p.id == id);
    if (!product) return;

    const catInfo = CATEGORY_MAP.find((c) => c.key === card.dataset.cat);

    // 顯示 Modal
    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
    
    // 鎖定背景捲動 (選用)
    if (window.bodyScrollLock) window.bodyScrollLock.disableBodyScroll(modalC);

    modalTitle.textContent = `${product.title}｜${catInfo?.title_zh || ""}`;
    renderSingleProduct(product, modalC, catInfo);

    // 初始化數量控制與動畫
    setTimeout(() => initQtyControls(), 50);
    AURORA.setColor(catInfo?.colorA, catInfo?.colorB);
  });

  // === 2. 關閉 Modal 函數 ===
  const close = () => {
    modal.style.transition = "opacity 0.3s ease";
    modalC.style.transition = "transform 0.3s ease";
    
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
    
    // 重置樣式 (避免拖曳殘留)
    modalC.style.transform = "";
    
    // 解除鎖定
    if (window.bodyScrollLock) window.bodyScrollLock.enableBodyScroll(modalC);

    // 清空內容
    setTimeout(() => {
      modalC.innerHTML = "";
      modalTitle.textContent = "";
      modal.style.transition = ""; // 重置 transition
      modalC.style.transition = "";
    }, 300);
  };

  // === 3. 綁定關閉事件 (修正背板點擊) ===
  if (closeBtn) closeBtn.addEventListener("click", close);
  
  // 監聽 Modal 本體點擊
  modal.addEventListener("click", (e) => {
    // 如果點擊的是 modal 容器本身 (即背板區域) 或是明確的 bg class
    if (e.target === modal || e.target.classList.contains("tea-modal-bg")) {
      close();
    }
  });

  // === 4. Hammer.js 拖曳下拉關閉 (仿 StorePicker) ===
  if (window.Hammer) {
    const hammer = new Hammer(modalC);
    hammer.get('pan').set({ direction: Hammer.DIRECTION_VERTICAL, threshold: 10 });

    let currentY = 0;
    let isDragging = false;

    hammer.on("panstart", (e) => {
      // 只有當內容捲動在最頂部時，才允許下拉關閉
      if (modalC.scrollTop <= 0) {
        isDragging = true;
        modalC.style.transition = "none"; // 拖曳時移除過渡動畫
      } else {
        isDragging = false;
      }
    });

    hammer.on("panmove", (e) => {
      if (!isDragging) return;

      // 只允許向下拉 (deltaY > 0)
      if (e.deltaY > 0) {
        // 阻尼效果，拉動距離打折
        currentY = e.deltaY * 0.6; 
        modalC.style.transform = `translateY(${currentY}px)`;
      }
    });

    hammer.on("panend", (e) => {
      if (!isDragging) return;
      isDragging = false;

      modalC.style.transition = "transform 0.25s ease";

      // 判斷：下拉超過 120px 或 速度夠快 -> 關閉
      if (currentY > 120 || (e.deltaY > 0 && e.velocityY > 0.5)) {
        // 這裡讓它繼續往下滑出視窗，視覺更順暢
        modalC.style.transform = `translateY(100%)`;
        close();
      } else {
        // 回彈
        modalC.style.transform = "";
      }
      currentY = 0;
    });
  }
}

// ============================================================
// 🟩 Modal 內單品渲染
// ============================================================
function renderSingleProduct(p, container, catInfo) {
  container.innerHTML = "";

  const item = document.createElement("article");
  item.className = "itemcard";

  // === 讀取 saved cart ===
  const saved = (JSON.parse(localStorage.getItem("teaOrderCart") || "{}"))[p.id] || {
    qty: 0,
    pack: false,
    packQty: 0,
  };

  const savedQty = saved.qty || 0;
  const savedPack = saved.pack || false;
  const savedPackQty = saved.packQty || 1;
  const stock = Number(p.stock || 0);

  function renderStockTag(stock) {
    if (stock === 0) return `<div class="stock-tag soldout">缺貨中</div>`;
    if (stock <= 5) return `<div class="stock-tag low">剩 ${stock} 件</div>`;
    return `<div class="stock-tag ok">庫存 ${stock} 件</div>`;
  }

  // === 裝罐 HTML ===
  const packHtml = p.packable
    ? `
      <div class="pack-row">
        <label class="pack-toggle">
          <input type="checkbox" id="pack-${p.id}" ${savedPack ? "checked" : ""}>
          裝罐
        </label>

        <div class="pack-qty ${savedPack ? "" : "hidden"}" id="packQtyWrap-${p.id}">
          <button class="step" data-dir="minus" data-pack="${p.id}">−</button>
          <input type="number" id="packQty-${p.id}" value="${savedPackQty}" min="1">
          <button class="step" data-dir="plus" data-pack="${p.id}">＋</button>
        </div>
      </div>
    `
    : "";

  const profileColor = catInfo?.profileColor || "#78cfa8";

  item.innerHTML = `
    <div class="title">${p.title}</div>
    <div class="meta">${p.tagline || ""}</div>
    <div class="meta price-line">NT$ ${p.price} / ${p.unit}</div>

     ${renderStockTag(stock)}

    <div class="qty-row">
      <button class="qty-btn" data-id="${p.id}" data-dir="minus">−</button>
      <input class="qty-input" id="qty-${p.id}" type="number" value="${savedQty}" min="0">
      <button class="qty-btn" data-id="${p.id}" data-dir="plus">＋</button>
    </div>

    ${packHtml}

    <div class="detailblock open" id="detail-${p.id}">
      ${p.story ? `<p>${p.story}</p>` : ""}
      ${renderProfileGroup(p, profileColor)}
      ${renderBrewGuide(p)}
    </div>
  `;

  container.appendChild(item);

  // ============================================================
  // 🔥🔥 庫存控制 (Local Logic)
  // ============================================================
  const qtyInput = container.querySelector(`#qty-${p.id}`);
  const plusBtn = container.querySelector(`.qty-btn[data-dir="plus"]`);
  const minusBtn = container.querySelector(`.qty-btn[data-dir="minus"]`);

  if (stock === 0) {
    qtyInput.value = 0;
    qtyInput.disabled = true;
    if (plusBtn) plusBtn.disabled = true;
    if (minusBtn) minusBtn.disabled = true;
  } else {
    // 限制輸入最大值
    qtyInput.addEventListener("input", () => {
      let v = parseInt(qtyInput.value, 10);
      if (isNaN(v)) v = 0;
      if (v > stock) {
        v = stock;
        // 可選： toast('庫存不足');
      }
      if (v < 0) v = 0;
      qtyInput.value = v;
    });

    // 按鈕邏輯 (輔助，主要邏輯可能在 qty.js 但這裡做雙重防護)
    if (plusBtn) {
      plusBtn.addEventListener("click", (e) => {
        let v = parseInt(qtyInput.value, 10) || 0;
        if (v >= stock) {
          e.stopImmediatePropagation(); // 阻止 qty.js 增加
          e.preventDefault();
          qtyInput.value = stock;
        }
      });
    }
  }

  // === 初始化裝罐 UI ===
  setTimeout(() => updatePackUI(p.id), 10);

  // === 進場動畫 ===
  requestAnimationFrame(() => {
    const animateEls = container.querySelectorAll(
      `#detail-${p.id} .profile-bar .blk.on,
       #detail-${p.id} .brew-row`
    );

    animateEls.forEach((el, i) => {
      el.style.opacity = 0;
      el.style.transform = "translateY(8px)";
      setTimeout(() => {
        el.style.transition = "opacity .35s var(--ease-soft), transform .35s var(--ease-soft)";
        el.style.opacity = 1;
        el.style.transform = "translateY(0)";
      }, 50 + i * 40);
    });
  });
}

// ============================================================
// 🟩 Profile 條
// ============================================================
function renderProfileGroup(p, color) {
  const labels = ["甜度", "香氣", "焙火", "厚度", "餘韻"];
  const values = [
    p.profile_sweetness,
    p.profile_aroma,
    p.profile_roast,
    p.profile_body,
    p.profile_finish,
  ];

  if (!values.some((v) => v)) return "";

  return `
    <div class="profile-blocks" data-color="${color}">
      ${labels
        .map(
          (label, i) => `
        <div class="bar">
          <b>${label}</b>
          <div class="profile-bar">
            ${Array.from({ length: 5 })
              .map(
                (_, j) =>
                  `<div class="blk ${j < (values[i] || 0) ? "on" : ""}"
                        style="--pcolor:${color};"></div>`
              )
              .join("")}
          </div>
        </div>
      `
        )
        .join("")}
    </div>
  `;
}

// ============================================================
// 🫧 Brew Guide（泡法）
// ============================================================
function renderBrewGuide(p) {
    const hot = [
    ["茶葉量", p.brew_hot_grams],
    ["熱水量", p.brew_hot_water_ml],
    ["水溫", p.brew_hot_temp_c],
    ["浸泡時間", p.brew_hot_time_s],
    ["可回沖", p.brew_hot_infusions],
    ].filter(x => x[1] !== "" && x[1] != null)

    const cold = [
        ["茶葉量", p.brew_cold_grams],
        ["冷水量", p.brew_cold_water_ml],
        ["冷泡時間", p.brew_cold_hours],
    ].filter(x => x[1] !== "" && x[1] != null)

  if (hot.length === 0 && cold.length === 0) return "";

  return `
    <div class="brew-section open" id="brew-${p.id}">
      <div class="brew-title">♨️ 熱泡 Hot Brew</div>
      ${hot.map(h => `<div class="brew-row"><span>${h[0]}</span><span>${h[1]}</span></div>`).join("")}

      ${cold.length ? `
      <div class="brew-title" style="margin-top:12px;">🧊 冷泡 Cold Brew</div>
      ${cold.map(c => `<div class="brew-row"><span>${c[0]}</span><span>${c[1]}</span></div>`).join("")}
      ` : ""}
    </div>
  `;
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
// 🌌 Tea Scenes Carousel
// ============================================================
function initTeaScenesCarousel() {
  const viewports = document.querySelectorAll(".embla__viewport");

  viewports.forEach(vp => {
    if (vp.__emblaInstance) return; 

    const embla = EmblaCarousel(vp, {
      align: "start",
      containScroll: "trimSnaps",
      dragFree: false,
    });

    vp.__emblaInstance = embla;
  });
}