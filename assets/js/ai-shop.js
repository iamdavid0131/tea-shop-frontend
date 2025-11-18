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

        <textarea id="aiQuery" 
          placeholder="告訴我你喜歡什麼風味…"
          class="ai-input"></textarea>

        <button id="aiSubmit" class="ai-submit">送出</button>

        <div id="aiResult" class="ai-result" style="display:none;"></div>

        <button id="aiClose" class="ai-close-icon">x</button>
      </div>
    `;

    document.body.appendChild(modal);

    // ----------------------------------------------------
    // ❶ 關閉按鈕
    // ----------------------------------------------------
    modal.querySelector("#aiClose").onclick = () => {
      modal.classList.remove("show");
      setTimeout(() => modal.remove(), 250);
    };

    // ----------------------------------------------------
    // ❷ 點背景關閉（但不關掉 ai-box）
    // ----------------------------------------------------
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.remove("show");
        setTimeout(() => modal.remove(), 250);
      }
    });

    // ----------------------------------------------------
    // ❸ AI 查詢送出
    // ----------------------------------------------------
    modal.querySelector("#aiSubmit").onclick = async () => {
  const q = modal.querySelector("#aiQuery").value.trim();
  if (!q) return;

  const resultBox = modal.querySelector("#aiResult");
  resultBox.style.display = "block";

  // ----------------------------------------------------
  // 🌟 1. LOADING UI（玻璃 3 點動畫 + 文字）
  // ----------------------------------------------------
  resultBox.innerHTML = `
    <div class="ai-loader">
      <div class="dot"></div>
      <div class="dot"></div>
      <div class="dot"></div>
    </div>
    <div class="ai-loading-text">AI 正在分析風味…</div>
  `;

  // ----------------------------------------------------
  // 🌟 2. Timeout（避免卡太久）
  // ----------------------------------------------------
  const aiPromise = callAI(q);
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("timeout")), 8000)
  );

  let out;
  try {
    out = await Promise.race([aiPromise, timeoutPromise]);
  } catch (e) {
    resultBox.innerHTML = `
      <div class="ai-error">
        ⚠️ 分析時間較久，可能正在忙線<br>
        請再試一次或簡短描述風味～
      </div>
    `;
    return;
  }

  console.log("AI 回覆：", out);

  if (!out || !out.best) {
    resultBox.innerHTML = "⚠️ 無法理解你的需求，請再描述一下～";
    return;
  }

  // ----------------------------------------------------
  // 🌟 3. 正常結果顯示
  // ----------------------------------------------------
  const best = CONFIG.PRODUCTS.find(p => p.id === out.best);

    let secondId = null;
    let secondName = "";
    let secondReason = "";

    if (out.second) {
    // 可能是字串，也可能是物件
    if (typeof out.second === "string") {
        secondId = out.second;
    } else {
        secondId = out.second.id;
        secondReason = out.second.reason || "";
    }

    // 從 CONFIG.PRODUCTS 找 title
    const secondProd = CONFIG.PRODUCTS.find(p => p.id === secondId);
    secondName = secondProd?.title || secondId;

    // 如果後端第二推薦沒有理由，用空或提示
    if (!secondReason) {
        secondReason = secondProd?.descShort || "風味也相近，可作為備選茶款。";
    }
    }

  resultBox.innerHTML = `
    <div class="ai-chat">
      <div class="ai-bubble ai-bubble-ai ai-bubble-click" data-id="${best.id}">
          <div class="ai-bubble-label">推薦茶款</div>
          <div class="ai-bubble-title">${best.title}</div>
          <div class="ai-bubble-text">${out.reason}</div>
      </div>

      ${
        out.second
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
  const brewGuideHTML = makeBrewGuide(best.title);

    resultBox.innerHTML = `
    <div class="ai-chat">
        …（你的推薦 bubble）
    </div>

    ${brewGuideHTML}
    `;


  saveUserTaste({
    lastBest: best.id,
    lastReason: out.reason,
    timestamp: Date.now(),
  });

  // ----------------------------------------------------
  // 🌟 4. 點選 bubble → 開啟商品 Modal
  // ----------------------------------------------------
  const chat = modal.querySelector(".ai-chat");
  chat.addEventListener("click", (e) => {
    const bubble = e.target.closest(".ai-bubble-click");
    if (!bubble) return;

    modal.classList.remove("show");
    setTimeout(() => modal.remove(), 250);

    openProductModal(bubble.dataset.id);
  });
};
  }

  // ----------------------------------------------------
  // ❺ 最重要：開啟 Modal（你之前漏掉）
  // ----------------------------------------------------
  modal.classList.add("show");
}

function makeBrewGuide(teaName) {
  return `
    <div class="ai-brew-guide">
      <div class="brew-title">冰鎮泡法建議（${teaName}）</div>
      <div class="brew-text">
        • 茶量：建議加強 +30%（6g → 7.8g）<br>
        • 水溫：85°C<br>
        • 熱泡：240 秒後立刻冰鎮<br>
        • 特點：香氣更集中、尾韻更甜
      </div>
    </div>
  `;
}



// ------------------------------------------------------------
// 初始化：自動注入 AI 按鈕
// ------------------------------------------------------------
setTimeout(() => injectAIButton(), 300);

