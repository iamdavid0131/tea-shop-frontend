import { addGiftBoxToCart, updateGiftBoxInCart } from './cart.js';
import { CONFIG } from './config.js';
import { $ } from './dom.js'; // 建議引入 $ 來簡化程式碼

// 狀態變數
let currentSlot = null;
let selectedItems = { 1: null, 2: null };
let editingId = null;

// ====== Slot UI 更新 ======
function updateMetalSlot(slot, product) {
  const slotEl = document.getElementById(`slot${slot}`);
  const text = slotEl.querySelector(`.metal-text`);
  
  if (!text) return;

  if (product) {
    text.innerHTML = `<span style="color:#2f4b3c; font-weight:bold;">${product.title}</span><br><span class="metal-sub">${product.unit}</span>`;
    slotEl.classList.add('active');
  } else {
    // 恢復預設樣式 (因應新 CSS 調整)
    text.innerHTML = `<i class="ph ph-plus-circle" style="font-size: 28px; color: #8fb79c; margin-bottom:4px;"></i><br><span style="color:#5a7b68">選擇茶品</span>`;
    slotEl.classList.remove('active');
  }
}

// ====== 選茶 Selector (核心邏輯) ======
function openProductSelector(slot) {
  // 防呆：如果商品資料還沒載入
  if (!CONFIG.PRODUCTS || CONFIG.PRODUCTS.length === 0) {
    alert("商品資料載入中，請稍候...");
    return;
  }

  currentSlot = slot;
  const modal = document.getElementById("selector-modal");
  const list = document.getElementById("selector-list");
  
  if(modal) modal.style.display = "flex";
  if(list) list.innerHTML = "";

  // 篩選：只顯示 75g 或 150g 的商品 (符合禮盒規格)
  const valid = CONFIG.PRODUCTS.filter(p => p.unit && /^(75g|150g)$/.test(p.unit));

  if(valid.length === 0) {
      if(list) list.innerHTML = '<div style="padding:20px; text-align:center; color:#666;">暫無符合禮盒規格的茶品</div>';
      return;
  }

  valid.forEach(p => {
    const div = document.createElement("div");
    div.className = "selector-item";
    // 優化選單樣式
    div.innerHTML = `
      <div style="font-weight:bold; color:#2f4b3c; font-size:15px;">${p.title}</div>
      <div style="font-size:13px; color:#888;">${p.unit}｜NT$ ${p.price}</div>
    `;
    div.onclick = () => selectProduct(p);
    list.appendChild(div);
  });
}

// 讓關閉按鈕也能運作
window.closeSelector = () => {
    const modal = document.getElementById("selector-modal");
    if(modal) modal.style.display = "none";
};

// ====== 選中商品 ======
function selectProduct(product) {
  selectedItems[currentSlot] = product;
  updateMetalSlot(currentSlot, product);
  updateGiftboxProgress();
  validateGiftbox();
  window.closeSelector();
}

// ====== 重量與進度條 ======
function getGiftBoxWeight() {
  let w = 0;
  if (selectedItems[1]) w += parseInt(selectedItems[1].unit) || 0;
  if (selectedItems[2]) w += parseInt(selectedItems[2].unit) || 0;
  return w;
}

function updateGiftboxProgress() {
  const w = getGiftBoxWeight();
  const fill = document.getElementById('giftbox-progress-fill');
  const text = document.getElementById('giftbox-progress-text');
  
  if(fill && text) {
      fill.style.width = Math.min((w / 300) * 100, 100) + '%';
      text.innerText = `${w} / 300 g (建議)`;
  }
}

// ====== 驗證禮盒 ======
function validateGiftbox() {
  const status = document.getElementById("giftbox-status");
  const submit = document.getElementById("giftbox-submit");
  const container = document.getElementById('giftbox-container');

  // 清除狀態
  container.classList.remove('gold-flow-active');

  if (!selectedItems[1] || !selectedItems[2]) {
    status.innerText = "請選擇兩罐茶品";
    status.style.color = "#888";
    submit.disabled = true;
    submit.classList.remove("enabled");
    return;
  }

  // 成功狀態：啟動流光
  container.classList.add('gold-flow-active');

  status.innerText = editingId ? "✔ 準備完成，請確認修改" : "✔ 完美組合！";
  status.style.color = "#2f4b3c"; // 品牌綠

  submit.disabled = false;
  submit.classList.add("enabled");
}

// ====== 編輯模式 ======
export function loadGiftBoxForEdit(data) {
  selectedItems[1] = data.slot1;
  selectedItems[2] = data.slot2;
  editingId = data.id;

  updateMetalSlot(1, selectedItems[1]);
  updateMetalSlot(2, selectedItems[2]);
  updateGiftboxProgress();
  validateGiftbox(); // 重新驗證以觸發樣式

  const status = document.getElementById("giftbox-status");
  const submit = document.getElementById("giftbox-submit");
  const section = document.getElementById("giftboxCard");

  if(status && submit) {
      status.innerText = "📝 編輯模式";
      status.style.color = "#b8860b";
      submit.innerText = "確認修改";
  }

  if (section) {
      setTimeout(() => {
        section.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
  }
}

// ====== 重置 UI ======
function resetUI() {
  selectedItems = { 1: null, 2: null };
  editingId = null;

  updateMetalSlot(1, null);
  updateMetalSlot(2, null);
  updateGiftboxProgress();
  validateGiftbox(); // 重置按鈕狀態

  const submit = document.getElementById("giftbox-submit");
  if(submit) submit.innerText = "加入購物車";
}

// 🛒 飛入購物車動畫 (維持原樣)
function flyToCart() {
    const ghost = document.createElement('div');
    ghost.classList.add('fly-item');
    document.body.appendChild(ghost);

    const startBox = document.getElementById('giftbox-container').getBoundingClientRect();
    const startX = startBox.left + startBox.width / 2;
    const startY = startBox.top + startBox.height / 2;

    const cartBtn = document.getElementById('viewCartBtn') || document.body;
    const endBox = cartBtn.getBoundingClientRect();
    const endX = endBox.left + endBox.width / 2;
    const endY = endBox.top + endBox.height / 2;

    ghost.style.left = `${startX}px`;
    ghost.style.top = `${startY}px`;

    requestAnimationFrame(() => {
        ghost.style.left = `${endX}px`;
        ghost.style.top = `${endY}px`;
        ghost.style.transform = 'scale(0.2)';
        ghost.style.opacity = '0';
    });

    setTimeout(() => ghost.remove(), 800);
}

// ==========================================
// ✨ 初始化函式 (Init) - 這是修復點擊的關鍵！
// ==========================================
export function initGiftBox() {
    // 1. 綁定加入購物車按鈕
    const submitBtn = document.getElementById("giftbox-submit");
    if (submitBtn) {
        submitBtn.addEventListener("click", () => {
          if (submitBtn.disabled) return;

          const finalGiftbox = {
            slot1: selectedItems[1],
            slot2: selectedItems[2],
            totalPrice: selectedItems[1].price + selectedItems[2].price,
          };

          flyToCart();

          if (editingId) {
            const ok = updateGiftBoxInCart(editingId, finalGiftbox);
            if(ok) alert("禮盒內容已更新！");
          } else {
            addGiftBoxToCart(finalGiftbox);
            window.dispatchEvent(new CustomEvent("cart:update"));
          }
          resetUI();
        });
    }

    // 2. 🔥 綁定罐子點擊事件 (取代 HTML 中的 onclick)
    const slot1 = document.getElementById("slot1");
    const slot2 = document.getElementById("slot2");

    if(slot1) slot1.addEventListener("click", () => openProductSelector(1));
    if(slot2) slot2.addEventListener("click", () => openProductSelector(2));

    console.log("🎁 禮盒系統初始化完成 (Event Listeners Attached)");
}