(async ()=>{
  const base = 'http://localhost:3000';
  const post = async (path, body) => {
    const r = await fetch(base+path, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(()=>null);
    console.log(path, r.status, j);
    return j;
  };

  // place a sell limit order
  await post('/api/order/place', { userId: 1, symbol: 'BTC-USDT', side: 'sell', type: 'limit', price: 100, amount: 5 });
  // place a buy market order (should match partially)
  await post('/api/order/place', { userId: 2, symbol: 'BTC-USDT', side: 'buy', type: 'market', amount: 3 });
  // fetch trades
  const t = await fetch(base + '/api/admin/stats');
  console.log('/api/admin/stats', await t.json());
})();
