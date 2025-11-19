// ============================================================
// ⭐ 祥興茶行 AI 導購（前端完整重組 v3.0）
// ============================================================

import { CONFIG } from "./config.js";
import { $ } from "./dom.js";

// ============================================================
// 🧠 1. 前端 Session 管理
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
  if (!session) return;
  localStorage.setItem(AI_SESSION_KEY, JSON.stringify(session));
}

function resetSession() {
  localStorage.removeItem(AI_SESSION_KEY);
}


// ============================================================
// 💬 2. 氣泡 UI
// ============================================================

function appendAIBubble(container, text) {
  const div = document.createElement("div");
  div.className = "ai-bubble ai-bubble-ai";
  div.innerHTML = `<div class="ai-bubble-text">${text}</div>`;
  container.appendChild(div);
}

function appendUserBubble(container, text) {
  const div = document.createElement("div");
  div.className = "ai-bubble ai-bubble-user";
  div.innerHTML = `<div class="ai-bubble-text">${text}</div>`;
  container.appendChild(div);
}


// ============================================================
// 📡 3. callAI
// ============================================================

async function callAI(message, session) {
  const r = await fetch("https://tea-order-server.onrender.com/api/ai-tea", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      products: CONFIG.PRODUCTS,
      session,
      previousTaste: JSON.parse(localStorage.getItem("user_taste") || "null")
    })
  });

  return await r.json();
}


// ============================================================
// 🏗️ 4. 建立 Modal
// ============================================================

function createAIModal() {
  let modal = $("#aiModal");
  if (modal) return modal;

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

  // 關閉 => 清 session
  modal.querySelector("#aiClose").onclick = () => {
    resetSession();
    modal.classList.remove("show");
    setTimeout(() => modal.remove(), 250);
  };

  modal.onclick = e => {
    if (e.target === modal) {
      resetSession();
      modal.classList.remove("show");
      setTimeout(() => modal.remove(), 250);
    }
  };

  return modal;
}


// ============================================================
// 🎯 5. 開啟 Modal
// ============================================================

function showAIModal() {
  const modal = createAIModal();
  const chat = modal.querySelector("#aiChat");
  const input = modal.querySelector("#aiInput");
  const sendBtn = modal.querySelector("#aiSend");

  modal.classList.add("show");
  chat.innerHTML = "";

  let session = loadSession();
  let userTaste = JSON.parse(localStorage.getItem("user_taste") || "null");

  // 進入問上次偏好
  if (userTaste) {
    appendAIBubble(chat, "歡迎回來！要使用上次的風味偏好嗎？😊");
    appendAskOptions(chat, ["使用上次偏好", "重新開始"]);
  } else {
    appendAIBubble(chat, "嗨～我是 AI 侍茶師，可以推薦/送禮/泡法/搭餐/性格測驗！想了解什麼呢？😊");
  }

  // 發送
  sendBtn.onclick = async () => {
    const msg = input.value.trim();
    if (!msg) return;

    appendUserBubble(chat, msg);
    input.value = "";

    const out = await callAI(msg, session);
    if (out.session) {
      session = out.session;
      saveSession(session);
    }

    handleAIResponse(out, chat);
  };
}


// ============================================================
// 🎛️ 6. 處理 AI 回應
// ============================================================

function handleAIResponse(out, chat) {

  console.log("🔥 AI Response:", out);

  // 錯誤
  if (out.mode === "error") {
    appendAIBubble(chat, "抱歉，我這邊出錯了，請再試一次 🙏");
    return;
  }

  // 多輪問題（ask）
  if (out.mode === "ask") {
    appendAIBubble(chat, out.ask);
    appendAskOptions(chat, out.options || []);
    return;
  }

  // 其他模式
  const builders = {
    recommend: buildRecommendBubble,
    pairing: buildPairingBubble,
    gift: buildGiftBubble,
    compare: buildCompareBubble,
    brew: buildBrewBubble,
    masterpick: buildMasterpickBubble,
    personality: buildPersonalityBubble
  };

  if (builders[out.mode]) {
    chat.innerHTML += builders[out.mode](out, CONFIG.PRODUCTS);
    enableProductClicks(chat);
    return;
  }

  appendAIBubble(chat, "我收到你的訊息囉！");
}


// ============================================================
// 🧩 7. 使用者可點選的選項
// ============================================================

function appendAskOptions(chat, options) {
  const box = document.createElement("div");
  box.className = "ai-option-group";

  options.forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "ai-option-btn";
    btn.textContent = opt;

    btn.onclick = async () => {
      const session = loadSession();
      let userTaste = JSON.parse(localStorage.getItem("user_taste") || "null");

      // 重新開始
      if (opt === "重新開始") {
        resetSession();
        userTaste = null;
        appendAIBubble(chat, "好的～我們重新來！想了解什麼呢？😊");
        return;
      }

      // 使用上次偏好
      if (opt === "使用上次偏好") {
        appendAIBubble(chat, "好的，我會根據你的偏好來推薦！");
        return;
      }

      appendUserBubble(chat, opt);
      const out = await callAI(opt, session);

      if (out.session) saveSession(out.session);
      handleAIResponse(out, chat);
    };

    box.appendChild(btn);
  });

  chat.appendChild(box);
}


// ============================================================
// 🧩 8. 點商品 → 打開商品 Modal
// ============================================================

function enableProductClicks(chat) {
  chat.querySelectorAll("[data-prod]")?.forEach(btn => {
    btn.onclick = () => {
      const pid = btn.dataset.prod;
      const card = document.querySelector(`.tea-card[data-id="${pid}"]`);
      if (card) card.click();

      // 關閉 AI modal
      const modal = $("#aiModal");
      modal.classList.remove("show");
      setTimeout(() => modal.remove(), 250);
    };
  });
}


// ============================================================
// 🧩 9. 各種模式 UI
// ============================================================

function buildRecommendBubble(out, products) {
  const best = products.find(p => p.id === out.best?.id);
  const second = products.find(p => p.id === out.second?.id);

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

function buildPairingBubble(out, products) {
  const tea = products.find(p => p.id === out.tea);
  return `
  <div class="ai-bubble ai-bubble-ai">
    <div class="ai-bubble-title">🍽 搭餐推薦</div>

    <div class="ai-prod-item" data-prod="${tea.id}">
      <div class="prod-name">${tea.title}</div>
      <div class="prod-reason">${out.reason}</div>
    </div>
  </div>`;
}

function buildGiftBubble(out, products) {
  const tea = products.find(p => p.id === out.tea);
  return `
  <div class="ai-bubble ai-bubble-ai">
    <div class="ai-bubble-title">🎁 送禮推薦</div>
    <div class="ai-prod-item" data-prod="${tea.id}">
      <div class="prod-name">${tea.title}</div>
      <div class="prod-reason">${out.reason}</div>
    </div>
  </div>`;
}

function buildCompareBubble(out, products) {
  const a = products.find(p => p.id === out.a);
  const b = products.find(p => p.id === out.b);

  return `
  <div class="ai-bubble ai-bubble-ai">
    <div class="ai-bubble-title">🔍 茶款比較</div>
    <div class="compare-block">
      <div class="compare-col"><div data-prod="${a.id}">${a.title}</div></div>
      <div class="compare-middle">
        <div>香氣：${out.compare.aroma}</div>
        <div>厚度：${out.compare.body}</div>
        <div>焙火：${out.compare.roast}</div>
        <div>價格：${out.compare.price}</div>
      </div>
      <div class="compare-col"><div data-prod="${b.id}">${b.title}</div></div>
    </div>
    <div class="compare-summary">${out.compare.summary}</div>
  </div>`;
}

function buildBrewBubble(out, products) {
  const tea = products.find(p => p.id === out.tea);

  return `
  <div class="ai-bubble ai-bubble-ai">
    <div class="ai-bubble-title">🍵 ${tea.title} 泡法</div>
    <div>熱泡：${out.brew.hot}</div>
    <div>冰鎮：${out.brew.ice_bath}</div>
    <div>冷泡：${out.brew.cold_brew}</div>
    <div class="brew-tips">${out.tips}</div>
  </div>`;
}

function buildMasterpickBubble(out, products) {
  const tea = products.find(p => p.id === out.best);
  return `
  <div class="ai-bubble ai-bubble-ai">
    <div class="ai-bubble-title">👑 店長推薦</div>
    <div class="ai-prod-item" data-prod="${tea.id}">
      <div>${tea.title}</div>
      <div>${out.reason}</div>
    </div>
  </div>`;
}

function buildPersonalityBubble(out, products) {
  const tea = products.find(p => p.id === out.tea);
  return `
  <div class="ai-bubble ai-bubble-ai">
    <div class="ai-bubble-title">🌿 性格茶</div>
    <div>${out.summary}</div>
    <div data-prod="${tea.id}" class="ai-prod-item">${tea.title}</div>
  </div>`;
}


// ============================================================
// 🚀 10. 注入按鈕
// ============================================================

function injectAIAssistButton() {
  const container = $("#aiEntry");
  if (!container) return;

  const btn = document.createElement("button");
  btn.className = "ai-assist-btn";
  btn.innerHTML = `<i class="ph ph-chat-circle-dots"></i> AI 導購聊天`;

  btn.onclick = showAIModal;
  container.prepend(btn);
}

setTimeout(() => injectAIAssistButton(), 300);

