// assets/app.api.js
// 從 meta 標籤或全域變數取得 GAS 執行網址
const GAS_EXEC = 
  window.GAS_EXEC_URL ||
  document.querySelector('meta[name="gas-exec"]')?.content ||
  '';

// 封裝 GAS 呼叫
async function call(fn, params = {}) {
  if (!GAS_EXEC) {
    throw new Error('GAS 執行網址未設定，請檢查 meta[name="gas-exec"] 或 window.GAS_EXEC_URL');
  }

  // 構建查詢參數
  const queryParams = new URLSearchParams();
  queryParams.append('fn', fn);
  
  // 根據不同的 API 端點處理參數
  if (fn === 'previewTotals') {
    queryParams.append('items', JSON.stringify(params.items || {}));
    queryParams.append('method', params.shippingMethod || 'store');
    queryParams.append('promo', params.promoCode || '');
  } else if (fn === 'submitOrder' || fn === 'searchStores' || fn === 'apiUpsertCustomer') {
    queryParams.append('p', JSON.stringify(params));
  } else if (fn === 'apiGetCustomerByPhone') {
    queryParams.append('phone', params.phone || '');
  }
  
  // 添加時間戳防止緩存
  queryParams.append('_', Date.now());
  
  const url = `${GAS_EXEC}?${queryParams.toString()}`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      // 重要：避免發送 cookies 等敏感資訊
      credentials: 'omit',
      // 可選：設定請求超時
      // signal: AbortSignal.timeout ? AbortSignal.timeout(10000) : null
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText || 'Unknown error'}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`API call to ${fn} failed:`, error);
    throw error;
  }
}

// 導出 API 方法
export const api = {
  // 取得設定
  async getConfig() {
    const res = await call('getConfig');
    // 統一處理回應格式
    const data = res.ok === false ? {} : res; // 如果回傳 { ok: false, error: ... } 則使用空物件
    
    return {
      PRICES: data.PRICES || {},
      PRODUCTS: data.PRODUCTS || [],
      FREE_SHIPPING_THRESHOLD: data.FREE_SHIPPING_THRESHOLD ?? 1000,
      BASE_SHIPPING_FEE: data.BASE_SHIPPING_FEE ?? 60,
      COD_SHIP_FEE: data.COD_SHIP_FEE ?? 100,
      COD_FREE_SHIPPING_THRESHOLD: data.COD_FREE_SHIPPING_THRESHOLD ?? 2000,
      STOCKS: data.STOCKS || {}
    };
  },
  
  // 計算總金額
  async previewTotals(items, shippingMethod, promoCode) {
    const res = await call('previewTotals', { 
      items, 
      shippingMethod, 
      promoCode 
    });
    
    // 如果回傳格式是 { ok: true, data: {...} }
    if (res && typeof res === 'object' && 'data' in res) {
      return res.ok ? res.data : Promise.reject(res.error || 'Unknown error');
    }
    
    // 直接回傳結果
    return res;
  },
  
  // 提交訂單
  async submitOrder(payload) {
    const res = await call('submitOrder', payload);
    
    // 處理錯誤情況
    if (res && res.ok === false) {
      throw new Error(res.error || '提交訂單失敗');
    }
    
    return res;
  },
  
  // 搜尋超商
  async searchStores(params) {
    const res = await call('searchStores', params);
    
    // 統一回傳格式
    if (res && Array.isArray(res)) {
      return { ok: true, results: res };
    }
    
    return res.ok === false ? Promise.reject(res.error) : res;
  },
  
  // 取得顧客資料
  async apiGetCustomerByPhone(phone) {
    if (!phone) throw new Error('電話號碼不能為空');
    const res = await call('apiGetCustomerByPhone', { phone });
    
    // 處理錯誤情況
    if (res && res.ok === false) {
      // 如果沒有找到顧客，回傳 null 而不是拋出錯誤
      if (res.error && res.error.includes('not found')) {
        return null;
      }
      throw new Error(res.error || '取得顧客資料失敗');
    }
    
    return res;
  },
  
  // 更新或新增顧客
  async apiUpsertCustomer(customerData) {
    if (!customerData) throw new Error('顧客資料不能為空');
    
    const res = await call('apiUpsertCustomer', customerData);
    
    // 處理錯誤情況
    if (res && res.ok === false) {
      throw new Error(res.error || '儲存顧客資料失敗');
    }
    
    return res;
  }
};
