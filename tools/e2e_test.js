(async ()=>{
  const base = 'http://localhost:3000';
  const call = async (path, method='GET', body) => {
    const opts = { method, headers: { 'Content-Type':'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(base+path, opts);
    const j = await r.text().then(t=>{ try { return JSON.parse(t); } catch(e){ return t; } });
    console.log(path, r.status, j);
    return j;
  };

  try {
    console.log('Register user A');
    const a = await call('/api/auth/register', 'POST', { username: 'e2e_A', email: 'a@example.com' });
    console.log('Register user B');
    const b = await call('/api/auth/register', 'POST', { username: 'e2e_B', email: 'b@example.com' });

    const idA = a && a.data && a.data.id;
    const idB = b && b.data && b.data.id;
    if (!idA || !idB) throw new Error('failed to create users');

    console.log('Top-up user A assets and user B balance via admin update');
    await call('/api/admin/user/update', 'POST', { id: idA, changes: { assets: { BTC: 10 }, balance: 0 } });
    await call('/api/admin/user/update', 'POST', { id: idB, changes: { balance: 100000, assets: {} } });

    // A places sell limit order
    console.log('User A place sell limit order');
    await call('/api/order/place', 'POST', { userId: idA, symbol: 'BTC-USDT', side: 'sell', type: 'limit', price: 100, amount: 5 });
    // B places buy market order
    console.log('User B place buy market order');
    await call('/api/order/place', 'POST', { userId: idB, symbol: 'BTC-USDT', side: 'buy', type: 'market', amount: 3 });

    // give server a moment
    await new Promise(r=>setTimeout(r, 300));

    console.log('Fetch trades and orders');
    await call('/api/trades');
    await call('/api/orders');

  } catch (e) {
    console.error('E2E error', e && e.message ? e.message : e);
  }
})();
