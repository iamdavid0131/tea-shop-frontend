// ============================================================
// ⭐ ai-shop.js — 祥興茶行 AI 導購模組（最佳化旗艦版）
// ============================================================

import { CONFIG } from "./config.js";
import { CATEGORY_MAP } from "./category-map.js";
import { $ } from "./dom.js";

// ------------------------------------------------------------
// 1. AI API 呼叫模組
// ------------------------------------------------------------
let taste = JSON.parse(localStorage.getItem("user_taste") || "null");

async function callAI(message) {
  const res = await fetch("https://tea-order-server.onrender.com/api/ai-tea", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      previousTaste: taste,
      products: CONFIG.PRODUCTS,
    }),
  });
  return await res.json();
}

function saveUserTaste(preference) {
  localStorage.setItem("user_taste", JSON.stringify(preference));
  taste = preference;
}

// ------------------------------------------------------------
// 2. 打開商品 Modal
// ------------------------------------------------------------
function openProductModal(prodId) {
  const card = document.querySelector(`.tea-card[data-id="${prodId}"]`);
  if (!card) {
    console.warn("找不到商品卡片:", prodId);
    return;
  }
  card.click();
}

// ------------------------------------------------------------
// 3. AI 入口按鈕
// ------------------------------------------------------------
function injectAIButton() {
  const container = $("aiEntry");
  if (!container) return;

  const btn = document.createElement("button");
  btn.id = "aiAssistBtn";
  btn.className = "ai-assist-btn glassy";
  btn.textContent = "💬 AI 幫我選茶";

  container.prepend(btn);
  btn.addEventListener("click", () => showAIModal());
}

// ------------------------------------------------------------
// ⭐ 4. 統一事件綁定（Compare / Brew / Gift / Masterpick / Personality）
// ------------------------------------------------------------
function bindAIActions(modal, resultBox) {
  resultBox.addEventListener("click", (e) => {
    const btn = e.target.closest(
      ".compare-btn, .brew-btn, .gift-btn, .mp-btn, .person-btn, .ai-bubble-click"
    );
    if (!btn) return;

    const id = btn.dataset.id;
    if (!id) return;

    modal.classList.remove("show");
    setTimeout(() => modal.remove(), 250);
    openProductModal(id);
  });
}

// ------------------------------------------------------------
// 5. 主 UI — AI Modal
// ------------------------------------------------------------
function showAIModal() {
  let modal = document.getElementById("aiModal");

  if (!modal) {
    modal = document.createElement("div");
    modal.id = "aiModal";
    modal.className = "ai-modal-overlay";

    modal.innerHTML = `
      <div class="ai-box">
        <h2 class="ai-title">
          <i class="ph ph-chat-teardrop-dots ai-icon"></i>
          AI 茶品推薦
        </h2>

        <textarea id="aiQuery" placeholder="告訴我你喜歡什麼風味…" class="ai-input"></textarea>

        <button id="aiSubmit" class="ai-submit">送出</button>

        <div id="aiResult" class="ai-result" style="display:none;"></div>

        <button id="aiClose" class="ai-close-icon">×</button>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector("#aiClose").onclick = () => {
      modal.classList.remove("show");
      setTimeout(() => modal.remove(), 250);
    };

    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.remove("show");
        setTimeout(() => modal.remove(), 250);
      }
    });

    // ----------------------------------------------------
    // ⭐ 送出查詢
    // ----------------------------------------------------
    modal.querySelector("#aiSubmit").onclick = async () => {
      const q = modal.querySelector("#aiQuery").value.trim();
      if (!q) return;

      const resultBox = modal.querySelector("#aiResult");
      resultBox.style.display = "block";

      resultBox.innerHTML = `
        <div class="ai-loader">
          <div class="dot"></div><div class="dot"></div><div class="dot"></div>
        </div>
        <div class="ai-loading-text">AI 正在分析風味…</div>
      `;

      let out;
      try {
        out = await Promise.race([
          callAI(q),
          new Promise((_, reject) =>
            setTimeout(() => reject("timeout"), 20000)
          )
        ]);
      } catch {
        resultBox.innerHTML = `<div class="ai-error">⚠️ 分析較久，請再試一次…</div>`;
        return;
      }

      // ----------------------------------------------------
      // ⭐ 多模式處理（Compare / Brew / Gift / MP / Person）
      // ----------------------------------------------------
      if (out.mode === "compare") {
        resultBox.innerHTML = buildCompareUI(out.a, out.b, out.compare, CONFIG.PRODUCTS);
        bindAIActions(modal, resultBox);
        return;
      }

      if (out.mode === "brew") {
        resultBox.innerHTML = buildBrewUI(out.tea, out.brew, out.tips, CONFIG.PRODUCTS);
        bindAIActions(modal, resultBox);
        return;
      }

      if (out.mode === "gift") {
        resultBox.innerHTML = buildGiftUI(out.best, out.reason, CONFIG.PRODUCTS);
        bindAIActions(modal, resultBox);
        return;
      }

      if (out.mode === "masterpick") {
        resultBox.innerHTML = buildMasterPickUI(out.best, out.reason, CONFIG.PRODUCTS);
        bindAIActions(modal, resultBox);
        return;
      }

      if (out.mode === "personality") {
        resultBox.innerHTML = buildPersonalityUI(out.tea, out.summary, CONFIG.PRODUCTS);
        bindAIActions(modal, resultBox);
        return;
      }

      // ----------------------------------------------------
      // ⭐ 一般推薦模式
      // ----------------------------------------------------
      const bestId = typeof out.best === "string" ? out.best : out.best?.id;
      const best = CONFIG.PRODUCTS.find(p => p.id === bestId);

      const bestReason = typeof out.best === "string"
        ? out.reason || ""
        : out.best?.reason || "";

      let secondId = null;
      let secondName = "";
      let secondReason = "";

      if (out.second) {
        secondId = typeof out.second === "string" ? out.second : out.second.id;
        const s = CONFIG.PRODUCTS.find(p => p.id === secondId);
        secondName = s?.title || secondId;
        secondReason = out.second?.reason || "";
      }

      resultBox.innerHTML = `
        <div class="ai-chat">
          <div class="ai-bubble ai-bubble-ai ai-bubble-click" data-id="${best.id}">
            <div class="ai-bubble-label">推薦茶款</div>
            <div class="ai-bubble-title">${best.title}</div>
            <div class="ai-bubble-text">${bestReason}</div>
          </div>

          ${
            secondId
              ? `
              <div class="ai-bubble ai-bubble-ai ai-bubble-click" data-id="${secondId}">
                <div class="ai-bubble-label">次推薦</div>
                <div class="ai-bubble-title">${secondName}</div>
                <div class="ai-bubble-text">${secondReason}</div>
              </div>
            `
              : ""
          }
        </div>
      `;

      saveUserTaste({
        lastBest: best.id,
        lastReason: bestReason,
        timestamp: Date.now(),
      });

      bindAIActions(modal, resultBox);
    };
  }

  modal.classList.add("show");
}

// ------------------------------------------------------------
// ⭐ Compare / Brew / Gift / MP / Person UI Builders（不變）
// ------------------------------------------------------------

function buildCompareUI(a, b, compare, products) {
  const teaA = products.find(p => p.id === a);
  const teaB = products.find(p => p.id === b);
  if (!teaA || !teaB) return `<div class="ai-error">⚠ 找不到產品</div>`;
  return `
    <div class="compare-wrapper">
      <div class="compare-header">
        <i class="ph ph-swap"></i> 茶品比較
      </div>

      <div class="compare-table">
        <div class="compare-col">
          <div class="tea-title">${teaA.title}</div>
          <div class="tea-price">NT$${teaA.price}</div>
          <div class="tea-tag tag-a">A</div>
        </div>

        <div class="compare-middle">
          <div class="middle-block"><div class="middle-label">香氣</div><div class="middle-text">${compare.aroma}</div></div>
          <div class="middle-block"><div class="middle-label">厚度</div><div class="middle-text">${compare.body}</div></div>
          <div class="middle-block"><div class="middle-label">焙火</div><div class="middle-text">${compare.roast}</div></div>
          <div class="middle-block"><div class="middle-label">價格</div><div class="middle-text">${compare.price}</div></div>
        </div>

        <div class="compare-col">
          <div class="tea-title">${teaB.title}</div>
          <div class="tea-price">NT$${teaB.price}</div>
          <div class="tea-tag tag-b">B</div>
        </div>
      </div>

      <div class="compare-summary">${compare.summary}</div>

      <div class="compare-actions">
        <button class="compare-btn" data-id="${teaA.id}">查看 ${teaA.title}</button>
        <button class="compare-btn" data-id="${teaB.id}">查看 ${teaB.title}</button>
      </div>
    </div>
  `;
}

function buildBrewUI(teaId, brew, tips, products) {
  const tea = products.find(p => p.id === teaId);
  return `
    <div class="brew-card">
      <div class="brew-header"><i class="ph ph-tea-bag"></i>${tea.title} 泡法建議</div>
      <div class="brew-section"><div class="brew-title">🔥 熱泡</div><div class="brew-text">${brew.hot || "無資料"}</div></div>
      <div class="brew-section"><div class="brew-title">❄️ 冰鎮</div><div class="brew-text">${brew.ice_bath || "無資料"}</div></div>
      <div class="brew-section"><div class="brew-title">🌙 冷泡</div><div class="brew-text">${brew.cold_brew || "無資料"}</div></div>
      ${
        tips
          ? `<div class="brew-tips"><i class="ph ph-sparkle"></i>${tips}</div>`
          : ""
      }
      <button class="brew-btn" data-id="${tea.id}">查看 ${tea.title}</button>
    </div>
  `;
}

function buildGiftUI(bestId, reason, products) {
  const tea = products.find(p => p.id === bestId);
  return `
    <div class="gift-card">
      <div class="gift-header"><i class="ph ph-gift"></i>最適合送禮</div>
      <div class="gift-main"><div class="gift-title">${tea.title}</div><div class="gift-reason">${reason}</div></div>
      <button class="gift-btn" data-id="${tea.id}">查看 ${tea.title}</button>
    </div>
  `;
}

function buildMasterPickUI(bestId, reason, products) {
  const tea = products.find(p => p.id === bestId);
  const limitedTag = tea.stock <= 8 ? `<div class="mp-limited">🔥 庫存僅剩 ${tea.stock} 包</div>` : "";
  return `
    <div class="master-card glassy">
      <div class="mp-header"><i class="ph ph-crown-simple"></i>店長特別推薦</div>
      ${limitedTag}
      <div class="mp-title">${tea.title}</div>
      <div class="mp-reason">${reason}</div>
      <button class="mp-btn" data-id="${tea.id}">查看 ${tea.title}</button>
    </div>
  `;
}

function buildPersonalityUI(teaId, summary, products) {
  const tea = products.find(p => p.id === teaId);
  return `
    <div class="person-card glassy">
      <div class="person-icon">🌿</div>
      <div class="person-title">${tea.title}</div>
      <div class="person-summary">${summary}</div>
      <button class="person-btn" data-id="${tea.id}">查看 ${tea.title}</button>
    </div>
  `;
}

// ------------------------------------------------------------
// 初始化：注入 AI 按鈕
// ------------------------------------------------------------
setTimeout(() => injectAIButton(), 300);
