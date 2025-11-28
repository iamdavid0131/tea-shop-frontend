import { addGiftBoxToCart, updateGiftBoxInCart } from './cart.js';
import { CONFIG } from './config.js';
import { $ } from './dom.js';
import { spawnQtyBubble } from './qty.js';

// ==========================================
// 1. 狀態變數 (State Variables)
// ==========================================
let currentSlot = null;
let selectedItems = { 1: null, 2: null };
let editingId = null;
let boxQuantity = 1; // 🟢 [修復重點] 補上這個變數宣告！

// ====== Slot UI 更新 ======
function updateMetalSlot(slot, product) {
  const slotEl = document.getElementById(`slot${slot}`);
  const text = slotEl.querySelector(`.metal-text`);
  
  if (!text) return;

  if (product) {
    const isMulti = product.qty && product.qty > 1;
    const qtyTag = isMulti ? `<span style="font-size:13px; color:#e67e22; font-weight:800; margin-left:4px;">x${product.qty}</span>` : "";
    
    text.innerHTML = `
        <span style="color:#2f4b3c; font-weight:bold;">${product.title}</span><br>
        <span class="metal-sub" style="display:flex; align-items:center; justify-content:center;">
          ${product.unit} ${qtyTag}
        </span>
    `;
    slotEl.classList.add('active');
  } else {
    text.innerHTML = `<i class="ph ph-plus-circle" style="font-size: 32px; color: #d0dcd5; margin-bottom:8px;"></i><br><span style="color:#8fb79c; font-size:14px;">點擊選茶</span>`;
    slotEl.classList.remove('active');
  }
}

// ====== 2. 開啟選單 (修正為嚴格篩選) ======
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

  // 🔥 修正：嚴格篩選 (只允許 "75g" 或 "150g")
  // 排除 "75g包" 或其他不符合規格的商品
  const valid = CONFIG.PRODUCTS.filter(p => {
      if (!p.unit) return false;
      // 去除空白並轉小寫，確保比對精準
      const u = p.unit.trim().toLowerCase();
      return u === "75g" || u === "150g";
  });

  if(valid.length === 0) {
      if(list) list.innerHTML = `<div style="padding:40px 20px; text-align:center; color:#889990;">暫無符合禮盒規格 (75g/150g) 的茶品</div>`;
      return;
  }

  valid.forEach(p => {
    const div = document.createElement("div");
    div.className = "selector-item";
    
    const u = p.unit.trim().toLowerCase();
    const isSmall = (u === "75g");
    const note = isSmall ? `<span style="color:#e67e22; font-size:12px;">(需2包)</span>` : "";
    
    // 列表顯示：單價 x 2
    const priceCalc = isSmall ? p.price * 2 : p.price;
    const priceHtml = isSmall ? `NT$ ${p.price} <span style="color:#e67e22; font-size:13px;">x 2</span>` : `NT$ ${p.price}`;

    div.innerHTML = `
      <div>
        <div class="sel-name">${p.title} ${note}</div>
        <div class="sel-meta">${p.unit}</div>
      </div>
      <div class="sel-price">${priceHtml}</div>
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

// ====== 3. 選中商品 (對應嚴格邏輯 + 保留動畫) ======
function selectProduct(product) {
  let qty = 1;
  const u = product.unit ? product.unit.trim().toLowerCase() : "";
  if (u === "75g") {
      qty = 2;
  }

  selectedItems[currentSlot] = { ...product, qty: qty };
  
  updateMetalSlot(currentSlot, selectedItems[currentSlot]);
  updateGiftboxProgress();
  validateGiftbox();
  window.closeSelector();

  setTimeout(() => {
      // 播放茶葉動畫
      playTeaLeavesAnimation(currentSlot);
  }, 300);
}

// ====== 茶葉飛入動畫 (使用 GSAP) ======
function playTeaLeavesAnimation(targetSlotId) {
    const slotEl = document.getElementById(`slot${targetSlotId}`);
    // 檢查 GSAP 是否存在，若無則不執行以免報錯
    if (!slotEl || !window.gsap) {
        console.warn("GSAP not loaded or Slot not found");
        return;
    }

    const rect = slotEl.getBoundingClientRect();
    const targetX = rect.left + rect.width / 2;
    const targetY = rect.top + rect.height / 2;
    
    // 取得 scroll，防止頁面捲動後位置錯誤
    const scrollY = window.scrollY || window.pageYOffset;
    const scrollX = window.scrollX || window.pageXOffset;

    for (let i = 0; i < 15; i++) {
        const leaf = document.createElement('div');
        leaf.className = 'leaf-particle'; // 確保這個 class 在 CSS 裡有定義 z-index
        document.body.appendChild(leaf);

        // 起點：螢幕隨機上方 (加上 scrollY 確保在當前視窗位置)
        const startX = targetX + (Math.random() - 0.5) * 200; 
        const startY = (rect.top + scrollY) - 200 - Math.random() * 100; 
        
        // 修正目標點 Y (也要加上 scrollY，因為是 absolute positioning)
        const finalY = targetY + scrollY;
        const finalX = targetX + scrollX + (Math.random() - 0.5) * 40;

        gsap.set(leaf, { 
            x: startX, 
            y: startY, 
            opacity: 0, // 初始隱藏
            scale: 0.5 + Math.random() * 0.5,
            rotation: Math.random() * 360,
            backgroundColor: Math.random() > 0.5 ? '#5a7b68' : '#8fb79c' 
        });

        gsap.to(leaf, {
            duration: 0.8 + Math.random() * 0.5,
            x: finalX, 
            y: finalY,
            opacity: 1, // 飛入過程現身
            rotation: "+=360",
            ease: "power2.in", // 加速掉落感
            onComplete: () => {
                gsap.to(leaf, {
                    duration: 0.2,
                    opacity: 0,
                    scale: 0,
                    onComplete: () => leaf.remove()
                });
                // 罐子震動
                gsap.to(slotEl, {
                    duration: 0.1,
                    scale: 1.05,
                    yoyo: true,
                    repeat: 1,
                    clearProps: "scale" // 動畫結束後清除 scale，避免模糊
                });
            }
        });
    }
}

// ... (以下保持不變，包含重量計算與價格公式顯示) ...

function getGiftBoxWeight() {
  let w = 0;
  // 🟢 修正：單罐重量 * 組數
  if (selectedItems[1]) {
      const unitW = parseInt(selectedItems[1].unit) || 0;
      w += unitW * (selectedItems[1].qty || 1);
  }
  if (selectedItems[2]) {
      const unitW = parseInt(selectedItems[2].unit) || 0;
      w += unitW * (selectedItems[2].qty || 1);
  }
  return w * boxQuantity; // 乘以總組數
}

function updateGiftboxProgress() {
  const w = getGiftBoxWeight(); // 這是總重
  const fill = document.getElementById('giftbox-progress-fill');
  const text = document.getElementById('giftbox-progress-text');
  
  if(fill && text) {
      // 關鍵：將總重除以組數，得出單組的重量
      const qtyInput = document.getElementById('box-qty');
      const currentQty = parseInt(qtyInput?.value) || 1;
      const singleBoxW = w / currentQty; 
      
      const maxWeight = 300; // 假設雙罐禮盒滿載為 300g

      // 1. Progress bar 仍然使用單組重量來計算進度
      fill.style.width = Math.min((singleBoxW / maxWeight) * 100, 100) + '%';
      
      // 2. 🟢 修正顯示：只顯示單組重量與標準
      text.innerText = `${singleBoxW} g / ${maxWeight} g (單組重量)`;
  }
}

function validateGiftbox() {
  const status = document.getElementById("giftbox-status");
  const submit = document.getElementById("giftbox-submit");
  const container = document.getElementById('giftbox-container');

  container.classList.remove('gold-flow-active');

  if (!selectedItems[1] || !selectedItems[2]) {
    status.innerText = "請選擇兩罐茶品";
    status.style.color = "#a0a0a0";
    submit.innerText = "加入購物車";
    submit.disabled = true;
    submit.classList.remove("enabled");
    return;
  }
  
  if (boxQuantity < 1) { // 🟢 新增：檢查數量
    status.innerText = "禮盒組數必須大於 0";
    status.style.color = "#e74c3c";
    submit.disabled = true;
    return;
  }

  // 成功樣式
  container.classList.add('gold-flow-active');
  
  const boxFee = CONFIG.GIFT_BOX_PRICE || 200;
  const p1 = selectedItems[1];
  const p2 = selectedItems[2];
  
  // 計算單組價格
  const v1 = p1.price * (p1.qty || 1);
  const v2 = p2.price * (p2.qty || 1);
  const singleTotal = v1 + v2 + boxFee;
  const grandTotal = singleTotal * boxQuantity; // 總價 = 單組價格 * 組數

  status.innerHTML = `
    <span style="color:#666; font-size:13px;">
      單組價格: $${singleTotal.toLocaleString()} x ${boxQuantity} 組 = 
    </span>
    <span style="color:#b8860b; font-size:18px; font-weight:800; margin-left:4px;">
      NT$ ${grandTotal.toLocaleString()}
    </span>
  `;

  submit.innerText = editingId ? "確認修改" : `加入購物車 (x${boxQuantity})`;
  submit.disabled = false;
  submit.classList.add("enabled");
}

export function loadGiftBoxForEdit(data) {
  // 🟢 修正：讀取整體組數
  boxQuantity = data.qty || 1;
  document.getElementById('box-qty').value = boxQuantity;

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
        ghost.style.transform = 'scale(0.2) rotate(360deg)';
        ghost.style.opacity = '0';
    });

    setTimeout(() => ghost.remove(), 800);
}

export function initGiftBox() {
    const submitBtn = document.getElementById("giftbox-submit");
    const qtyInput = document.getElementById('box-qty');
    const qtyControls = document.querySelector('.giftbox-qty-row');

    // 🟢 數量控制綁
    if (qtyControls) {
        qtyControls.addEventListener('click', (e) => {
            // 1. 修正：使用 closest 確保點擊 icon 也能抓到按鈕
            const btn = e.target.closest('[data-action]'); 
            
            // 如果沒點到按鈕或沒有輸入框，直接結束
            if (!btn || !qtyInput) return;
            
            const action = btn.dataset.action;
            let currentQty = parseInt(qtyInput.value) || 1;

            // 2. 修正：邏輯整合，避免重複加減
            if (action === 'increase') {
                if (currentQty < 99) {
                    currentQty++;
                    // 呼叫氣泡動畫 (需確認此函式存在)
                    if (typeof spawnQtyBubble === 'function') {
                        spawnQtyBubble(btn, '+1'); 
                    }
                }
            } else if (action === 'decrease') { // 使用 else if
                if (currentQty > 1) {
                    currentQty--;
                    if (typeof spawnQtyBubble === 'function') {
                        spawnQtyBubble(btn, '-1');
                    }
                }
            }
            
            // 移除原本下方重複的 if (action === 'increase'...) 區塊

            // 3. 更新數值與狀態
            qtyInput.value = currentQty;
            boxQuantity = currentQty; // 更新全域變數
            
            validateGiftbox();       // 重新計算價格
            updateGiftboxProgress(); // 更新進度條
        });
    }

    if (submitBtn) {
        submitBtn.addEventListener("click", () => {
          if (submitBtn.disabled) return;

          const boxFee = CONFIG.GIFT_BOX_PRICE || 200;
          const p1 = selectedItems[1];
          const p2 = selectedItems[2];
          const price1 = p1.price * (p1.qty || 1);
          const price2 = p2.price * (p2.qty || 1);
          const singleTotal = price1 + price2 + boxFee;

          const finalGiftbox = {
            slot1: selectedItems[1],
            slot2: selectedItems[2],
            totalPrice: singleTotal, // 這裡只傳單組價格，總價在 cart.js 和後端算
            qty: boxQuantity, // 🟢 關鍵：傳遞整體組數
          };

          flyToCart();

          if (editingId) {
            const ok = updateGiftBoxInCart(editingId, finalGiftbox);
            if(ok) alert(`禮盒內容已更新！共 ${boxQuantity} 組`);
          } else {
            // 🟢 新增模式：傳入組數
            addGiftBoxToCart(finalGiftbox);
            window.dispatchEvent(new CustomEvent("cart:update"));
          }
          resetUI();
        });
    }

    const slot1 = document.getElementById("slot1");
    const slot2 = document.getElementById("slot2");
    if(slot1) slot1.addEventListener("click", () => openProductSelector(1));
    if(slot2) slot2.addEventListener("click", () => openProductSelector(2));
}

// 放到 cart.js 或 dom.js 中，並 import 進來，或者直接定義在下方
function spawnQtyBubble(targetElement, text) {
    const bubble = document.createElement('div');
    bubble.textContent = text;
    bubble.style.position = 'absolute';
    bubble.style.color = '#e67e22';
    bubble.style.fontWeight = 'bold';
    bubble.style.fontSize = '14px';
    bubble.style.pointerEvents = 'none';
    bubble.style.zIndex = '1000';
    bubble.style.transition = 'all 0.6s ease-out';
    
    // 定位
    const rect = targetElement.getBoundingClientRect();
    bubble.style.left = rect.left + (rect.width / 2) - 10 + 'px'; // 簡單置中
    bubble.style.top = rect.top + 'px';

    document.body.appendChild(bubble);

    // 動畫
    requestAnimationFrame(() => {
        bubble.style.transform = 'translateY(-30px)';
        bubble.style.opacity = '0';
    });

    setTimeout(() => {
        bubble.remove();
    }, 600);
}