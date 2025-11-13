// ============================================================
// 🍃 products.js — Aurora Mist（極光茶霧）完整版（Final）
// ============================================================

import { $, $$ } from "./dom.js";
import { updatePackUI, initQtyControls } from "./qty.js";
import { CATEGORY_MAP } from "./category-map.js";
import { CONFIG } from "./config.js";

// ============================================================
// 🌌 Aurora Mist Engine — 極光茶霧動畫
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

    // 🌫️ 基礎漂浮（超慢 + 平滑）
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

  /** 依分類切換極光色系 */
  setColor(colorA, colorB) {
    if (!window.gsap || this.layers.length === 0) return;

    this.layers.forEach((layer, i) => {
      gsap.to(layer, {
        background: `radial-gradient(circle at 30% 30%, ${colorA}, ${colorB}, transparent 70%)`,
        duration: 1.8,
        ease: "sine.out",
      });

      // 小幅度推動
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
// 🟩 主畫面渲染（縱向分類 + 橫向卡片）
// ============================================================
export function renderTeaScenes() {
  const items = CONFIG.PRODUCTS || [];
  const container = $("teaScenes");
  if (!container) return;

  container.innerHTML = "";

  // 分類分組
  const categories = {};
  items.forEach((p) => {
    if (!categories[p.category]) categories[p.category] = [];
    categories[p.category].push(p);
  });

  // 排序 & 加上詩意分類名稱
  const sortedCats = CATEGORY_MAP
    .map((c) => ({
      ...c,
      list: categories[c.key] || [],
    }))
    .filter((c) => c.list.length > 0)
    .sort((a, b) => (a.order || 999) - (b.order || 999));

  // 初始化極光
  AURORA.init();

  sortedCats.forEach((cat) => {
    const sec = document.createElement("section");
    sec.className = "tea-scene";
    sec.dataset.cat = cat.key;

    sec.innerHTML = `
      <header class="tea-scene-header">
        <div class="cat-zh">${cat.title_zh}</div>
        <div class="cat-en">${cat.title_en}</div>
      </header>

      <div class="tea-scroll">
        ${cat.list
          .map(
            (p) => `
          <article class="tea-card" data-id="${p.id}" data-cat="${cat.key}">
            <div class="title">${p.title}</div>
            <div class="meta">${p.tagline || ""}</div>
            <div class="meta price-line">NT$ ${p.price} / ${p.unit || ""}</div>
          </article>
        `
          )
          .join("")}
      </div>
    `;

    container.appendChild(sec);
  });

  // 🔥 捲動分類 → 更新霧光
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
// 🟩 單品 Modal（點茶卡開啟）
// ============================================================
export function initTeaModal() {
  const modal = $("teaModal");
  const modalC = $("teaCollection");
  const modalTitle = $("modalTitle");
  const closeBtn = $("closeModalBtn");
  const modalBg = $(".tea-modal-bg");

  if (!modal || !modalC) return;

  // —— 打開 Modal：點單一個商品卡 ——
  document.addEventListener("click", (e) => {
    const card = e.target.closest(".tea-card");
    if (!card) return;

    const id = card.dataset.id;
    const product = CONFIG.PRODUCTS.find((p) => p.id == id);
    if (!product) return;

    const catInfo = CATEGORY_MAP.find((c) => c.key === card.dataset.cat);

    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");

    modalTitle.textContent =
      `${product.title}｜${catInfo?.title_zh || ""}`;

    renderSingleProduct(product, modalC);

    // 初始化 qty / pack
    setTimeout(() => initQtyControls(), 50);

    // 自動展開詳細說明
    const detail = modalC.querySelector(".detailblock");
    const btn = modalC.querySelector(".more-btn");
    if (detail && btn) {
      detail.classList.add("open");
      btn.classList.add("active");
    }

    // Aurora 變色
    AURORA.setColor(catInfo?.colorA, catInfo?.colorB);
  });

  // —— 關閉 Modal ——
  const close = () => {
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
    modalC.innerHTML = "";
    modalTitle.textContent = "";
  };

  [modalBg, closeBtn].forEach((el) => el?.addEventListener("click", close));
}

// ============================================================
// 🟩 Modal 內單品渲染
// ============================================================
function renderSingleProduct(p, container) {
  container.innerHTML = "";

  const item = document.createElement("article");
  item.className = "itemcard";

  const packHtml = p.packable
    ? `
      <div class="pack-row">
        <label class="pack-toggle">
          <input type="checkbox" id="pack-${p.id}">
          裝罐
        </label>
        <div class="pack-qty hidden" id="packQtyWrap-${p.id}">
          <button class="step" data-pack="${p.id}" data-dir="minus">−</button>
          <input type="number" id="packQty-${p.id}" value="0" min="0">
          <button class="step" data-pack="${p.id}" data-dir="plus">＋</button>
        </div>
      </div>`
    : "";

  item.innerHTML = `
      <div class="title">${p.title}</div>
      <div class="meta">${p.tagline || ""}</div>
      <div class="meta price-line">NT$ ${p.price} / ${p.unit}</div>

      <div class="qty-row">
        <button class="qty-btn" data-id="${p.id}" data-dir="minus">−</button>
        <input type="number" id="qty-${p.id}" class="qty-input" value="0" min="0">
        <button class="qty-btn" data-id="${p.id}" data-dir="plus">＋</button>
      </div>

      ${packHtml}

      <button class="more-btn" data-id="${p.id}">
        <span>詳細說明</span>
        <span class="arrow">▾</span>
      </button>

      <div class="detailblock" id="detail-${p.id}">
        ${p.story ? `<p>${p.story}</p>` : ""}
        ${renderProfileGroup(p)}
      </div>
    `;

  container.appendChild(item);

  setTimeout(() => updatePackUI(p.id), 30);
}

// ============================================================
// 🟩 Profile 條
// ============================================================
function renderProfileGroup(p) {
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
    <div class="profile-blocks">
      ${labels
        .map(
          (label, i) => `
        <div class="bar">
          <b>${label}</b>
          <div class="profile-bar">
            ${Array.from({ length: 5 })
              .map(
                (_, j) =>
                  `<div class="blk ${j < (values[i] || 0) ? "on" : ""}"></div>`
              )
              .join("")}
          </div>
        </div>`
        )
        .join("")}
    </div>
  `;
}

// ============================================================
// 🟩 詳細說明切換（Modal 內）
// ============================================================
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".more-btn");
  if (!btn) return;

  const id = btn.dataset.id;
  const block = $(`detail-${id}`);
  if (!block) return;

  const isOpen = block.classList.contains("open");

  // 只閉合其它項目的，不關自己的
  $$(".detailblock").forEach((el) => {
    if (el !== block) el.classList.remove("open");
  });

  $$(".more-btn").forEach((el) => {
    if (el !== btn) el.classList.remove("active");
  });

  if (!isOpen) {
    btn.classList.add("active");
    block.classList.add("open");
  }
});

// ============================================================
// 👆 Aurora Modal 手勢關閉（iOS 阻尼 + 背景淡出 + 霧層位移）
// ============================================================

(function initModalSwipeClose() {
  const modal = document.getElementById("teaModal");
  const content = document.querySelector(".tea-modal-content");
  const bg = document.querySelector(".tea-modal-bg");
  const auroraLayers = [
    document.querySelector(".layer-1"),
    document.querySelector(".layer-2"),
    document.querySelector(".layer-3"),
  ].filter(Boolean);

  if (!modal || !content) return;

  let startY = 0;
  let currentY = 0;
  let dragging = false;
  let threshold = 80;

  // —— iOS 阻尼曲線 —— //
  const rubber = (dy) => {
    const limit = 180; // 最高阻尼距離
    return (dy * 0.5 * limit) / (dy + limit);
  };

  // 開始
  content.addEventListener("touchstart", (e) => {
    if (content.scrollTop <= 0) {
      dragging = true;
      startY = e.touches[0].clientY;
      content.style.transition = "none";
      if (bg) bg.style.transition = "none";

      auroraLayers.forEach((l) => (l.style.transition = "none"));
    }
  });

  // 移動
  content.addEventListener("touchmove", (e) => {
    if (!dragging) return;
    const dy = e.touches[0].clientY - startY;

    if (dy > 0) {
      currentY = rubber(dy);

      // Content panel 下移
      content.style.transform = `translateY(${currentY}px)`;

      // 背景淡出
      if (bg) {
        const opacity = Math.max(0, 0.7 - currentY / 300);
        bg.style.opacity = opacity;
      }

      // Aurora Mist 位移（更高級感）
      auroraLayers.forEach((layer, i) => {
        const offset = currentY * (0.05 + i * 0.03);
        layer.style.transform = `translateY(${offset}px)`;
      });

      e.preventDefault();
    }
  });

  // 結束
  content.addEventListener("touchend", () => {
    if (!dragging) return;
    dragging = false;

    content.style.transition = "transform 0.25s ease";
    if (bg) bg.style.transition = "opacity 0.25s ease";
    auroraLayers.forEach((l) => (l.style.transition = "transform 0.3s ease"));

    if (currentY > threshold) {
      // 👉 關閉 Modal
      modal.classList.remove("show");
      modal.setAttribute("aria-hidden", "true");
      document.getElementById("teaCollection").innerHTML = "";
      document.getElementById("modalTitle").textContent = "";

      // Reset
      content.style.transform = "translateY(0)";
      if (bg) bg.style.opacity = "0";
      auroraLayers.forEach((l) => (l.style.transform = "translateY(0)"));
    } else {
      // 👉 回彈
      content.style.transform = "translateY(0)";
      if (bg) bg.style.opacity = "0.7";
      auroraLayers.forEach((l) => (l.style.transform = "translateY(0)"));
    }

    currentY = 0;
  });
})();

