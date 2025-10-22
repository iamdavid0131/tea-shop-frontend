// Main application entry point
document.addEventListener('DOMContentLoaded', function() {
  // Initialize the application
  initApp();
});

/**
 * Initialize the application
 */
async function initApp() {
  // Initialize Google Analytics
  initGoogleAnalytics();
  
  // Initialize event listeners
  initEventListeners();
  
  // Check for promo code in URL
  checkForPromoCode();
}

/**
 * Initialize Google Analytics
 */
function initGoogleAnalytics() {
  window.dataLayer = window.dataLayer || [];
  function gtag(){ dataLayer.push(arguments); }
  gtag('js', new Date());
  gtag('config', 'G-4QY9T0ZJS3', {
    send_page_view: true,
    debug_mode: location.search.includes('ga_debug=1')
  });
}

/**
 * Initialize event listeners
 */
function initEventListeners() {
  // Add your event listeners here
  // Example:
  // document.getElementById('someButton').addEventListener('click', handleButtonClick);
}

/**
 * Check for promo code in URL and apply it
 */
function checkForPromoCode() {
  // 1) HtmlService 正式環境：用 getLocation 拿 URL 參數
  if (google && google.script && google.script.url && google.script.url.getLocation) {
    google.script.url.getLocation(function (loc) {
      const promo = (loc.parameter && (loc.parameter.promoCode || loc.parameter.promo)) ? 
                   String(loc.parameter.promoCode || loc.parameter.promo).toUpperCase() : '';
      applyPromoToInput(promo);
    });
  } else {
    // 2) 本地/純靜態測試：退回用 location.search
    const qs = new URLSearchParams(location.search || '');
    const promo = ((qs.get('promoCode') || qs.get('promo') || '') + '').toUpperCase();
    applyPromoToInput(promo);
  }
}

/**
 * Apply promo code to input field
 * @param {string} promo - The promo code to apply
 */
function applyPromoToInput(promo) {
  if (!promo) return;
  
  const input = document.querySelector('#promoCode');
  if (input) {
    input.value = promo;
    input.dispatchEvent(new Event('input')); // Trigger input event for validation
  }
  
  // 若你沒有即時驗證→可呼叫後端預覽覆寫金額（可留可拿掉）
  if (google?.script?.run && typeof window.recalcTotals === 'function') {
    google.script.run
      .withSuccessHandler(window.recalcTotals)
      .applyPromoCodeFromClient(promo);
  }
}

// Export functions for use in other modules
window.testQuote = async function() {
  try {
    const data = await api('quote', {
      items: [
        { sku: 'OOLONG100', qty: 2, unitPrice: 350 },
        { sku: 'BLACK50', qty: 1, unitPrice: 180 }
      ],
      promo: { type: 'percent', value: 10, code: 'SALE10' },
      shipping: '711' // 711 | fmart | cod
    });
    console.log('Quote:', data.quote);
    alert(`小計：${data.quote.subtotal}，折扣：${data.quote.discount}，運費：${data.quote.shipping}，總計：${data.quote.total}`);
  } catch (e) {
    alert('試算失敗：' + e.message);
  }
};

window.submitOrder = async function() {
  try {
    const data = await api('submitOrder', {
      name: '王小明',
      phone: '0912-345-678',
      email: 'a@b.c',
      items: [{ sku: 'OOLONG100', qty: 2, unitPrice: 350 }],
      promo: null,
      shipping: 'cod'
    });
    console.log('Order:', data);
    alert('下單成功，訂單編號：' + data.orderId);
  } catch (e) {
    alert('下單失敗：' + e.message);
  }
};

/**
 * Generic API call function
 * @param {string} action - The API action to call
 * @param {Object} payload - The data to send
 * @returns {Promise<Object>} - The API response
 */
async function api(action, payload = {}) {
  try {
    const response = await fetch(`/api/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
}

// Initialize any global functions that might be called from HTML
window.applyPromoCodeFromClient = function(promoCode) {
  // This function can be called from Google Apps Script
  console.log('Applying promo code:', promoCode);
  // Add your promo code application logic here
};
