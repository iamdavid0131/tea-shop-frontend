// ============================================================
// 🍃 tea.js — 祥興自然霧設計系統（固定漸變版）
// ============================================================
import { $, $$ } from "./dom.js";
import { updatePackUI, initQtyControls } from "./qty.js";

/* === Render 主場景 === */
export function renderTeaScenes(items) {
  const container = $("teaScenes");
  const mist = document.querySelector(".tea-bg-mist");
  container.innerHTML = "";

  const categories = {};
  items.forEach(p => {
    if (!categories[p.category]) categories[p.category] = [];
    categories[p.category].push(p);
  });

  const bgMap = {
    "窨花茶品": "linear-gradient(135deg,#f7f2e7,#f3e6c2)",
    "文山包種": "linear-gradient(135deg,#edf7f1,#e8f3ed)",
    "清香高山茶": "linear-gradient(135deg,#e8f3ed,#d7efe3)",
    "焙香烏龍茶": "linear-gradient(135deg,#f5eee4,#f1e3d2)",
    "蜜香茶品": "linear-gradient(135deg,#f9f3e8,#f6e5c9)",
    "紅茶": "linear-gradient(135deg,#f3e8e5,#eecfc6)",
    "白茶": "linear-gradient(135deg,#f6f5f0,#ebe9e0)",
    "加購": "linear-gradient(135deg,#eef5fc,#d9ebff)"
  };

  Object.entries(categories).forEach(([cat, list]) => {
    const section = document.createElement("section");
    section.className = "tea-scene";

    const header = document.createElement("div");
    header.className = "tea-scene-header";
    header.innerHTML = `
      <span>${cat}</span>
      <span class="see-all" data-cat="${cat}">查看更多 ▸</span>
    `;

    const scroll = document.createElement("div");
    scroll.className = "tea-scroll";

    list.slice(0, 6).forEach(p => {
      const card = document.createElement("div");
      card.className = "tea-card";
      card.innerHTML = `
        <div class="title">${p.title}</div>
        <div class="meta">${p.tagline || ""}</div>
        <div class="meta">NT$ ${p.price} / ${p.unit || ""}</div>
      `;
      scroll.appendChild(card);
    });

    const more = document.createElement("div");
    more.className = "view-more-card see-all";
    more.textContent = "更多";
    more.dataset.cat = cat;
    scroll.appendChild(more);

    section.appendChild(header);
    section.appendChild(scroll);
    section.dataset.bg = bgMap[cat] || "linear-gradient(135deg,#e8f3ed,#f7f2e7)";
    container.appendChild(section);
  });

  // 背景漸變切換（固定版）
  container.addEventListener("scroll", () => {
    const sections = $$(".tea-scene");
    let index = Math.round(container.scrollLeft / container.clientWidth);
    index = Math.min(index, sections.length - 1);
    const bg = sections[index]?.dataset.bg;
    if (bg) mist.style.background = bg;
  });
}

/* === Modal === */
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
    const list = items.filter(p => p.category === cat);

    modal.classList.add("show");
    modalTitle.textContent = cat;
    renderTeaCollection(list, modalContent);
    setTimeout(() => initQtyControls(), 100);
  });

  [closeBtn, modalBg].forEach(el =>
    el?.addEventListener("click", () => {
      modal.classList.remove("show");
      modalContent.innerHTML = "";
      modalTitle.textContent = "";
    })
  );
}

/* === Modal 內商品 === */
function renderTeaCollection(list, container) {
  container.innerHTML = "";

  list.forEach(p => {
    const item = document.createElement("div");
    item.className = "itemcard";

    const packHtml = p.packable ? `
      <div class="pack-row">
        <label><input type="checkbox" id="pack-${p.id}"> 裝罐</label>
        <div class="pack-qty hidden" id="packQtyWrap-${p.id}">
          <button class="step" data-pack="${p.id}" data-dir="minus">−</button>
          <input type="number" id="packQty-${p.id}" min="0" value="0">
          <button class="step" data-pack="${p.id}" data-dir="plus">＋</button>
        </div>
      </div>` : "";

    const detailHtml = `
      <div class="detailblock" id="detail-${p.id}">
        ${p.story ? `<p>${p.story}</p>` : ""}
        ${renderProfileGroup(p)}
      </div>`;

    item.innerHTML = `
      <div class="title">${p.title}</div>
      <div class="meta">${p.tagline || ""}</div>
      <div class="meta">NT$ ${p.price} / ${p.unit || ""}</div>
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

/* === Profile 條 === */
function renderProfileGroup(p) {
  const labels = ["甜度", "香氣", "焙火", "厚度", "餘韻"];
  const levels = [
    p.profile_sweetness, p.profile_aroma, p.profile_roast, p.profile_body, p.profile_finish,
  ];
  return `
    <div class="profile-blocks">
      ${labels.map((l, i) => `
        <div class="bar">
          <b>${l}</b>
          <div class="profile-bar">
            ${Array.from({ length: 5 }).map((_, j) =>
              `<div class="blk ${j < levels[i] ? "on" : ""}"></div>`
            ).join("")}
          </div>
        </div>`).join("")}
    </div>`;
}

/* === 詳細說明開關 === */
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".more-btn");
  if (!btn) return;
  const id = btn.dataset.id;
  const block = document.getElementById(`detail-${id}`);
  if (!block) return;
  const open = block.classList.contains("open");
  document.querySelectorAll(".detailblock").forEach(el => el.classList.remove("open"));
  document.querySelectorAll(".more-btn").forEach(el => el.classList.remove("active"));
  if (!open) {
    block.classList.add("open");
    btn.classList.add("active");
  }
});
