import { addGiftBoxToCart, updateGiftBoxInCart } from './cart.js';
import { CONFIG } from './config.js';
import { $ } from './dom.js';

let currentSlot = null;
let selectedItems = { 1: null, 2: null };
let editingId = null;

// ====== Slot UI 更新 ======
function updateMetalSlot(slot, product) {
  const slotEl = document.getElementById(`slot${slot}`);
  const text = slotEl.querySelector(`.metal-text`);
  
  if (!text) return;

  if (product) {
    const isMulti = product.qty && product.qty > 1;
    const qtyTag = isMulti ? `<span style="font-size:12px; color:#e67e22; margin-left:4px;">x${product.qty}</span>` : "";
    
    text.innerHTML = `
        <span style="color:#2f4b3c; font-weight:bold;">${product.title}</span>${qtyTag}<br>
        <span class="metal-sub">${product.unit}</span>
    `;
    slotEl.classList.add('active');
  } else {
    text.innerHTML = `<i class="ph ph-plus-circle" style="font-size: 28px; color: #8fb79c; margin-bottom:4px;"></i><br><span style="color:#5a7b68">選擇茶品</span>`;
    slotEl.classList.remove('active');
  }
}

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
      <div class="sel-price">NT$ ${priceCalc}</div>
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

function selectProduct(product) {
  let qty = 1;
  if (product.unit && product.unit.includes("75")) {
      qty = 2;
  }

  selectedItems[currentSlot] = { ...product, qty: qty };
  
  updateMetalSlot(currentSlot, selectedItems[currentSlot]);
  updateGiftboxProgress();
  validateGiftbox();
  window.closeSelector();
}

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

// 🔥【核心修正】驗證禮盒時，顯示「含禮盒費」的公式
function validateGiftbox() {
  const status = document.getElementById("giftbox-status");
  const submit = document.getElementById("giftbox-submit");
  const container = document.getElementById('giftbox-container');

  container.classList.remove('gold-flow-active');

  if (!selectedItems[1] || !selectedItems[2]) {
    status.innerText = "請選擇兩罐茶品";
    status.style.color = "#888";
    submit.innerText = "加入購物車";
    submit.disabled = true;
    submit.classList.remove("enabled");
    return;
  }

  container.classList.add('gold-flow-active');
  
  // 1. 取得設定的禮盒費用 (預設 200)
  const boxFee = CONFIG.GIFT_BOX_PRICE || 200;

  // 2. 計算
  const p1 = selectedItems[1];
  const p2 = selectedItems[2];
  const v1 = p1.price * (p1.qty || 1);
  const v2 = p2.price * (p2.qty || 1);
  const total = v1 + v2 + boxFee; // 🔥 加上禮盒費

  // 3. 顯示公式： 茶1 + 茶2 + 禮盒費 = 總價
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

  const submit = document.getElementById("giftbox-submit");
  const section = document.getElementById("giftboxCard");

  if(submit) submit.innerText = "確認修改";

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
  const submit = document.getElementById("giftbox-submit");
  if(submit) submit.innerText = "加入購物車";
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
        ghost.style.transform = 'scale(0.2)';
        ghost.style.opacity = '0';
    });

    setTimeout(() => ghost.remove(), 800);
}

export function initGiftBox() {
    const submitBtn = document.getElementById("giftbox-submit");
    if (submitBtn) {
        submitBtn.addEventListener("click", () => {
          if (submitBtn.disabled) return;

          // 🔥 取得禮盒費用
          const boxFee = CONFIG.GIFT_BOX_PRICE || 200;

          const p1 = selectedItems[1];
          const p2 = selectedItems[2];
          const price1 = p1.price * (p1.qty || 1);
          const price2 = p2.price * (p2.qty || 1);

          const finalGiftbox = {
            slot1: selectedItems[1],
            slot2: selectedItems[2],
            // 🔥 寫入總價時包含禮盒費
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
    if(slot1) slot1.addEventListener("click", () => openProductSelector(1));
    if(slot2) slot2.addEventListener("click", () => openProductSelector(2));
}