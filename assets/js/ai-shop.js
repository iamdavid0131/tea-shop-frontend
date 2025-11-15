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
  btn.textContent = "💬 AI 幫我選茶";
  btn.style.cssText = `
    width: 100%;
    padding: 14px 20px;
    margin: 0 0 20px;
    font-size: 17px;
    font-weight: 700;
    color: #2f4b3c;
    background: rgba(255,255,255,0.85);
    border: 1px solid rgba(160,180,160,0.4);
    border-radius: 14px;
    box-shadow: 0 4px 14px rgba(80,110,90,0.08);
    backdrop-filter: blur(12px);
  `;

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
    modal.style.cssText = `
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.35);
      backdrop-filter: blur(8px);
      display: flex; justify-content: center; align-items: center;
      z-index: 999999;
    `;

    modal.innerHTML = `
      <div style="
        width: 86%; max-width: 420px;
        background: rgba(255,255,255,0.9);
        padding: 20px 22px;
        border-radius: 18px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.15);
        backdrop-filter: blur(12px);
      ">
        <h2 style="margin:0 0 12px; font-size:20px; color:#2f4b3c;">
          💬 AI 茶品推薦
        </h2>

        <textarea id="aiQuery" placeholder="告訴我你喜歡什麼風味…" style="
          width:100%; height:90px; padding:10px;
          border-radius:10px; border:1px solid #ccc;
          font-size:15px; resize:none;
        "></textarea>

        <button id="aiSubmit" style="
          margin-top:12px; width:100%; padding:12px;
          font-size:16px; font-weight:700; color:#fff;
          background:#4f7b61; border:none; border-radius:10px;
        ">送出</button>

        <div id="aiResult" style="
          margin-top:16px; font-size:15px; color:#2f4b3c;
          line-height:1.6;
        "></div>

        <button id="aiClose" style="
          margin-top:14px; width:100%; padding:8px;
          font-size:14px; border-radius:10px;
          background:#eee; border:1px solid #ccc;
        ">關閉</button>
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
        <b>推薦：</b> ${best.title}<br>
        <div style="margin:6px 0 12px;">${out.reason}</div>

        ${
        out.second
            ? `<b>次推薦：</b> ${secondName}<br>${out.second.reason}`
            : ""
        }
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
