import { $, toast } from "./dom.js";
import { saveCartItem, updateTotals } from "./cart.js";
import { CONFIG } from "./config.js";

function getQtyEl(id) {
  return document.getElementById(`qty-${id}`);
}

let qtyEventsBound = false;

/* ============================================================
✨ 1. 購買總數量控制 (+/-)
============================================================ */
export function handleQtyClick(btn) {
  const id = btn.dataset.id;
  const dir = btn.dataset.dir;

  const qtyEl = getQtyEl(id);
  let currentQty = parseInt(qtyEl.value || 0);

  // 取得目前所需的最小包數
  const { totalNeeded } = calculatePackRequirements(id);

  if (dir === "plus") {
    currentQty++;
    spawnQtyBubble(btn, "+1");
  }
  
  if (dir === "minus") {
    if (currentQty > 0) {
      // 🛡️ 阻擋邏輯：如果減少後會小於裝罐所需數量，禁止減少
      if (currentQty - 1 < totalNeeded) {
        toast(`⚠️ 請先減少裝罐數量<br>目前裝罐至少需要 ${totalNeeded} 包`, "error");
        // 稍微搖晃提示
        qtyEl.classList.add("shake");
        setTimeout(() => qtyEl.classList.remove("shake"), 500);
        return; 
      }
      currentQty--;
      spawnQtyBubble(btn, "-1");
    }
  }

  qtyEl.value = currentQty;
  syncToCart(id);
}

/* ============================================================
✨ 2. 裝罐數量控制 (小罐/大罐)
============================================================ */
function handlePackBtn(btn) {
  const id = btn.dataset.pack;
  const dir = btn.dataset.dir;
  const type = btn.dataset.type; // "small" 或 "large"

  // 取得該類型的 input
  const inputId = type === "small" ? `packQtySmall-${id}` : `packQtyLarge-${id}`;
  const inputEl = document.getElementById(inputId);
  if (!inputEl) return;

  let val = parseInt(inputEl.value || 0);

  if (dir === "plus") {
    val++;
  }
  if (dir === "minus" && val > 0) {
    val--;
  }

  // 更新介面上的 input 數值
  inputEl.value = val;

  // 🔥 核心邏輯：檢查總數是否足夠，不夠自動加
  checkAndAutoIncrementTotal(id, btn, type);
  
  syncToCart(id);
}

/* ============================================================
🧮 輔助：計算裝罐需求
============================================================ */
function calculatePackRequirements(id) {
  const sInput = document.getElementById(`packQtySmall-${id}`);
  const lInput = document.getElementById(`packQtyLarge-${id}`);

  // 如果 UI 沒有展開或找不到，視為 0
  if (!sInput || !lInput) return { totalNeeded: 0, small: 0, large: 0 };

  const small = parseInt(sInput.value || 0);
  const large = parseInt(lInput.value || 0);

  // 1 小罐 = 1 包, 1 大罐 = 2 包
  const totalNeeded = (small * 1) + (large * 2);

  return { totalNeeded, small, large };
}

/* ============================================================
🚀 輔助：自動增長總數 (Bottom-up Logic)
============================================================ */
function checkAndAutoIncrementTotal(id, btn, type) {
  const qtyEl = getQtyEl(id);
  let currentTotal = parseInt(qtyEl.value || 0);
  
  const { totalNeeded } = calculatePackRequirements(id);

  if (totalNeeded > currentTotal) {
    // 自動補足
    qtyEl.value = totalNeeded;
    
    // 計算增加了多少
    const diff = totalNeeded - currentTotal;
    
    // 提示氣泡
    const msg = `同步+${diff}`; 
    spawnQtyBubble(btn, msg);
    
    // 也可以讓總數欄位閃一下
    qtyEl.classList.add("flash-highlight");
    setTimeout(() => qtyEl.classList.remove("flash-highlight"), 300);
  }
}

/* ============================================================
💾 輔助：統一儲存與更新 UI 狀態文字
============================================================ */
function syncToCart(id) {
  const qtyEl = getQtyEl(id);
  const currentTotal = parseInt(qtyEl.value || 0);
  
  const packChk = document.getElementById(`pack-${id}`);
  const isPacked = packChk?.checked || false;

  const { small, large, totalNeeded } = calculatePackRequirements(id);

  // 1. 更新狀態文字 (Feedback)
  updateStatusText(id, currentTotal, totalNeeded, isPacked);

  // 2. 存入購物車
  // 注意：我們現在傳入物件 { small, large } 作為 packData
  const packData = { small: isPacked ? small : 0, large: isPacked ? large : 0 };
  
  saveCartItem(id, currentTotal, isPacked, packData);
  updateTotals();
}

function updateStatusText(id, total, needed, isPacked) {
  const statusEl = document.getElementById(`packStatus-${id}`);
  if (!statusEl) return;

  if (!isPacked) {
    statusEl.textContent = "";
    return;
  }

  const remaining = total - needed;
  if (remaining === 0 && needed > 0) {
    statusEl.innerHTML = `<span class="ok">✓ 全數裝罐</span>`;
  } else if (remaining > 0) {
    statusEl.innerHTML = `<span class="warn">剩 ${remaining} 包裸裝</span>`;
  } else if (needed === 0) {
     statusEl.innerHTML = `<span>未設定</span>`;
  } else {
    // 理論上不會發生 needed > total (因為有自動補足)，除非手動改 code
    statusEl.textContent = "數量異常"; 
  }
}

/* ============================================================
✨ 3. 裝罐開關 Toggle
============================================================ */
function handlePackToggle(e) {
  const chk = e.target;
  const id = chk.id.replace("pack-", "");
  const wrap = document.getElementById(`packQtyWrap-${id}`);
  const row = chk.closest(".pack-row");

  if (chk.checked) {
    wrap.classList.remove("hidden");
    row.classList.add("active");
    
    // 預設開啟時，如果兩個都是 0，自動幫「小罐」設為 1 (貼心 UX)
    // 並觸發自動增長檢查
    const sInput = document.getElementById(`packQtySmall-${id}`);
    const lInput = document.getElementById(`packQtyLarge-${id}`);
    if (parseInt(sInput.value)==0 && parseInt(lInput.value)==0) {
        sInput.value = 1;
        checkAndAutoIncrementTotal(id, sInput, "small"); // 自動補總數
    }

  } else {
    wrap.classList.add("hidden");
    row.classList.remove("active");
    // 關閉時不一定要清空 value，可以保留使用者上次輸入的，但 saveCartItem 會判斷 checked=false 就不存
  }

  syncToCart(id);
}

/* ============================================================
✨ UI 初始化與事件綁定
============================================================ */
export function updatePackUI(id) {
    // 這裡主要用來初始化狀態文字
    const qtyEl = getQtyEl(id);
    const packChk = document.getElementById(`pack-${id}`);
    if(qtyEl && packChk) {
        const { totalNeeded } = calculatePackRequirements(id);
        updateStatusText(id, parseInt(qtyEl.value||0), totalNeeded, packChk.checked);
    }
}

export function initQtyControls() {
  if (qtyEventsBound) return;
  qtyEventsBound = true;

  document.addEventListener("click", (e) => {
    // 1. 總數按鈕
    const btn = e.target.closest(".qty-btn");
    if (btn) return handleQtyClick(btn);

    // 2. 裝罐按鈕 (step)
    const pbtn = e.target.closest(".step");
    if (pbtn) return handlePackBtn(pbtn);
  });

  document.addEventListener("change", (e) => {
    if (e.target.matches("input[id^='pack-']")) return handlePackToggle(e);
  });
  
  // 初始化所有 UI 狀態
  CONFIG.PRODUCTS.forEach(p => {
      // 確保一載入如果有勾選，狀態文字是正確的
      updatePackUI(p.id);
  });
}

function spawnQtyBubble(btn, text) {
  const bubble = document.createElement("div");
  bubble.className = "qty-bubble";
  bubble.textContent = text;
  const rect = btn.getBoundingClientRect();
  const topPos = rect.top + window.scrollY - 15;
  const leftPos = rect.left + window.scrollX + (rect.width / 2);
  bubble.style.top = topPos + "px";
  bubble.style.left = leftPos + "px";
  document.body.appendChild(bubble);
  bubble.addEventListener('animationend', () => bubble.remove());
}