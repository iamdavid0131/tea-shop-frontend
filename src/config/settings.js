/**
 * Application configuration settings
 */

export const APP_CONFIG = {
  // Application metadata
  appName: '茶葉專賣店',
  appDescription: '精選台灣高山茶葉，品質保證，新鮮直送',
  
  // API Configuration
  api: {
    baseUrl: process.env.VITE_API_BASE_URL || '/api',
    endpoints: {
      quote: '/quote',
      order: '/submitOrder',
      products: '/products',
      validatePromo: '/validate-promo'
    },
    timeout: 30000, // 30 seconds
    retryAttempts: 3
  },
  
  // Google Analytics
  ga: {
    trackingId: 'G-4QY9T0ZJS3',
    debug: process.env.NODE_ENV === 'development'
  },
  
  // Shipping options
  shippingOptions: [
    { id: '711', name: '7-11 超商取貨', price: 60 },
    { id: 'fami', name: '全家超商取貨', price: 60 },
    { id: 'home', name: '宅配', price: 100 },
    { id: 'cod', name: '貨到付款', price: 100 }
  ],
  
  // Payment methods
  paymentMethods: [
    { id: 'credit_card', name: '信用卡/簽帳金融卡' },
    { id: 'atm', name: 'ATM 轉帳' },
    { id: 'cvs', name: '超商代碼' },
    { id: 'cod', name: '貨到付款' }
  ],
  
  // Promo codes (for demo purposes, in production this should be server-side)
  promoCodes: [
    { 
      code: 'WELCOME10', 
      type: 'percent', 
      value: 10, 
      description: '新客專屬9折優惠',
      minPurchase: 1000,
      validUntil: '2025-12-31'
    },
    { 
      code: 'FREESHIP', 
      type: 'shipping', 
      value: 0, 
      description: '免運費優惠',
      minPurchase: 1000,
      validUntil: '2025-06-30'
    }
  ],
  
  // UI Settings
  ui: {
    currency: 'TWD',
    currencySymbol: 'NT$',
    dateFormat: 'YYYY/MM/DD',
    timeFormat: 'HH:mm',
    itemsPerPage: 10,
    maxQuantity: 10,
    defaultImage: '/images/placeholder-tea.jpg',
    breakpoints: {
      mobile: 480,
      tablet: 768,
      desktop: 1024,
      wide: 1280
    }
  },
  
  // Feature flags
  features: {
    enableReviews: true,
    enableWishlist: true,
    enablePromoCodes: true,
    enableGiftWrapping: true
  },
  
  // Social media links
  social: {
    facebook: 'https://facebook.com/teashop',
    instagram: 'https://instagram.com/teashop',
    line: 'https://line.me/R/ti/p/@teashop',
    youtube: 'https://youtube.com/teashop'
  },
  
  // Contact information
  contact: {
    email: 'service@teashop.com',
    phone: '02-1234-5678',
    address: '106 台北市大安區信義路四段1號',
    businessHours: '週一至週五 10:00-18:00',
    customerServiceHours: '週一至週五 09:00-18:00'
  },
  
  // Legal information
  legal: {
    termsOfService: '/terms',
    privacyPolicy: '/privacy',
    returnPolicy: '/returns',
    shippingPolicy: '/shipping'
  }
};

/**
 * Get a configuration value by dot notation
 * @param {string} path - Path to the config value (e.g., 'api.timeout')
 * @param {*} defaultValue - Default value if not found
 * @returns {*} The config value or default
 */
export function getConfig(path, defaultValue = null) {
  const keys = path.split('.');
  let result = APP_CONFIG;
  
  for (const key of keys) {
    if (result === null || typeof result !== 'object' || !(key in result)) {
      return defaultValue;
    }
    result = result[key];
  }
  
  return result !== undefined ? result : defaultValue;
}

// Export as default for easier importing
export default APP_CONFIG;
