import { addGiftBoxToCart, updateGiftBoxInCart } from './cart.js';
import { CONFIG } from './config.js';

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
    slotEl.classList.add('active'); // 加亮邊框
  } else {
    text.innerHTML = `<i class="ph ph-plus-circle" style="font-size: 24px;"></i><br>${slot === 1 ? '第一罐' : '第二罐'}`;
    slotEl.classList.remove('active');
  }
}

// ====== 重量計算與進度條 ======
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
      // 假設滿載是 300g (150g x 2)
      fill.style.width = Math.min((w / 300) * 100, 100) + '%';
      text.innerText = `${w} / 300 g`;
  }
}

// ====== 選茶 Selector ======
window.openProductSelector = function (slot) {
  currentSlot = slot;
  document.getElementById("selector-modal").style.display = "flex";

  const list = document.getElementById("selector-list");
  list.innerHTML = "";

  // 讀取 CONFIG 並過濾
  const valid = CONFIG.PRODUCTS.filter(p => p.unit && /^(75g|150g)$/.test(p.unit));

  if(valid.length === 0) {
      list.innerHTML = '<div style="padding:20px;">暫無符合商品</div>';
      return;
  }

  valid.forEach(p => {
    const div = document.createElement("div");
    div.className = "selector-item";
    div.innerHTML = `
      <div style="font-weight:bold;">${p.title}</div>
      <div style="font-size:12px;color:#666;">${p.unit} - NT$ ${p.price}</div>
    `;
    div.onclick = () => selectProduct(p);
    list.appendChild(div);
  });
};

window.closeSelector = () => document.getElementById("selector-modal").style.display = "none";

// ====== 選中商品 ======
function selectProduct(product) {
  selectedItems[currentSlot] = product;
  updateMetalSlot(currentSlot, product);
  updateGiftboxProgress();
  validateGiftbox();
  window.closeSelector();
}

// ====== 驗證禮盒 ======
function validateGiftbox() {
  const status = document.getElementById("giftbox-status");
  const submit = document.getElementById("giftbox-submit");

  clearGoldFlow(); // 清除動畫狀態

  if (!selectedItems[1] || !selectedItems[2]) {
    status.innerText = "尚未滿足兩罐組合";
    status.style.color = "#666";
    submit.disabled = true;
    submit.classList.remove("enabled");
    return;
  }

  // A. 啟動金光流
  playGoldFlow();

  // B. 觸發合罐特效 (如果是兩個 75g)
  const u1 = parseInt(selectedItems[1].unit);
  const u2 = parseInt(selectedItems[2].unit);
  if (u1 === 75 && u2 === 75) {
    playMerge(1);
    playMerge(2);
  }

  status.innerText = editingId ? "✔ 準備完成，請確認修改" : "✔ 已組成兩罐禮盒！";
  status.style.color = editingId ? "#b8860b" : "#2f4b3c";

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
  playGoldFlow();

  const status = document.getElementById("giftbox-status");
  const submit = document.getElementById("giftbox-submit");
  const section = document.getElementById("giftboxCard");

  if(status && submit) {
      status.innerText = "📝 編輯模式：請重新選擇或確認內容";
      status.style.color = "#b8860b";
      submit.innerText = "確認修改";
      submit.disabled = false;
      submit.classList.add("enabled");
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

  clearGoldFlow();
  updateMetalSlot(1, null);
  updateMetalSlot(2, null);
  updateGiftboxProgress();

  const status = document.getElementById("giftbox-status");
  const submit = document.getElementById("giftbox-submit");

  if(status && submit) {
      status.innerText = "尚未滿足兩罐組合";
      status.style.color = "#666";
      submit.innerText = "加入購物車";
      submit.disabled = true;
      submit.classList.remove("enabled");
  }
}

// ==========================================
// 補齊的動畫函式 (Animation Helpers)
// ==========================================

function playGoldFlow() {
    const container = document.getElementById('giftbox-container');
    if(container) container.classList.add('gold-flow-active');
}

function clearGoldFlow() {
    const container = document.getElementById('giftbox-container');
    if(container) container.classList.remove('gold-flow-active');
}

function playMerge(slotNum) {
    const slot = document.getElementById(`slot${slotNum}`);
    if(slot) {
        slot.classList.remove('merge-flash');
        void slot.offsetWidth; // 強制重繪
        slot.classList.add('merge-flash');
    }
}

// 🛒 飛入購物車動畫
function flyToCart() {
    // 1. 建立分身
    const ghost = document.createElement('div');
    ghost.classList.add('fly-item');
    document.body.appendChild(ghost);

    // 2. 取得起點 (禮盒中心)
    const startBox = document.getElementById('giftbox-container').getBoundingClientRect();
    const startX = startBox.left + startBox.width / 2;
    const startY = startBox.top + startBox.height / 2;

    // 3. 取得終點 (StickyBar 的購物車按鈕位置)
    // 如果找不到 StickyBar，就飛到畫面右下角
    const cartBtn = document.getElementById('viewCartBtn') || document.body;
    const endBox = cartBtn.getBoundingClientRect();
    const endX = endBox.left + endBox.width / 2;
    const endY = endBox.top + endBox.height / 2;

    // 4. 設定初始位置
    ghost.style.left = `${startX}px`;
    ghost.style.top = `${startY}px`;

    // 5. 啟動動畫
    requestAnimationFrame(() => {
        ghost.style.left = `${endX}px`;
        ghost.style.top = `${endY}px`;
        ghost.style.transform = 'scale(0.2)';
        ghost.style.opacity = '0';
    });

    // 6. 清除
    setTimeout(() => {
        ghost.remove();
    }, 800);
}


// ==========================================
// 初始化函式 (Init)
// ==========================================
export function initGiftBox() {
    const submitBtn = document.getElementById("giftbox-submit");
    if (!submitBtn) return;

    submitBtn.addEventListener("click", () => {
      if (submitBtn.disabled) return;

      const finalGiftbox = {
        slot1: selectedItems[1],
        slot2: selectedItems[2],
        totalPrice: selectedItems[1].price + selectedItems[2].price,
      };

      // 動畫
      flyToCart();

      if (editingId) {
        const ok = updateGiftBoxInCart(editingId, finalGiftbox);
        if(ok) alert("禮盒內容已更新！");
      } else {
        addGiftBoxToCart(finalGiftbox);
        // alert("禮盒已加入購物車！"); // 有動畫了，可以考慮把 alert 拿掉體驗更好
        window.dispatchEvent(new CustomEvent("cart:update"));
      }

      resetUI();
    });
}