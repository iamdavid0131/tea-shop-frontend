import { addGiftBoxToCart, updateGiftBoxInCart } from './cart.js';
import { CONFIG } from './config.js';
import { $ } from './dom.js';

let currentSlot = null;
let selectedItems = { 1: null, 2: null };
let editingId = null;

// ... (updateMetalSlot 保持不變) ...
function updateMetalSlot(slot, product) {
  const slotEl = document.getElementById(`slot${slot}`);
  const text = slotEl.querySelector(`.metal-text`);
  
  if (!text) return;

  if (product) {
    const isMulti = product.qty && product.qty > 1;
    const qtyTag = isMulti ? `<span style="font-size:12px; color:#e67e22; margin-left:4px;">x${product.qty}</span>` : "";
    
    // 移除舊的 x2 價格邏輯，只顯示單品名稱
    text.innerHTML = `
        <span style="color:#2f4b3c; font-weight:bold;">${product.title}</span>${qtyTag}<br>
        <span class="metal-sub">${product.unit}</span>
    `;
    slotEl.classList.add('active');
  } else {
    text.innerHTML = `<i class="ph ph-plus-circle" style="font-size: 32px; color: #d0dcd5; margin-bottom:8px;"></i><br><span style="color:#8fb79c; font-size:14px;">點擊選茶</span>`;
    slotEl.classList.remove('active');
  }
}

// ... (window.openProductSelector 等函式保持不變，請保留原本的) ...
window.openProductSelector = function (slot) {
  if (!CONFIG.PRODUCTS || CONFIG.PRODUCTS.length === 0) {
    alert("商品資料載入中，請稍候...");
    return;
  }

  currentSlot = slot;
  const modal = document.getElementById("selector-modal");
  const list = document.getElementById("selector-list");
  
  if(modal) {
      modal.style.display = "flex";
      setTimeout(() => modal.classList.add("show"), 10);
  }
  
  if(list) list.innerHTML = "";

  const valid = CONFIG.PRODUCTS.filter(p => {
      if (!p.unit) return false;
      const u = p.unit.toLowerCase();
      return u.includes("75") || u.includes("150");
  });

  if(valid.length === 0) {
      if(list) list.innerHTML = `<div style="padding:40px 20px; text-align:center; color:#889990;">暫無符合禮盒規格 (75g/150g) 的茶品</div>`;
      return;
  }

  valid.forEach(p => {
    const div = document.createElement("div");
    div.className = "selector-item";
    
    const isSmall = p.unit.includes("75");
    const note = isSmall ? `<span style="color:#e67e22; font-size:12px;">(需2包)</span>` : "";
    const priceCalc = isSmall ? p.price * 2 : p.price;

    div.innerHTML = `
      <div>
        <div class="sel-name">${p.title} ${note}</div>
        <div class="sel-meta">${p.unit}</div>
      </div>
      <div class="sel-price">NT$ ${p.price} ${isSmall ? '<span style="font-size:12px;color:#e67e22">x2</span>' : ''}</div>
    `;
    div.onclick = () => selectProduct(p);
    list.appendChild(div);
  });
};

window.closeSelector = () => {
    const modal = document.getElementById("selector-modal");
    if(modal) {
        modal.classList.remove("show");
        setTimeout(() => { modal.style.display = "none"; }, 300);
    }
};

// ====== 選中商品 (加入動畫觸發) ======
function selectProduct(product) {
  let qty = 1;
  if (product.unit && product.unit.includes("75")) {
      qty = 2;
  }

  selectedItems[currentSlot] = { ...product, qty: qty };
  
  // 1. 更新 UI
  updateMetalSlot(currentSlot, selectedItems[currentSlot]);
  updateGiftboxProgress();
  validateGiftbox();
  
  // 2. 關閉選單
  window.closeSelector();

  // 3. 🔥 播放茶葉飛入動畫
  // 稍微延遲一點點，等選單關閉後再飛
  setTimeout(() => {
      playTeaLeavesAnimation(currentSlot);
  }, 300);
}

// ====== 🔥 新增：茶葉飛入動畫 (使用 GSAP) ======
function playTeaLeavesAnimation(targetSlotId) {
    const slotEl = document.getElementById(`slot${targetSlotId}`);
    if (!slotEl || !window.gsap) return;

    const rect = slotEl.getBoundingClientRect();
    // 目標點：罐子中心
    const targetX = rect.left + rect.width / 2;
    const targetY = rect.top + rect.height / 2;

    // 產生 15 片茶葉
    for (let i = 0; i < 15; i++) {
        const leaf = document.createElement('div');
        leaf.className = 'leaf-particle';
        document.body.appendChild(leaf);

        // 起點：螢幕隨機上方
        const startX = targetX + (Math.random() - 0.5) * 200; // 左右隨機 200px
        const startY = rect.top - 300 - Math.random() * 200; // 上方 300px 外

        // 設定初始位置
        gsap.set(leaf, { 
            x: startX, 
            y: startY, 
            opacity: 1, 
            scale: 0.5 + Math.random() * 0.5,
            rotation: Math.random() * 360,
            backgroundColor: Math.random() > 0.5 ? '#5a7b68' : '#8fb79c' // 深淺綠交錯
        });

        // 動畫路徑
        gsap.to(leaf, {
            duration: 0.8 + Math.random() * 0.5,
            x: targetX + (Math.random() - 0.5) * 40, // 稍微散落在罐子周圍
            y: targetY,
            rotation: "+=360",
            ease: "power2.in",
            onComplete: () => {
                // 碰到罐子後消失
                gsap.to(leaf, {
                    duration: 0.2,
                    opacity: 0,
                    scale: 0,
                    onComplete: () => leaf.remove()
                });
                // 讓罐子震動一下
                gsap.to(slotEl, {
                    duration: 0.1,
                    scale: 1.05,
                    yoyo: true,
                    repeat: 1
                });
            }
        });
    }
}

// ... (以下其餘函式 getGiftBoxWeight, updateGiftboxProgress, validateGiftbox, loadGiftBoxForEdit... 保持不變) ...
// 請務必保留 validateGiftbox 中的 boxFee 邏輯

function getGiftBoxWeight() {
  let w = 0;
  if (selectedItems[1]) {
      const unitW = parseInt(selectedItems[1].unit) || 0;
      w += unitW * (selectedItems[1].qty || 1);
  }
  if (selectedItems[2]) {
      const unitW = parseInt(selectedItems[2].unit) || 0;
      w += unitW * (selectedItems[2].qty || 1);
  }
  return w;
}

function updateGiftboxProgress() {
  const w = getGiftBoxWeight();
  const fill = document.getElementById('giftbox-progress-fill');
  const text = document.getElementById('giftbox-progress-text');
  if(fill && text) {
      fill.style.width = Math.min((w / 300) * 100, 100) + '%';
      text.innerText = `${w} / 300 g`;
  }
}

function validateGiftbox() {
  const status = document.getElementById("giftbox-status");
  const submit = document.getElementById("giftbox-submit");
  
  // 移除光暈
  const container = document.getElementById('giftbox-container');
  container.style.boxShadow = "0 10px 40px rgba(90, 123, 104, 0.1)";
  container.style.borderColor = "rgba(255, 255, 255, 0.6)";

  if (!selectedItems[1] || !selectedItems[2]) {
    status.innerText = "請選擇兩罐茶品";
    status.style.color = "#a0a0a0";
    submit.innerText = "加入購物車";
    submit.disabled = true;
    submit.classList.remove("enabled");
    return;
  }

  // 成功樣式：加強綠色光暈
  container.style.boxShadow = "0 0 0 2px #8fb79c, 0 15px 50px rgba(90, 123, 104, 0.2)";
  container.style.borderColor = "#8fb79c";

  const boxFee = CONFIG.GIFT_BOX_PRICE || 200;
  const p1 = selectedItems[1];
  const p2 = selectedItems[2];
  const v1 = p1.price * (p1.qty || 1);
  const v2 = p2.price * (p2.qty || 1);
  const total = v1 + v2 + boxFee;

  status.innerHTML = `
    <span style="color:#666; font-size:13px;">
      $${v1.toLocaleString()} + $${v2.toLocaleString()} + 禮盒$${boxFee} = 
    </span>
    <span style="color:#b8860b; font-size:18px; font-weight:800; margin-left:4px;">
      NT$ ${total.toLocaleString()}
    </span>
  `;

  submit.innerText = editingId ? "確認修改" : "加入購物車";
  submit.disabled = false;
  submit.classList.add("enabled");
}

export function loadGiftBoxForEdit(data) {
  selectedItems[1] = data.slot1;
  selectedItems[2] = data.slot2;
  editingId = data.id;

  updateMetalSlot(1, selectedItems[1]);
  updateMetalSlot(2, selectedItems[2]);
  updateGiftboxProgress();
  validateGiftbox();

  const section = document.getElementById("giftboxCard");
  if (section) {
      setTimeout(() => {
        section.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
  }
}

function resetUI() {
  selectedItems = { 1: null, 2: null };
  editingId = null;
  updateMetalSlot(1, null);
  updateMetalSlot(2, null);
  updateGiftboxProgress();
  validateGiftbox();
}

// 🛒 禮盒飛入購物車動畫
function flyToCart() {
    const ghost = document.createElement('div');
    // 使用與茶葉一樣的綠色圓點，或禮盒圖示
    ghost.classList.add('fly-item'); 
    ghost.style.width = '40px';
    ghost.style.height = '40px';
    ghost.style.background = '#5a7b68';
    ghost.style.borderRadius = '8px';
    ghost.innerHTML = '🎁';
    ghost.style.display = 'flex';
    ghost.style.alignItems = 'center';
    ghost.style.justifyContent = 'center';
    ghost.style.color = '#fff';
    document.body.appendChild(ghost);

    const startBox = document.getElementById('giftbox-container').getBoundingClientRect();
    const startX = startBox.left + startBox.width / 2;
    const startY = startBox.top + startBox.height / 2;

    // 修正：如果 StickyBar 被遮住，改飛向視窗底部中央
    const cartBtn = document.getElementById('viewCartBtn');
    let endX, endY;
    
    if (cartBtn && cartBtn.offsetParent !== null) {
       const endBox = cartBtn.getBoundingClientRect();
       endX = endBox.left + endBox.width / 2;
       endY = endBox.top + endBox.height / 2;
    } else {
       endX = window.innerWidth / 2;
       endY = window.innerHeight - 50;
    }

    ghost.style.left = `${startX}px`;
    ghost.style.top = `${startY}px`;

    requestAnimationFrame(() => {
        ghost.style.left = `${endX}px`;
        ghost.style.top = `${endY}px`;
        ghost.style.transform = 'scale(0.2) rotate(360deg)';
        ghost.style.opacity = '0';
    });

    setTimeout(() => ghost.remove(), 800);
}

export function initGiftBox() {
    const submitBtn = document.getElementById("giftbox-submit");
    if (submitBtn) {
        submitBtn.addEventListener("click", () => {
          if (submitBtn.disabled) return;

          const boxFee = CONFIG.GIFT_BOX_PRICE || 200;
          const p1 = selectedItems[1];
          const p2 = selectedItems[2];
          const price1 = p1.price * (p1.qty || 1);
          const price2 = p2.price * (p2.qty || 1);

          const finalGiftbox = {
            slot1: selectedItems[1],
            slot2: selectedItems[2],
            totalPrice: price1 + price2 + boxFee,
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

    const slot1 = document.getElementById("slot1");
    const slot2 = document.getElementById("slot2");
    // 使用 addEventListener，不要寫 onclick
    if(slot1) slot1.addEventListener("click", () => openProductSelector(1));
    if(slot2) slot2.addEventListener("click", () => openProductSelector(2));
}