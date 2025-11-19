// ============================================================
// ⭐ ai-shop.js（多輪對話 v3-stable）Part 1 — 系統 + UI + Modal
// ============================================================

import { CONFIG } from "./config.js";

// ============================================================
// 🧠 1. Session（localStorage）
// ============================================================
const AI_SESSION_KEY = "ai_guide_session";

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(AI_SESSION_KEY)) || null;
  } catch {
    return null;
  }
}

function saveSession(session) {
  localStorage.setItem(AI_SESSION_KEY, JSON.stringify(session));
}

function resetSession() {
  localStorage.removeItem(AI_SESSION_KEY);
}


// ============================================================
// 💬 2. Chat UI：新增氣泡
// ============================================================
function appendAIBubble(container, text) {
  const bubble = document.createElement("div");
  bubble.className = "ai-bubble ai-bubble-ai";
  bubble.innerHTML = `<div class="ai-bubble-text">${text}</div>`;
  container.appendChild(bubble);
}

function appendUserBubble(container, text) {
  const bubble = document.createElement("div");
  bubble.className = "ai-bubble ai-bubble-user";
  bubble.innerHTML = `<div class="ai-bubble-text">${text}</div>`;
  container.appendChild(bubble);
}


// ============================================================
// 📡 3. callAI（呼叫後端）
// ============================================================
async function callAI(message, session) {
  const res = await fetch("https://tea-order-server.onrender.com/api/ai-tea", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      products: CONFIG.PRODUCTS,
      session,
      previousTaste: JSON.parse(localStorage.getItem("user_taste") || "null")
    })
  });

  return await res.json();
}


// ============================================================
// 🎨 4. 建立 Modal（聊天視窗）
// ============================================================
function createAIModal() {
  let modal = document.getElementById("aiModal");

  if (!modal) {
    modal = document.createElement("div");
    modal.id = "aiModal";
    modal.className = "ai-modal-overlay";

    modal.innerHTML = `
      <div class="ai-box">

        <h2 class="ai-title">
          <i class="ph ph-chat-teardrop-dots ai-icon"></i>
          AI 茶師導購
        </h2>

        <div id="aiChat" class="ai-chat-area"></div>

        <div class="ai-input-row">
          <input id="aiInput" class="ai-text-input" placeholder="輸入或點選選項…" />
          <button id="aiSend" class="ai-send-btn">送出</button>
        </div>

        <button id="aiClose" class="ai-close-icon">×</button>

      </div>
    `;

    document.body.appendChild(modal);

    // 左上角關閉
    modal.querySelector("#aiClose").onclick = () => {
      resetSession();
      modal.classList.remove("show");
      setTimeout(() => modal.remove(), 250);
    };

    // 點背景關閉
    modal.addEventListener("click", e => {
      if (e.target === modal) {
        resetSession();
        modal.classList.remove("show");
        setTimeout(() => modal.remove(), 250);
      }
    });
  }

  return modal;
}


// ============================================================
// 🏁 5. 開啟 AI Modal（初始化畫面）
// ============================================================
function showAIModal() {
  const modal = createAIModal();
  const chat = modal.querySelector("#aiChat");
  const input = modal.querySelector("#aiInput");
  const sendBtn = modal.querySelector("#aiSend");

  modal.classList.add("show");

  let userTaste = JSON.parse(localStorage.getItem("user_taste") || "null");

  // --- 初始化畫布 ---
  chat.innerHTML = "";

  if (userTaste) {
    appendAIBubble(chat, "歡迎回來！要使用上次的風味偏好嗎？😊");
    appendAskOptions(chat, ["使用上次偏好", "重新開始"]);
  } else {
    appendAIBubble(chat, "嗨～我是 AI 侍茶師，可以推薦｜送禮｜搭餐｜泡法｜比較｜性格茶。想從哪裡開始？😊");
  }

  // 初始 session
  let session = loadSession() || null;

  // 送出按鈕
  sendBtn.onclick = async () => {
    const msg = input.value.trim();
    if (!msg) return;

    appendUserBubble(chat, msg);
    input.value = "";

    const result = await callAI(msg, session);
    session = result.session || null;
    saveSession(session);

    handleAIResponse(result, chat);
  };
}
// ============================================================
// ⭐ ai-shop.js（多輪對話 v3-stable）Part 2 — 回應處理 + UI 建構
// ============================================================


// ============================================================
// 🎯 6. 處理 AI 回應（核心）
// ============================================================
function handleAIResponse(out, chat) {

  // -------------------------------
  // (A) 錯誤
  // -------------------------------
 	if (out.mode === "error") {
    appendAIBubble(chat, "抱歉，我這邊出現問題了，請再試一次 🙏");
    return;
  }

  // -------------------------------
  // (B) AI 要問問題（多輪導購）
// -------------------------------
  if (out.mode === "ask") {
    appendAIBubble(chat, out.ask || "我需要更多資訊喔！");

    if (out.options && out.options.length) {
      appendAskOptions(chat, out.options);
    }
    return;
  }

  // -------------------------------
  // (C) Recommend —— 一般推薦
  // -------------------------------
  if (out.mode === "recommend") {
    chat.innerHTML += buildRecommendBubble(out, CONFIG.PRODUCTS);
    enableProductClicks(chat);
    return;
  }

  // -------------------------------
  // (D) Pairing —— 搭餐推薦
  // -------------------------------
  if (out.mode === "pairing") {
    chat.innerHTML += buildPairingBubble(out, CONFIG.PRODUCTS);
    enableProductClicks(chat);
    return;
  }

  // -------------------------------
  // (E) Gift —— 送禮推薦
  // -------------------------------
  if (out.mode === "gift") {
    chat.innerHTML += buildGiftBubble(out, CONFIG.PRODUCTS);
    enableProductClicks(chat);
    return;
  }

  // -------------------------------
  // (F) Compare —— 比較兩款
  // -------------------------------
  if (out.mode === "compare") {
    chat.innerHTML += buildCompareBubble(out, CONFIG.PRODUCTS);
    enableProductClicks(chat);
    return;
  }

  // -------------------------------
  // (G) Brew —— 泡法指南
  // -------------------------------
  if (out.mode === "brew") {
    chat.innerHTML += buildBrewBubble(out, CONFIG.PRODUCTS);
    enableProductClicks(chat);
    return;
  }

  // -------------------------------
  // (H) Masterpick —— 店長推薦
  // -------------------------------
  if (out.mode === "masterpick") {
    chat.innerHTML += buildMasterpickBubble(out, CONFIG.PRODUCTS);
    enableProductClicks(chat);
    return;
  }

  // -------------------------------
  // (I) Personality —— 性格茶
  // -------------------------------
  if (out.mode === "personality") {
    chat.innerHTML += buildPersonalityBubble(out, CONFIG.PRODUCTS);
    enableProductClicks(chat);
    return;
  }

  appendAIBubble(chat, "我收到你的訊息了，但還需要一點資訊喔！");
}



// ============================================================
// 🧩 7. 使用者選項按鈕（多輪流程最重要區塊）
// ============================================================
function appendAskOptions(chat, options) {
  const box = document.createElement("div");
  box.className = "ai-option-group";

  options.forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "ai-option-btn";
    btn.textContent = opt;

    btn.onclick = async () => {
      let session = loadSession();

      // 重新開始
      if (opt === "重新開始") {
        resetSession();
        session = null;
        localStorage.removeItem("user_taste");

        appendAIBubble(chat, "好的～我們重新開始！你想從哪個方向開始呢？😊");
        return;
      }

      // 使用上次偏好
      if (opt === "使用上次偏好") {
        appendAIBubble(chat, "好的，我會依照你的偏好協助你！");
        return;
      }

      // 一般選項 → 視為使用者發話
      appendUserBubble(chat, opt);

      const out = await callAI(opt, session);
      saveSession(out.session || null);

      handleAIResponse(out, chat);
    };

    box.appendChild(btn);
  });

  chat.appendChild(box);
}



// ============================================================
// 🧩 8. 點商品 → 打開 modal (前端既有功能)
// ============================================================
function enableProductClicks(chat) {
  chat.querySelectorAll("[data-prod]")?.forEach(btn => {
    btn.onclick = () => {
      const modal = document.getElementById("aiModal");
      modal.classList.remove("show");
      setTimeout(() => modal.remove(), 250);

      const prodId = btn.dataset.prod;
      const card = document.querySelector(`.tea-card[data-id="${prodId}"]`);
      if (card) card.click();
    };
  });
}



// ============================================================
// ⭐ 9. 氣泡 UI 建構器（所有模式）
// ============================================================

// ----------------------------
// (1) Recommend 一般推薦
// ----------------------------
function buildRecommendBubble(out, products) {
  const best = products.find(p => p.id === (out.best?.id || out.best));
  const secondId = out.second?.id || out.second;
  const second = products.find(p => p.id === secondId);

  return `
    <div class="ai-bubble ai-bubble-ai">
      <div class="ai-bubble-title">🌟 推薦茶款</div>

      <div class="ai-prod-item" data-prod="${best.id}">
        <div class="prod-name">${best.title}</div>
        <div class="prod-reason">${out.best.reason}</div>
      </div>

      ${second ? `
      <div class="ai-prod-item" data-prod="${second.id}">
        <div class="prod-name">${second.title}</div>
        <div class="prod-reason">${out.second.reason}</div>
      </div>` : ""}
    </div>
  `;
}



// ----------------------------
// (2) Pairing（搭配料理）
// ----------------------------
function buildPairingBubble(out, products) {
  const tea = products.find(p => p.id === out.tea);

  return `
    <div class="ai-bubble ai-bubble-ai">
      <div class="ai-bubble-title">🍽 搭配料理推薦</div>

      <div class="ai-prod-item" data-prod="${tea.id}">
        <div class="prod-name">${tea.title}</div>
        <div class="prod-reason">${out.reason}</div>
      </div>
    </div>
  `;
}



// ----------------------------
// (3) Gift（送禮推薦）
// ----------------------------
function buildGiftBubble(out, products) {
  const tea = products.find(p => p.id === out.tea || out.best);

  return `
    <div class="ai-bubble ai-bubble-ai">
      <div class="ai-bubble-title">🎁 送禮建議</div>

      <div class="ai-prod-item" data-prod="${tea.id}">
        <div class="prod-name">${tea.title}</div>
        <div class="prod-reason">${out.reason}</div>
      </div>
    </div>
  `;
}



// ----------------------------
// (4) Compare（比較兩款）
// ----------------------------
function buildCompareBubble(out, products) {
  const a = products.find(p => p.id === out.a);
  const b = products.find(p => p.id === out.b);

  return `
    <div class="ai-bubble ai-bubble-ai">
      <div class="ai-bubble-title">🔍 茶品比較</div>

      <div class="compare-block">
        <div class="compare-col">
          <div class="compare-name" data-prod="${a.id}">${a.title}</div>
        </div>

        <div class="compare-middle">
          <div>香氣：${out.compare.aroma}</div>
          <div>厚度：${out.compare.body}</div>
          <div>焙火：${out.compare.roast}</div>
          <div>價格：${out.compare.price}</div>
        </div>

        <div class="compare-col">
          <div class="compare-name" data-prod="${b.id}">${b.title}</div>
        </div>
      </div>

      <div class="compare-summary">${out.compare.summary}</div>
    </div>
  `;
}



// ----------------------------
// (5) Brew（泡法）
// ----------------------------
function buildBrewBubble(out, products) {
  const tea = products.find(p => p.id === out.tea);

  return `
    <div class="ai-bubble ai-bubble-ai">
      <div class="ai-bubble-title">🍵 ${tea.title} 泡法指南</div>

      <div class="brew-item">熱泡：${out.brew.hot}</div>
      <div class="brew-item">冰鎮：${out.brew.ice_bath}</div>
      <div class="brew-item">冷泡：${out.brew.cold_brew}</div>

      <div class="brew-tips">${out.tips}</div>

      <div class="ai-prod-item" data-prod="${tea.id}">
        查看商品 →
      </div>
    </div>
  `;
}



// ----------------------------
// (6) Masterpick
// ----------------------------
function buildMasterpickBubble(out, products) {
  const tea = products.find(p => p.id === out.best);

  return `
    <div class="ai-bubble ai-bubble-ai">
      <div class="ai-bubble-title">👑 店長特別推薦</div>

      <div class="ai-prod-item" data-prod="${tea.id}">
        <div class="prod-name">${tea.title}</div>
        <div class="prod-reason">${out.reason}</div>
      </div>
    </div>
  `;
}



// ----------------------------
// (7) Personality 性格茶
// ----------------------------
function buildPersonalityBubble(out, products) {
  const tea = products.find(p => p.id === out.tea);

  return `
    <div class="ai-bubble ai-bubble-ai">
      <div class="ai-bubble-title">🌿 性格茶推薦</div>

      <div class="person-summary">${out.summary}</div>

      <div class="ai-prod-item" data-prod="${tea.id}">
        ${tea.title}
      </div>
    </div>
  `;
}

// ============================================================
// ⭐ ai-shop.js v3-stable — Part 3：AI 導購入口按鈕 + Init
// ============================================================

/**
 * 10. 注入 AI「對話助理」按鈕
 * - 你網站 HTML 需有 <div id="aiEntry"></div>
 * - 這段會在 AI 入口處插入一顆浮動按鈕
 */
function injectAIAssistButton(retry = 0) {
  const container = document.getElementById("aiEntry");

  // 若 container 尚未出現 → 稍後再試
  if (!container) {
    if (retry < 10) {
      requestAnimationFrame(() => injectAIAssistButton(retry + 1));
    }
    return;
  }

  // 已存在按鈕 → 不重複插入
  if (document.getElementById("aiAssistBtn")) return;

  // 建立按鈕
  const btn = document.createElement("button");
  btn.id = "aiAssistBtn";
  btn.className = "ai-assist-btn";
  btn.innerHTML = `
    <i class="ph ph-chat-circle-dots"></i>
    AI 導購聊天
  `;

  btn.onclick = () => showAIModal();

  // 插入到容器 **最前方**
  container.prepend(btn);
}

/**
 * 11. 啟動點（最終）
 * - 等 DOM Ready 後注入導購按鈕
 */
document.addEventListener("DOMContentLoaded", () => {
  injectAIAssistButton();
});
