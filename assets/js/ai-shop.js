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
// 🎨 非同步背景畫圖 (v5.3 New)
// ============================================================
async function triggerBackgroundPainting(payload, btnId) {
  console.log("🎨 [Imagen 3] 背景畫圖啟動...", payload.card_title);

  try {
    // 呼叫原本的 API，帶上 special_intent
    // 注意：這裡不傳 session，因為畫圖不需要上下文
    const res = await callAI("", null, null, {
      special_intent: "generate_card_image",
      image_payload: payload
    });

    const imageUrl = res.image_url;
    const btn = document.getElementById(btnId);

    // 👇 這裡加一個檢查，確保後端真的有回傳東西
    if (!imageUrl) {
        console.warn("⚠️ 圖片生成回傳為空");
        throw new Error("Empty image url");
    }

    if (btn && imageUrl) {
      // 1. 更新按鈕文字
      btn.innerHTML = `🍌 Nano Banana 靈魂茶籤 (完成)`;
      btn.classList.remove("loading-state"); // 移除灰色樣式
      btn.classList.add("ready-state");      // 加入金色閃光樣式

      // 2. 處理字串跳脫 (避免 title 有引號噴錯)
      const safeTitle = payload.card_title.replace(/'/g, "\\'");
      const safeText = payload.card_text.replace(/'/g, "\\'").replace(/\n/g, " ");
      
      // 3. ⭐ 關鍵：更新 onclick，將算好的 imageUrl 塞進去
      // 這樣使用者點擊時，drawTeaCard 就不用再等了，直接畫！
      btn.setAttribute("onclick", `drawTeaCard('${safeTitle}', '${safeText}', '${imageUrl}')`);
      
      console.log("✅ 圖片生成完畢，按鈕已更新");
    }

  } catch (err) {
    console.error("背景畫圖失敗", err);
    const btn = document.getElementById(btnId);
    if (btn) {
        btn.textContent = "🍌 茶籤圖片讀取失敗 (點擊重試)";
        // 失敗時保持原本 onclick，讓 drawTeaCard 自己去重試
    }
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

          <button id="aiSend" class="ai-send-btn"><i class="ph ph-paper-plane-right"></i></button>
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
// 🌡️ 自動偵測環境小工具
function getEnvContext() {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12月
  const hour = now.getHours();      // 0-23時

  // 簡單模擬台灣氣溫邏輯 (也可改接真實氣象 API，但這樣最快最穩)
  let estimated_temp = 24; // 春秋均溫
  if (month >= 5 && month <= 10) estimated_temp = 30; // 夏 (熱)
  if (month >= 12 || month <= 2) estimated_temp = 16; // 冬 (冷)

  return {
    month: month,
    time_hour: hour,
    temperature: estimated_temp,
    is_night: (hour >= 22 || hour <= 5) // 是否為深夜
  };
}

async function callAI(message, session, image = null, extraPayload = {}) {
  try {
    const env = getEnvContext();
    const res = await fetch("https://tea-order-server.onrender.com/api/ai-tea", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        image,
        products: CONFIG.PRODUCTS,
        session,
        client_env: env,
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
      "今天想要找茶、送禮，或是試試可愛的茶籤嗎？✨"
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

  // 🟣 1) 語音播放
  if (out.audio) playAIAudio(out.audio);

  // 🌙 2) 指令
  if (out.command) handleAICommand(out.command);

  // ❌ 3) 錯誤
  if (out.mode === "error") {
    appendAIBubble(chat, "阿興師現在有點忙，請稍後再試 🙏");
    return;
  }

  // ⭐ 關鍵新增：為這次回應產生一個唯一的按鈕 ID
  // 這樣背景圖片算好回來時，才知道要更新哪一顆按鈕
  const btnId = "ai-card-btn-" + Date.now();
  out.btnId = btnId; 

  // 🟡 4) 問句
  if (out.mode === "ask") {
    appendAIBubble(chat, out.ask);
    if (out.options) appendAskOptions(chat, out.options);
    return;
  }

  // 🫶 5) 私房貨
  if (out.mode === "masterpick") {
    let teaData = out.tea_data || CONFIG.PRODUCTS.find(p => p.id === (out.best?.id || out.best));
    chat.innerHTML += buildMasterpickBubble(out, teaData, out.isSecret);
    enableProductClicks(chat);
    return;
  }

  // 🟢 6) 各種模式 UI 建構 (都會用到 out.btnId)
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

  // ⭐ 關鍵新增：非同步圖片載入觸發器
  // 如果後端說 "LOADING"，我們就在這裡偷偷發送請求去畫圖
  if (out.card_image === "LOADING" && out.image_payload) {
    triggerBackgroundPainting(out.image_payload, btnId);
  }
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
  // 1. 取得 AI 推薦的 ID
  // 相容兩種格式：out.best 是物件(包含 id) 或 out.best 直接是字串
  const rawId = out.best?.id || out.best;
  
  // 2. 嘗試在前端商品列表尋找
  let best = products.find(p => p.id === rawId);

  // 🚨 3. 如果找不到，印出詳細兇手資訊 (請按 F12 看 Console)
  if (!best) {
    console.group("%c🚨 抓到了！AI 推薦的商品 ID 對不上！", "color: red; font-size: 14px; font-weight: bold;");
    console.log("🔍 AI 回傳的原始 ID:", rawId);
    console.log("📦 AI 回傳的完整資料:", out);
    console.log("📋 前端目前有的 ID 列表:", products.map(p => p.id));
    
    // 分析原因
    if (rawId === "fallback") {
      console.warn("💡 原因：後端發生錯誤 (Catch Error)，回傳了 'fallback'。");
    } else {
      console.warn("💡 原因：可能是 AI 幻覺，或者前後端商品資料不同步。");
    }
    console.groupEnd();

    // 為了不讓畫面當掉，還是得先拿一個墊檔，但至少我們知道發生什麼事了
    best = products[0]; 
  }

  // 4. 第二名處理 (同理)
  let second = null;
  if (out.second) {
    const secondId = out.second?.id || out.second;
    second = products.find(p => p.id === secondId);
    if (!second && secondId) {
        console.warn("⚠️ 第二名推薦也找不到 ID:", secondId);
    }
  }

  // ... (以下 HTML 生成保持不變) ...
  return `
    <div class="ai-bubble ai-bubble-ai">
      <div class="ai-bubble-title">🌟 阿興師推薦</div>

      <div class="ai-prod-item" data-prod="${best.id}">
        <div class="prod-name">👑 ${best.title}</div>
        <div class="prod-reason">${out.best?.reason || "這款非常適合你！(系統預設)"}</div>
      </div>

      ${second ? `
      <div class="ai-prod-item" 
           data-prod="${second.id}" 
           style="margin-top:8px; border-left:3px solid #ccc;">
        <div class="prod-name" style="color:#666;">🥈 ${second.title}</div>
        <div class="prod-reason" style="color:#888;">${out.second.reason}</div>
      </div>` : ""}

      ${getCardButtonHtml(best.title, out.card_text, out.card_image, out.btnId)}
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

      ${getCardButtonHtml(tea.title, out.card_text, out.card_image,out.btnId)}
    </div>
  `;
}

// ------------------------------------------------------------
// 🎁 送禮推薦
// ------------------------------------------------------------
function buildGiftBubble(out, products) {
  // 先決定這次要顯示哪個商品的 id：優先用 out.tea，沒有就用 best.id
  const targetId = out.tea || (out.best && out.best.id);
  const tea = products.find(p => p.id === targetId) || products[0];

  return `
    <div class="ai-bubble ai-bubble-ai">
      <div class="ai-bubble-title">🎁 送禮首選</div>

      <div class="ai-prod-item" data-prod="${tea.id}">
        <div class="prod-name">${tea.title}</div>
        <div class="prod-reason">
          ${out.best?.reason || out.reason}
        </div>
      </div>

      ${getCardButtonHtml(tea.title, out.card_text, out.card_image,out.btnId)}
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

      <div class="brew-item">${out.brew.hot}</div>
      <div class="brew-item">${out.brew.ice_bath}</div>
      <div class="brew-item">${out.brew.cold_brew}</div>
    </div>
  `;
}

// ------------------------------------------------------------
// 🔮 靈魂茶（人格分析）
// ------------------------------------------------------------
function buildPersonalityBubble(out, products) {
  // 1. 嘗試抓取商品 ID
  // 新版後端放在: out.best.id
  // 舊版後端放在: out.tea
  const targetId = (out.best && out.best.id) || out.tea || out.best;

  // 2. 在商品列表中尋找
  let tea = products.find(p => p.id === targetId);

  // 🛑 3. 防呆：如果 ID 對不上或找不到，強制使用第一個商品
  if (!tea) {
    console.warn("⚠️ [Personality] 找不到對應 ID:", targetId, "自動切換為預設商品");
    tea = products[0]; 
  }

  // 4. 抓取理由/文案
  const reason = out.best?.reason || out.summary || "這是你的命定茶。";

  return `
    <div class="ai-bubble ai-bubble-ai">
      <div class="ai-bubble-title">🔮 你的靈魂茶飲</div>

      <div class="person-summary">${out.summary || reason}</div>

      <div class="ai-prod-item" data-prod="${tea.id}">
        <div class="prod-name">${tea.title}</div>
        <div class="prod-reason" style="color:#2f4b3c;">
           ${reason}
        </div>
        <div style="margin-top:4px; font-size:0.85rem; color:#888; text-align:right;">
           查看詳情 →
        </div>
      </div>

      ${getCardButtonHtml(tea.title, out.card_text, out.card_image, out.btnId)}
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
// 💌 茶籤按鈕 (v5.3 Async Support)
// ------------------------------------------------------------
function getCardButtonHtml(teaTitle, cardText, cardImageUrl = null, btnId = "") {
  // 如果沒有 cardText，就不顯示按鈕
  if (!cardText) return "";

  // 如果後端還在算圖 (LOADING 模式)
  if (cardImageUrl === "LOADING") {
    return `
      <button id="${btnId}" 
              class="ai-card-btn loading-state" 
              onclick="alert('阿興師正在磨墨畫圖中，請稍候約 10 秒...🎨')"
              style="background: #e0e0e0; color: #888; border: 1px dashed #ccc; cursor: progress;">
        🎨 阿興師作畫中... (請稍候)
      </button>
    `;
  }

  // 正常模式 (已有圖片 或 沒有圖片需現場算)
  const safeTitle = teaTitle.replace(/'/g, "\\'");
  const safeText = cardText.replace(/'/g, "\\'").replace(/\n/g, " ");
  const safeImg = cardImageUrl ? `'${cardImageUrl}'` : "null";

  // 如果沒有傳 btnId 進來，就不用 id 屬性 (相容舊版)
  const idAttr = btnId ? `id="${btnId}"` : "";

  return `
    <button ${idAttr} class="ai-card-btn"
            onclick="drawTeaCard('${safeTitle}', '${safeText}', ${safeImg})">
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
// ✨ 11. Nano Banana AI — 茶籤金框卡片生成器 (v5.2 Fix)
// ============================================================
// ============================================================
// ✨ 11. Nano Banana AI — 茶籤金框卡片生成器 (v5.2 Fix)
// ============================================================
window.drawTeaCard = async function(title, text, preGeneratedUrl = null) {
  console.log("🎨 開始生成茶籤：", title);

  // 1. 顯示讀取中 (因為畫圖很吃資源)
  const loadingBubble = document.createElement("div");
  loadingBubble.className = "ai-modal-overlay show";
  loadingBubble.style.zIndex = "9999";
  loadingBubble.innerHTML = `<div style="color:#fff; font-size:1.5rem;">🍌 阿興師正在磨墨畫圖...</div>`;
  document.body.appendChild(loadingBubble);

  let bgSrc = preGeneratedUrl;

  // 2. 如果沒有預先生成的圖，才呼叫後端 API 現場生成
  if (!bgSrc) {
    try {
      // ✅ 改用 callAI，並帶上 image_payload（與 v6 後端一致）
      const out = await callAI("", null, null, {
        special_intent: "generate_card_image",
        image_payload: {
          card_title: title,
          card_text: text
        }
      });

      bgSrc = out.image_url;
    } catch (err) {
      console.error("AI 背景生成失敗:", err);
    }
  }

  // 3. 建立 Canvas
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  const width = 900;
  const height = 1400;
  canvas.width = width;
  canvas.height = height;

  // 4. 繪製背景 (處理圖片 / Fallback 底色)
  if (bgSrc) {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = bgSrc; // 設定圖片來源

    // 等待圖片載入完成
    await new Promise((resolve) => {
      img.onload = () => {
        // 👇 確保這裡是用 drawImage 填滿整個畫布
        // Imagen 3 預設也是正方形，配合你的 Canvas (900x1400) 會被拉長
        // 如果覺得拉長很醜，可以改用「裁切填滿」邏輯，但目前先維持原樣即可
        ctx.drawImage(img, 0, 0, width, height);
        
        // 💡 加上一層半透明白色遮罩 (30%)，讓文字更清楚
        ctx.fillStyle = "rgba(255, 255, 255, 0.3)"; 
        ctx.fillRect(0, 0, width, height);
        
        resolve();
      };
      
      img.onerror = () => {
        console.warn("圖片載入失敗，使用預設背景");
        resolve(); // 失敗也繼續，改用純色
      };
    });
  } else {
    // Fallback：若無圖片則使用米白底
    ctx.fillStyle = "#F9F7F0";
    ctx.fillRect(0, 0, width, height);
  }

  // === 以下繪圖樣式保持不變 ===

  // 金色雙框
  ctx.strokeStyle = "#D4AF37";
  ctx.lineWidth = 12;
  ctx.strokeRect(40, 40, width - 80, height - 80);
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 6;
  ctx.strokeRect(60, 60, width - 120, height - 120);

  // 標題
  ctx.fillStyle = "#2F4B3C";
  ctx.font = "bold 64px 'Noto Serif TC', serif";
  ctx.textAlign = "center";
  
  // 標題陰影增強可讀性
  ctx.shadowColor = "rgba(255,255,255,0.8)";
  ctx.shadowBlur = 10;
  ctx.fillText(title, width / 2, 180);
  ctx.shadowBlur = 0; // 重置

  // 分隔線
  ctx.beginPath();
  ctx.moveTo(width / 2 - 120, 220);
  ctx.lineTo(width / 2 + 120, 220);
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = 3;
  ctx.stroke();

  // 內文 (自動換行)
  ctx.fillStyle = "#1a1a1a";
  ctx.font = "36px 'Noto Serif TC', serif";
  ctx.textAlign = "center";
  
  ctx.shadowColor = "rgba(255,255,255, 1)";
  ctx.shadowBlur = 15;

  const maxWidth = 700;
  const lineHeight = 55;
  let y = 320;
  const chars = text.replace(/\n/g, "").split(""); 
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
  
  ctx.shadowBlur = 0; // 重置陰影

  // 落款
  ctx.fillStyle = "#b8860b";
  ctx.font = "bold 40px 'Noto Serif TC', serif";
  ctx.fillText("—— 祥興茶行", width / 2, height - 180);

  // 移除 Loading
  loadingBubble.remove();

  // 顯示結果
  try {
    const dataUrl = canvas.toDataURL("image/png");
    showCardModal(dataUrl);
  } catch (e) {
    console.error("茶籤輸出失敗:", e);
    alert("圖片生成失敗，請稍後再試或聯絡管理員。");
  }
};

// ============================================================
// ✨ 11.1 Show 茶籤 Modal（展示 Canvas 生成結果）
// ============================================================
function showCardModal(dataUrl) {
  // 先確保只會有一個 Modal 存在
  const existing = document.getElementById("teaCardModal");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "teaCardModal";
  overlay.className = "ai-modal-overlay show";
  overlay.style.zIndex = "10000";

  overlay.innerHTML = `
    <div class="ai-box" 
         style="
           max-width: 420px;
           margin: 0 auto;
           padding: 16px;
           background: #fffbf3;
           display: flex;
           flex-direction: column;
           align-items: center;
         ">
      <div style="margin-bottom: 12px; font-size: 1.05rem; color:#2f4b3c;">
        靈魂茶籤
      </div>

      <img src="${dataUrl}" 
           alt="靈魂茶籤" 
           style="
             width: 100%;
             border-radius: 18px;
             box-shadow: 0 10px 28px rgba(0,0,0,0.22);
           " />

      <div style="
            margin-top: 10px;
            font-size: 0.85rem;
            color:#666;
            text-align:center;
            line-height: 1.5;
          ">
        長按圖片即可儲存或分享這張茶籤。<br/>
        （若無法長按，請截圖保存 😀）
      </div>

      <button id="closeTeaCardModal"
              class="ai-send-btn"
              style="margin-top: 16px; width: 100%;">
        關閉
      </button>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();

  const closeBtn = document.getElementById("closeTeaCardModal");
  if (closeBtn) closeBtn.onclick = close;

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
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
