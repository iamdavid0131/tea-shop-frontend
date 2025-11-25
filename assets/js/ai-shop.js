// ============================================================
// ⭐ ai-shop.js（v5.2 Ultimate + Nano Banana Edition）
// ============================================================
// 更新亮點：
// ✔ AI 解析意圖 + 食物影像 + 配茶
// ✔ Secret Modal 私房貨購買流程（完整保留）
// ✔ Nano Banana AI 生成茶籤（後端生成背景）
// ✔ 前端 Canvas 套上：金框＋漸層＋字體＋落款
// ✔ v5.2 豪華 UI 整合（與你的 CSS 完全相容）
// ============================================================

import { CONFIG } from "./config.js";
import { saveCartItem, updateTotals } from "./cart.js";

// ============================================================
// 🧠 1. Session（localStorage）
// ============================================================

const AI_SESSION_KEY = "ai_guide_session";

function loadSession() {
  try {
    const d = localStorage.getItem(AI_SESSION_KEY);
    return d ? JSON.parse(d) : null;
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
  bubble.innerHTML = `<div class="ai-bubble-text">${text.replace(/\n/g, "<br>")}</div>`;
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
  if (document.getElementById("aiTypingIndicator")) return;
  const bubble = document.createElement("div");
  bubble.className = "ai-bubble ai-bubble-ai ai-typing";
  bubble.id = "aiTypingIndicator";
  bubble.innerHTML = `<div class="dot-flashing"></div>`;
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

function removeTyping() {
  const el = document.getElementById("aiTypingIndicator");
  if (el) el.remove();
}

// ============================================================
// 🔊 2.1 語音（v5.2）
// ============================================================

let currentAudio = null;

function playAIAudio(base64) {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }

  try {
    currentAudio = new Audio(base64);
    currentAudio.volume = 1;
    currentAudio.play().catch(() => {});
  } catch (e) {
    console.error("Audio error:", e);
  }
}

// ============================================================
// 🌙 2.2 AI 指令處理（夜間模式）
// ============================================================

function handleAICommand(cmd) {
  if (cmd === "night_mode_on") {
    document.body.style.transition = "filter 3s ease";
    document.body.style.filter = "brightness(0.7) sepia(0.2)";

    const modal = document.getElementById("aiModal");
    if (modal) modal.style.background = "rgba(0,0,0,0.55)";
  }
}

// ============================================================
// 🎨 3. Modal 建立
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
          <input type="file" id="aiImgUpload" accept="image/*" style="display:none;" />

          <button id="aiImgBtn" class="ai-icon-btn" title="上傳食物照">
            <i class="ph ph-camera"></i>
          </button>

          <input id="aiInput" class="ai-text-input" placeholder="輸入訊息..." />

          <button id="aiSend" class="ai-send-btn">
            ➤
          </button>
        </div>

        <button id="aiClose" class="ai-close-icon">×</button>
      </div>
    `;

    document.body.appendChild(modal);

    const closeAction = () => {
      document.body.style.filter = "none";
      if (currentAudio) currentAudio.pause();
      resetSession();
      modal.classList.remove("show");
      setTimeout(() => modal.remove(), 260);
    };

    modal.querySelector("#aiClose").onclick = closeAction;
    modal.addEventListener("click", e => {
      if (e.target === modal) closeAction();
    });
  }

  return modal;
}

// ============================================================
// 📡 4. callAI（v5.2 統一通道）
// ============================================================
//
// v5.2 支援：
// - 訊息問答
// - 圖片分析（食物 → 搭配茶）
// - special_intent: generate_card_image（Nano Banana 茶籤生成）
//
async function callAI(message, session, image = null, extraPayload = {}) {
  try {
    const res = await fetch("https://tea-order-server.onrender.com/api/ai-tea", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        image,
        products: CONFIG.PRODUCTS,
        session,
        previousTaste: JSON.parse(localStorage.getItem("user_taste") || "null"),
        ...extraPayload
      })
    });

    return await res.json();
  } catch (err) {
    console.error("AI API error:", err);
    return { mode: "error" };
  }
}

// ============================================================
// 🔧 工具：轉 Base64
// ============================================================

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.readAsDataURL(file);
    r.onload = () => resolve(r.result);
    r.onerror = reject;
  });
}

// ============================================================
// 🏁 5. 開啟 AI Modal（v5.2）
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
  chat.innerHTML = "";

  // --- 入場問候 ---
  let taste = JSON.parse(localStorage.getItem("user_taste") || "null");

  if (taste) {
    appendAIBubble(chat, "歡迎回來！阿興師還記得你的口味，要沿用上次偏好嗎？😊");
    appendAskOptions(chat, ["使用上次偏好", "重新開始"]);
  } else {
    appendAIBubble(chat, 
      "嗨～我是阿興師！\n" +
      "今天想要找茶、送禮，或是試試 **Nano Banana 茶籤** 嗎？🍌✨"
    );
    appendAskOptions(chat, [
      "我想找茶",
      "送禮推薦",
      "測測我的命定茶",
      "搭餐建議"
    ]);
  }

  let session = null;

  // ============================================================
  // 📤 送出訊息
  // ============================================================

  const sendText = async () => {
    const msg = input.value.trim();
    if (!msg) return;

    appendUserBubble(chat, msg);
    input.value = "";

    showTyping(chat);
    const out = await callAI(msg, session);
    removeTyping();

    session = out.session || null;
    saveSession(session);

    handleAIResponse(out, chat);
  };

  sendBtn.onclick = sendText;

  input.onkeypress = e => { 
    if (e.key === "Enter") sendText(); 
  };

  // ============================================================
  // 📸 上傳圖片（食物 → 搭配茶、情境 → 推薦）
  // ============================================================

  imgBtn.onclick = () => imgUpload.click();

  imgUpload.onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;

    // 限制大小（你可自行調整）
    if (file.size > 10* 1024 * 1024) {
      alert("圖片太大囉！請選 5MB 以下的照片～");
      return;
    }

    try {
      const base64 = await toBase64(file);

      // 顯示圖片氣泡
      const bubble = document.createElement("div");
      bubble.className = "ai-bubble ai-bubble-user";
      bubble.innerHTML = `<img src="${base64}" class="ai-bubble-img">`;
      chat.appendChild(bubble);
      chat.scrollTop = chat.scrollHeight;

      showTyping(chat);

      // 呼叫後端進行圖片 AI 分析
      const out = await callAI("", session, base64);
      removeTyping();

      session = out.session || null;
      saveSession(session);

      handleAIResponse(out, chat);
    } catch (err) {
      console.error("Image Upload Error:", err);
      appendAIBubble(chat, "圖片讀取失敗，請再試一次 🙏");
    }

    imgUpload.value = "";
  };
}

// ============================================================
// 🎯 6. 處理 AI 回應（v5.2 Router）
// ============================================================

function handleAIResponse(out, chat) {

  // 🟣 1) 語音播放（TTS）
  if (out.audio) playAIAudio(out.audio);

  // 🌙 2) 指令（夜間模式）
  if (out.command) handleAICommand(out.command);

  // ❌ 3) 錯誤處理
  if (out.mode === "error") {
    appendAIBubble(chat, "阿興師現在有點忙，請稍後再試 🙏");
    return;
  }

  // 🟡 4) 問句（反問模式）
  if (out.mode === "ask") {
    appendAIBubble(chat, out.ask);
    if (out.options) appendAskOptions(chat, out.options);
    return;
  }

  // 🫶 5) 私房貨 / Masterpick
  if (out.mode === "masterpick") {
    let teaData = out.tea_data || CONFIG.PRODUCTS.find(p => p.id === (out.best?.id || out.best));
    chat.innerHTML += buildMasterpickBubble(out, teaData, out.isSecret);
    enableProductClicks(chat);
    return;
  }

  // 🟢 6) 正常推薦模式（支援 Upsell）
  if (out.mode === "recommend") {
    chat.innerHTML += buildRecommendBubble(out, CONFIG.PRODUCTS);
  }

  // 🍽 食物搭配模式（圖片/文字都可觸發）
  else if (out.mode === "pairing") {
    chat.innerHTML += buildPairingBubble(out, CONFIG.PRODUCTS);
  }

  // 🎁 送禮推薦
  else if (out.mode === "gift") {
    chat.innerHTML += buildGiftBubble(out, CONFIG.PRODUCTS);
  }

  // 🔍 比較模式
  else if (out.mode === "compare") {
    chat.innerHTML += buildCompareBubble(out, CONFIG.PRODUCTS);
  }

  // 🍵 泡法模式
  else if (out.mode === "brew") {
    chat.innerHTML += buildBrewBubble(out, CONFIG.PRODUCTS);
  }

  // 🔮 靈魂茶（人格測試）
  else if (out.mode === "personality") {
    chat.innerHTML += buildPersonalityBubble(out, CONFIG.PRODUCTS);
  }

  // 🧊 預防 fallback
  else {
    appendAIBubble(chat, "收到！");
  }

  enableProductClicks(chat);
  chat.scrollTop = chat.scrollHeight;
}

// ============================================================
// 🧩 7. 反問按鈕（Ask Options）
// ============================================================

function appendAskOptions(chat, options) {
  const box = document.createElement("div");
  box.className = "ai-option-group";

  options.forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "ai-option-btn";
    btn.textContent = opt;

    btn.onclick = async () => {
      // 重新開始 → reset session
      if (opt === "重新開始") {
        resetSession();
        showAIModal();
        return;
      }

      appendUserBubble(chat, opt);

      let session = loadSession();
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

// ============================================================
// 🫖 8. 點擊推薦的商品卡片
// ============================================================
//
// 支援：
//   - 點擊 → 開啟該商品 modal
//   - 私房貨 data-secret → 開啟 Secret Modal
//

function enableProductClicks(chat) {
  chat.querySelectorAll("[data-prod]")?.forEach(btn => {
    btn.onclick = () => {
      const secretRaw = btn.getAttribute("data-secret");

      // 🕵️ Secret Tea
      if (secretRaw) {
        const data = JSON.parse(decodeURIComponent(secretRaw));
        openSecretModal(data);
        return;
      }

      // 🫖 一般商品 → 觸發前端原本的 tea-card click
      const prodId = btn.dataset.prod;
      const modal = document.getElementById("aiModal");

      // 關閉 AI modal
      if (modal) modal.classList.remove("show");

      const card = document.querySelector(`.tea-card[data-id="${prodId}"]`);
      if (card) card.click();
    };
  });
}

// ============================================================
// 🧩 9. UI 建構器（v5.2 全新升級）
// ============================================================

// ------------------------------------------------------------
// 🌟 推薦（含 v5.2 Upsell 雙卡片）
// ------------------------------------------------------------
function buildRecommendBubble(out, products) {
  const best = products.find(p => p.id === (out.best?.id || out.best));
  const second = products.find(p => p.id === (out.second?.id || out.second));

  return `
    <div class="ai-bubble ai-bubble-ai">
      <div class="ai-bubble-title">🌟 阿興師推薦</div>

      <!-- 第一名 -->
      <div class="ai-prod-item" data-prod="${best.id}">
        <div class="prod-name">👑 ${best.title}</div>
        <div class="prod-reason">${out.best.reason}</div>
      </div>

      <!-- 第二名 Upsell -->
      ${second ? `
      <div class="ai-prod-item" 
           data-prod="${second.id}" 
           style="margin-top:8px; border-left:3px solid #ccc;">
        <div class="prod-name" style="color:#666;">🥈 ${second.title}</div>
        <div class="prod-reason" style="color:#888;">${out.second.reason}</div>
      </div>` : ""}

      ${getCardButtonHtml(best.title, out.card_text)}
    </div>
  `;
}

// ------------------------------------------------------------
// 🍽 搭餐推薦（含圖片食物 AI 辨識）
// ------------------------------------------------------------
function buildPairingBubble(out, products) {
  const tea = products.find(p => p.id === out.tea);

  return `
    <div class="ai-bubble ai-bubble-ai">
      <div class="ai-bubble-title">
        ${out.summary || "🍽 搭配推薦"}
      </div>

      <div class="ai-prod-item" data-prod="${tea.id}">
        <div class="prod-name">${tea.title}</div>
        <div class="prod-reason">${out.reason}</div>
      </div>

      ${getCardButtonHtml(tea.title, out.card_text)}
    </div>
  `;
}

// ------------------------------------------------------------
// 🎁 送禮推薦
// ------------------------------------------------------------
function buildGiftBubble(out, products) {
  const tea = products.find(p => p.id === out.tea || out.best.id);

  return `
    <div class="ai-bubble ai-bubble-ai">
      <div class="ai-bubble-title">🎁 送禮首選</div>

      <div class="ai-prod-item" data-prod="${tea.id}">
        <div class="prod-name">${tea.title}</div>
        <div class="prod-reason">
          ${out.best?.reason || out.reason}
        </div>
      </div>

      ${getCardButtonHtml(tea.title, out.card_text)}
    </div>
  `;
}

// ------------------------------------------------------------
// 🔍 比較（A vs B）
// ------------------------------------------------------------
function buildCompareBubble(out, products) {
  const a = products.find(p => p.id === out.a);
  const b = products.find(p => p.id === out.b);

  return `
    <div class="ai-bubble ai-bubble-ai">
      <div class="ai-bubble-title">🔍 茶品比較</div>

      <div class="compare-block">
        <div class="compare-col">
          <div class="compare-name">${a.title}</div>
        </div>

        <div class="compare-middle" style="color:#888;">VS</div>

        <div class="compare-col">
          <div class="compare-name">${b.title}</div>
        </div>
      </div>

      <div class="compare-summary">${out.compare.summary}</div>
    </div>
  `;
}

// ------------------------------------------------------------
// 🍵 泡法
// ------------------------------------------------------------
function buildBrewBubble(out, products) {
  const tea = products.find(p => p.id === out.tea);

  return `
    <div class="ai-bubble ai-bubble-ai">
      <div class="ai-bubble-title">🍵 ${tea.title} 泡法</div>

      <div class="brew-item">🔥 熱泡：${out.brew.hot}</div>
      <div class="brew-item">🧊 冰鎮：${out.brew.ice_bath}</div>
      <div class="brew-item">❄️ 冷泡：${out.brew.cold_brew}</div>
    </div>
  `;
}

// ------------------------------------------------------------
// 🔮 靈魂茶（人格分析）
// ------------------------------------------------------------
function buildPersonalityBubble(out, products) {
  const tea = products.find(p => p.id === out.tea);

  return `
    <div class="ai-bubble ai-bubble-ai">
      <div class="ai-bubble-title">🔮 你的靈魂茶飲</div>

      <div class="person-summary">${out.summary}</div>

      <div class="ai-prod-item" data-prod="${tea.id}">
        <div class="prod-name">${tea.title}</div>
        <div class="prod-reason" style="color:#2f4b3c;">
          查看詳情 →
        </div>
      </div>

      ${getCardButtonHtml(tea.title, out.card_text)}
    </div>
  `;
}

// ------------------------------------------------------------
// 🤫 私房貨（Secret Mode）
// ------------------------------------------------------------
function buildMasterpickBubble(out, tea, isSecret = false) {
  const icon = isSecret ? "🤫" : "👑";
  const title = isSecret ? "阿興師的私房貨" : "店長特別推薦";
  const special = isSecret ? "secret-card" : "";
  const attr = isSecret ? `data-secret="${encodeURIComponent(JSON.stringify(tea))}"` : "";

  return `
    <div class="ai-bubble ai-bubble-ai">
      <div class="ai-bubble-title">${icon} ${title}</div>

      <div class="ai-prod-item ${special}" data-prod="${tea.id}" ${attr}>
        <div class="prod-name">${tea.title}</div>
        <div class="prod-reason">${out.reason}</div>

        ${isSecret ? `
          <div style="margin-top:6px; font-size:0.9rem; color:#b8860b; font-weight:600;">
            NT$ ${tea.price} / 珍藏罐
          </div>
        ` : ""}
      </div>
    </div>
  `;
}

// ------------------------------------------------------------
// 💌 茶籤按鈕（點擊 → Nano Banana AI 作畫）
// ------------------------------------------------------------
function getCardButtonHtml(teaTitle, cardText) {
  if (!cardText) return "";

  const safeTitle = teaTitle.replace(/'/g, "\\'");
  const safeText = cardText.replace(/'/g, "\\'").replace(/\n/g, " ");

  return `
    <button class="ai-card-btn"
            onclick="drawTeaCard('${safeTitle}', '${safeText}')">
      🍌 Nano Banana 靈魂茶籤
    </button>
  `;
}
// ============================================================
// 🕵️ 10. Secret Modal（隱藏版私房貨購買 UI）
// ============================================================
//
// 功能：
// ✔ 點擊「阿興師私房貨」
// ✔ 顯示獨立 Modal
// ✔ 支援加減數量
// ✔ 加入購物車（整合 cart.js）
// ✔ 若該商品不在 CONFIG.PRODUCTS 中，自動收錄（重要）
//

export function openSecretModal(product) {
  // 關閉 AI 導購 modal（重新打開時會自動還原 session）
  const aiModal = document.getElementById("aiModal");
  if (aiModal) aiModal.classList.remove("show");

  const modalId = "secretModal";
  let modal = document.getElementById(modalId);

  // 若已存在則先移除
  if (modal) modal.remove();

  // 建立 Modal
  modal = document.createElement("div");
  modal.id = modalId;
  modal.className = "ai-modal-overlay show";

  modal.innerHTML = `
    <div class="ai-box"
         style="
           border: 2px solid #d4af37;
           background: #fffbf0;
           max-height: 88vh;
           display: flex;
           flex-direction: column;
         ">

      <!-- Header -->
      <div style="text-align:center; margin-bottom:20px; flex-shrink:0;">
        <div style="font-size:3rem;">🤫</div>
        <h2 style="color:#b8860b; margin:10px 0;">
          ${product.title}
        </h2>
      </div>

      <!-- 內容 -->
      <div style="
          background:#fff;
          padding:15px;
          border-radius:12px;
          border:1px solid #eee;
          margin-bottom:20px;
          flex-grow:1;
          overflow-y:auto;
        ">
        <p style="
            color:#666;
            font-size:0.9rem;
            margin-bottom:15px;
            line-height:1.6;
        ">
          ${product.desc || "這款是阿興師的限量私房貨，風味極佳！"}
        </p>

        <!-- 售價 -->
        <div style="
            display:flex;
            justify-content:space-between;
            margin-bottom:12px;
            font-size:0.95rem;
        ">
          <span>售價</span>
          <span style="font-weight:bold; color:#b8860b;">
            NT$ ${product.price}
          </span>
        </div>

        <!-- 數量選擇 -->
        <div style="
            display:flex;
            justify-content:space-between;
            align-items:center;
        ">
          <span>數量</span>

          <div style="display:flex; align-items:center; gap:12px;">
            <button class="secret-qty-btn" onclick="adjustSecretQty(-1)">–</button>
            <span id="secretQty"
                  style="font-weight:bold; width:32px; text-align:center;">
              1
            </span>
            <button class="secret-qty-btn" onclick="adjustSecretQty(1)">+</button>
          </div>
        </div>
      </div>

      <!-- 加入購物車 -->
      <button id="addToSecretCartBtn"
              class="ai-send-btn"
              style="
                background:#b8860b;
                width:100%;
                font-weight:bold;
                flex-shrink:0;
              ">
        加入購物車（秘密交易）
      </button>

      <!-- 關閉按鈕 -->
      <button id="closeSecret"
              class="ai-close-icon"
              style="color:#b8860b;">
        ×
      </button>
    </div>
  `;

  document.body.appendChild(modal);

  // ============================================================
  // 1. 關閉 modal
  // ============================================================
  const close = () => {
    modal.remove();
    if (aiModal) aiModal.classList.add("show");
  };

  modal.querySelector("#closeSecret").onclick = close;
  modal.addEventListener("click", e => {
    if (e.target === modal) close();
  });

  // ============================================================
  // 2. 內部數量邏輯
  // ============================================================
  let qty = 1;

  // 全域註冊（為了 onclick）
  window.adjustSecretQty = (delta) => {
    qty += delta;
    if (qty < 1) qty = 1;
    const el = document.getElementById("secretQty");
    if (el) el.textContent = qty;
  };

  // ============================================================
  // 3. 加入購物車（整合 cart.js）
// ============================================================
  document.getElementById("addToSecretCartBtn").onclick = () => {

    console.log("🤫 加入私房貨:", product.title);

    // 3-1 若商品未收錄，加入 CONFIG.PRODUCTS（可被主購買系統識別）
    const exists = CONFIG.PRODUCTS.find(p => p.id === product.id);
    if (!exists) {
      CONFIG.PRODUCTS.push(product);
    }

    // 3-2 存入購物車
    const cart = JSON.parse(localStorage.getItem("teaOrderCart") || "{}");
    const oldData = cart[product.id] || { qty: 0, pack: false, packQty: 0 };

    const newQty = oldData.qty + qty;

    saveCartItem(product.id, newQty, oldData.pack, oldData.packQty);
    updateTotals();

    close();

    // 3-3 提示
    alert(`🤫 已將 ${qty} 份「${product.title}」偷偷放入您的購物車…`);
  };
}
// ============================================================
// ✨ 11. Nano Banana AI — 茶籤金框卡片生成器（v5.2）
// ============================================================
//
// 功能：
// ✔ 後端傳回 image_base64 （AI 背景）
// ✔ Canvas 疊上金框 + 手寫字
// ✔ 自動文字換行
// ✔ 儲存分享用 Modal
//

window.drawTeaCard = async function(title, text) {
  console.log("🎨 開始生成茶籤：", title);

  // ============================================================
  // 1. 呼叫後端獲取 AI 背景（Nano Banana）
  // ============================================================
  let bgImage = null;
  try {
    const res = await fetch("https://tea-order-server.onrender.com/api/ai-tea-card", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        special_intent: "generate_card_image",
        title,
        text
      })
    });

    const json = await res.json();
    bgImage = json.image_base64;   // <--- 後端必須傳這個欄位

    if (!bgImage) {
      console.error("❌ 後端沒有回傳 image_base64");
    }
  } catch (err) {
    console.error("AI 背景生成失敗:", err);
  }

  // ============================================================
  // 2. 建立 Canvas
  // ============================================================
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  const width = 900;
  const height = 1400;
  canvas.width = width;
  canvas.height = height;

  // 2.1 背景：若有 AI 背景 → 套用；沒有 → 套柔光米白底
  if (bgImage) {
    const img = new Image();
    img.src = bgImage;
    await new Promise(resolve => img.onload = resolve);
    ctx.drawImage(img, 0, 0, width, height);
  } else {
    // Fallback：米白底
    ctx.fillStyle = "#F9F7F0";
    ctx.fillRect(0, 0, width, height);
  }

  // ============================================================
  // 3. 金色雙框（iOS 奢華茶行感）
  // ============================================================
  // 外框
  ctx.strokeStyle = "#D4AF37";
  ctx.lineWidth = 12;
  ctx.strokeRect(40, 40, width - 80, height - 80);

  // 內框（白金）
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 6;
  ctx.strokeRect(60, 60, width - 120, height - 120);

  // ============================================================
  // 4. 標題（茶名）
  // ============================================================
  ctx.fillStyle = "#2F4B3C";
  ctx.font = "bold 64px 'Noto Serif TC', serif";
  ctx.textAlign = "center";
  ctx.fillText(title, width / 2, 180);

  // 分隔線
  ctx.beginPath();
  ctx.moveTo(width / 2 - 120, 220);
  ctx.lineTo(width / 2 + 120, 220);
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = 3;
  ctx.stroke();

  // ============================================================
  // 5. 文字內容（自動換行核心）
  // ============================================================
  ctx.fillStyle = "#333333";
  ctx.font = "36px 'Noto Serif TC', serif";
  ctx.textAlign = "center";

  const maxWidth = 700;
  const lineHeight = 55;
  let y = 320;

  const chars = text.replace(/\n/g, "").split(""); // 去除換行後自己排
  let line = "";

  for (let i = 0; i < chars.length; i++) {
    const testLine = line + chars[i];
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth) {
      ctx.fillText(line, width / 2, y);
      line = chars[i];
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, width / 2, y);
  y += 120;

  // ============================================================
  // 6. 品牌落款「祥興茶行」
  // ============================================================
  ctx.fillStyle = "#b8860b";
  ctx.font = "bold 40px 'Noto Serif TC', serif";
  ctx.fillText("—— 祥興茶行", width / 2, height - 180);

  // ============================================================
  // 7. 朱紅茶印章（強化品牌）
  // ============================================================
  ctx.strokeStyle = "#B22222";
  ctx.lineWidth = 5;
  const sealX = width / 2 - 50;
  const sealY = height - 150;
  ctx.strokeRect(sealX, sealY, 100, 100);

  ctx.fillStyle = "#B22222";
  ctx.font = "48px serif";
  ctx.fillText("祥興", width / 2, sealY + 72);

  // ============================================================
  // 8. 轉 PNG 並顯示 Modal
  // ============================================================
  const dataUrl = canvas.toDataURL("image/png");
  showCardModal(dataUrl);
};

// ============================================================
// 📸 Modal 顯示卡片（可長按儲存）
// ============================================================
function showCardModal(imgUrl) {
  const modal = document.createElement("div");
  modal.className = "ai-modal-overlay show";
  modal.style.zIndex = "10000";

  modal.innerHTML = `
    <div class="ai-box"
         style="background:transparent; box-shadow:none; border:none; align-items:center;">

      <img src="${imgUrl}"
           style="width:100%; max-width:480px; border-radius:12px;
                  box-shadow:0 10px 30px rgba(0,0,0,0.4);">

      <p style="color:#fff; margin-top:12px; font-size:15px;">
        📌 長按圖片即可儲存
      </p>

      <button class="ai-close-icon"
              style="position:static; margin-top:12px;
                     background:rgba(255,255,255,0.9);"
              onclick="this.closest('.ai-modal-overlay').remove()">
        ×
      </button>
    </div>
  `;
  document.body.appendChild(modal);
}
// ============================================================
// 🚀 12. 注入 AI 導購按鈕（入口模組）
// ============================================================
//
// 在你的前端頁面中：
// <div id="aiEntry"></div>
// 我們會自動把按鈕插入進去
//

function injectAIAssistButton(retry = 0) {
  const entry = document.getElementById("aiEntry");

  // 若 entry 尚未出現 → 等待重新嘗試
  if (!entry) {
    if (retry < 20) {
      requestAnimationFrame(() => injectAIAssistButton(retry + 1));
    }
    return;
  }

  // 若按鈕已存在 → 跳過
  if (document.getElementById("aiAssistBtn")) return;

  const btn = document.createElement("button");
  btn.id = "aiAssistBtn";
  btn.className = "ai-assist-btn";
  btn.innerHTML = `
    <i class="ph ph-chat-circle-dots"></i>
    阿興師 AI 導購
  `;

  btn.onclick = () => {
    try {
      showAIModal(); // 主入口
    } catch (err) {
      console.error("❌ showAIModal() 執行錯誤：", err);
    }
  };

  entry.prepend(btn);
}


// ============================================================
// 🏁 13. DOMContentLoaded 初始化
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  injectAIAssistButton();

  console.log("✨ 祥興茶行 AI 導購 v5.2 已啟動");
});


// ============================================================
// 📦 14. 若你需要外部可呼叫 AI Modal（例如其他按鈕）
// ============================================================
export function openAIAssistant() {
  showAIModal();
}


// ============================================================
// 🧩 15. 最終模組收尾與整合
// ============================================================
//
// 模組最終輸出：
// - openAIAssistant()
// - openSecretModal()
// - drawTeaCard()
//
// 供外部（例如其他 JS）安全調用
//

export default {
  openAIAssistant,
  openSecretModal,
  drawTeaCard
};
