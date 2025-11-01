// ================================
// products.js
// 商品渲染（分類 / 詳情收合 / Profile）
// ================================
import { $, $$ } from "./dom.js";
import { updatePackUI } from "./qty.js";

// === Profile 條動態渲染（自動依茶類決定色調） ===
export function renderProfile(label, level, category = "") {
  const colorMap = {
    窨花: "linear-gradient(90deg, #f8d67e, #f2b33d)",
    高山: "linear-gradient(90deg, #7ddca3, #34c759)",
    紅茶: "linear-gradient(90deg, #ff9671, #ff5a36)",
    白茶: "linear-gradient(90deg, #e6dcc9, #b9a584)",
    焙香: "linear-gradient(90deg, #e1a35a, #c97d42)",
    蜜香: "linear-gradient(90deg, #ffb45a, #ff8c00)",
    文山: "linear-gradient(90deg, #ffb86c, #ff9f0a)",
    加購: "linear-gradient(90deg, #82c9ff, #0a84ff)",
  };

  const gradient =
    Object.entries(colorMap).find(([key]) => category.includes(key))?.[1] ||
    "linear-gradient(90deg, #8cd37f, #34c759, #2fb24c)";

  const max = 5;
  const bars = Array.from({ length: max }, (_, i) => {
    const active = i < level ? "on" : "";
    const delay = i * 0.08;
    return `<div class="blk ${active}" style="--bar-color:${gradient};animation-delay:${delay}s"></div>`;
  }).join("");

  return `
    <div class="bar fade-in">
      <b>${label}</b>
      <div class="profile-bar" data-gradient="${gradient}">${bars}</div>
    </div>
  `;
}

// ============================================================
// 🛍️ 商品渲染（含分類、裝罐、標籤、詳情收合、庫存）
// ============================================================
export function renderProducts(items) {
  const panel = $("categoryList");
  panel.innerHTML = "";

  const categories = {};
  items.forEach((p) => {
    if (!categories[p.category]) categories[p.category] = [];
    categories[p.category].push(p);
  });

  Object.entries(categories).forEach(([cat, list], i) => {
    const section = document.createElement("div");
    section.className = "category-section";

    const header = document.createElement("button");
    header.className = "category-header";
    header.innerHTML = `
      <span class="cat-title">${cat}</span>
      <span class="chev">▼</span>
    `;
    if (i === 0) header.classList.add("open");

    const body = document.createElement("div");
    body.className = "category-body";
    body.style.maxHeight = i === 0 ? "none" : "0";

    list.forEach((p) => {
      const tags = (p.tags || [])
        .filter((t) => t.trim())
        .map((t) => `<span class="tag">${t}</span>`)
        .join("");

      const detailBlock = `
        <div class="detailblock" hidden id="detail-${p.id}">
          ${p.story ? `<p class="story fade-in">${p.story}</p>` : ""}

          ${
            p.profile
              ? `
              <div class="profile-blocks fade-in">
                ${renderProfile("甜度", p.profile.sweetness, p.category)}
                ${renderProfile("香氣", p.profile.aroma, p.category)}
                ${renderProfile("焙火", p.profile.roast, p.category)}
                ${renderProfile("厚度", p.profile.body, p.category)}
                ${renderProfile("餘韻", p.profile.finish, p.category)}
              </div>`
              : ""
          }

          ${
            p.brew
              ? `<div class="brew-info fade-in">
                  <p><b>熱泡：</b>${p.brew.hot.grams}g / ${p.brew.hot.water_ml}ml / ${p.brew.hot.temp_c}°C / ${p.brew.hot.time_s}秒 × ${p.brew.hot.infusions}</p>
                  <p><b>冷泡：</b>${p.brew.cold.grams}g / ${p.brew.cold.water_ml}ml / ${p.brew.cold.hours}小時（冰箱冷藏）</p>
                 </div>`
              : ""
          }
        </div>
      `;

      const card = document.createElement("div");
      card.className = "itemcard";
      card.innerHTML = `
        <div class="title">${p.title}</div>
        <div class="quickblock">
          <span class="tagline">${p.tagline || ""}</span>
          <div class="tags">${tags}</div>
        </div>
        <div class="variant">
          <div class="v-meta">
            單價 <b>NT$ ${p.price}</b> / ${p.unit || "—"}
            <small class="muted">（剩餘 ${p.stock ?? 0}）</small>
          </div>
          <div class="qty">
            <button class="qty-btn" data-id="${p.id}" data-dir="minus">−</button>
            <span id="qty-${p.id}" class="qty-value">0</span>
            <button class="qty-btn" data-id="${p.id}" data-dir="plus">＋</button>
          </div>
        </div>

        ${
          p.packable
            ? `
              <div class="pack-row">
                <label class="pack-toggle">
                  <input type="checkbox" id="pack-${p.id}">
                  裝罐
                </label>
                <div class="pack-qty hidden" id="packQtyWrap-${p.id}">
                  <button class="step" data-pack="${p.id}" data-dir="minus">−</button>
                  <input type="number" id="packQty-${p.id}" min="0" value="0">
                  <button class="step" data-pack="${p.id}" data-dir="plus">＋</button>
                </div>
              </div>
              <p class="pack-err" id="packErr-${p.id}">裝罐數量不可超過購買數量</p>
            `
            : ""
        }

        <button class="more-btn" aria-expanded="false" data-id="${p.id}">
          <span class="label">收合詳情</span>
          <span class="arrow">▼</span>
        </button>
        ${detailBlock}
      `;

      body.appendChild(card);

      setTimeout(() => {
        list.forEach(p => {
          const qty = parseInt($(`qty-${p.id}`)?.textContent || 0);
          const packToggle = $(`pack-${p.id}`);
          const wrap = $(`packQtyWrap-${p.id}`);
          const packInput = $(`packQty-${p.id}`);

          if (packToggle) {
            if (qty === 0) {
              packToggle.disabled = true;
              packToggle.checked = false;
              wrap?.classList.add("hidden");
              if (packInput) packInput.value = 0;
            } else {
              packToggle.disabled = false;
            }
          }
        });
      }, 50);

    });

    section.appendChild(header);
    section.appendChild(body);
    panel.appendChild(section);
  });

  document.querySelectorAll(".itemcard").forEach((el, i) => {
    el.style.setProperty("--delay", `${i * 0.1}s`);
  });
}

// ============================================================
// 分類展開收合
// ============================================================
document.addEventListener("click", (e) => {
  const header = e.target.closest(".category-header");
  if (!header) return;

  const body = header.nextElementSibling;
  const isOpen = header.classList.contains("open");

  document.querySelectorAll(".category-header").forEach((h) => {
    h.classList.remove("open");
    h.querySelector(".chev").textContent = "▼";
  });
  document
    .querySelectorAll(".category-body")
    .forEach((b) => (b.style.maxHeight = "0"));

  if (!isOpen) {
    header.classList.add("open");
    header.querySelector(".chev").textContent = "▲";
    body.style.maxHeight = "none";
    setTimeout(
      () => body.scrollIntoView({ behavior: "smooth", block: "start" }),
      100
    );
  }
});

// ============================================================
// 商品詳情收合（同分類只開一個）
// ============================================================
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".more-btn");
  if (!btn) return;
  const id = btn.dataset.id;
  const block = document.getElementById(`detail-${id}`);
  if (!block) return;

  const isCurrentlyOpen = !block.hidden;

  const categoryBody = btn.closest(".category-body");
  const allBlocks = categoryBody.querySelectorAll(".detailblock");
  const allBtns = categoryBody.querySelectorAll(".more-btn");

  allBlocks.forEach((b) => (b.hidden = true));
  allBtns.forEach((b) => {
    b.querySelector(".label").textContent = "收合詳情";
    b.querySelector(".arrow").textContent = "▼";
    b.classList.remove("active");
  });

  if (isCurrentlyOpen) return;

  btn.querySelector(".label").textContent = "隱藏詳情";
  btn.querySelector(".arrow").textContent = "▲";
  btn.classList.add("active");
  block.hidden = false;

  block.querySelectorAll(".fade-in").forEach((el, i) => {
    el.style.animation = `fadeSlideIn 0.5s ease forwards ${i * 0.1}s`;
  });

  const offset = block.getBoundingClientRect().top + window.scrollY - 80;
  window.scrollTo({ top: offset, behavior: "smooth" });
});
