/**
 * Tea products data
 * Categories:
 * - Jasmine (茉莉)
 * - High Mountain (高山)
 * - Wenshan (文山)
 * - Roasted (焙香)
 * - Black Tea (紅茶)
 * - White Tea (白茶)
 * - Honey Aroma (蜜香)
 * - Add-ons (加購)
 */

export const teaProducts = [
  {
    id: 'jasmine-pearl',
    name: '茉莉香片',
    category: 'Jasmine',
    variants: [
      { id: 'jp-50g', weight: '50g', price: 350, stock: 100 },
      { id: 'jp-100g', weight: '100g', price: 650, stock: 75 },
      { id: 'jp-teabag-10', weight: '茶包10入', price: 280, stock: 50 }
    ],
    description: '精選茉莉花與綠茶完美融合，香氣清新持久。',
    origin: '台灣南投',
    flavor: '花香、清甜',
    brewTemp: '85°C',
    brewTime: '2-3分鐘',
    tags: ['熱銷', '新手推薦'],
    rating: 4.8,
    reviews: 124,
    image: '/images/teas/jasmine-pearl.jpg',
    featured: true
  },
  {
    id: 'alishan',
    name: '阿里山高山茶',
    category: 'High Mountain',
    variants: [
      { id: 'al-75g', weight: '75g', price: 600, stock: 60 },
      { id: 'al-150g', weight: '150g', price: 1100, stock: 45 },
      { id: 'al-teabag-5', weight: '茶包5入', price: 250, stock: 30 }
    ],
    description: '來自阿里山高海拔茶園，茶湯金黃透亮，喉韻甘醇。',
    origin: '台灣嘉義',
    flavor: '果香、甘甜',
    brewTemp: '90°C',
    brewTime: '1-2分鐘',
    tags: ['得獎茶', '限量'],
    rating: 4.9,
    reviews: 98,
    image: '/images/teas/alishan.jpg',
    featured: true
  },
  {
    id: 'dong-ding',
    name: '凍頂烏龍',
    category: 'Wenshan',
    variants: [
      { id: 'dd-75g', weight: '75g', price: 450, stock: 80 },
      { id: 'dd-150g', weight: '150g', price: 850, stock: 60 }
    ],
    description: '傳統炭焙工藝，茶湯琥珀色，帶有獨特炭焙香氣。',
    origin: '台灣南投',
    flavor: '炭焙香、醇厚',
    brewTemp: '95°C',
    brewTime: '1-1.5分鐘',
    tags: ['傳統工藝', '老饕首選'],
    rating: 4.7,
    reviews: 156,
    image: '/images/teas/dongding.jpg'
  },
  {
    id: 'oriental-beauty',
    name: '東方美人茶',
    category: 'Honey Aroma',
    variants: [
      { id: 'ob-50g', weight: '50g', price: 550, stock: 40 },
      { id: 'ob-100g', weight: '100g', price: 1000, stock: 30 }
    ],
    description: '小綠葉蟬著涎的茶菁製作，帶有獨特蜜香果香。',
    origin: '台灣新竹',
    flavor: '蜜香、果香',
    brewTemp: '85-90°C',
    brewTime: '2-3分鐘',
    tags: ['得獎茶', '限量'],
    rating: 4.9,
    reviews: 87,
    image: '/images/teas/oriental-beauty.jpg',
    featured: true
  },
  {
    id: 'black-tea-assam',
    name: '日月潭紅茶',
    category: 'Black Tea',
    variants: [
      { id: 'bt-50g', weight: '50g', price: 280, stock: 90 },
      { id: 'bt-100g', weight: '100g', price: 520, stock: 70 },
      { id: 'bt-teabag-15', weight: '茶包15入', price: 320, stock: 50 }
    ],
    description: '台灣在地栽種，茶湯紅艷明亮，適合調製奶茶。',
    origin: '台灣南投',
    flavor: '麥芽香、醇厚',
    brewTemp: '95-100°C',
    brewTime: '3-5分鐘',
    tags: ['奶茶首選'],
    rating: 4.6,
    reviews: 112,
    image: '/images/teas/assam.jpg'
  },
  {
    id: 'white-peony',
    name: '白牡丹',
    category: 'White Tea',
    variants: [
      { id: 'wp-50g', weight: '50g', price: 380, stock: 45 },
      { id: 'wp-100g', weight: '100g', price: 720, stock: 30 }
    ],
    description: '精選一芽二葉，白毫顯露，茶湯清甜順口。',
    origin: '中國福建',
    flavor: '清甜、花香',
    brewTemp: '80-85°C',
    brewTime: '2-3分鐘',
    tags: ['養生'],
    rating: 4.7,
    reviews: 63,
    image: '/images/teas/white-peony.jpg'
  },
  {
    id: 'tieguanyin',
    name: '鐵觀音',
    category: 'Roasted',
    variants: [
      { id: 'tg-75g', weight: '75g', price: 480, stock: 55 },
      { id: 'tg-150g', weight: '150g', price: 900, stock: 40 }
    ],
    description: '中度烘焙，帶有獨特觀音韻，回甘持久。',
    origin: '台灣木柵',
    flavor: '炭焙香、果香',
    brewTemp: '95°C',
    brewTime: '1-2分鐘',
    tags: ['老饕首選'],
    rating: 4.8,
    reviews: 92,
    image: '/images/teas/tieguanyin.jpg',
    featured: true
  },
  {
    id: 'tea-set-basic',
    name: '入門茶具組',
    category: 'Add-ons',
    variants: [
      { id: 'ts-basic', weight: '1組', price: 1200, stock: 25 }
    ],
    description: '包含茶壺、茶杯、茶海、茶匙，初學者最佳選擇。',
    origin: '台灣',
    tags: ['加購優惠'],
    rating: 4.9,
    reviews: 48,
    image: '/images/accessories/tea-set-basic.jpg',
    isAccessory: true
  },
  {
    id: 'tea-tin',
    name: '茶葉密封罐',
    category: 'Add-ons',
    variants: [
      { id: 'tin-small', weight: '小(100g)', price: 150, stock: 40 },
      { id: 'tin-medium', weight: '中(200g)', price: 220, stock: 35 },
      { id: 'tin-large', weight: '大(500g)', price: 320, stock: 25 }
    ],
    description: '不鏽鋼材質，雙層密封設計，保持茶葉新鮮。',
    origin: '台灣',
    tags: ['加購優惠'],
    rating: 4.8,
    reviews: 76,
    image: '/images/accessories/tea-tin.jpg',
    isAccessory: true
  }
];

/**
 * Get all products
 * @returns {Array} Array of all products
 */
export function getAllProducts() {
  return [...teaProducts];
}

/**
 * Get featured products
 * @returns {Array} Array of featured products
 */
export function getFeaturedProducts() {
  return teaProducts.filter(product => product.featured);
}

/**
 * Get products by category
 * @param {string} category - Category name
 * @returns {Array} Array of products in the specified category
 */
export function getProductsByCategory(category) {
  return teaProducts.filter(product => product.category === category);
}

/**
 * Get product by ID
 * @param {string} id - Product ID
 * @returns {Object|null} Product object or null if not found
 */
export function getProductById(id) {
  return teaProducts.find(product => product.id === id) || null;
}

/**
 * Get variant by ID
 * @param {string} variantId - Variant ID
 * @returns {Object|null} Variant object with product reference or null if not found
 */
export function getVariantById(variantId) {
  for (const product of teaProducts) {
    const variant = product.variants.find(v => v.id === variantId);
    if (variant) {
      return {
        ...variant,
        productId: product.id,
        productName: product.name,
        category: product.category,
        image: product.image
      };
    }
  }
  return null;
}
