// ============================================================
// ⭐ ai-shop.js（多輪對話 v3.1 - Vision版）
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
// 💬 2. Chat UI：氣泡與動畫
// ============================================================
function appendAIBubble(container, text) {
  const bubble = document.createElement("div");
  bubble.className = "ai-bubble ai-bubble-ai";
  bubble.innerHTML = `<div class="ai-bubble-text">${text}</div>`;
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

function appendUserBubble(container, text) {
  const bubble = document.createElement("div");
  bubble.className = "ai-bubble ai-bubble-user";
  bubble.innerHTML = `<div class="ai-bubble-text">${text}</div>`;
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

function showTyping(container) {
  // 避免重複顯示
  if (document.getElementById("aiTypingIndicator")) return;
  
  const bubble = document.createElement("div");
  bubble.className = "ai-bubble ai-bubble-ai ai-typing";
  bubble.id = "aiTypingIndicator";
  // CSS 需要配合 .dot-flashing 動畫
  bubble.innerHTML = `<div class="dot-flashing"></div>`; 
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

function removeTyping() {
  const el = document.getElementById("aiTypingIndicator");
  if (el) el.remove();
}

// ============================================================
// 📡 3. callAI（呼叫後端）
// ============================================================
async function callAI(message, session, image = null) {
  try {
    const res = await fetch("https://tea-order-server.onrender.com/api/ai-tea", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        image, // 👈 傳送 Base64 圖片
        products: CONFIG.PRODUCTS,
        session,
        previousTaste: JSON.parse(localStorage.getItem("user_taste") || "null")
      })
    });
    return await res.json();
  } catch (error) {
    console.error("API Error:", error);
    return { mode: "error" };
  }
}

// --- 輔助工具：轉 Base64 ---
function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
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
          阿興師 AI 導購
        </h2>

        <div id="aiChat" class="ai-chat-area"></div>

        <div class="ai-input-row">
          <input type="file" id="aiImgUpload" accept="image/*" style="display: none;" />
          
          <button id="aiImgBtn" class="ai-icon-btn" title="上傳食物照">
            <i class="ph ph-camera"></i>
          </button>

          <input id="aiInput" class="ai-text-input" placeholder="輸入訊息..." />
          <button id="aiSend" class="ai-send-btn">送出</button>
        </div>

        <button id="aiClose" class="ai-close-icon">×</button>
      </div>
    `;

    document.body.appendChild(modal);

    // 關閉邏輯
    const closeAction = () => {
      resetSession();
      modal.classList.remove("show");
      setTimeout(() => modal.remove(), 250);
    };

    modal.querySelector("#aiClose").onclick = closeAction;
    modal.addEventListener("click", e => {
      if (e.target === modal) closeAction();
    });
  }

  return modal;
}

// ============================================================
// 🏁 5. 開啟 AI Modal（初始化 + 事件綁定）
// ============================================================
function showAIModal() {
  resetSession();
  const modal = createAIModal();
  const chat = modal.querySelector("#aiChat");
  const input = modal.querySelector("#aiInput");
  const sendBtn = modal.querySelector("#aiSend");
  const imgUpload = modal.querySelector("#aiImgUpload");
  const imgBtn = modal.querySelector("#aiImgBtn");

  modal.classList.add("show");

  // --- 初始化歡迎詞 ---
  let userTaste = JSON.parse(localStorage.getItem("user_taste") || "null");
  chat.innerHTML = "";

  if (userTaste) {
    appendAIBubble(chat, "歡迎回來！要使用上次的風味偏好嗎？😊");
    appendAskOptions(chat, ["使用上次偏好", "重新開始"]);
  } else {
    appendAIBubble(chat, "嗨～我是阿興師，可以幫您推薦｜送禮｜搭餐，也可以拍張食物照片給我看喔！📸");
    appendAskOptions(chat, ["我想找茶", "送禮推薦", "測測我的命定茶", "搭餐建議"]);
  }

  let session = null;

  // --- 事件 1：傳送文字 ---
  const sendText = async () => {
    const msg = input.value.trim();
    if (!msg) return;

    appendUserBubble(chat, msg);
    input.value = "";
    
    showTyping(chat); // 顯示 ...
    const result = await callAI(msg, session);
    removeTyping();   // 移除 ...

    session = result.session || null;
    saveSession(session);
    handleAIResponse(result, chat);
  };

  sendBtn.onclick = sendText;
  input.onkeypress = (e) => { if (e.key === "Enter") sendText(); };

  // --- 事件 2：點擊相機 ---
  imgBtn.onclick = () => imgUpload.click();

  // --- 事件 3：圖片選取後 ---
  imgUpload.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("圖片太大囉！請選 5MB 以下的照片。");
      return;
    }

    // 預覽圖片 (User Bubble)
    try {
      const base64 = await toBase64(file);
      // 這裡顯示圖片預覽
      const imgBubble = document.createElement("div");
      imgBubble.className = "ai-bubble ai-bubble-user";
      imgBubble.innerHTML = `<img src="${base64}" class="ai-bubble-img">`;
      chat.appendChild(imgBubble);
      chat.scrollTop = chat.scrollHeight;

      // 呼叫 AI (傳送圖片)
      showTyping(chat); // 🔥 重點：圖片分析比較久，一定要加 loading
      const result = await callAI("", session, base64);
      removeTyping();

      session = result.session || null;
      saveSession(session);
      handleAIResponse(result, chat);

    } catch (err) {
      console.error(err);
      appendAIBubble(chat, "圖片讀取失敗，請再試一次 🙏");
      removeTyping();
    }

    imgUpload.value = ""; // 清空，允許重複選同一張
  };
}

// ============================================================
// 🎯 6. 處理 AI 回應（Router）
// ============================================================
function handleAIResponse(out, chat) {
  if (out.mode === "error") {
    appendAIBubble(chat, "阿興師現在有點忙，請稍後再試 🙏");
    return;
  }

  if (out.mode === "ask") {
    appendAIBubble(chat, out.ask);
    if (out.options) appendAskOptions(chat, out.options);
    return;
  }

  // -------------------------------
  // (H) Masterpick —— 店長推薦 (含隱藏版支援)
  // -------------------------------
  if (out.mode === "masterpick") {
    // 如果是隱藏版 (後端傳來 tea_data)，直接用它；否則去 products 列表找
    let teaData;
    if (out.tea_data) {
      teaData = out.tea_data; // 使用後端傳來的神秘物件
    } else {
      teaData = CONFIG.PRODUCTS.find(p => p.id === out.best);
    }

    // 呼叫 UI 建構器，多傳一個 isSecret 參數
    chat.innerHTML += buildMasterpickBubble(out, teaData, out.isSecret);
    enableProductClicks(chat);
    return;
  }

  if (out.mode === "recommend") {
    chat.innerHTML += buildRecommendBubble(out, CONFIG.PRODUCTS);
  } else if (out.mode === "pairing") {
    chat.innerHTML += buildPairingBubble(out, CONFIG.PRODUCTS);
  } else if (out.mode === "gift") {
    chat.innerHTML += buildGiftBubble(out, CONFIG.PRODUCTS);
  } else if (out.mode === "compare") {
    chat.innerHTML += buildCompareBubble(out, CONFIG.PRODUCTS);
  } else if (out.mode === "brew") {
    chat.innerHTML += buildBrewBubble(out, CONFIG.PRODUCTS);
  } else if (out.mode === "personality") {
    chat.innerHTML += buildPersonalityBubble(out, CONFIG.PRODUCTS);
  } else {
    appendAIBubble(chat, "收到！");
  }

  enableProductClicks(chat);
  chat.scrollTop = chat.scrollHeight;
}

// ============================================================
// 🧩 7. UI 建構器 & 輔助函式
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

      if (opt === "重新開始") {
        resetSession();
        showAIModal(); // 重開
        return;
      }

      appendUserBubble(chat, opt);
      showTyping(chat);
      
      const out = await callAI(opt, session);
      removeTyping();
      
      saveSession(out.session || null);
      handleAIResponse(out, chat);
    };
    box.appendChild(btn);
  });
  chat.appendChild(box);
}

function enableProductClicks(chat) {
  chat.querySelectorAll("[data-prod]")?.forEach(btn => {
    btn.onclick = () => {
      // 關閉 Modal 並跳轉商品
      const modal = document.getElementById("aiModal");
      if(modal) modal.classList.remove("show");
      const prodId = btn.dataset.prod;
      // 假設原本網頁有這個邏輯
      const card = document.querySelector(`.tea-card[data-id="${prodId}"]`);
      if (card) card.click();
    };
  });
}

// --- 以下是氣泡 HTML 生成 (維持原本邏輯，略為精簡) ---

function buildRecommendBubble(out, products) {
  const best = products.find(p => p.id === (out.best?.id || out.best));
  const second = products.find(p => p.id === (out.second?.id || out.second));
  return `
    <div class="ai-bubble ai-bubble-ai">
      <div class="ai-bubble-title">🌟 推薦茶款</div>
      <div class="ai-prod-item" data-prod="${best.id}">
        <div class="prod-name">${best.title}</div>
        <div class="prod-reason">${out.best.reason}</div>
      </div>
      ${second ? `<div class="ai-prod-item" data-prod="${second.id}"><div class="prod-name">${second.title}</div><div class="prod-reason">${out.second.reason}</div></div>` : ""}
    </div>`;
}

function buildPairingBubble(out, products) {
  const tea = products.find(p => p.id === out.tea);
  return `
    <div class="ai-bubble ai-bubble-ai">
      <div class="ai-bubble-title">${out.summary || "🍽 搭配推薦"}</div>
      <div class="ai-prod-item" data-prod="${tea.id}">
        <div class="prod-name">${tea.title}</div>
        <div class="prod-reason">${out.reason}</div>
      </div>
    </div>`;
}

function buildGiftBubble(out, products) {
  const tea = products.find(p => p.id === out.tea || out.best);
  return `
    <div class="ai-bubble ai-bubble-ai">
      <div class="ai-bubble-title">🎁 送禮建議</div>
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
      <div class="ai-bubble-title">🔍 茶品比較</div>
      <div class="compare-block">
        <div class="compare-col"><div class="compare-name">${a.title}</div></div>
        <div class="compare-middle">
          <div>香氣：${out.compare.aroma}</div>
          <div>焙火：${out.compare.roast}</div>
          <div>價格：${out.compare.price}</div>
        </div>
        <div class="compare-col"><div class="compare-name">${b.title}</div></div>
      </div>
      <div class="compare-summary">${out.compare.summary}</div>
    </div>`;
}

function buildBrewBubble(out, products) {
  const tea = products.find(p => p.id === out.tea);
  return `
    <div class="ai-bubble ai-bubble-ai">
      <div class="ai-bubble-title">🍵 ${tea.title} 泡法</div>
      <div class="brew-item">🔥 熱泡：${out.brew.hot}</div>
      <div class="brew-item">🧊 冰鎮：${out.brew.ice_bath}</div>
      <div class="brew-item">❄️ 冷泡：${out.brew.cold_brew}</div>
      <div class="brew-tips">${out.tips}</div>
    </div>`;
}

function buildPersonalityBubble(out, products) {
  const tea = products.find(p => p.id === out.tea);
  return `
    <div class="ai-bubble ai-bubble-ai">
      <div class="ai-bubble-title">🔮 你的靈魂茶飲</div>
      <div style="margin-bottom:10px; color:#555; line-height:1.5;">${out.summary}</div>
      <div class="ai-prod-item" data-prod="${tea.id}">
        <div class="prod-name">${tea.title}</div>
        <div class="prod-reason" style="color:var(--tea-green-deep)">查看詳情 →</div>
      </div>
    </div>`;
}

function buildMasterpickBubble(out, tea, isSecret = false) {
  // 如果是隱藏版，我們加一個特殊的 CSS class
  const specialClass = isSecret ? "secret-card" : "";
  const icon = isSecret ? "🤫" : "👑";
  const title = isSecret ? "阿興師的私房貨" : "店長特別推薦";

  return `
    <div class="ai-bubble ai-bubble-ai">
      <div class="ai-bubble-title">${icon} ${title}</div>

      <div class="ai-prod-item ${specialClass}" data-prod="${tea.id}">
        <div class="prod-name">${tea.title}</div>
        <div class="prod-reason">${out.reason}</div>
        ${isSecret ? `<div style="font-size:0.8rem; color:#b8860b; margin-top:5px;">NT$ ${tea.price}</div>` : ""}
      </div>
    </div>
  `;
}

function injectAIAssistButton(retry = 0) {
  const container = document.getElementById("aiEntry");
  if (!container) {
    if (retry < 10) requestAnimationFrame(() => injectAIAssistButton(retry + 1));
    return;
  }
  if (document.getElementById("aiAssistBtn")) return;

  const btn = document.createElement("button");
  btn.id = "aiAssistBtn";
  btn.className = "ai-assist-btn";
  btn.innerHTML = `<i class="ph ph-chat-circle-dots"></i> AI 導購`;
  btn.onclick = () => showAIModal();
  container.prepend(btn);
}

document.addEventListener("DOMContentLoaded", () => injectAIAssistButton());