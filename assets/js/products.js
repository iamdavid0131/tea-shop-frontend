// ============================================================
// 🍃 products.js — Aurora Mist（極光茶霧）完整版（Final Clean Version）
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
    sec.style.setProperty("--catA", cat.colorA);
    sec.style.setProperty("--catB", cat.colorB);

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
// 🟩 單品 Modal（開啟）
// ============================================================
export function initTeaModal() {
  const modal = $("teaModal");
  const modalC = $("teaCollection");
  const modalTitle = $("modalTitle");
  const closeBtn = $("closeModalBtn");
  const modalBg = $(".tea-modal-bg");

  if (!modal || !modalC) return;

  document.addEventListener("click", (e) => {
    const card = e.target.closest(".tea-card");
    if (!card) return;

    const id = card.dataset.id;
    const product = CONFIG.PRODUCTS.find((p) => p.id == id);
    if (!product) return;

    const catInfo = CATEGORY_MAP.find((c) => c.key === card.dataset.cat);

    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");

    modalTitle.textContent = `${product.title}｜${catInfo?.title_zh || ""}`;

    renderSingleProduct(product, modalC, catInfo);

    setTimeout(() => initQtyControls(), 50);

    AURORA.setColor(catInfo?.colorA, catInfo?.colorB);
  });

  const close = () => {
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
    modalC.innerHTML = "";
    modalTitle.textContent = "";
  };

  [modalBg, closeBtn].forEach((el) => el?.addEventListener("click", close));
};
// ============================================================
// 🟩 Modal 內單品渲染
// ============================================================
function renderSingleProduct(p, container, catInfo) {
    console.log("=== 🧪 DEBUG: Single Product ===");
  console.log("p =", p);
  console.log("catInfo =", catInfo);
  console.log("profileColor =", catInfo?.profileColor);
  console.log("hot brew raw =", p.brew_hot_grams, p.brew_hot_time_s);
  console.log("cold brew raw =", p.brew_cold_grams, p.brew_cold_hours);

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
          <button class="step" data-dir="minus" data-pack="${p.id}">−</button>
          <input type="number" id="packQty-${p.id}" value="0" min="0">
          <button class="step" data-dir="plus" data-pack="${p.id}">＋</button>
        </div>
      </div>
    `
    : "";

  // ⭐ catInfo 一定存在，不會 undefined
  const profileColor = catInfo?.profileColor || "#78cfa8";

  item.innerHTML = `
    <div class="title">${p.title}</div>
    <div class="meta">${p.tagline || ""}</div>
    <div class="meta price-line">NT$ ${p.price} / ${p.unit}</div>

    <div class="qty-row">
      <button class="qty-btn" data-id="${p.id}" data-dir="minus">−</button>
      <input class="qty-input" id="qty-${p.id}" type="number" value="0" min="0">
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

  // 🟩 初始化裝罐 UI
  setTimeout(() => updatePackUI(p.id), 10);

  // 🟩 Profile + Brew 動畫（Stagger）
  setTimeout(() => {
    const animateEls = container.querySelectorAll(
      `#detail-${p.id} .profile-bar .blk.on,
       #detail-${p.id} .brew-row`
    );

    animateEls.forEach((el, i) => {
      el.style.opacity = 0;
      el.style.transform = "translateY(8px)";
      setTimeout(() => {
        el.style.transition =
          "opacity .35s var(--ease-soft), transform .35s var(--ease-soft)";
        el.style.opacity = 1;
        el.style.transform = "translateY(0)";
      }, i * 40);
    });
  }, 50);
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
      ${hot
        .map(
          (h) => `
        <div class="brew-row"><span>${h[0]}</span><span>${h[1]}</span></div>
      `
        )
        .join("")}

      ${
        cold.length
          ? `
      <div class="brew-title" style="margin-top:12px;">🧊 冷泡 Cold Brew</div>
      ${cold
        .map(
          (c) => `
        <div class="brew-row"><span>${c[0]}</span><span>${c[1]}</span></div>
      `
        )
        .join("")}
      `
          : ""
      }
    </div>
  `;
}

