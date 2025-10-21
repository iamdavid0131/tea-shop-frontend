// GET /api/products
export default async function handler(req, res) {
  const products = [
    {
      id: 1,
      name: "Earl Grey",
      price: 5.99,
      description: "A classic black tea flavored with bergamot oil. Perfect with a slice of lemon.",
      category: "Black Tea"
    },
    {
      id: 2,
      name: "Jasmine Green",
      price: 6.49,
      description: "Delicate green tea scented with jasmine flowers. Light and fragrant.",
      category: "Green Tea"
    },
    {
      id: 3,
      name: "Chamomile",
      price: 4.99,
      description: "Caffeine-free herbal tea made from chamomile flowers. Soothing and calming.",
      category: "Herbal Tea"
    },
    {
      id: 4,
      name: "Masala Chai",
      price: 5.99,
      description: "Spiced black tea with a blend of aromatic spices. Best enjoyed with milk.",
      category: "Spiced Tea"
    }
  ];

  res.status(200).json(products);
}
