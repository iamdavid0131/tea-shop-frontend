// ============================================================
// ⭐ ai-shop.js — 祥興茶行 AI 導購模組（Plugin Module）
// ============================================================

import { CONFIG } from "./config.js";
import { CATEGORY_MAP } from "./category-map.js";
import { $ } from "./dom.js";

// ------------------------------------------------------------
// 1. AI API 呼叫模組（使用 OpenAI Response API）
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


// save taste
function saveUserTaste(preference) {
  localStorage.setItem("user_taste", JSON.stringify(preference));
  taste = preference; 
}

// ------------------------------------------------------------
// 2. 自動打開你的 tea-modal 模組
// ------------------------------------------------------------
function openProductModal(prodId) {
  const card = document.querySelector(`.tea-card[data-id="${prodId}"]`);
  if (!card) {
    console.warn("找不到商品卡片:", prodId);
    return;
  }
  card.click(); // ⭐ 直接觸發你的原本 modal 行為
}


// ------------------------------------------------------------
// 3. 導購「AI 入口按鈕 + Modal」自動注入 UI
// ------------------------------------------------------------
function injectAIButton() {
  const container = $("aiEntry");
  if (!container) return;

  const btn = document.createElement("button");
  btn.id = "aiAssistBtn";
  btn.className = "ai-assist-btn glassy";  // ⭐ 使用 class，而不是 inline style
  btn.textContent = "💬 AI 幫我選茶";

  container.prepend(btn);
  btn.addEventListener("click", () => showAIModal());
}


// ------------------------------------------------------------
// 4. AI Modal UI（輸入需求 → AI 推薦 → 自動開啟商品）
// ------------------------------------------------------------
function showAIModal() {
  let modal = document.getElementById("aiModal");

  // ----------------------------------------------------
  // (1) 建立 Modal 元素
  // ----------------------------------------------------
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

    // ----------------------------------------------------
    // (2) 關閉按鈕
    // ----------------------------------------------------
    modal.querySelector("#aiClose").onclick = () => {
      modal.classList.remove("show");
      setTimeout(() => modal.remove(), 250);
    };

    // 點背景關閉
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.remove("show");
        setTimeout(() => modal.remove(), 250);
      }
    });

    // ----------------------------------------------------
    // (3) 送出 AI 查詢
    // ----------------------------------------------------
    modal.querySelector("#aiSubmit").onclick = async () => {
      const q = modal.querySelector("#aiQuery").value.trim();
      if (!q) return;

      const resultBox = modal.querySelector("#aiResult");
      resultBox.style.display = "block";

      // loading UI
      resultBox.innerHTML = `
        <div class="ai-loader">
          <div class="dot"></div><div class="dot"></div><div class="dot"></div>
        </div>
        <div class="ai-loading-text">AI 正在分析風味…</div>
      `;

      // timeout 保護
      const aiPromise = callAI(q);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 15000)
      );

      let out;
      try {
        out = await Promise.race([aiPromise, timeoutPromise]);
      } catch {
        resultBox.innerHTML = `
          <div class="ai-error">
            ⚠️ 分析較久，請再試一次…
          </div>
        `;
        return;
      }

      // ----------------------------------------------------
      // (4) 處理多模式邏輯（compare/gift/brew/masterpick/personality）
      // ----------------------------------------------------
      if (out.mode === "compare") {
        resultBox.innerHTML = buildCompareUI(out.a, out.b, out.compare, CONFIG.PRODUCTS);

        resultBox.querySelectorAll(".ai-btn").forEach(btn => {
          btn.onclick = () => {
            modal.classList.remove("show");
            setTimeout(() => modal.remove(), 250);
            openProductModal(btn.dataset.id);
          };
        });
        return;
      }

      if (out.mode === "brew") {
        resultBox.innerHTML = buildBrewUI(out.tea, out.brew, out.tips, CONFIG.PRODUCTS);

        const btn = resultBox.querySelector(".brew-btn");
        btn.onclick = () => {
          modal.classList.remove("show");
          setTimeout(() => modal.remove(), 250);
          openProductModal(btn.dataset.id);
        };
        return;
      }

      if (out.mode === "gift") {
        resultBox.innerHTML = buildGiftUI(out.best, out.reason, CONFIG.PRODUCTS);

        resultBox.querySelector(".gift-btn").onclick = () => {
          modal.classList.remove("show");
          setTimeout(() => modal.remove(), 250);
          openProductModal(out.best);
        };
        return;
      }

      if (out.mode === "masterpick") {
        resultBox.innerHTML = buildMasterPickUI(out.best, out.reason, CONFIG.PRODUCTS);

        resultBox.querySelector(".mp-btn").onclick = () => {
          modal.classList.remove("show");
          setTimeout(() => modal.remove(), 250);
          openProductModal(out.best);
        };
        return;
      }

      if (out.mode === "personality") {
        resultBox.innerHTML = buildPersonalityUI(out.tea, out.summary, CONFIG.PRODUCTS);

        resultBox.querySelector(".person-btn").onclick = () => {
          modal.classList.remove("show");
          setTimeout(() => modal.remove(), 250);
          openProductModal(out.tea);
        };
        return;
      }

    // ----------------------------------------------------
    // (5) 一般推薦模式（best + second）
    // ----------------------------------------------------

    // 1) 取得 best ID（無論字串或物件）
    const bestId =
    typeof out.best === "string"
        ? out.best
        : out.best?.id;

    // 2) 若沒有 bestId → 直接中斷（必須有 best）
    if (!bestId) {
    resultBox.innerHTML = `
        <div class="ai-error">
        ⚠️ AI 推薦結果異常（無 best），請再試一次。
        </div>
    `;
    console.error("AI 無 best:", out);
    return;
    }

    // 3) find 產品資料
    const best = CONFIG.PRODUCTS.find(p => p.id === bestId);

    if (!best) {
    resultBox.innerHTML = `
        <div class="ai-error">
        ⚠️ 找不到推薦的茶品（ID：${bestId}）
        </div>
    `;
    console.error("找不到茶品:", out);
    return;
    }

    // 4) best 理由（字串 or 物件.reason）
    const bestReason =
    typeof out.best === "string"
        ? out.reason || ""
        : out.best?.reason || "";

    // 5) second 同樣邏輯
    let secondId = null;
    let secondName = "";
    let secondReason = "";

    if (out.second) {
    secondId =
        typeof out.second === "string"
        ? out.second
        : out.second?.id;

    const secondProd = CONFIG.PRODUCTS.find(p => p.id === secondId);
    secondName = secondProd?.title || secondId;

    secondReason =
        typeof out.second === "string"
        ? out.secondReason || ""
        : out.second?.reason || "";
    }


      resultBox.innerHTML = `
        <div class="ai-chat">
          <div class="ai-bubble ai-bubble-ai ai-bubble-click" data-id="${best.id}">
            <div class="ai-bubble-label">推薦茶款</div>
            <div class="ai-bubble-title">${best.title}</div>
            <div class="ai-bubble-text">${bestReason}</div>
          </div>

          ${secondId ? `
            <div class="ai-bubble ai-bubble-ai ai-bubble-click" data-id="${secondId}">
              <div class="ai-bubble-label">次推薦</div>
              <div class="ai-bubble-title">${secondName}</div>
              <div class="ai-bubble-text">${secondReason}</div>
            </div>
          ` : ""}
        </div>
      `;

      saveUserTaste({
        lastBest: best.id,
        lastReason: out.reason,
        timestamp: Date.now(),
      });

      // 点击 推荐/次推荐 → 开商品 modal
      resultBox.addEventListener("click", (e) => {
        const bubble = e.target.closest(".ai-bubble-click");
        if (!bubble) return;

        modal.classList.remove("show");
        setTimeout(() => modal.remove(), 250);

        openProductModal(bubble.dataset.id);
      });
    };
  }

  // ----------------------------------------------------
  // (6) 顯示 Modal
  // ----------------------------------------------------
  modal.classList.add("show");
}


// ============================================================
// ⭐ AI Compare UI Builder（Apple Style）
// ============================================================
function buildCompareUI(a, b, compare, products) {
  const teaA = products.find(p => p.id === a);
  const teaB = products.find(p => p.id === b);

  if (!teaA || !teaB) {
    return `<div class="ai-error">⚠ 無法進行比較（找不到茶品）</div>`;
  }

  return `
    <div class="compare-wrapper">

      <!-- 標題列 -->
      <div class="compare-header">
        <i class="ph ph-swap"></i>
        茶品比較
      </div>

      <div class="compare-table">

        <!-- 左側欄 -->
        <div class="compare-col compare-col-left">
          <div class="tea-title">${teaA.title}</div>
          <div class="tea-price">NT$${teaA.price}</div>
          <div class="tea-tag tag-a">A</div>
        </div>

        <!-- 中間比對項 -->
        <div class="compare-middle">

          <div class="middle-block">
            <div class="middle-label">香氣</div>
            <div class="middle-text">${compare.aroma}</div>
          </div>

          <div class="middle-block">
            <div class="middle-label">厚度</div>
            <div class="middle-text">${compare.body}</div>
          </div>

          <div class="middle-block">
            <div class="middle-label">焙火</div>
            <div class="middle-text">${compare.roast}</div>
          </div>

          <div class="middle-block">
            <div class="middle-label">價格</div>
            <div class="middle-text">${compare.price}</div>
          </div>

        </div>

        <!-- 右側欄 -->
        <div class="compare-col compare-col-right">
          <div class="tea-title">${teaB.title}</div>
          <div class="tea-price">NT$${teaB.price}</div>
          <div class="tea-tag tag-b">B</div>
        </div>

      </div>

      <!-- 總結 -->
      <div class="compare-summary">
        ${compare.summary}
      </div>

      <!-- 按鈕 -->
      <div class="compare-actions">
        <button class="compare-btn" data-id="${teaA.id}">
          查看 ${teaA.title}
        </button>
        <button class="compare-btn" data-id="${teaB.id}">
          查看 ${teaB.title}
        </button>
      </div>
    </div>
  `;
}

// ============================================================
// ⭐ AI Brew UI（熱泡 / 冰鎮 / 冷泡）
// ============================================================
function buildBrewUI(teaId, brew, tips, products) {
  const tea = products.find(p => p.id === teaId);
  if (!tea) return `<div class="ai-error">找不到茶品</div>`;

  return `
    <div class="brew-card">

      <div class="brew-header">
        <i class="ph ph-tea-bag"></i>
        ${tea.title} 泡法建議
      </div>

      <div class="brew-section">
        <div class="brew-title">🔥 熱泡（Hot Brew）</div>
        <div class="brew-text">${brew.hot || "此茶無熱泡資料"}</div>
      </div>

      <div class="brew-section">
        <div class="brew-title">❄️ 冰鎮（Ice Bath）</div>
        <div class="brew-text">${brew.ice_bath || "此茶無冰鎮資料"}</div>
      </div>

      <div class="brew-section">
        <div class="brew-title">🌙 冷泡（Cold Brew）</div>
        <div class="brew-text">${brew.cold_brew || "此茶無冷泡資料"}</div>
      </div>

      ${
        tips
          ? `<div class="brew-tips">
               <i class="ph ph-sparkle"></i>
               ${tips}
             </div>`
          : ""
      }

      <button class="brew-btn" data-id="${tea.id}">
        查看 ${tea.title}
      </button>

    </div>
  `;
}

// ============================================================
// 🎁 Gift UI – 送禮建議卡片（高質感玻璃）
// ============================================================
function buildGiftUI(bestId, reason, products) {
  const tea = products.find(p => p.id === bestId);
  if (!tea) return `<div class="ai-error">找不到推薦的茶品</div>`;

  return `
    <div class="gift-card">

      <div class="gift-header">
        <i class="ph ph-gift"></i>
        最適合送禮的茶款
      </div>

      <div class="gift-main">
        <div class="gift-title">${tea.title}</div>
        <div class="gift-reason">${reason}</div>
      </div>

      <button class="gift-btn" data-id="${tea.id}">
        查看 ${tea.title}
      </button>
    </div>
  `;
}

// ============================================================
// 👑 Master Pick UI（店長特別推薦）
// ============================================================
function buildMasterPickUI(bestId, reason, products) {
  const tea = products.find(p => p.id === bestId);
  if (!tea) return `<div class="ai-error">找不到推薦的茶品</div>`;

  // 你之後可以讓後端附帶庫存 → 顯示限量提示
  const limitedTag = tea.stock <= 8
    ? `<div class="mp-limited">🔥 庫存僅剩 ${tea.stock} 包</div>`
    : "";

  return `
    <div class="master-card glassy">
      
      <div class="mp-header">
        <i class="ph ph-crown-simple"></i>
        店長特別推薦
      </div>

      ${limitedTag}

      <div class="mp-title">${tea.title}</div>
      <div class="mp-reason">${reason}</div>

      <button class="mp-btn" data-id="${tea.id}">
        查看 ${tea.title}
      </button>
    </div>
  `;
}
function buildPersonalityUI(teaId, summary, products) {
  const tea = products.find(p => p.id === teaId);
  if (!tea) return `<div class="ai-error">找不到茶品</div>`;

  return `
    <div class="person-card glassy">
      <div class="person-icon">🌿</div>

      <div class="person-title">${tea.title}</div>

      <div class="person-summary">
        ${summary}
      </div>

      <button class="person-btn" data-id="${tea.id}">
        查看 ${tea.title}
      </button>
    </div>
  `;
}


// ------------------------------------------------------------
// 初始化：自動注入 AI 按鈕
// ------------------------------------------------------------
setTimeout(() => injectAIButton(), 300);

