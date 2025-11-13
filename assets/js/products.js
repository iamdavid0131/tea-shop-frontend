import { $, $$ } from "./dom.js";
import { updatePackUI, initQtyControls } from "./qty.js";
import { CATEGORY_MAP } from "./config.js";

/* ============================================================
🏞️ 主畫面 Scroll Snap 分景渲染
============================================================ */
export function renderTeaScenes(items) {
  const container = $("teaScenes");
  container.innerHTML = "";

  const categories = {};
  items.forEach(p => {
    if (!categories[p.category]) categories[p.category] = [];
    categories[p.category].push(p);
  });

  CATEGORY_MAP.forEach(cat => {
    const list = categories[cat.key];
    if (!list) return;

    const section = document.createElement("section");
    section.className = "tea-scene";
    section.innerHTML = `
      <header class="tea-scene-header">
        <div class="cat-title">
          <div class="zh">${cat.title_zh}</div>
          <div class="en">${cat.title_en}</div>
        </div>
        <button class="see-all" data-cat="${cat.key}">全部</button>
      </header>
      <div class="tea-scroll">
        ${list.slice(0, 6).map(p => `
          <div class="tea-card" data-id="${p.id}">
            <div class="title">${p.title}</div>
            <div class="meta">${p.tagline || ""}</div>
            <div class="meta price">NT$ ${p.price} / ${p.unit || ""}</div>
          </div>`).join("")}
        <div class="view-more-card" data-cat="${cat.key}">更多 ▸</div>
      </div>
    `;
    container.appendChild(section);
  });
}

/* ============================================================
🌫️ Scroll 指示點 + 惯性動畫
============================================================ */
export function initTeaIndicators() {
  const container = $("teaScenes");
  const indicators = $("teaIndicators");
  const scenes = $$(".tea-scene");
  if (!scenes.length) return;

  indicators.innerHTML = scenes.map((_, i) =>
    `<span class="dot ${i === 0 ? "active" : ""}"></span>`).join("");
  const dots = $$(".dot");

  let current = 0;
  let ticking = false;

  container.addEventListener("scroll", () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        const index = Math.round(container.scrollLeft / container.offsetWidth);
        if (index !== current) {
          current = index;
          dots.forEach((d, i) => d.classList.toggle("active", i === index));
        }
        ticking = false;
      });
      ticking = true;
    }
  });
}

/* ============================================================
🫖 Modal
============================================================ */
export function initTeaModal(items) {
  const modal = $("teaModal");
  const modalContent = $("teaCollection");
  const modalTitle = $("modalTitle");
  const closeBtn = $("closeModalBtn");
  const modalBg = $(".tea-modal-bg");

  document.addEventListener("click", (e) => {
    const trigger = e.target.closest(".view-more-card, .see-all");
    if (!trigger) return;
    const cat = trigger.dataset.cat;
    const catInfo = CATEGORY_MAP.find(c => c.key === cat);
    const list = items.filter(p => p.category === cat);

    modal.classList.add("show");
    modalTitle.innerHTML = `
      <div class="zh">${catInfo?.title_zh || cat}</div>
      <div class="en">${catInfo?.title_en || ""}</div>`;
    renderTeaCollection(list, modalContent);
    setTimeout(() => initQtyControls(), 100);
  });

  [closeBtn, modalBg].forEach(el =>
    el?.addEventListener("click", () => {
      modal.classList.remove("show");
      modalContent.innerHTML = "";
    })
  );
}

/* ============================================================
🍃 商品卡與詳情
============================================================ */
function renderTeaCollection(list, container) {
  container.innerHTML = "";
  list.forEach(p => {
    const packHtml = p.packable ? `
      <div class="pack-row">
        <label>
          <input type="checkbox" id="pack-${p.id}"> 裝罐
        </label>
        <div class="pack-qty hidden" id="packQtyWrap-${p.id}">
          <button class="step" data-pack="${p.id}" data-dir="minus">−</button>
          <input type="number" id="packQty-${p.id}" min="0" value="0">
          <button class="step" data-pack="${p.id}" data-dir="plus">＋</button>
        </div>
      </div>` : "";

    const detailHtml = `
      <div class="detailblock" id="detail-${p.id}">
        ${p.story ? `<p>${p.story}</p>` : ""}
        ${p.profile ? renderProfileGroup(p) : ""}
      </div>`;

    const item = document.createElement("div");
    item.className = "itemcard";
    item.innerHTML = `
      <div class="title">${p.title}</div>
      <div class="meta">${p.tagline || ""}</div>
      <div class="meta price">NT$ ${p.price} / ${p.unit || ""}</div>
      <div class="qty-row">
        <button class="qty-btn" data-id="${p.id}" data-dir="minus">−</button>
        <input type="number" id="qty-${p.id}" class="qty-input" value="0" min="0">
        <button class="qty-btn" data-id="${p.id}" data-dir="plus">＋</button>
      </div>
      ${packHtml}
      <button class="more-btn" data-id="${p.id}">詳細說明 ▼</button>
      ${detailHtml}
    `;
    container.appendChild(item);
    setTimeout(() => updatePackUI(p.id), 100);
  });
}

/* ============================================================
🌿 Profile 條
============================================================ */
function renderProfileGroup(p) {
  const labels = ["甜度", "香氣", "焙火", "厚度", "餘韻"];
  const levels = [
    p.profile_sweetness, p.profile_aroma, p.profile_roast, p.profile_body, p.profile_finish
  ];
  return `
    <div class="profile-blocks">
      ${labels.map((l, i) => `
        <div class="bar">
          <b>${l}</b>
          <div class="profile-bar">
            ${Array.from({ length: 5 }).map((_, j) =>
              `<div class="blk ${j < levels[i] ? "on" : ""}" style="--delay:${j * 0.05}s"></div>`
            ).join("")}
          </div>
        </div>`).join("")}
    </div>`;
}

/* ============================================================
🌸 詳細說明開關
============================================================ */
document.addEventListener("click", e => {
  const btn = e.target.closest(".more-btn");
  if (!btn) return;
  const id = btn.dataset.id;
  const block = document.getElementById(`detail-${id}`);
  const open = block.classList.contains("open");
  $$(`.detailblock`).forEach(el => el.classList.remove("open"));
  $$(`.more-btn`).forEach(el => el.classList.remove("active"));
  if (!open) {
    block.classList.add("open");
    btn.classList.add("active");
  }
});
