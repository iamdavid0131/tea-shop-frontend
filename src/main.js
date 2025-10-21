async function api(action, payload) {
  const res = await fetch(`/api/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' }, // 與 GAS 相容
    body: JSON.stringify(payload || {})
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'API error');
  return json;
}

window.testQuote = async () => {
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

window.submitOrder = async () => {
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
