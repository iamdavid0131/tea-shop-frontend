// ============================================================
// 🍃 product.js — Aurora Mist（極光茶霧）版
// ============================================================
import { $, $$ } from "./dom.js";
import { updatePackUI, initQtyControls } from "./qty.js";
import { CATEGORY_MAP } from "./category-map.js";
import { CONFIG } from "./config.js";

// ============================================================
// 🌌 Aurora Mist Engine — 極光茶霧動畫
// ============================================================
import gsap from "https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js?module";


const AURORA = {
  layers: [],
  init() {
    this.layers = [
      document.querySelector(".layer-1"),
      document.querySelector(".layer-2"),
      document.querySelector(".layer-3"),
    ];

    // 漂浮動畫（極慢、輕柔、永續）
    this.layers.forEach((layer, i) => {
      gsap.to(layer, {
        x: "+=120",
        y: "+=80",
        duration: 20 + i * 5,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    });
  },

  /** 分類切換時的光霧推動效果 */
  push(colorA, colorB) {
    this.layers.forEach((layer, i) => {
      gsap.to(layer, {
        background: `radial-gradient(circle at 30% 30%, ${colorA}, transparent 70%)`,
        duration: 1.5,
        ease: "sine.out",
      });

      gsap.to(layer, {
        x: "+=160",
        duration: 2 + i * 0.2,
        ease: "power1.out",
      });

      // 回彈
      gsap.to(layer, {
        x: "-=120",
        delay: 2,
        duration: 3 + i * 0.3,
        ease: "power2.out",
      });
    });
  },
};

// ============================================================
// 🟩 主畫面渲染（直向分類 + 極光背景）
// ============================================================
export function renderTeaScenes() {
  const items = CONFIG.PRODUCTS; 
  const container = $("teaScenes");
  container.innerHTML = "";

  // 分類分組
  const categories = {};
  items.forEach((p) => {
    if (!categories[p.category]) categories[p.category] = [];
    categories[p.category].push(p);
  });

  // 依 CATEGORY_MAP 排序
  const sortedCats = CATEGORY_MAP
    .map((c) => ({
      ...c,
      list: categories[c.key] || [],
    }))
    .filter((c) => c.list.length > 0);

  // 初始化極光
  AURORA.init();

  // 渲染每個分類（直向呈現）
  sortedCats.forEach((cat) => {
    const sec = document.createElement("section");
    sec.className = "tea-scene";
    sec.dataset.cat = cat.key;

    sec.innerHTML = `
      <header class="tea-scene-header">
        <div class="cat-zh">${cat.title_zh}</div>
        <div class="cat-en">${cat.title_en}</div>
        <button class="see-all" data-cat="${cat.key}">查看全部 ▸</button>
      </header>

      <div class="tea-scroll">
        ${cat.list
          .slice(0, 6)
          .map(
            (p) => `
          <div class="tea-card">
            <div class="title">${p.title}</div>
            <div class="meta">${p.tagline || ""}</div>
            <div class="meta">NT$ ${p.price} / ${p.unit || ""}</div>
          </div>
        `
          )
          .join("")}

        <div class="view-more-card see-all" data-cat="${cat.key}">
          更多
        </div>
      </div>
    `;

    container.appendChild(sec);
  });

  // 分類捲動 → 極光變色
  container.addEventListener("scroll", () => {
    const sections = $$(".tea-scene");
    let index = Math.round(container.scrollTop / window.innerHeight);
    index = Math.max(0, Math.min(index, sections.length - 1));

    const catKey = sections[index].dataset.cat;
    const cfg = CATEGORY_MAP.find((c) => c.key === catKey);

    if (cfg) AURORA.push(cfg.colorA, cfg.colorB);
  });
}

// ============================================================
// 🟩 Modal（查看全部）
// ============================================================
export function initTeaModal(items) {
  const modal = $("teaModal");
  const modalContent = $("teaCollection");
  const modalTitle = $("modalTitle");
  const closeBtn = $("closeModalBtn");
  const modalBg = $(".tea-modal-bg");

  document.addEventListener("click", (e) => {
    const trigger = e.target.closest(".see-all");
    if (!trigger) return;

    const cat = trigger.dataset.cat;
    const list = items.filter((p) => p.category === cat);

    modal.classList.add("show");

    const catInfo = CATEGORY_MAP.find((c) => c.key === cat);

    modalTitle.textContent =
      `${catInfo?.title_zh || cat} ${catInfo?.title_en ? `｜${catInfo.title_en}` : ""}`;

    renderTeaCollection(list, modalContent);

    // 初始化 qty + pack
    setTimeout(() => initQtyControls(), 50);
  });

  // 關閉 modal
  [closeBtn, modalBg].forEach((el) =>
    el.addEventListener("click", () => {
      modal.classList.remove("show");
      modalContent.innerHTML = "";
      modalTitle.textContent = "";
    })
  );
}

// ============================================================
// 🟩 Modal 內商品渲染
// ============================================================
function renderTeaCollection(list, container) {
  container.innerHTML = "";

  list.forEach((p) => {
    const item = document.createElement("div");
    item.className = "itemcard";

    const packHtml = p.packable
      ? `
      <div class="pack-row">
        <label><input type="checkbox" id="pack-${p.id}"> 裝罐</label>
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
      <div class="meta">NT$ ${p.price} / ${p.unit}</div>

      <div class="qty-row">
        <button class="qty-btn" data-id="${p.id}" data-dir="minus">−</button>
        <input type="number" id="qty-${p.id}" class="qty-input" value="0" min="0">
        <button class="qty-btn" data-id="${p.id}" data-dir="plus">＋</button>
      </div>

      ${packHtml}

      <button class="more-btn" data-id="${p.id}">
        <span>詳細說明</span> ▾
      </button>

      <div class="detailblock" id="detail-${p.id}">
        ${p.story ? `<p>${p.story}</p>` : ""}
        ${renderProfileGroup(p)}
      </div>
    `;

    container.appendChild(item);
    setTimeout(() => updatePackUI(p.id), 50);
  });
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
                  `<div class="blk ${j < values[i] ? "on" : ""}"></div>`
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
// 🟩 詳細說明切換
// ============================================================
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".more-btn");
  if (!btn) return;

  const id = btn.dataset.id;
  const block = $(`detail-${id}`);
  const open = block.classList.contains("open");

  $$(".detailblock").forEach((el) => el.classList.remove("open"));
  $$(".more-btn").forEach((el) => el.classList.remove("active"));

  if (!open) {
    btn.classList.add("active");
    block.classList.add("open");
  }
});
