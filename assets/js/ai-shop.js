// ============================================================
// ⭐ ai-shop.js（多輪對話 v3.1 - Vision版）
// ============================================================

import { CONFIG } from "./config.js";
import { saveCartItem, updateTotals } from "./cart.js";

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
      // 1. 檢查是否有隱藏版資料
      const secretRaw = btn.getAttribute("data-secret");

      if (secretRaw) {
        // 🕵️ 是隱藏商品！解碼資料並打開專屬 Modal
        const productData = JSON.parse(decodeURIComponent(secretRaw));
        openSecretModal(productData);
      } else {
        // 🍵 普通商品：維持原本邏輯 (模擬點擊網頁上的卡片)
        const modal = document.getElementById("aiModal");
        if (modal) modal.classList.remove("show");
        
        const prodId = btn.dataset.prod;
        const card = document.querySelector(`.tea-card[data-id="${prodId}"]`);
        if (card) card.click();
      }
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

// 🔥 關鍵修改：如果是隱藏版，把整包 tea 物件轉成字串，藏在 data-secret 屬性裡
  // 我們用 encodeURIComponent 避免引號造成的 HTML 格式錯誤
  const secretDataAttr = isSecret 
    ? `data-secret="${encodeURIComponent(JSON.stringify(tea))}"` 
    : "";

  return `
    <div class="ai-bubble ai-bubble-ai">
      <div class="ai-bubble-title">${icon} ${title}</div>

      <div class="ai-prod-item ${specialClass}" data-prod="${tea.id}" ${secretDataAttr}>
        <div class="prod-name">${tea.title}</div>
        <div class="prod-reason">${out.reason}</div>
        ${isSecret ? `<div style="font-size:0.9rem; color:#b8860b; margin-top:5px; font-weight:bold;">NT$ ${tea.price} / 珍藏罐</div>` : ""}
      </div>
    </div>
  `;
}

// 🕵️ 開啟隱藏版專屬購買視窗
function openSecretModal(product) {
  // 1. 先移除舊的 AI Modal (暫時隱藏，保持體驗流暢)
  const aiModal = document.getElementById("aiModal");
  if (aiModal) aiModal.classList.remove("show");

  // 2. 建立新的 Secret Modal
  const modalId = "secretModal";
  let modal = document.getElementById(modalId);
  
  if (modal) modal.remove(); // 避免重複

  modal = document.createElement("div");
  modal.id = modalId;
  modal.className = "ai-modal-overlay show"; // 直接顯示
  // 金色主題樣式
  modal.innerHTML = `
    <div class="ai-box" style="border: 2px solid #d4af37; background: #fffbf0; max-height: 85vh; overflow-y: auto; display: flex; flex-direction: column;">
      
      <div style="text-align:center; margin-bottom:20px; flex-shrink: 0;">
        <div style="font-size:3rem;">🤫</div>
        <h2 style="color:#b8860b; margin:10px 0;">${product.title}</h2>
      </div>

      <div style="background:#fff; padding:15px; border-radius:12px; border:1px solid #eee; margin-bottom:20px; flex-grow: 1; overflow-y: auto;">
        <p style="color:#666; font-size:0.9rem; margin-bottom: 15px; line-height: 1.6;">${product.desc}</p>
        
        <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
          <span>售價</span>
          <span style="font-weight:bold; color:#b8860b;">NT$ ${product.price}</span>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span>數量</span>
          <div style="display:flex; align-items:center; gap:10px;">
            <button class="qty-btn" onclick="adjustSecretQty(-1)">-</button>
            <span id="secretQty" style="font-weight:bold; width:30px; text-align:center;">1</span>
            <button class="qty-btn" onclick="adjustSecretQty(1)">+</button>
          </div>
        </div>
      </div>

      <button id="addToSecretCartBtn" class="ai-send-btn" style="background:#b8860b; width:100%; font-weight:bold; flex-shrink: 0;">
        加入購物車 (秘密交易)
      </button>

      <button id="closeSecret" class="ai-close-icon" style="color:#b8860b;">×</button>
    </div>
  `;
  document.body.appendChild(modal);

  // --- 內部邏輯 ---
  
  // 關閉事件
  const close = () => {
    modal.remove();
    // 如果原本 AI 視窗還在，把它叫回來 (Optional)
    if (aiModal) aiModal.classList.add("show");
  };
  modal.querySelector("#closeSecret").onclick = close;
  modal.addEventListener("click", e => { if(e.target === modal) close(); });

  // 數量調整 (掛在 window 上以便 onclick 呼叫，或直接綁定)
  let qty = 1;
  window.adjustSecretQty = (delta) => {
    qty += delta;
    if (qty < 1) qty = 1;
    document.getElementById("secretQty").textContent = qty;
  };

  // 🔥 加入購物車核心邏輯
  document.getElementById("addToSecretCartBtn").onclick = () => {
    addToGlobalCart(product, qty); // 呼叫外部的購物車函式
    close();
    
    // 顯示成功提示
    alert(`🤫 已將 ${qty} 份「${product.title}」偷偷放入您的購物車...`);
  };
}

// 🛒 橋接器：把商品推入主網站的購物車
function addToGlobalCart(product, quantity) {
  console.log("🤫 加入隱藏商品:", product.title);

  // 1. 把隱藏商品「偷渡」進全域商品列表
  // 這樣 cart.js 的 buildOrderItems() 才能透過 CONFIG.PRODUCTS.find() 找到它
  const existsInConfig = CONFIG.PRODUCTS.find(p => p.id === product.id);
  if (!existsInConfig) {
    CONFIG.PRODUCTS.push(product);
    console.log("✅ 已將隱藏商品註冊至 CONFIG.PRODUCTS");
  }

  // 2. 取得目前的購物車狀態 (從 localStorage)
  const cart = JSON.parse(localStorage.getItem("teaOrderCart") || "{}");
  const currentData = cart[product.id] || { qty: 0, pack: false, packQty: 0 };
  
  // 3. 更新數量 (累加)
  const newQty = currentData.qty + quantity;

  // 4. 呼叫 cart.js 的標準儲存函式
  // saveCartItem(id, qty, pack, packQty)
  saveCartItem(product.id, newQty, currentData.pack, currentData.packQty);

  // 5. 強制更新 UI 金額
  updateTotals();
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