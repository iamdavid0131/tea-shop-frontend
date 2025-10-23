// 使用 Cloudflare Worker 的 API 客戶端
import { api as UpstreamAPI } from './app.api.js';
// 全域 DOM helper（ESM 不會自動掛到 window，手動掛）
window.$  ??= (id) => document.getElementById(id);
window.$$ ??= (sel, root=document) => Array.from(root.querySelectorAll(sel));

/* ============================================================
   API 相容層：優先使用已匯入的 UpstreamAPI；失敗則降級到 GAS EXEC
   - 可在 HTML 放入：<meta name="gas-exec" content="https://script.google.com/macros/s/xxxx/exec">
     或在全域設 window.GAS_EXEC_URL='...'
   ============================================================ */
const GAS_EXEC =
  window.GAS_EXEC_URL ||
  document.querySelector('meta[name="gas-exec"]')?.content ||
  '';

const enc = encodeURIComponent;

async function viaEXEC(name, ...args){
  if (!GAS_EXEC) throw new Error('no_exec_url');
  const q = (o)=>enc(JSON.stringify(o||{}));
  const routes = {
    getConfig:        () => `${GAS_EXEC}?fn=getConfig`,
    previewTotals:    (qMap, method, promo) => `${GAS_EXEC}?fn=previewTotals&items=${enc(JSON.stringify(qMap||{}))}&method=${enc(method||'store')}&promo=${enc((promo||'').toUpperCase())}`,
    submitOrder:      (payload)             => `${GAS_EXEC}?fn=submitOrder&p=${q(payload)}`,
    searchStores:     (payload)             => `${GAS_EXEC}?fn=searchStores&p=${q(payload)}`,
    apiGetCustomerByPhone: (phone)          => `${GAS_EXEC}?fn=apiGetCustomerByPhone&phone=${enc(phone||'')}`,
    apiUpsertCustomer:    (obj)             => `${GAS_EXEC}?fn=apiUpsertCustomer&p=${q(obj)}`
  };
  const url = routes[name]?.(...args);
  if (!url) throw new Error('exec_unsupported:'+name);
  const r = await fetch(url, { credentials:'omit' });
  if (!r.ok) throw new Error('exec_http_'+r.status);
  return r.json();
}

function createCompatAPI(upstream){
  // 嘗試 upstream（/api），失敗再降級到 GAS EXEC
  const call = async (name, ...args)=>{
    try { return await upstream[name](...args); }
    catch(_e){ try { return await viaEXEC(name, ...args); } catch(e2){ throw _e || e2; } }
  };
  return {
    getConfig:             (...a)=>call('getConfig', ...a),
    previewTotals:         (...a)=>call('previewTotals', ...a),
    submitOrder:           (...a)=>call('submitOrder', ...a),
    searchStores:          (...a)=>call('searchStores', ...a),
    apiGetCustomerByPhone: (...a)=>call('apiGetCustomerByPhone', ...a),
    apiUpsertCustomer:     (...a)=>call('apiUpsertCustomer', ...a),
  };
}

// 統一使用 API（具降級能力）
const API = createCompatAPI(UpstreamAPI);

// ============ 玻璃卡・分類手風琴（最小可用版） ============

// 開/關某一組
/* ===== 分類手風琴：只開一組＋自適應高度 ===== */


function refreshPanelHeight(panel){
  if (!panel) return;
  // 兩幀保險：先清空再回填，避免 transition 卡到舊高度
  panel.style.maxHeight = 'none';
  // 讀一次觸發 reflow
  void panel.offsetHeight;
  panel.style.maxHeight = panel.scrollHeight + 'px';
}
const panelObservers = new WeakMap();

function watchPanel(panel){
  if (!('ResizeObserver' in window) || panelObservers.has(panel)) return;
  const ro = new ResizeObserver(()=> refreshPanelHeight(panel));
  ro.observe(panel);
  panelObservers.set(panel, ro);
}
function unwatchPanel(panel){
  const ro = panelObservers.get(panel);
  if (ro){ ro.disconnect(); panelObservers.delete(panel); }
}


/** 展開/收合單一分類 */
function toggleGroup(group, open) {
  const panel = group.querySelector('.cat-panel');
  const btn   = group.querySelector('.cat-toggle');
  if (!panel || !btn) return;

  if (open) {
    // 關掉其他已開的組
    document.querySelectorAll('.cat-group.is-open').forEach(g => {
      if (g === group) return;
      g.classList.remove('is-open');
      const p = g.querySelector('.cat-panel');
      const b = g.querySelector('.cat-toggle');
      if (p) p.style.maxHeight = '0px';
      if (b) b.setAttribute('aria-expanded','false');
    });

    // 打開自己
    group.classList.add('is-open');
    btn.setAttribute('aria-expanded','true');
    refreshPanelHeight(panel);
    watchPanel(panel);
  } else {
    group.classList.remove('is-open');
    btn.setAttribute('aria-expanded','false');
    panel.style.maxHeight = '0px';
    unwatchPanel(panel);
  }
}



function packRowHTML(id){
  return `
    <div class="pack-row" data-for="${id}">
      <label class="pack-toggle">
        <input type="checkbox" id="pack_${id}" />
        裝盒
      </label>
      <div id="pack_wrap_${id}" class="pack-qty" hidden>
        <span class="pack-hint">最多 <b id="pack_max_${id}">0</b> 盒</span>
        <div class="qty">
          <button class="step" type="button" data-for="pack_q_${id}" data-delta="-1">−</button>
          <input id="pack_q_${id}" type="number" min="0" step="1" value="0" />
          <button class="step" type="button" data-for="pack_q_${id}" data-delta="1">＋</button>
        </div>
      </div>
      <div id="pack_err_${id}" class="pack-err" style="display:none;">裝盒數不可超過購買數量</div>
    </div>`;
}
// ★ 放在 buildItemCards 之外（例如 compute 上方），並加防重
(function installUndoOnce(){
  if (window.__undoInstalled) return;
  window.__undoInstalled = true;

  const toast = document.getElementById('undoToast');
  const msgEl = document.getElementById('undoMsg');
  const btn   = document.getElementById('undoBtn');
  if (!toast || !msgEl || !btn) return;

  let undoTimer = null;
  let lastChange = null; // { id, prev, title }

  document.addEventListener('focusin', (e)=>{
    const el = e.target;
    if (!el || !el.id || !el.id.startsWith('q_')) return;
    el.__prev = Number(el.value || 0);
  });

  document.addEventListener('change', (e)=>{
    const el = e.target;
    if (!el || !el.id || !el.id.startsWith('q_')) return;
    const prev = Number(el.__prev || 0);
    const now  = Number(el.value || 0);
    if (prev > 0 && now === 0){
      const id = el.id.replace('q_', '');
      const p  = (CONFIG.PRODUCTS || []).find(x => x.id === id);
      lastChange = { id, prev, title: p ? p.title : ('商品 ' + id) };
      msgEl.textContent = `已清空「${lastChange.title}」`;
      toast.style.display = 'block';
      clearTimeout(undoTimer);
      undoTimer = setTimeout(()=>{ toast.style.display='none'; lastChange=null; }, 3000);
    }
  });

  btn.addEventListener('click', ()=>{
    if (!lastChange) return;
    const el = document.getElementById('q_' + lastChange.id);
    if (el){
      el.value = lastChange.prev;
      saveForm(); compute(); if (window.validate) window.validate();
    }
    toast.style.display = 'none';
    clearTimeout(undoTimer);
    lastChange = null;
  });
})();

function renderQuickBlock(p){
  const t = p.tagline ? `<span class="tagline">${p.tagline}</span>` : '';
  const tags = Array.isArray(p.tags) && p.tags.length
    ? `<div class="tags">${p.tags.map(x=>`<span class="tag">${x}</span>`).join('')}</div>` : '';
  return `<div class="quickblock">${t}${tags}</div>`;
}

// 把 0–5 轉成「■■■□□」這種字串
function bar5(n){
  const v = Math.max(0, Math.min(5, Number(n)||0));
  let html = '';
  for (let i = 0; i < 5; i++){
    html += `<span class="blk${i < v ? ' on' : ''}" aria-hidden="true"></span>`;
  }
  return html;
}

// 將 profile 轉成五行（甜度/香氣/焙火/厚度/餘韻）
function renderProfileBlocks(prof){
  if (!prof) return '';
  const row = (label, val)=>`
    <div class="row">
      <span class="label">${label}</span>
      <span class="bar" aria-label="${label}：${Number(val)||0}／5">${bar5(val)}</span>
    </div>`;
  return `<div class="profile-blocks">
    ${row('甜度',     prof.sweetness)}
    ${row('香氣',     prof.aroma)}
    ${row('焙火',     prof.roast)}
    ${row('厚度',     prof.body)}
    ${row('餘韻',     prof.finish)}
  </div>`;
}

function renderBrewLines(b){
  if (!b || !b.hot) return '';
  const hot = b.hot;
  const hotLine = `熱泡：<b>${hot.grams}g</b> / <b>${hot.water_ml}ml</b> / <b>${hot.temp_c}°C</b> / <b>${hot.time_s}秒</b> × <b>${hot.infusions}</b>`;
  const cold = b.cold ? `冷泡：<b>${b.cold.grams}g</b> / <b>${b.cold.water_ml}ml</b> / <b>${b.cold.hours}小時</b>` : '';
  return `<div class="brew">
    <div class="line">${hotLine}</div>
    ${cold ? `<div class="line">${cold} <small>（冰箱冷藏）</small></div>` : ''}
  </div>`;
}

function renderDetailBlock(p, idx){
  const story = p.story ? `<div class="story">${p.story}</div>` : '';
  const prof  = renderProfileBlocks(p.profile);
  const brew  = renderBrewLines(p.brew);
  if (!story && !prof && !brew) return '';
  return `
    <button class="more-btn" type="button" data-more="${idx}" aria-expanded="false">更多詳情</button>
    <div class="detailblock" id="more_${idx}" hidden>
      ${story}
      ${prof}
      ${brew}
    </div>
  `;
}

// 全域一次性安裝「更多詳情」事件委派
(function bindMoreOnce(){
  if (bindMoreOnce._ok) return; bindMoreOnce._ok = true;
  document.addEventListener('click', (e)=>{
    const btn = e.target.closest('.more-btn');
    if (!btn) return;
    const id = btn.getAttribute('data-more');
    const box = document.getElementById('more_' + id);
    if (!box) return;
    const open = box.hasAttribute('hidden');
    if (open) { box.removeAttribute('hidden'); btn.setAttribute('aria-expanded','true'); btn.textContent='收合詳情'; }
    else { box.setAttribute('hidden',''); btn.setAttribute('aria-expanded','false'); btn.textContent='更多詳情'; }
    // ★ 重要：詳情開/關後，刷新外層 cat-panel 的 max-height
    const panel = btn.closest('.cat-panel');
    if (panel) refreshPanelHeight(panel);
  }, true);
})();



// 依 PRODUCTS 生成分類與商品
function buildItemCards(products){
  const container =
    document.getElementById('categoryList') ||
    document.querySelector('#itemsCard .itemlist');
  if (!container) return;

  // 分組
  const byCat = {};
  (products || []).forEach(p=>{
    const cat = p.category || '其他';
    (byCat[cat] ||= []).push(p);
  });

  container.innerHTML = '';
  container.style.display = 'block';

  // 遞增索引用於 aria-controls
  let idx = 0;

  for (const [cat, list] of Object.entries(byCat)){
    const panelId = `cat_${idx++}`;

    const group = document.createElement('section');
    group.className = 'cat-group';
    group.dataset.cat = cat;

    const head = document.createElement('div');
    head.className = 'itemcard cat-head';
    head.innerHTML = `
      <button class="cat-toggle" type="button" aria-expanded="false" aria-controls="${panelId}">
        <span class="title">${cat}</span>
        <span class="chev" aria-hidden="true">▾</span>
      </button>`;

    const panel = document.createElement('div');
    panel.id = panelId;
    panel.className = 'cat-panel';
    panel.style.maxHeight = '0px';

    // 只渲染非變體；變體塞在同卡內
    list.filter(p=>!p.variantOf).forEach((p, cardIndex)=>{
      const variants = (products || []).filter(v => v.variantOf === p.id);

      // 主品（散茶）
      const baseLabel = (p.category === '加購' || p.noBaseLabel) ? '' : (p.baseLabel || '散茶');
      const baseUnit  = p.unit || '';
      // 主品
      let vHTML = `
        <div class="variant">
          <span class="v-label">${baseLabel}</span>
          <span class="v-meta">
            單價 <span class="price" id="p_${p.id}">—</span> <span class="muted">/${baseUnit}</span>
            <span class="muted" id="s_${p.id}" style="margin-left:6px;"></span>
          </span>
          <div class="qty">
            <button class="step" type="button" data-for="q_${p.id}" data-delta="-1">−</button>
            <input id="q_${p.id}" type="number" inputmode="numeric" pattern="[0-9]*" min="0" step="1" value="0" />
            <button class="step" type="button" data-for="q_${p.id}" data-delta="1">＋</button>
          </div>
        </div>
        ${p.packable ? packRowHTML(p.id) : ''}
      `;

      // 再把所有變體串進來
    for (const v of variants) {
      const vLabel = v.variantLabel || '茶包';
      const vUnit  = v.unit || '';
      vHTML += `
        <div class="variant">
          <span class="v-label">${vLabel}</span>
          <span class="v-meta">
            單價 <span class="price" id="p_${v.id}">—</span> <span class="muted">/${vUnit}</span>
            <span class="muted" id="s_${v.id}" style="margin-left:6px;"></span>
          </span>
          <div class="qty">
            <button class="step" type="button" data-for="q_${v.id}" data-delta="-1">−</button>
            <input id="q_${v.id}" type="number" inputmode="numeric" pattern="[0-9]*" min="0" step="1" value="0" />
            <button class="step" type="button" data-for="q_${v.id}" data-delta="1">＋</button>
          </div>
        </div>
        ${v.packable ? packRowHTML(v.id) : ''}
      `;
    }

    // 卡片內容（注意：這一段要在 forEach 內）
    const card = document.createElement('div');
    card.className = 'itemcard';
    const moreIndex = `${p.id}_${cardIndex}`;
    card.innerHTML = `
      <div class="title">${p.title}</div>
      ${renderQuickBlock(p)}
      ${vHTML}
      ${renderDetailBlock(p, moreIndex)}
    `;
    panel.appendChild(card);
  });

    group.appendChild(head);
    group.appendChild(panel);
    container.appendChild(group);
  }

  // 裝罐上限與狀態回填
  syncAllPackMax();

  // 預設展開：優先「窨花」，否則第一組
  const groups = Array.from(document.querySelectorAll('.cat-group'));
  const prefer = groups.find(g => /窨花/.test(g.dataset.cat || '')) || groups[0];
  if (prefer) requestAnimationFrame(() => toggleGroup(prefer, true));


  // === GA: view_item_list ===
try {
  const items = (products || []).filter(p => !p.variantOf).map((p, idx) => ({
    item_id: p.id,
    item_name: p.title,
    item_brand: '祥興台灣茶',
    item_category: p.category || '',
    index: idx
  }));
  if (items.length) {
    gtag('event', 'view_item_list', { items });
  }
} catch(_) {}
}

// === 安裝分類手風琴（事件委派 + 自適應高度） ===

function installCategoryAccordion(){
  const container = document.getElementById('categoryList');
  if (!container) return;

  // 避免重複綁定
  if (installCategoryAccordion._bound) return;
  installCategoryAccordion._bound = true;

  // 點標題切換展開/收合
  container.addEventListener('click', (e)=>{
    const btn = e.target.closest('.cat-toggle');
    if (!btn) return;
    const group = btn.closest('.cat-group');
    if (!group) return;

    const open = !group.classList.contains('is-open');
    toggleGroup(group, open);

    // 展開後更新高度（避免內容動態變化）
    if (open) {
      const panel = group.querySelector('.cat-panel');
      if (panel) panel.style.maxHeight = panel.scrollHeight + 'px';
    }
  });

  // 視窗尺寸變更：刷新已展開面板高度
  function refreshOpenPanels(){
    document.querySelectorAll('.cat-group.is-open .cat-panel').forEach(panel=>{
      panel.style.maxHeight = panel.scrollHeight + 'px';
    });
  }
  window.addEventListener('resize', refreshOpenPanels);

  // 內部內容改變（數量+/-、裝罐顯示）時刷新高度
  document.addEventListener('input', (e)=>{
    if (e.target.closest('.cat-panel')) refreshOpenPanels();
  }, true);
}



// 生成完商品後要安裝一次手風琴
// —— 在 buildItemCards(products) 之後呼叫：

// 顯示單價
function renderPrices(){
  const cfg = CONFIG && CONFIG.PRICES ? CONFIG : DEFAULT_CONFIG;
  for (const [id, price] of Object.entries(cfg.PRICES)){
    const el = document.getElementById('p_' + id);
    if (el) el.textContent = money(price);
  }
}
//顯示庫存
function getStockFor(id){
  const st = (CONFIG && CONFIG.STOCKS) || {};
  const v = st[id];
  return (v === null || v === undefined || v === '' || v < 0) ? null : Number(v);
}

function renderStocks(){
  (CONFIG.PRODUCTS || []).forEach(p=>{
    const left = getStockFor(p.id);
    const tag = document.getElementById('s_' + p.id);
    const input = document.getElementById('q_' + p.id);
    const plus  = document.querySelector(`.step[data-for="q_${p.id}"][data-delta="1"]`);
    const minus = document.querySelector(`.step[data-for="q_${p.id}"][data-delta="-1"]`);

    if (tag){
      if (left === null){ tag.textContent = ''; }  // 不追蹤
      else if (left === 0){ tag.textContent = '（完售，請洽客服）'; }
      else { tag.textContent = `（剩餘 ${left}）`; }
    }

    // 控制輸入/按鈕
    if (input){
      if (left === null){
        input.max = '';
        input.disabled = false;
      } else {
        input.max = String(left);
        if (left === 0){
          input.value = 0;
          input.disabled = true;
        } else {
          input.disabled = false;
          // 夾值
          let v = Math.max(0, Number(input.value||0));
          if (v > left) { input.value = left; }
        }
      }
    }
    if (plus)  plus.disabled  = (left !== null) && (Number(input?.value||0) >= left);
    if (minus) minus.disabled = Number(input?.value||0) <= 0;
  });
}

function clampToStock(id){
  const input = document.getElementById('q_' + id);
  if (!input) return;
  const left = getStockFor(id);
  if (left === null) return;
  let v = Math.max(0, Number(input.value||0));
  if (v > left){
    input.value = left;
    // 可選：提醒一次
    // alert('超過庫存，已自動調整為 ' + left);
  }
}


// 讀取所有商品數量
function getQuantities(){
  const q = {};
  (CONFIG.PRODUCTS || []).forEach(p => {
    const el = document.getElementById('q_' + p.id);
    const val = Math.max(0, parseInt((el && el.value) || '0', 10) || 0);
    q[p.id] = val;
  });
  return q;
}
function packMaxFor(id){
  const q = getQuantities();
  const buy = Number(q[id]||0);
  return buy; // 小於購買數量
}

// 同步某一品項的裝罐 UI（上限/顯示/錯誤）
function syncPackUIFor(id){
  const wrap = document.getElementById('pack_wrap_' + id);
  const chk  = document.getElementById('pack_' + id);
  const qtyI = document.getElementById('pack_q_' + id);
  const maxL = document.getElementById('pack_max_' + id);
  const err  = document.getElementById('pack_err_' + id);
  if (!chk || !qtyI || !maxL) return;

const max = packMaxFor(id);
maxL.textContent = String(max);
let v = Math.max(0, Math.min(Number(qtyI.value||0), max));
if (max === 0) v = 0;
qtyI.value = v;

if (wrap) wrap.hidden = !chk.checked;

const over = chk.checked && Number(qtyI.value||0) > max;
if (err) err.style.display = over ? 'block' : 'none';

}

// 一次同步全部（在 compute() 後、restore 後調用較準）
function syncAllPackMax(){
  (CONFIG.PRODUCTS || []).forEach(p=>{
    if (p.packable) syncPackUIFor(p.id);
  });
}

// ---- 事件：勾裝罐、輸入裝罐數量、主數量變動時同步上限 ----
document.addEventListener('change', (e)=>{
  const t = e.target;
  if (!t) return;

  // 勾選/取消「裝罐」
  if (t.id && t.id.startsWith('pack_')){
    const id = t.id.replace('pack_','');
    syncPackUIFor(id);
    saveForm();
    if (window.validate) window.validate();
  }

  // 主商品/變體數量改變 → 同步對應裝罐上限
  if (t.id && t.id.startsWith('q_')){
    const id = t.id.replace('q_','');
    syncPackUIFor(id);
    saveForm();
    if (window.validate) window.validate();
  }
}, true);

document.addEventListener('input', (e)=>{
  const t = e.target;
  if (!t) return;

  // 裝罐數量即時夾值並校驗
  if (t.id && t.id.startsWith('pack_q_')){
    const id = t.id.replace('pack_q_','');
    syncPackUIFor(id);
    saveForm();
    if (window.validate) window.validate();
  }
}, true);



function renderTotals({ sub, discount, ship, tot, baseForShip, method, cfg, code }){
  const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  const money = (n)=>'NT$ ' + Number(n||0).toLocaleString('zh-Hant-TW');

  set('sub_s',   money(sub));
  set('disc_s',  (discount > 0) ? `- ${money(discount)}` : '—');
  set('ship_s',  money(ship));
  set('total_s', money(tot));

  const discWrap = document.getElementById('disc_wrap');
  if (discWrap) discWrap.style.display = discount > 0 ? 'inline-block' : 'none';

  // 免運提示/進度條/徽章（沿用你原來邏輯）
  const tipSticky = document.getElementById('free_tip_s');
  const barWrap   = document.getElementById('freeProgress');
  const bar       = document.getElementById('freeProgressBar');
  const badge     = document.getElementById('freeBadge');

  const goal = (method === 'cod')
    ? Number(cfg.COD_FREE_SHIPPING_THRESHOLD || 0)
    : Number(cfg.FREE_SHIPPING_THRESHOLD || 0);

  const diffToFree = Math.max(0, goal - baseForShip);

  if (baseForShip > 0 && diffToFree > 0) {
    if (tipSticky){
      tipSticky.textContent = `免運差 NT$ ${diffToFree.toLocaleString('zh-Hant-TW')}`;
      tipSticky.style.display = 'inline-block';
    }
  } else if (goal > 0 && baseForShip >= goal && baseForShip > 0) {
    if (tipSticky){ tipSticky.textContent = '已免運'; tipSticky.style.display = 'inline-block'; }
  } else {
    if (tipSticky){ tipSticky.textContent = ''; tipSticky.style.display = 'none'; }
  }

  if (barWrap && bar){
    if (baseForShip > 0 && goal > 0 && baseForShip < goal){
      const pct = Math.max(6, Math.min(100, Math.round((baseForShip / goal) * 100)));
      bar.style.width = pct + '%';
      barWrap.style.display = 'block';
      barWrap.style.opacity = '1';
    } else if (goal > 0 && baseForShip >= goal){
      bar.style.width = '100%';
      barWrap.style.display = 'block';
      barWrap.style.opacity = '1';
    } else {
      barWrap.style.display = 'none';
    }
  }

  if (badge){
    badge.style.display = (goal > 0 && baseForShip >= goal && baseForShip > 0) ? 'inline-block' : 'none';
  }
}

function updateCartSheetTotals({ sub, discount, ship, tot }) {
  const money = (n)=>'NT$ ' + Number(n||0).toLocaleString('zh-Hant-TW');
  const subAfter = Math.max(0, Number(sub||0) - Number(discount||0));

  // 主要三欄
  const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  set('cartSub',  money(subAfter));
  set('cartShip', money(ship));
  set('cartTotal',money(tot));

  // 原價（有折扣才顯示）
  const origRow = document.getElementById('cartSubOrigRow');
  const origEl  = document.getElementById('cartSubOrig');
  if (origRow && origEl) {
    const on = Number(discount) > 0;
    origRow.style.display = on ? 'flex' : 'none';
    if (on) origEl.textContent = money(sub);
  }

  // 折扣列（負值呈現）
  const discRow = document.getElementById('cartDiscRow');
  const discEl  = document.getElementById('cartDisc');
  if (discRow && discEl) {
    const on = Number(discount) > 0;
    discRow.style.display = on ? 'flex' : 'none';
    if (on) discEl.textContent = '- ' + money(discount);
  }

  // 頂部 peek
  const peek = document.getElementById('peekSum');
  if (peek) peek.textContent = (Number(sub) > 0)
    ? `小計 ${money(subAfter)}，運費 ${money(ship)}，共 ${money(tot)}`
    : '尚未選購商品';
}


// 計算金額（全動態）
function compute(){
  const q = getQuantities();
  const cfg = CONFIG && CONFIG.PRICES ? CONFIG : DEFAULT_CONFIG;

  // 1) 原價小計 sub
  let sub = 0;
  for (const [id, price] of Object.entries(cfg.PRICES)){
    sub += (q[id] || 0) * price;
  }

  // 2) 前端只做正規化與占位訊息（折扣以後端為準）
  const APPLY_DISCOUNT_BEFORE_FREE_SHIP = true;
  const codeRaw = ($('promoCode')?.value || '').trim();
  const { discount, normalizedCode, message } = calcDiscountFront(codeRaw, sub);

  // GA / 標記
  try {
    window.__appliedCoupon = normalizedCode || '';
    if (normalizedCode) gtag('event','apply_promo',{ coupon: normalizedCode, discount_value: discount || 0 });
  } catch(_) {}

  // 先用前端臨時值呈現（折扣=0）
  const subAfter = Math.max(0, sub - discount);
  const method = (typeof currentShip === 'function') ? currentShip() : 'store';
  const baseForShip = APPLY_DISCOUNT_BEFORE_FREE_SHIP ? subAfter : sub;

  let ship = 0;
  if (method === 'cod') {
    const codGoal = Number(cfg.COD_FREE_SHIPPING_THRESHOLD || 0);
    const codFee  = Number(cfg.COD_SHIP_FEE || 0);
    ship = (baseForShip === 0 || (codGoal > 0 && baseForShip >= codGoal)) ? 0 : codFee;
  } else {
    const storeGoal = Number(cfg.FREE_SHIPPING_THRESHOLD || 0);
    const storeFee  = Number(cfg.BASE_SHIPPING_FEE || 0);
    ship = (baseForShip === 0 || (storeGoal > 0 && baseForShip >= storeGoal)) ? 0 : storeFee;
  }
  const tot = subAfter + ship;

 // ====== 先畫出暫時值（避免空白）======
  renderTotals({
    sub, discount, ship, tot,
    baseForShip, method, cfg, code: normalizedCode
  });

  updateCartSheetTotals({ sub, discount, ship, tot }); // ★ 新增：先用暫時計算更新購物車面板

  // 後端覆蓋真正數字（以 /api）
{
    const shippingMethod = method;
    const promoCode = normalizedCode;
    api.previewTotals(q, shippingMethod, promoCode)
      .then(res => {
        const help = document.getElementById('promoMsg');
        if (help) {
          help.textContent = res.appliedCode
            ? `已套用：${res.appliedCode}（折 NT$${res.discount.toLocaleString('zh-TW')}${res.freeship ? '、免運' : ''}）`
            : (promoCode ? '此優惠碼不適用或已失效' : '');
        }
        renderTotals({
          sub: res.subtotal,
          discount: res.discount,
          ship: res.shippingFee,
          tot: res.total,
          baseForShip: (true ? res.subtotal - res.discount : res.subtotal),
          method, cfg, code: res.appliedCode || promoCode
        });
        updateCartSheetTotals({
          sub: res.subtotal,
          discount: res.discount,
          ship: res.shippingFee,
          tot: res.total
        });
      })
      .catch(err => console.warn('previewTotals failed', err));
  }


  if (typeof window.validate === 'function') window.validate();

  // 回傳暫時值（相容既有呼叫）
  return { sub, discount, subAfter, ship, tot, q, normalizedCode, message };
}




/* ===== Collapsible Cart Logic ===== */
function renderCartSheet(){
  const itemsEl = document.getElementById('cartItems');
  if (!itemsEl) return;

  const q = getQuantities();
  const cfg = CONFIG && CONFIG.PRICES ? CONFIG : DEFAULT_CONFIG;
  const pack = readPackState ? readPackState() : {};   // ← 新增：一次拿裝罐狀態

  const rows = [];
  (CONFIG.PRODUCTS || []).forEach(p => {
    const qty = Number(q[p.id] || 0);
    const pk = pack?.[p.id]; // ← 先宣告 pk
    const packTxt = (pk && pk.on && Number(pk.qty) > 0) ? `（裝盒 ${pk.qty}）` : '';
    if (!qty) return;
    const unit = p.unit ? `（${p.unit}）` : '';
    const price = Number(cfg.PRICES?.[p.id] || 0);
    const lineSub = money(qty * price);


    rows.push(`
      <div class="line-item">
        <div>
          <div class="li-title">${p.title}</div>
          <div class="li-meta">單價 ${money(price)} ${unit}</div>
        </div>
        <div class="li-sub">${lineSub}</div>
        <div></div>
        <div class="li-qty" data-id="${p.id}" style="cursor:pointer;">
        <span class="muted">數量</span>&nbsp;<b>${qty}</b>
        ${packTxt ? `<span class="muted">${packTxt}</span>` : ''}
        </div>

      </div>
    `);
  });

  itemsEl.innerHTML = rows.length
    ? rows.join('')
    : `<div class="muted" style="padding:8px 0;">尚未選購商品</div>`;
  // 合計交給 compute() → renderTotals() + updateCartSheetTotals() 一次處理
  const totalsNow = compute();
  const { sub, subAfter, discount, ship, tot } = totalsNow;

    // 原價（有折扣才顯示）
  const origRow = document.getElementById('cartSubOrigRow');
  const origEl  = document.getElementById('cartSubOrig');
  if (origRow && origEl) {
    const on = Number(discount) > 0;
    origRow.style.display = on ? 'flex' : 'none';
    if (on) origEl.textContent = money(sub);
  }

  // 折扣（有折扣才顯示；顯示為負值）
  const discRow = document.getElementById('cartDiscRow');
  const discEl  = document.getElementById('cartDisc');
  if (discRow && discEl) {
    const on = Number(discount) > 0;
    discRow.style.display = on ? 'flex' : 'none';
    if (on) discEl.textContent = '- ' + money(discount);
  }

  const peek = document.getElementById('peekSum');
  if (peek) peek.textContent = (sub>0)
    ? `小計 ${money(subAfter)}，運費 ${money(ship)}，共 ${money(tot)}`
    : '尚未選購商品';

    // 讓「數量」可點回商品位置
  itemsEl.querySelectorAll('.li-qty[data-id]').forEach(el=>{
    el.addEventListener('click', ()=>{
      const id = el.getAttribute('data-id');
      closeCartSheet();
      // 展開對應分類（利用你的 toggleGroup）
      setTimeout(()=>{
        const input = document.getElementById('q_' + id);
        if (input){
          // 找到最外層 cat-group 並展開
          const group = input.closest('.cat-panel')?.closest('.cat-group');
          if (group) toggleGroup(group, true);
          input.focus();
          input.scrollIntoView({ behavior:'smooth', block:'center' });
        }
      }, 220);
    });
  });

}


function toggleCartOpen(){
  const sheet = document.getElementById('cartSheet');
  if (!sheet) return;
  const next = sheet.dataset.open !== 'true';
  sheet.dataset.open = next ? 'true' : 'false';
  renderCartSheet();
}

if (!window.__cartHandlersBound) {
  window.__cartHandlersBound = true;

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#viewCartBtn');
    if (!btn) return;
    e.preventDefault();
    openCartSheet();
    // GA: view_cart
  try {
    const q = getQuantities();
    const items = (CONFIG.PRODUCTS || []).map(p => {
      const qty = Number(q[p.id] || 0);
      const price = Number((CONFIG.PRICES || {})[p.id] || 0);
      if (!qty) return null;
      return {
        item_id: p.id, item_name: p.title, item_brand:'祥興台灣茶',
        item_category: p.category || '', price, quantity: qty
      };
    }).filter(Boolean);
    const sub = items.reduce((s,it)=>s + (it.price||0)*(it.quantity||0), 0);
    gtag('event','view_cart',{ currency:'TWD', value: sub, items });
  } catch(_) {}

  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#cartCloseBtn')) return;
    e.preventDefault();
    closeCartSheet();
  });

  document.addEventListener('click', (e) => {
    const bd = document.getElementById('cartSheetBackdrop');
    if (bd && e.target === bd) closeCartSheet();
  });
}
// 放在全域
let __cartOpenedAt = 0;
function openCartSheet(){
  const bd = document.getElementById('cartSheetBackdrop');
  const sheet = document.getElementById('cartSheet');
  if (!bd || !sheet) return;
  if (sheet.getAttribute('data-open') === 'true' &&
      bd.getAttribute('aria-hidden') === 'false') {
  return; // 已經是開的，不再重複開
  }

  try { renderCartSheet && renderCartSheet(); } catch(_) {}

  __cartOpenedAt = performance.now();
  // 只切一個狀態：顯示背板
  bd.setAttribute('aria-hidden','false');

  // 下一幀再推動抽屜（保證 transition 有起點/終點）
  requestAnimationFrame(() => {
    sheet.setAttribute('data-open','true');
  });

  // 延後處理滾動條，避免立即 reflow 抖動
  setTimeout(() => document.body.classList.add('noscroll'), 0);
}
// 改寫「點背板關閉」的判斷：
document.addEventListener('click', (e) => {
  const bd = document.getElementById('cartSheetBackdrop');
  if (!bd) return;
  if (e.target === bd) {
    // 開啟後 250ms 內忽略背板點擊，避免「打開那一下」也被視為點背板
    if (performance.now() - __cartOpenedAt < 250) return;
    closeCartSheet();
  }
});

function closeCartSheet(){
  const bd = document.getElementById('cartSheetBackdrop');
  const sheet = document.getElementById('cartSheet');
  if (!bd || !sheet) return;

  // 先把抽屜收起（會觸發 transform/opacity 動畫）
  sheet.setAttribute('data-open','false');

  // —— 關閉完成後要做的事（抽成函式，方便多路徑呼叫）
  const done = () => {
    bd.setAttribute('aria-hidden','true');     // ← 真正關掉背板
    document.body.classList.remove('noscroll');
  };

  // 有些瀏覽器只回報 opacity、有些回報 transform；兩種都接受
  sheet.addEventListener('transitionend', function onEnd(e){
    if (e.propertyName !== 'transform' && e.propertyName !== 'opacity') return;
    sheet.removeEventListener('transitionend', onEnd);
    done();
  }, { once:true });

  // 保險：若 transitionend 沒發（例如樣式已在終態），0.4s 後強制關
  setTimeout(done, 400);
}

// === Back button integration (IIFE，放在 openCartSheet / closeCartSheet 定義之後) ===
(function integrateBackButton(){
  if (window.__cartBackIntegrated) return;   // 防止重複安裝
  window.__cartBackIntegrated = true;

  let pushed = false;

  // 先保留原本的開/關函式
  const _open  = window.openCartSheet;
  const _close = window.closeCartSheet;

  // 開啟抽屜：先執行原本邏輯，再 push 一個歷史狀態
  window.openCartSheet = function(){
    _open && _open();
    if (!pushed) {
      history.pushState({ cartOpen: true }, '', location.href);
      pushed = true;
    }
  };

  // 關閉抽屜：優先把那個歷史狀態吃掉（觸發 popstate），再真正關閉
  window.closeCartSheet = function(){
    if (pushed && history.state && history.state.cartOpen) {
      pushed = false;
      history.back();                     // 這會觸發 popstate（見下方 listener）
      // 等瀏覽器處理完 back 再執行原本關閉（確保 UI/滾動鎖一致）
      setTimeout(() => { _close && _close(); }, 0);
      return;
    }
    _close && _close();
  };

  // 使用者按 Android 返回鍵 / 或 history.back() 時，把抽屜關掉而不是整頁離開
  window.addEventListener('popstate', () => {
    const bd    = document.getElementById('cartSheetBackdrop');
    const sheet = document.getElementById('cartSheet');
    if (bd && sheet && sheet.getAttribute('data-open') === 'true') {
      pushed = false;
      sheet.setAttribute('data-open', 'false');
      bd.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('noscroll');
    }
  });
})();


// 事件：查看明細 / 收起 / 點背板空白
document.getElementById('cartCloseBtn')?.addEventListener('click', (e)=>{ e.preventDefault(); closeCartSheet(); });







// 當數量/價格/運送變動時，自動刷新 peek/清單
(function autoRefreshCartSheet(){
  const refresh = ()=> {
    const bd = document.getElementById('cartSheetBackdrop');
    if (!bd) return;
    // 不論展開/收起，更新 peek 的匯總；展開時也更新清單
    const sheet = document.getElementById('cartSheet');
    if (sheet) {
      renderCartSheet();
    }
  };
  document.addEventListener('input', refresh, true);
  document.addEventListener('change', refresh, true);
})();
 
// === Drag to close (mobile) ===
(function enableCartDrag(){
  const sheet = document.getElementById('cartSheet');
  const bd    = document.getElementById('cartSheetBackdrop');
  if (!sheet || !bd) return;

  let startY = 0, currentY = 0, dragging = false, moved = 0;

  const min = 0;
  const damp = v => v * 0.6;              // 阻尼，越往下拖越鈍
  const threshold = 80;                   // 超過就關

  const onStart = (e) => {
    if (!(e.touches && e.touches[0])) return;
    dragging = true;
    startY = e.touches[0].clientY;
    moved = 0;
    sheet.classList.add('dragging');
  };
  const onMove = (e) => {
    if (!dragging || !(e.touches && e.touches[0])) return;
    currentY = e.touches[0].clientY;
    let dy = Math.max(min, currentY - startY);
    moved = dy;
    dy = damp(dy);
    sheet.style.transform = `translate3d(0, ${dy}px, 0)`;
  };
  const onEnd = () => {
    if (!dragging) return;
    dragging = false;
    sheet.classList.remove('dragging');
    sheet.style.transform = '';  // 交回 CSS transition
    if (moved > threshold) {
      closeCartSheet();
    } else {
      // 回彈
      sheet.setAttribute('data-open','true');
    }
  };

  sheet.addEventListener('touchstart', onStart, { passive:true });
  sheet.addEventListener('touchmove',  onMove,  { passive:true });
  sheet.addEventListener('touchend',   onEnd,   { passive:true });
})();




// 綁定（動態把所有 q_*、.step 都接上）
function bind(){
  if (bind._installed) return;
  bind._installed = true;

 document.addEventListener('input', (e)=>{
   const id = e.target && e.target.id;
  if (id && id.startsWith('q_')) {
    const pid = id.replace(/^q_/, '');
    clampToStock(pid);
    syncPackUIFor(pid);   // ← 及時刷新 pack_max
    saveForm(); compute(); window.validate && window.validate();
    renderStocks();
  }
   // 既有的 pack_q_ 分支保持
 }, true);

  document.addEventListener('click', (e)=>{
    const btn = e.target && e.target.closest('.step');
    if (!btn) return;
    const target = document.getElementById(btn.dataset.for);
    if (!target) return;
    const delta = parseInt(btn.dataset.delta || '0', 10) || 0;
    target.value = Math.max(0, (parseInt(target.value || '0',10)||0) + delta);
     // 同步「最多 X 罐」
    syncPackUIFor((target.id || '').replace(/^q_/, ''));
    // 派發 input 事件給其他監聽（可選，但建議）
    target.dispatchEvent(new Event('input', { bubbles: true }));
    saveForm(); compute(); window.validate && window.validate();
    renderStocks();
    try {
      const id = (target.id || '').replace(/^q_/,'');
      const p  = (CONFIG.PRODUCTS || []).find(x => x.id === id);
      const price = Number((CONFIG.PRICES || {})[id] || 0);
      if (p && delta !== 0) {
        gtag('event', delta > 0 ? 'add_to_cart' : 'remove_from_cart', {
          currency: 'TWD',
          value: Math.abs(delta) * price,
          items: [{
            item_id: p.id, item_name: p.title, item_brand: '祥興台灣茶',
            item_category: p.category || '', price, quantity: Math.abs(delta)
          }]
        });
      }
    } catch(_) {}
  }, { passive:true });
}


  // —— 電話驗證（台灣）
  function toHalfWidthDigits(s){ return s.replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)); }
  function normalizePhoneTW(phoneRaw){
    if (!phoneRaw) return '';
    let s = String(phoneRaw).trim();
    s = toHalfWidthDigits(s).replace(/[－—–]/g, '-').replace(/[()\s]/g, '');
    if (s.startsWith('+886')) s = '0' + s.slice(4);
    return s;
  }
  function validatePhoneNumber(phoneRaw){
    const s = normalizePhoneTW(phoneRaw);
    const mobile = s.replace(/-/g, '');
    if (/^09\d{8}$/.test(mobile)) return { ok:true, normalized: mobile };
    const m = s.match(/^0(\d{1,2})-?(\d{6,8})$/);
    if (m) return { ok:true, normalized: `0${m[1]}-${m[2]}` };
    return { ok:false, normalized:s };
  }

  /* 郵遞區號推斷（3 碼） */
  (function(global){
    const ZIP_MAP = { "基隆市":{"仁愛區":"200","信義區":"201","中正區":"202","中山區":"203","安樂區":"204","暖暖區":"205","七堵區":"206"},"台北市":{"中正區":"100","大同區":"103","中山區":"104","松山區":"105","大安區":"106","萬華區":"108","信義區":"110","士林區":"111","北投區":"112","內湖區":"114","南港區":"115","文山區":"116"},"新北市":{"萬里區":"207","金山區":"208","板橋區":"220","汐止區":"221","深坑區":"222","石碇區":"223","瑞芳區":"224","平溪區":"226","雙溪區":"227","貢寮區":"228","新店區":"231","坪林區":"232","烏來區":"233","永和區":"234","中和區":"235","土城區":"236","三峽區":"237","樹林區":"238","鶯歌區":"239","三重區":"241","新莊區":"242","泰山區":"243","林口區":"244","蘆洲區":"247","五股區":"248","八里區":"249","淡水區":"251","三芝區":"252","石門區":"253"},"宜蘭縣":{"宜蘭市":"260","頭城鎮":"261","礁溪鄉":"262","壯圍鄉":"263","員山鄉":"264","羅東鎮":"265","三星鄉":"266","大同鄉":"267","五結鄉":"268","冬山鄉":"269","蘇澳鎮":"270","南澳鄉":"272","釣魚台列嶼":"290"},"新竹市":{"東區":"300","北區":"300","香山區":"300"},"新竹縣":{"竹北市":"302","湖口鄉":"303","新豐鄉":"304","新埔鎮":"305","關西鎮":"306","芎林鄉":"307","寶山鄉":"308","竹東鎮":"310","五峰鄉":"311","橫山鄉":"312","尖石鄉":"313","北埔鄉":"314","峨嵋鄉":"315"},"桃園市":{"中壢區":"320","平鎮區":"324","龍潭區":"325","楊梅區":"326","新屋區":"327","觀音區":"328","桃園區":"330","龜山區":"333","八德區":"334","大溪區":"335","復興區":"336","大園區":"337","蘆竹區":"338"},"苗栗縣":{"竹南鎮":"350","頭份市":"351","三灣鄉":"352","南庄鄉":"353","獅潭鄉":"354","後龍鎮":"356","通霄鎮":"357","苑裡鎮":"358","苗栗市":"360","造橋鄉":"361","頭屋鄉":"362","公館鄉":"363","大湖鄉":"364","泰安鄉":"365","銅鑼鄉":"366","三義鄉":"367","西湖鄉":"368","卓蘭鎮":"369"},"台中市":{"中區":"400","東區":"401","南區":"402","西區":"403","北區":"404","北屯區":"406","西屯區":"407","南屯區":"408","太平區":"411","大里區":"412","霧峰區":"413","烏日區":"414","豐原區":"420","后里區":"421","石岡區":"422","東勢區":"423","和平區":"424","新社區":"426","潭子區":"427","大雅區":"428","神岡區":"429","大肚區":"432","沙鹿區":"433","龍井區":"434","梧棲區":"435","清水區":"436","大甲區":"437","外埔區":"438","大安區":"439"},"彰化縣":{"彰化市":"500","芬園鄉":"502","花壇鄉":"503","秀水鄉":"504","鹿港鎮":"505","福興鄉":"506","線西鄉":"507","和美鎮":"508","伸港鄉":"509","員林市":"510","社頭鄉":"511","永靖鄉":"512","埔心鄉":"513","溪湖鎮":"514","大村鄉":"515","埔鹽鄉":"516","田中鎮":"520","北斗鎮":"521","田尾鄉":"522","埤頭鄉":"523","溪州鄉":"524","竹塘鄉":"525","二林鎮":"526","大城鄉":"527","芳苑鄉":"528","二水鄉":"530"},"南投縣":{"南投市":"540","中寮鄉":"541","草屯鎮":"542","國姓鄉":"544","埔里鎮":"545","仁愛鄉":"546","名間鄉":"551","集集鎮":"552","水里鄉":"553","魚池鄉":"555","信義鄉":"556","竹山鎮":"557","鹿谷鄉":"558"},"嘉義市":{"東區":"600","西區":"600"},"嘉義縣":{"番路鄉":"602","梅山鄉":"603","竹崎鄉":"604","阿里山":"605","中埔鄉":"606","大埔鄉":"607","水上鄉":"608","鹿草鄉":"611","太保市":"612","朴子市":"613","東石鄉":"614","六腳鄉":"615","新港鄉":"616","民雄鄉":"621","大林鎮":"622","溪口鄉":"623","義竹鄉":"624","布袋鎮":"625"},"雲林縣":{"斗南鎮":"630","大埤鄉":"631","虎尾鎮":"632","土庫鎮":"633","褒忠鄉":"634","東勢鄉":"635","臺西鄉":"636","崙背鄉":"637","麥寮鄉":"638","斗六市":"640","林內鄉":"643","古坑鄉":"646","莿桐鄉":"647","西螺鎮":"648","二崙鄉":"649","北港鎮":"651","水林鄉":"652","口湖鄉":"653","四湖鄉":"654","元長鄉":"655"},"台南市":{"中西區":"700","東區":"701","南區":"702","北區":"704","安平區":"708","安南區":"709","永康區":"710","歸仁區":"711","新化區":"712","左鎮區":"713","玉井區":"714","楠西區":"715","南化區":"716","仁德區":"717","關廟區":"718","龍崎區":"719","官田區":"720","麻豆區":"721","佳里區":"722","西港區":"723","七股區":"724","將軍區":"725","學甲區":"726","北門區":"727","新營區":"730","後壁區":"731","白河區":"732","東山區":"733","六甲區":"734","下營區":"735","柳營區":"736","鹽水區":"737","善化區":"741","大內區":"742","山上區":"743","新市區":"744","安定區":"745"},"高雄市":{"新興區":"800","前金區":"801","苓雅區":"802","鹽埕區":"803","鼓山區":"804","旗津區":"805","前鎮區":"806","三民區":"807","楠梓區":"811","小港區":"812","左營區":"813","仁武區":"814","大社區":"815","岡山區":"820","路竹區":"821","阿蓮區":"822","田寮鄉":"823","燕巢區":"824","橋頭區":"825","梓官區":"826","彌陀區":"827","永安區":"828","湖內鄉":"829","鳳山區":"830","大寮區":"831","林園區":"832","鳥松區":"833","大樹區":"840","旗山區":"842","美濃區":"843","六龜區":"844","內門區":"845","杉林區":"846","甲仙區":"847","桃源區":"848","那瑪夏區":"849","茂林區":"851","茄萣區":"852"},"屏東縣":{"屏東市":"900","三地門":"901","霧臺鄉":"902","瑪家鄉":"903","九如鄉":"904","里港鄉":"905","高樹鄉":"906","鹽埔鄉":"907","長治鄉":"908","麟洛鄉":"909","竹田鄉":"911","內埔鄉":"912","萬丹鄉":"913","潮州鎮":"920","泰武鄉":"921","來義鄉":"922","萬巒鄉":"923","崁頂鄉":"924","新埤鄉":"925","南州鄉":"926","林邊鄉":"927","東港鎮":"928","琉球鄉":"929","佳冬鄉":"931","新園鄉":"932","枋寮鄉":"940","枋山鄉":"941","春日鄉":"942","獅子鄉":"943","車城鄉":"944","牡丹鄉":"945","恆春鎮":"946","滿州鄉":"947"},"台東縣":{"臺東市":"950","綠島鄉":"951","蘭嶼鄉":"952","延平鄉":"953","卑南鄉":"954","鹿野鄉":"955","關山鎮":"956","海端鄉":"957","池上鄉":"958","東河鄉":"959","成功鎮":"961","長濱鄉":"962","太麻里鄉":"963","金峰鄉":"964","大武鄉":"965","達仁鄉":"966"},"花蓮縣":{"花蓮市":"970","新城鄉":"971","秀林鄉":"972","吉安鄉":"973","壽豐鄉":"974","鳳林鎮":"975","光復鄉":"976","豐濱鄉":"977","瑞穗鄉":"978","萬榮鄉":"979","玉里鎮":"981","卓溪鄉":"982","富里鄉":"983"},"金門縣":{"金沙鎮":"890","金湖鎮":"891","金寧鄉":"892","金城鎮":"893","烈嶼鄉":"894","烏坵鄉":"896"},"連江縣":{"南竿鄉":"209","北竿鄉":"210","莒光鄉":"211","東引鄉":"212"},"澎湖縣":{"馬公市":"880","西嶼鄉":"881","望安鄉":"882","七美鄉":"883","白沙鄉":"884","湖西鄉":"885"},"南海諸島":{"東沙":"817","南沙":"819"} };
    function variants(s){ return [s, s.replace(/臺/g,'台'), s.replace(/台/g,'臺')]; }
    function lookupZip(city, dist){
      for (const c of variants(city||'')){ const map = ZIP_MAP[c]; if (!map) continue;
        for (const d of variants(dist||'')){ if (map[d]) return map[d]; } }
      return '';
    }
    function inferZipFromAddress(addrRaw){
      const addr = (addrRaw||'').trim();
      const m = addr.match(/^(.*?[市縣])(.*?[區鄉鎮市])/);
      if (!m) return '';
      return lookupZip(m[1], m[2]);
    }
    global.inferZipFromAddress = inferZipFromAddress;
  })(window);

 


  // ===== 驗證 =====
  function currentShip(){ const r = document.querySelector('input[name=ship]:checked'); return r ? r.value : 'store'; }
  function validate(){
  let ok = true;

  const name = $('name').value.trim();
  const phoneRaw = $('phone').value.trim();
  const { ok: phoneOK } = validatePhoneNumber(phoneRaw);
  const consent = $('consent').checked;

  // 動態統計數量總和
  const q = getQuantities();
  const qsum = Object.values(q).reduce((a,b)=>a+(Number(b)||0),0);

  const phoneErr = $('phoneErr');
  if (!phoneOK) { phoneErr.textContent='請輸入正確的電話格式（行動：09xxxxxxxx；市話含區碼，例如 02-xxxxxxxx）'; phoneErr.style.display='block'; }
  else { phoneErr.textContent=''; phoneErr.style.display='none'; }

  if (qsum <= 0) ok = false;
  if (!name) ok = false;
  if (!phoneOK) ok = false;

  const m = currentShip();

  if (m === 'store') {
    if (!$('carrier').value) ok = false;
    if (!$('storeName').value.trim()) ok = false;
  } else if (m === 'cod') {
    const address = $('address').value.trim();
    if (!address) ok = false;
    const zip = inferZipFromAddress(address);
    $('zipCode').value = zip; $('zipDisplay').textContent = zip || '—';
  } 
  // === 裝罐檢核 ===
  (CONFIG.PRODUCTS || []).forEach(p=>{
    if (!p.packable) return;
    const buy = Number(q[p.id] || 0);
    const on  = !!(document.getElementById('pack_' + p.id)?.checked);
    const val = Number(document.getElementById('pack_q_' + p.id)?.value || 0);
    const err = document.getElementById('pack_err_' + p.id);
    const over = on && val > buy;               // 只要超過購買量就違規
    if (err) err.style.display = over ? 'block' : 'none';
    if (over) ok = false;
  });

  $('submitBtnSticky').disabled = !ok;
  return ok;
}


function readPackState(){
  const pack = {};
  (CONFIG.PRODUCTS || []).forEach(p=>{
    if (!p.packable) return;
    const on  = !!(document.getElementById('pack_' + p.id)?.checked);
    const val = Number(document.getElementById('pack_q_' + p.id)?.value || 0);
    pack[p.id] = { on, qty: val };
  });
  return pack;
}

function applyPackState(pack){
  (CONFIG.PRODUCTS || []).forEach(p=>{
    if (!p.packable) return;
    const row = document.querySelector(`.pack-row[data-for="${p.id}"]`);
    const on  = pack?.[p.id]?.on || false;
    const qty = pack?.[p.id]?.qty || 0;

    const chk  = document.getElementById('pack_' + p.id);
    const qtyI = document.getElementById('pack_q_' + p.id);
    if (chk)  chk.checked = on;
    if (qtyI) qtyI.value  = qty;
  });
  syncAllPackMax();
}
  // ===== 存取表單 =====
  function saveForm(){
  const data = {
    items: getQuantities(),
    receiver: { name: $('name').value.trim(), phone: $('phone').value.trim() },
    shipping: { method: currentShip(), carrier: $('carrier').value, storeName: $('storeName').value.trim(), address: $('address') ? $('address').value.trim() : '' },
    note: $('note').value.trim(),
    consent: $('consent').checked,
    pack: readPackState(),                 // ← 先放進來
    promoCode: ($('promoCode')?.value || '').trim(),
  };
  try { localStorage.setItem('teaOrderForm', JSON.stringify(data)); } catch (e) {}
  }

  function restoreForm(){
  try {
    const raw = localStorage.getItem('teaOrderForm'); 
    if (!raw) return;
    const d = JSON.parse(raw);

    // 動態回填 items
    if (d.items){
      (CONFIG.PRODUCTS || []).forEach(p=>{
        const el = document.getElementById('q_' + p.id);
        if (el) el.value = d.items[p.id] || 0;
      });
    }

    if (d.receiver){ $('name').value=d.receiver.name||''; $('phone').value=d.receiver.phone||''; }
    if (d.shipping){
      const m = d.shipping.method || 'store';
      document.querySelectorAll('input[name=ship]').forEach(r => r.checked = (r.value === m));
      $('carrier').value = d.shipping.carrier || '';
      $('storeName').value = d.shipping.storeName || '';
      if ($('address')) $('address').value = d.shipping.address || '';
      onShipChange();
    }
    if ($('promoCode')) $('promoCode').value = (d.promoCode || '');
    // 顯示一次計算（會同步折扣）
    compute();
    $('note').value = d.note || '';
    $('consent').checked = !!d.consent;

    // ✅ 移到 try 裡面，避免作用域錯誤
    applyPackState(d.pack);
  } catch (e) {
    // 安靜失敗即可
  }
}


document.addEventListener('change', (e) => {
  if (e.target && e.target.name === 'ship') {
    onShipChange();
  }
}, true);

  // ===== 運送切換 =====
 function onShipChange(){
  const m = currentShip();
  const show = (el, on) => { if (el) el.style.display = on ? 'block' : 'none'; };

  // 只有「超商」要顯示 storeFields，其餘（ cod）都隱藏
  show($('storeFields'), m === 'store');

  // 如果你有貨到付款就保留，沒有就把下一行改成 show($('codFields'), false)
  show($('codFields'), m === 'cod');

  // 面交不用填任何地址或店名，因此不顯示任何收件地點相關欄位
  // （上面兩個 show 已涵蓋）
  compute();
  saveForm();
  validate();
}

  // ===== Bottom Sheet =====
  function openConfirmSheet(){
  const { sub, subAfter, ship, tot, discount } = compute();   // ← 多拿 subAfter
  const q = getQuantities();

  const lines = [];
  (CONFIG.PRODUCTS || []).forEach(p=>{
    const qty = Number(q[p.id]||0);
    if (!qty) return;
    const pk = readPackState()?.[p.id];
    const extra = (pk && pk.on && Number(pk.qty)>0) ? `（裝盒 ${pk.qty}）` : '';
    lines.push(`${p.title} x${qty}（${p.unit}）${extra}`);
  });

  const method = currentShip ? currentShip() : 'store';
  const shipLabel = (method === 'cod') ? '貨到付款（宅配）' : '超商店到店取貨付款';

  $('sheetItems').innerHTML = lines.length
    ? `<div class="line"><span>商品</span><span>${lines.join('、')}</span></div>
       <div class="line"><span>運送</span><span>${shipLabel}</span></div>`
    : `<div class="muted">尚未選購商品</div>`;

  $('sheetSub').textContent  = money(subAfter);               // 用折後小計
  const discEl = $('sheetDisc');
  if (discEl) discEl.textContent = discount>0 ? `- ${money(discount)}` : '—';
  $('sheetShip').textContent = money(ship);
  $('sheetTotal').textContent = money(tot);

  document.body.classList.add('noscroll');
  $('sheetBackdrop').style.display = 'flex';
  $('sheetBackdrop').setAttribute('aria-hidden','false');
}

function closeConfirmSheet(){
  const bd = $('sheetBackdrop');
  if (bd){
    bd.style.display = 'none';
    bd.setAttribute('aria-hidden','true');
  }
  document.body.classList.remove('noscroll');
}

document.addEventListener('click', (e)=>{
  if (e.target.closest('#sheetCancel')) {
    e.preventDefault();
    closeConfirmSheet();
  }
}, true);


  // ===== 成功畫面 =====
  function resetUIAfterSuccess(){
  (CONFIG.PRODUCTS || []).forEach(p=>{
    const el = document.getElementById('q_' + p.id);
    if (el) el.value = 0;
  });
  ['name','phone','storeName','address','note'].forEach(id=>{ const el=$(id); if(el) el.value=''; });
  const shipStore = document.querySelector('input[name=ship][value="store"]'); if (shipStore) shipStore.checked = true;
  const carrier = $('carrier'); if (carrier) carrier.value='';
  const consent = $('consent'); if (consent) consent.checked=false;
  onShipChange(); compute();
  const btn = $('submitBtnSticky'); if (btn) btn.disabled = true;
  $('loadingMask').style.display = 'none';
}

/** 顯示訂單成功 modal */
function showSuccess(res) {
  // 更新內容
  $('successOrderId').textContent = res.orderId || '';
  $('successTotal').textContent = (res.total || 0).toLocaleString('zh-TW');
  $('successDetail').textContent = '感謝您的訂購。';

  // 顯示 LINE 綁定按鈕
  if (res.lineBindUrl) {
    $('lineBindBtn').href = res.lineBindUrl;
    $('lineBindBox').hidden = false;
  } else {
    $('lineBindBox').hidden = true;
  }

  // 開啟 modal
  const modal = $('successBackdrop');
  modal.setAttribute('aria-hidden', 'false');
  modal.style.display = 'flex';
  document.body.classList.add('noscroll');
  }
  /** 關閉成功 modal */
function hideSuccess() {
  const modal = $('successBackdrop');
  modal.setAttribute('aria-hidden', 'true');
  modal.style.display = 'none';
  document.body.classList.remove('noscroll');

  try { resetUIAfterSuccess(); } catch(_) {}
  try { window.setStep && window.setStep(0); } catch(_) {}
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 綁定關閉按鈕事件
$('successClose')?.addEventListener('click', hideSuccess);


// ===== 送出 =====
async function doSubmit() {
    if (!validate()) return;
  
    const totals = compute();
    const zip = inferZipFromAddress($('address') ? $('address').value.trim() : '');
    const { ok: phoneOK, normalized: phoneNorm } = validatePhoneNumber($('phone').value.trim());
    if (!phoneOK) { alert('請輸入正確的電話格式'); return; }
  
    const payload = {
      items: getQuantities(),
      receiver: { name: $('name').value.trim(), phone: phoneNorm },
      shipping: {
        method: currentShip(),
        carrier: $('carrier').value,
        storeName: $('storeName').value.trim(),
        address: $('address') ? $('address').value.trim() : '',
        zip
      },
      note: $('note').value.trim(),
      consent: $('consent').checked,
      pack: readPackState(),
      promoCode: ($('promoCode')?.value || '').trim(),
      totals: {
        sub: totals.sub, discount: totals.discount, subAfter: totals.subAfter,
        ship: totals.ship, total: totals.tot
      },
      pricingPolicy: { applyDiscountBeforeFreeShip: true }
    };
  
    $('loadingMask').style.display = 'flex';
    $('submitBtnSticky').disabled = true;
    try { localStorage.setItem('lastOrderPayload', JSON.stringify(payload)); } catch (_) {}
  
    try {
      const res = await api.submitOrder(payload);
  
      // 收尾（與原本成功流程一致）
      closeConfirmSheet?.();
      resetUIAfterSuccess?.();
  
      const safeRes = { ...res, total: (typeof res.total !== 'undefined') ? res.total : totals.tot };
      showSuccess(safeRes);
  
      // 會員上傳（改用 /api）
      try {
        const ph = payload?.receiver?.phone || '';
        if (ph) {
          const isStore = payload?.shipping?.method === 'store';
          const isCOD   = payload?.shipping?.method === 'cod';
          api.apiUpsertCustomer({
            phone: ph,
            name: payload?.receiver?.name || '',
            carrier:  isStore ? (payload?.shipping?.carrier || '')   : '',
            storeName:isStore ? (payload?.shipping?.storeName || '') : '',
            address:  isCOD   ? (payload?.shipping?.address || '')   : '',
            updatedAt: new Date().toISOString()
          }).catch(()=>{});
        }
      } catch(_) {}
  
      // 更新前端庫存顯示
      try {
        if (CONFIG && CONFIG.STOCKS){
          Object.entries(payload.items || {}).forEach(([id, qty])=>{
            const left = getStockFor(id);
            if (left !== null){
              CONFIG.STOCKS[id] = Math.max(0, left - (Number(qty)||0));
            }
          });
          renderStocks();
        }
      } catch(_) {}
  
      // GA（原封不動）
      try {
        const q = getQuantities();
        const items = (CONFIG.PRODUCTS || []).map(p => {
          const qty = Number(q[p.id] || 0);
          const price = Number((CONFIG.PRICES || {})[p.id] || 0);
          if (!qty) return null;
          return {
            item_id: p.id, item_name: p.title, item_brand: '祥興台灣茶',
            item_category: p.category || '', price, quantity: qty
          };
        }).filter(Boolean);
  
        const t = compute();
        const txId = safeRes.orderId ? String(safeRes.orderId) : 'PREVIEW-' + Date.now();
  
        gtag('event', 'purchase', {
          transaction_id: txId,
          currency: 'TWD',
          value: t.tot,
          shipping: t.ship || 0,
          coupon: window.__appliedCoupon || '',
          items
        });
      } catch (_) {}
  
    } catch (err) {
      alert('送出失敗：' + (err && err.message ? err.message : err));
    } finally {
      $('loadingMask').style.display = 'none';
      $('submitBtnSticky').disabled = false;
    }
  }
  



// ===== 重送最後訂單 =====
async function retryLastOrder() {
    try {
      const raw = localStorage.getItem('lastOrderPayload');
      if (!raw) { alert('沒有可重試的訂單'); return; }
      const payload = JSON.parse(raw);
  
      $('loadingMask').style.display = 'flex';
      $('submitBtnSticky').disabled = true;
  
      const res = await api.submitOrder(payload);
      closeConfirmSheet?.();
      resetUIAfterSuccess?.();
      $('successOrderId').textContent = res.orderId || '';
      $('successTotal').textContent = (res.total || 0).toLocaleString('zh-TW');
    } catch (err) {
      alert(`重試失敗：${(err && err.message) ? err.message : err}`);
    } finally {
      $('loadingMask').style.display = 'none';
      $('submitBtnSticky').disabled = false;
    }
  }
  


/* === Mobile Wizard：三步 + 事件委派（最後一步直接送出） === */
(() => {
  const STEPS = ['itemsCard','receiverCard','shippingCard']; // 3 步
  let stepIndex = 0;
  const $ = (id)=>document.getElementById(id);
  const isMobile = () => window.matchMedia('(max-width:1024px)').matches;

  // ---- Sticky bar 高度同步 ----
  function syncStickyPadding(){
    const bar = document.querySelector('.stickybar'); if(!bar) return;
    const h = Math.ceil(bar.getBoundingClientRect().height);
    document.documentElement.style.setProperty('--stickybar-h', h + 'px');
  }
  function installStickyPaddingSync(){
    syncStickyPadding();
    window.addEventListener('resize', syncStickyPadding);
    if (window.visualViewport) visualViewport.addEventListener('resize', syncStickyPadding);
    const barEl = document.querySelector('.stickybar');
    if (barEl && 'ResizeObserver' in window) new ResizeObserver(syncStickyPadding).observe(barEl);
  }

  /* 讓 sticky bar 釘在「可視區」底部（iOS 工具列/鍵盤縮放時不漂浮） */
  function pinStickyToVisualBottom(){
    const bar = document.querySelector('.stickybar');
    if (!bar || !window.visualViewport) return;
    const vv = window.visualViewport;
    const gap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    bar.style.transform = `translateY(${gap}px)`;
  }
  function installStickyBarPin(){
    pinStickyToVisualBottom();
    if (window.visualViewport) {
      visualViewport.addEventListener('resize', pinStickyToVisualBottom);
      visualViewport.addEventListener('scroll', pinStickyToVisualBottom);
    }
    window.addEventListener('orientationchange', pinStickyToVisualBottom);
  }

  // ---- setStep ----
  function setStep(i){
    stepIndex = Math.max(0, Math.min(i, STEPS.length - 1));
    const mobile = isMobile();

    // 手機：<= 當前步驟顯示；桌機：全展開
    STEPS.forEach((id, idx) => {
      const el = $(id); if (!el) return;
      if (mobile) el.classList.toggle('is-step-active', idx <= stepIndex);
      else        el.classList.add('is-step-active');
    });

    // 按鈕文案 / 上一步顯示
    const isLast = stepIndex >= (STEPS.length - 1);
    const prevBtn = $('stepPrev');
    const submit  = $('submitBtnSticky');
    if (prevBtn) prevBtn.style.display = (mobile && stepIndex > 0) ? 'inline-flex' : 'none';
    if (submit)  submit.textContent    = (mobile && !isLast) ? '下一步' : '送出訂單';


    

    // 平滑捲動到卡片頂（避開 sticky header）
    const isIOS = () => /iP(hone|ad|od)|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document;
    function jumpToCardTop(el){
      const header = document.querySelector('.ios-header');
      const headerH = header ? header.getBoundingClientRect().height : 0;
      const y = el.getBoundingClientRect().top + window.scrollY - headerH - 8;
      const html = document.documentElement;
      const prev = html.style.scrollBehavior;
      html.style.scrollBehavior = 'auto';
      window.scrollTo({ top: Math.max(0, y), behavior: isIOS() ? 'auto' : 'smooth' });
      html.style.scrollBehavior = prev || '';
    }

    requestAnimationFrame(() => {
    const target = document.getElementById(STEPS[stepIndex]);
    if (target) jumpToCardTop(target); // 桌機也捲動
    syncStickyPadding();
    pinStickyToVisualBottom();
  });

    // Segmented（若存在）
    document.querySelectorAll('.seg-btn').forEach((btn, idx)=>{
      btn.classList.toggle('is-active', idx === stepIndex);
      btn.setAttribute('aria-selected', idx === stepIndex ? 'true':'false');
    });

    if (typeof window.validate === 'function') window.validate();
  }

  // ---- 主按鈕 / 上一步：事件委派（避免節點被重建）----
  document.addEventListener('click', (e) => {
    // 主按鈕
    const main = e.target.closest('#submitBtnSticky');
    if (main) {
      e.preventDefault();
      const isLast = stepIndex >= (STEPS.length - 1);
      if (isMobile() && !isLast) {
        if (!main.disabled) setStep(stepIndex + 1);
      } else {
        const ok = (typeof window.validate === 'function') ? window.validate() : true;
        if (ok && typeof window.doSubmit === 'function') window.doSubmit(); // 直接送出（不開確認視窗）
      }
      // GA: begin_checkout / add_shipping_info
try {
  if (stepIndex === 1) {
    // begin_checkout
    const q = getQuantities();
    const items = (CONFIG.PRODUCTS || []).map(p => {
      const qty = Number(q[p.id] || 0);
      const price = Number((CONFIG.PRICES || {})[p.id] || 0);
      if (!qty) return null;
      return {
        item_id:p.id, item_name:p.title, item_brand:'祥興台灣茶',
        item_category:p.category||'', price, quantity:qty
      };
    }).filter(Boolean);
    const sub = items.reduce((s,it)=>s + (it.price||0)*(it.quantity||0), 0);
    gtag('event', 'begin_checkout', { currency:'TWD', value: sub, items });
  } else if (stepIndex === 2) {
    // add_shipping_info
    const method = (typeof currentShip==='function') ? currentShip() : 'store';
    gtag('event', 'add_shipping_info', {
      shipping_tier: (method==='cod') ? '宅配貨到付款' : '超商取貨付款'
    });
  }
} catch(_) {}

      return;
    }
    // 上一步
    const prev = e.target.closest('#stepPrev');
    if (prev) { e.preventDefault(); setStep(stepIndex - 1); }
  });

  // ---- Segmented Control（3 顆） ----
  function bindSegments(){
    document.querySelectorAll('.seg-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const idx = parseInt(btn.dataset.step, 10) || 0;
        setStep(idx);
      });
    });
  }

  // ---- 手機逐步驗證 wrapper（桌機跑完整驗證）----
  (function wrapStepAwareValidate(){
    if (window._wizardValidateWrapped) return;
    window._wizardValidateWrapped = true;

    const origValidate = window.validate || function(){ return true; };

    function getActiveStepIndex(){
      let idx = 0;
      for (let i=0;i<STEPS.length;i++){
        const el = $(STEPS[i]);
        if (el && el.classList.contains('is-step-active')) idx = i;
      }
      return idx;
    }

    window.validate = function(){
      const okAll = origValidate();
      const btn   = $('submitBtnSticky');

      if (!isMobile()) { if (btn) btn.disabled = !okAll; return okAll; }

      const idx = getActiveStepIndex();
      let stepOk = true;

      if (idx === 0) {
        const q = (typeof getQuantities === 'function') ? getQuantities() : {};
        stepOk = Object.values(q).some(v => (Number(v) || 0) > 0);
      } else if (idx === 1) {
        const name  = (document.getElementById('name')?.value || '').trim();
        const phone = (document.getElementById('phone')?.value || '').trim();
        const okPhone = (typeof validatePhoneNumber === 'function') ? !!validatePhoneNumber(phone).ok : !!phone;
        stepOk = !!name && okPhone;
      } else if (idx === 2) {
        // 最後一步：沿用完整驗證（含運送與同意）
        stepOk = okAll;
      }

      if (btn) btn.disabled = !stepOk;
      return stepOk;
    };

    // 欄位變動就刷新一次
    document.addEventListener('input',  () => { try{ window.validate(); }catch(_){} }, true);
    document.addEventListener('change', () => { try{ window.validate(); }catch(_){} }, true);
  })();

  // ---- 啟動 ----
  document.addEventListener('DOMContentLoaded', () => {
    const first = $('itemsCard'); if (first) first.classList.add('is-step-active');
    setStep(0);
    bindSegments();
    installStickyPaddingSync();
    installStickyBarPin();

    // RWD 切換
    window.addEventListener('resize', () => {
      if (isMobile()) {
        setStep(stepIndex);
      } else {
        // 桌機：全展開、隱藏上一步、主鍵文案
        STEPS.forEach(id => { const el = $(id); if (el) el.classList.add('is-step-active'); });
        const prevBtn = $('stepPrev'); if (prevBtn) prevBtn.style.display = 'none';
        const submit  = $('submitBtnSticky'); if (submit) submit.textContent = '送出訂單';
        if (typeof window.validate === 'function') window.validate();
        syncStickyPadding();
      }
    });
  });

  // 對外輸出（必要時可從其他程式呼叫）
  window.setStep = setStep;
})();

  /* ===== 初始化（載入設定 → 建立商品卡 → 綁手風琴/事件 → 回填 → 計算） ===== */
  (async function init(){
    try {
      const cfg = await api.getConfig();
      CONFIG = (cfg && cfg.PRODUCTS) ? cfg : DEFAULT_CONFIG;
      buildItemCards(CONFIG.PRODUCTS);
      installCategoryAccordion();
      renderPrices();
      renderStocks();
      restoreForm();
      bind();
      compute();
    } catch (e) {
      CONFIG = DEFAULT_CONFIG;
      buildItemCards(CONFIG.PRODUCTS);
      installCategoryAccordion();
      renderPrices();
      renderStocks();
      restoreForm();
      bind();
      compute();
      alert('無法載入伺服端設定（/api）。');
    }
    // Add this after your API initialization
    console.log('API initialized with GAS_EXEC:', GAS_EXEC);

    // Test the API call
    API.getConfig()
    .then(config => console.log('Config loaded:', config))
    .catch(err => console.error('Failed to load config:', err));
  })();
  

// 放在你的全域腳本裡
  const __custCache = new Map(); // phone -> { carrier, storeName, address, name }

  function primeCustomerCache(rec){
    if (!rec || !rec.phone) return;
    const key = rec.phone;
    __custCache.set(key, {
      carrier: rec.carrier || '',
      storeName: rec.storeName || '',
      address: rec.address || '',
      name: rec.name || ''
    });
    try {
      // 讓跨頁/重整也留著
      localStorage.setItem('cust:'+key, JSON.stringify(__custCache.get(key)));
    } catch(_) {}
  }

  function getCustomerFromLocal(phone){
    const key = phone;
    if (__custCache.has(key)) return __custCache.get(key);
    try{
      const raw = localStorage.getItem('cust:'+key);
      if (raw){ const obj = JSON.parse(raw); if (obj){ __custCache.set(key, obj); return obj; } }
    }catch(_){}
    return null;
  }

function calcDiscountFront(codeRaw, sub){
  const code = String(codeRaw || '').trim().toUpperCase();
  const subtotal = Math.max(0, Number(sub) || 0);

  let msg = '';
  if (!code) {
    msg = '';
  } else {
    // 占位訊息：實際折扣以後端為準
  }

  const holder = document.getElementById('promoMsg');
  if (holder) holder.textContent = msg;

  // 折扣由後端計；這裡回傳 0 並帶回正規化過的碼
  return { discount: 0, normalizedCode: code, message: msg };
}

document.addEventListener('DOMContentLoaded', ()=>{
  const btn = document.getElementById('applyPromoBtn');
  if (btn) btn.addEventListener('click', ()=>{ saveForm(); compute(); });
});
document.addEventListener('input', (e)=>{
  if (e.target && e.target.id === 'promoCode'){
    // 輸入即時儲存/重算（也可只在按鈕時重算）
    saveForm();
    compute();
  }
}, true);

/* ===== 電話帶出上次門市（整理版：相容新舊回傳 + 單一路徑 Debounce）— 改為走 /api ===== */
(function installAutoFillStoreByPhone(){
    if (window.__autoFillInstalled) return;
    window.__autoFillInstalled = true;
  
    const phoneInput = document.getElementById('phone');
    if (!phoneInput) return;
  
    let debounceTimer = null;
    let lastQueried = '';
  
    function sameNormalized(a, b){
      try{
        const norm = (v) => {
          if (typeof validatePhoneNumber === 'function') {
            const r = validatePhoneNumber(v || '');
            return (r && r.normalized) ? r.normalized : String(v || '').trim();
          }
          return String(v || '').trim();
        };
        return norm(a) === norm(b);
      }catch(_){
        return String(a || '').trim() === String(b || '').trim();
      }
    }
  
    // 將後端回傳標準化
    function normalizeCustomerResult(res){
      if (!res) return null;
  
      const normKey = k => String(k||'').trim().toLowerCase().replace(/[\s_]/g,'');
      const pick = (obj, keys) => {
        const map = {};
        Object.keys(obj||{}).forEach(raw => map[normKey(raw)] = obj[raw]);
        for (const k of keys) {
          const v = map[normKey(k)];
          if (v != null && String(v).trim() !== '') return String(v).trim();
        }
        return '';
      };
      const normCarrier = (raw='')=>{
        const s = String(raw).toLowerCase().replace(/\s|_/g,'');
        if (/^7-?11|^7eleven|統一超商/.test(s)) return '7-11';
        if (/familymart|^全家/.test(s)) return '全家';
        return '';
      };
  
      if (res.found) {
        return {
          name:      (res.name || '').toString().trim(),
          carrier:   normCarrier(res.carrier || ''),
          storeName: (res.storeName || '').toString().trim(),
          address:   (res.address || '').toString().trim(),
          method:    (res.method || '').toString().trim()
        };
      }
  
      const name      = pick(res, ['name','buyerName','收件姓名']);
      const carrier   = normCarrier(pick(res, ['default_carrier','carrier','storecarrier','store carrier','超商','超商品牌']));
      const storeName =           pick(res, ['default_store_name','storename','store_name','門市','門市店名']);
      const address   =           pick(res, ['default_address','address','codaddress','收件地址']);
      const methodRaw =           pick(res, ['default_shipping_method','shippingmethod','ShippingMethod','運送方式']);
  
      let method = '';
      if (/cod|宅配|貨到/.test((methodRaw||'').toLowerCase())) method = 'cod';
      else if (/store|超商|店到店/.test((methodRaw||'').toLowerCase())) method = 'store';
  
      if (!name && !carrier && !storeName && !address && !method) return null;
      return { name, carrier, storeName, address, method };
    }
  
    function applyCustomer(res){
      if (res.method === 'store' || (!res.method && (res.carrier || res.storeName))) {
        const r = document.querySelector('input[name=ship][value="store"]');
        if (r){ r.checked = true; onShipChange(); }
      } else if (res.method === 'cod' || (!res.method && res.address)) {
        const r = document.querySelector('input[name=ship][value="cod"]');
        if (r){ r.checked = true; onShipChange(); }
      }
  
      const nameEl = document.getElementById('name');
      if (nameEl){
        const cur = (nameEl.value||'').trim();
        if (res.name && (!cur || cur === '-' || cur === '—')) nameEl.value = res.name;
      }
  
      if (res.carrier || res.storeName){
        try {
          applyStoreSelection({ carrier: res.carrier || '', storeName: res.storeName || '' });
        } catch(_) {
          const carrierEl = document.getElementById('carrier');
          const storeEl   = document.getElementById('storeName');
          if (carrierEl && res.carrier)   carrierEl.value = res.carrier;
          if (storeEl)                    storeEl.value   = res.storeName || '';
        }
      } else if (res.address){
        const addrEl = document.getElementById('address');
        if (addrEl) addrEl.value = res.address || '';
        if (typeof inferZipFromAddress === 'function'){
          const zip = inferZipFromAddress(res.address || '');
          const zipHidden = document.getElementById('zipCode');
          const zipDisp   = document.getElementById('zipDisplay');
          if (zipHidden) zipHidden.value = zip || '';
          if (zipDisp)   zipDisp.textContent = zip || '—';
        }
      }
  
      try { saveForm(); compute(); validate(); } catch(_){}
      const btn = document.getElementById('submitBtnSticky');
      if (btn){ btn.classList.add('pulse-once'); setTimeout(()=>btn.classList.remove('pulse-once'), 800); }
    }
  
    async function tryFetchAndApply(){
      const raw = phoneInput.value || '';
      const chk = (typeof validatePhoneNumber === 'function')
        ? validatePhoneNumber(raw)
        : { ok: !!raw, normalized: raw };
  
      if (!chk.ok) return;
      if (sameNormalized(chk.normalized, lastQueried)) return;
  
      // 1) 先查本機快取
      try {
        const cached = getCustomerFromLocal && getCustomerFromLocal(chk.normalized);
        if (cached){
          applyCustomer(cached);
  
          // 背景刷新（不影響 UI）
          try {
            if (window.api?.apiGetCustomerByPhone) {
              window.api.apiGetCustomerByPhone(chk.normalized).catch(()=>{});
            }
          } catch(_) {}
  
          lastQueried = chk.normalized;
          return;
        }
      } catch(_) {}
  
      // 2) 沒快取 → 打 /api
      lastQueried = chk.normalized;
      try {
        if (!window.api?.apiGetCustomerByPhone) {
          console.info('前端沒有 api 客戶端（/api），略過查詢。');
          return;
        }
        const res = await window.api.apiGetCustomerByPhone(chk.normalized);
        const shaped = normalizeCustomerResult(res);
        console.debug('[apiGetCustomerByPhone] raw:', res, '→ shaped:', shaped);
        if (!shaped) return;
  
        try {
          primeCustomerCache && primeCustomerCache({
            phone: chk.normalized,
            name:      shaped.name || '',
            carrier:   shaped.carrier || '',
            storeName: shaped.storeName || '',
            address:   shaped.address || ''
          });
        } catch(_) {}
  
        applyCustomer(shaped);
      } catch (err) {
        console.warn('查詢 Customer 失敗：', err && err.message ? err.message : err);
      }
    }
  
    const DEBOUNCE_MS = 350;
    function schedule(){
      clearTimeout(debounceTimer);
      const raw = phoneInput.value || '';
      const chk = (typeof validatePhoneNumber === 'function') ? validatePhoneNumber(raw) : { ok:false };
      if (!chk.ok) return;
      debounceTimer = setTimeout(tryFetchAndApply, DEBOUNCE_MS);
    }
  
    phoneInput.addEventListener('input',  schedule, { passive:true });
    phoneInput.addEventListener('change', schedule, { passive:true });
    phoneInput.addEventListener('blur',   () => { clearTimeout(debounceTimer); tryFetchAndApply(); }, { passive:true });
  
    document.addEventListener('change', (e)=>{
      if (e.target && e.target.name === 'ship' && (phoneInput.value||'').trim()){
        tryFetchAndApply();
      }
    }, true);
  
    setTimeout(()=>{ if (phoneInput.value) tryFetchAndApply(); }, 300);
    window.addEventListener('pageshow', ()=>{ if (phoneInput.value) tryFetchAndApply(); });
  })();
  
// === 依你的表單欄位名稱，這裡回填 ===
function applyStoreSelection(data){
  const carrierEl = document.getElementById('carrier');
  const storeEl   = document.getElementById('storeName');
  const addrEl    = document.getElementById('address');  // COD
  const pidEl     = document.getElementById('placeId');  // 若有隱藏欄位
  const latEl     = document.getElementById('lat');
  const lngEl     = document.getElementById('lng');

  const carrier = data.carrier || guessCarrier(data.name || data.storeName || '');

  if (carrierEl) carrierEl.value = carrier;
  if (storeEl)   storeEl.value   = data.name || data.storeName || '';
  if (addrEl)    addrEl.value    = data.address || '';
  if (pidEl)     pidEl.value     = data.place_id || data.placeId || '';
  if (latEl)     latEl.value     = (data.lat ?? '');
  if (lngEl)     lngEl.value     = (data.lng ?? '');

  try { compute(); } catch(_) {}
  try { saveForm(); validate(); } catch(_){}
}

function guessCarrier(name=''){
  const n = String(name).toLowerCase();
  if (n.includes('7-11') || n.includes('7-eleven') || n.includes('7 11')) return '7-11';
  if (n.includes('全家') || n.includes('family')) return '全家';
  return '';
}



// ================= Inline Store Picker（最終版） =================

// A) 事件委派：按下「查看附近便利商店」→ 開啟選擇器
document.addEventListener('click', (e)=>{
  const btn = e.target.closest('#openStoreBtn');
  if (!btn) return;

  e.preventDefault();

  // 顯示小沙漏
  btn.setAttribute('aria-busy','true');
  const spin = btn.querySelector('.btn-spin');
  if (spin) spin.style.display = 'inline-block';

  // 依下拉選單偏好品牌
  const prefer = (document.getElementById('carrier')?.value || 'all'); // '7-11' / 'familymart' / 'all'

  // 呼叫內部實作的 picker
  openStorePickerInline({
    autoNearby: true,         // 開啟就嘗試定位
    preferBrand: prefer,
    onOpen: () => {           // 視窗一開就還原按鈕
      btn.removeAttribute('aria-busy');
      if (spin) spin.style.display = 'none';
    },
    onPicked: (store) => {    // 使用者點選某門市
      try { applyStoreSelection(store); } catch(_) {}
    }
  });
}, { passive:true });


// B) Picker 模組（IIFE）：包含 UI 控制 / 搜尋 / 對外開啟函式
(function(){
  const $ = s => document.querySelector(s);

  // ---- DOM ----
  const root     = $('#store-picker');
  const sheet    = root?.querySelector('.sp-sheet');
  const back     = root?.querySelector('.sp-backdrop');
  const list     = $('#sp-results');
  const qInput   = $('#sp-q');
  const btnGo    = $('#sp-search-btn');
  const nearBtn  = $('#sp-nearby');
  const brandSel = $('#sp-brand');

  // ---- 地圖狀態（新增）----
  let _map = null;
  let _markersLayer = null;
  let _userMarker = null;

  function ensureMap(){
    if (_map) return _map;
    const el = document.getElementById('sp-map');
    if (!el) return null;

    // 基本底圖
    _map = L.map(el, { zoomControl: true, scrollWheelZoom: true });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 20,
    attribution: '&copy; OpenStreetMap, &copy; CARTO'
  }).addTo(_map);

    _markersLayer = L.layerGroup().addTo(_map);

    // 初始視角（台灣中點）
    _map.setView([23.7, 121], 6);

    return _map;
  }

  function setUserLocationOnMap(lat, lng){
    const m = ensureMap();
    if (!m || !Number.isFinite(lat) || !Number.isFinite(lng)) return;

    if (_userMarker) { _userMarker.setLatLng([lat, lng]); }
    else {
      _userMarker = L.circleMarker([lat, lng], { radius: 7, weight: 2, color: '#2a81ea' }).addTo(m);
      _userMarker.bindTooltip('你的位置', {permanent:false, direction:'top'});
    }
  }

  // 計算兩點距離（公尺）— 當後端沒給 distance_m 時用
  function haversine(lat1, lon1, lat2, lon2){
    const R = 6371000;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat/2)**2 +
              Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  function updateMap(rowsToShow){
    const m = ensureMap();
    if (!m || !_markersLayer) return;

    _markersLayer.clearLayers();

    const bounds = [];
    // 使用者位置
    if (_userPos && Number.isFinite(_userPos.lat) && Number.isFinite(_userPos.lng)){
      setUserLocationOnMap(_userPos.lat, _userPos.lng);
      bounds.push([_userPos.lat, _userPos.lng]);
    }

    // 列表門市
    (rowsToShow || []).forEach(r=>{
      const lat = Number(r.lat), lng = Number(r.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const marker = L.marker([lat, lng]).addTo(_markersLayer);
      marker.bindPopup(`<b>${escapeHTML(r.name || '')}</b><br>${escapeHTML(r.formatted_address || r.address || '')}`);

      // 給清單互動用
      r.__marker = marker;
      bounds.push([lat, lng]);
    });

    // 視窗自動框到所有點
    if (bounds.length){
      m.fitBounds(bounds, { padding: [24, 24] });
    }
  }

  // ---- 狀態 ----
  let _onPicked = null;
  let _onOpen   = null;
  let _expanded = false;   // 是否展開全部
  let _userPos  = null;    // { lat, lng }

  // ---- 小工具 ----
  function setOpenBtnBusy(on){
    const btn = document.getElementById('openStoreBtn');
    if (!btn) return;
    if (on) btn.setAttribute('aria-busy','true'); else btn.removeAttribute('aria-busy');
    const spin = btn.querySelector('.btn-spin');
    if (spin) spin.style.display = on ? 'inline-block' : 'none';
  }

  function uiBusy(on, hint=''){
    if (btnGo)   btnGo.disabled   = !!on;
    if (nearBtn) nearBtn.disabled = !!on;
    sheet?.classList.toggle('sp-busy', !!on);
    if (on && hint) list.innerHTML = `<div style="padding:12px;color:#666">${hint}</div>`;
  }

  function escapeHTML(s){
    return String(s||'').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
  }

  function closePicker(){
    root?.setAttribute('aria-hidden','true');
    setOpenBtnBusy(false);
    try { if (history.state?.view === 'store-picker') history.back(); } catch(_) {}
  }

  // ---- 對外：開啟選擇器（必須在 IIFE 內，才能存取上面變數/函式）----
  window.openStorePickerInline = function({ onPicked, onOpen, autoNearby=false, preferBrand='all' } = {}){
    _onPicked = (typeof onPicked === 'function') ? onPicked : null;
    _onOpen   = (typeof onOpen   === 'function') ? onOpen   : null;
    _expanded = false;

    if (!root){
      try { _onOpen && _onOpen(); } catch(_) {}
      alert('門市選擇器 DOM (#store-picker) 未載入');
      return;
    }

    // 將品牌偏好帶入下拉（'7-11' / 'familymart' / 'all'）
    if (brandSel) {
      const v = (preferBrand === '7-11' || preferBrand === 'familymart') ? preferBrand : 'all';
      brandSel.value = v;
    }

    // 開窗
    root.setAttribute('aria-hidden','false');
    list.innerHTML = '<div style="padding:12px;color:#666">載入中…</div>';

    // 通知外層：視窗已開（還原按鈕 loading）
    try { _onOpen && _onOpen(); } catch(_) {}

    // pushState：返回鍵可關閉
    try { history.pushState({view:'store-picker'}, '', location.href); } catch(_) {}

    // 自動就近
    if (autoNearby && navigator.geolocation){
      uiBusy(true,'正在取得定位…');
      navigator.geolocation.getCurrentPosition(pos=>{
        const { latitude:lat, longitude:lng } = pos.coords || {};
        _userPos = { lat, lng };
        uiBusy(true,'正在找附近門市…');
        const brand = brandSel?.value || 'all';
        searchServer({ lat, lng, brand });
      }, _=>{
        uiBusy(false);
        list.innerHTML = '<div style="padding:12px;color:#666">無法取得定位，請輸入地址／地標搜尋</div>';
        qInput?.focus();
      }, { timeout:8000, enableHighAccuracy:true, maximumAge:60000 });
    } else {
      uiBusy(false);
      list.innerHTML = '<div style="padding:12px;color:#666">請輸入地址／地標後搜尋，或點「附近門市」</div>';
      qInput?.focus();
    }
  };

  // ---- 文本搜尋 ----
  function doTextSearch(){
    const query = (qInput?.value || '').trim();
    if (!query){
      list.innerHTML = '<div style="padding:12px;color:#666">請輸入地址／地標關鍵字</div>';
      return;
    }
    uiBusy(true,'搜尋中…');
    searchServer({ query, brand: brandSel?.value || 'all' });
  }
  btnGo?.addEventListener('click', doTextSearch);
  qInput?.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); doTextSearch(); }});
  nearBtn?.addEventListener('click', ()=>{
    if (!navigator.geolocation) return alert('此裝置不支援定位');
    uiBusy(true,'正在取得定位…');
    navigator.geolocation.getCurrentPosition(pos=>{
      _userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      uiBusy(true,'正在找附近門市…');
      searchServer({ lat:_userPos.lat, lng:_userPos.lng, brand: brandSel?.value || 'all' });
    }, err=>{ uiBusy(false); alert('定位失敗：' + (err?.message || '')); }, { timeout:8000 });
  });

  // ---- 後端搜尋（Apps Script）----
  api.searchStores(payload)
  .then(res => {
    uiBusy(false);
    setOpenBtnBusy(false);
    const rows = (res && res.ok && Array.isArray(res.results)) ? res.results : (res.results || []);
    renderResults(rows);
  })
  .catch(err => {
    uiBusy(false);
    setOpenBtnBusy(false);
    console.error(err);
    renderResults([]);
    alert('搜尋失敗，請稍後再試');
  });


  // ---- 渲染結果 ----
    function renderResults(rows){
    list.innerHTML = '';
    const all = Array.isArray(rows) ? rows.slice() : [];

    // 若後端沒提供 distance_m，且已知使用者位置，則自行計算
    if (_userPos && Number.isFinite(_userPos.lat) && Number.isFinite(_userPos.lng)){
      all.forEach(r=>{
        if (!Number.isFinite(r.distance_m) && Number.isFinite(r.lat) && Number.isFinite(r.lng)){
          r.distance_m = Math.round(haversine(_userPos.lat, _userPos.lng, r.lat, r.lng));
        }
      });
    }

    // 由近到遠：優先用 distance_m；沒有就維持原順序（Infinity 排後面）
    all.sort((a,b)=>{
      const da = Number.isFinite(a.distance_m) ? a.distance_m : Infinity;
      const db = Number.isFinite(b.distance_m) ? b.distance_m : Infinity;
      return da - db;
    });

    const MAX = 5;
    const show = _expanded ? all : all.slice(0, MAX);

    if (!show.length){
      list.innerHTML = '<div style="padding:12px;color:#666">找不到符合的門市</div>';
      // 地圖也清空
      updateMap([]);
      return;
    }

    // 更新地圖（顯示 show 範圍即可，避免標記太多）
    updateMap(show);

    show.forEach(r=>{
      const item = document.createElement('div');
      item.className = 'sp-item';
      item.setAttribute('role','option');
      item.tabIndex = 0;

      const metaBits = [];
      if (r.address || r.formatted_address) metaBits.push(escapeHTML(r.address || r.formatted_address));
      if (Number.isFinite(r.distance_m))     metaBits.push(`${Math.round(r.distance_m)} m`);

      item.innerHTML = `
        <div class="sp-name">${escapeHTML(r.name || '')}</div>
        <div class="sp-meta">${metaBits.join(' · ')}</div>
      `;

      const pick = ()=>{
        const payload = {
          carrier: guessCarrier(r.name || ''),
          name: r.name || '',
          address: r.formatted_address || r.address || '',
          place_id: r.place_id || '',
          lat: r.lat, lng: r.lng
        };
        try { _onPicked && _onPicked(payload); } catch(_) {}
        try { applyStoreSelection(payload); } catch(_) {}
        // 地圖上也彈出該標記
        try { r.__marker && r.__marker.openPopup(); } catch(_) {}
        closePicker();
        try { window.scrollTo({ top:0, behavior:'smooth' }); } catch(_) {}
      };

      // 點清單 → 飛到該標記
      item.addEventListener('mouseenter', ()=>{
        try {
          if (r.__marker && _map) { _map.panTo(r.__marker.getLatLng(), { animate:true, duration:.3 }); }
        } catch(_) {}
      });
      item.addEventListener('click', pick);
      item.addEventListener('keydown', e=>{ if (e.key==='Enter' || e.key===' '){ e.preventDefault(); pick(); }});
      list.appendChild(item);
    });

    if (!_expanded && all.length > MAX){
      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'sp-cancel';
      more.textContent = `顯示更多（還有 ${all.length - MAX} 間）`;
      more.addEventListener('click', ()=>{ _expanded = true; renderResults(all); });
      list.appendChild(more);
    }
  }


  // ---- 關閉（背板 / 取消）----
  back?.addEventListener('click', e=>{ if (e.target === back) closePicker(); });
  root?.querySelectorAll('[data-sp-close]').forEach(btn=>{
    btn.addEventListener('click', closePicker);
  });
})();

(function () {
  // 確保有唯一的 viewport meta
  let vp = document.querySelector('meta[name="viewport"]');
  if (!vp) {
    vp = document.createElement('meta');
    vp.name = 'viewport';
    document.head.appendChild(vp);
  }
  // 基本內容（要有 width=device-width）
  const BASE = 'width=device-width, initial-scale=1, viewport-fit=cover';
  const LOCK = BASE + ', maximum-scale=1'; // 聚焦期間鎖縮放

  // 目標元素：所有可輸入欄位
  const sel = 'input[type="text"],input[type="tel"],input[type="number"],input[type="email"],textarea,select';

  function lockZoom(){ vp.setAttribute('content', LOCK); }
  function unlockZoom(){ vp.setAttribute('content', BASE); }

  // 事件委派：focus/blur 切換
  document.addEventListener('focusin', e => {
    if (e.target.matches(sel)) lockZoom();
  });
  document.addEventListener('focusout', e => {
    if (e.target.matches(sel)) unlockZoom();
  });

  // 初始化：先恢復正常
  vp.setAttribute('content', BASE);
})();


  
  /* ===================== 3) 小 Bug 修補（已套用最小變更） ===================== */
  /* 在你檔內的 renderCartSheet() 末段，補抓 totals（避免未宣告變數）：
     若你已經照我先前回覆改過，就可忽略這段說明。這裡給參考實作範例： */
  (function patchRenderCartSheetIfNeeded(){
    if (typeof window.renderCartSheet !== 'function') return;
    const orig = window.renderCartSheet;
    window.renderCartSheet = function(){
      orig();
      // 若頁面上存在 cart 項目，且全域沒有 discount/sub 之類，就重新取一次 totals
      try {
        const itemsEl = document.getElementById('cartItems');
        if (!itemsEl) return;
        // 若變數不存在（舊版寫法），就從 compute() 取
        if (typeof discount === 'undefined' || typeof sub === 'undefined') {
          const t = (typeof compute === 'function') ? compute() : null;
          if (!t) return;
          // 用 updateCartSheetTotals 同步畫面（你的程式已有）
          if (typeof updateCartSheetTotals === 'function') {
            updateCartSheetTotals({ sub: t.sub, discount: t.discount, ship: t.ship, tot: t.tot });
          }
        }
      } catch(_) {}
    };
  })();
  