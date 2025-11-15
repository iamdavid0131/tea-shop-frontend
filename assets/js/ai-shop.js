// ============================================================
// ⭐ ai-shop.js — 祥興茶行 AI 導購模組（Plugin Module）
// ============================================================

import { CONFIG } from "./config.js";
import { CATEGORY_MAP } from "./category-map.js";
import { $ } from "./dom.js";

// ------------------------------------------------------------
// 1. AI API 呼叫模組（使用 OpenAI Response API）
// ------------------------------------------------------------
async function callAI(message) {
  const res = await fetch("https://tea-order-server.onrender.com/api/ai-tea", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      products: CONFIG.PRODUCTS,
    }),
  });

  return await res.json();
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
  const container = $("aiTeaHelperHost");
  if (!container) return;

  const btn = document.createElement("button");
  btn.id = "aiAssistBtn";
  btn.className = "ai-assist-btn";  // ⭐ 使用 class，而不是 inline style
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
    // 動態建立
    modal = document.createElement("div");
    modal.id = "aiModal";
    modal.className = "ai-modal-overlay";  // ⭐ 用 class

    modal.innerHTML = `
        <div class="ai-box">

            <h2 class="ai-title">💬 AI 茶品推薦</h2>

            <textarea id="aiQuery" 
            placeholder="告訴我你喜歡什麼風味…"
            class="ai-input"></textarea>

            <button id="aiSubmit" class="ai-submit">
            送出
            </button>

            <div id="aiResult" class="ai-result"></div>

            <button id="aiClose" class="ai-close">
            關閉
            </button>

        </div>
        `;


    document.body.appendChild(modal);

    modal.querySelector("#aiClose").onclick = () => modal.remove();

    // ⭐ 綁定送出事件
    modal.querySelector("#aiSubmit").onclick = async () => {
    const q = modal.querySelector("#aiQuery").value.trim();
    if (!q) return;

    const resultBox = modal.querySelector("#aiResult");
    resultBox.innerHTML = "⏳ AI 分析中…";

    const out = await callAI(q);
    console.log("AI 回覆：", out);

    if (!out || !out.best) {
        resultBox.innerHTML = "⚠️ 無法理解你的需求，請再描述一下～";
        return;
    }

    const best = CONFIG.PRODUCTS.find(p => p.id === out.best);

    // ⭐ 次推薦：抓出茶名
    let secondName = "";
    if (out.second?.id) {
        secondName = CONFIG.PRODUCTS.find(p => p.id === out.second.id)?.title || out.second.id;
    }

    resultBox.innerHTML = `
        <div class="ai-chat">
            
            <div class="ai-bubble ai-bubble-ai">
            <div class="ai-bubble-label">推薦茶款</div>
            <div class="ai-bubble-title">${best.title}</div>
            <div class="ai-bubble-text">${out.reason}</div>
            </div>

            ${
            out.second
                ? `
                <div class="ai-bubble ai-bubble-ai">
                <div class="ai-bubble-label">次推薦</div>
                <div class="ai-bubble-title">${secondName}</div>
                <div class="ai-bubble-text">${out.second.reason}</div>
                </div>
                `
                : ""
            }

        </div>
        `;

    // 🔥 自動打開你的商品 modal
    openProductModal(out.best);
    };
  }
}

// ------------------------------------------------------------
// 初始化：自動注入 AI 按鈕
// ------------------------------------------------------------
setTimeout(() => injectAIButton(), 300);
