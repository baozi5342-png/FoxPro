// FoxPro minimal production server  clean single-file implementation (final)
const fs = require('fs').promises;
const path = require('path');
const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const DATA_FILE = path.join(__dirname, 'data', 'data.json');

async function loadData() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return {
      users: [],
      kyc: [],
      quick_contract: { config: [], orders: [] },
      recharge_orders: [],
      lending_requests: [],
      withdrawal_orders: [],
      exchange_records: [],
      products: [],
      orders: []
    };
  }
}

async function saveData(data) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function computeStats(data) {
  return {
    users: (data.users || []).length,
    orders: ((data.orders || []).length + (data.quick_contract?.orders || []).length),
    kyc_requests: (data.kyc || []).length,
    recharge_orders: (data.recharge_orders || []).length,
    lending_requests: (data.lending_requests || []).length,
    withdrawal_orders: (data.withdrawal_orders || []).length
  };
}

async function createServer() {
  const app = express();
  app.use(express.json());

  function log(...args) {
    console.log(new Date().toISOString(), ...args);
  }

  // perform atomic in-memory mutation + persist; on error rollback
  async function performAtomicUpdate(mutator) {
    const snapshot = JSON.parse(JSON.stringify(data));
    try {
      const result = await mutator();
      await saveData(data);
      return result;
    } catch (err) {
      // rollback in-memory
      data = snapshot;
      try { await saveData(data); } catch (e) { /* best-effort */ }
      throw err;
    }
  }

  let data = await loadData();
  // ensure trades array exists
  if (!data.trades) data.trades = [];
  // ensure users have assets/balance fields
  data.users = (data.users || []).map(u => Object.assign({ balance: u.balance || 0, assets: u.assets || {} }, u));

  // try to init sqlite persistence (optional)
  let sqlite = null;
  try {
    const sqliteModule = require('./backend/db/sqlite-db');
    const ok = sqliteModule.init();
    if (ok && sqliteModule.available()) {
      sqlite = sqliteModule;
      const loaded = sqlite.loadAll();
      if (loaded) {
        data.users = (loaded.users && loaded.users.length) ? loaded.users : data.users;
        data.orders = (loaded.orders && loaded.orders.length) ? loaded.orders : (data.orders || []);
        data.trades = (loaded.trades && loaded.trades.length) ? loaded.trades : (data.trades || []);
      }
    } else {
      // sqlite not available; proceed with file storage
      sqlite = null;
    }
  } catch (e) {
    sqlite = null;
  }

  // init trade engine
  const TradeEngine = require('./lib/trade-engine');
  const engine = new TradeEngine(data);
  // restore engine books from persisted open orders
  try { engine.restoreBooks(data.orders || []); } catch (e) { /* ignore */ }

  app.get('/api/admin/stats', (req, res) => res.json({ success: true, data: computeStats(data) }));

  app.get('/api/admin/users', (req, res) => {
    const formatted = (data.users || []).map(u => ({ id: u.id, username: u.username, email: u.email, phone: u.phone, created_at: u.created_at }));
    res.json({ success: true, data: formatted });
  });

  app.get('/api/admin/kyc', (req, res) => {
    const type = req.query.type || 'primary';
    const list = (data.kyc || []).filter(k => (k.type || 'primary') === type);
    res.json({ success: true, data: list });
  });

  app.post('/api/auth/register', async (req, res) => {
    try {
      const body = req.body || {};
      const id = (data.users.length ? (Math.max(...data.users.map(u => u.id || 0)) + 1) : 1);
      const newUser = { id, username: body.username || `user${id}`, email: body.email || '', phone: body.phone || '', created_at: new Date().toISOString() };
      data.users.push(newUser);
      await saveData(data);
      // persist to sqlite if available
      try { if (sqlite) sqlite.insertOrUpdateUser(newUser); } catch (e) {}
      notifyAll('users', data.users.map(u => ({ id: u.id, username: u.username, email: u.email, phone: u.phone, created_at: u.created_at })));
      notifyAll('stats', computeStats(data));
      res.json({ success: true, data: newUser });
    } catch (err) {
      console.error('register error', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/admin/quick-contract/config', (req, res) => res.json({ success: true, data: data.quick_contract?.config || [] }));

  // REST endpoint to place orders
  app.post('/api/order/place', async (req, res) => {
    try {
      const order = req.body || {};
      order.id = (data.orders.length ? (Math.max(...data.orders.map(o => o.id || 0)) + 1) : null);
      order.created_at = new Date().toISOString();

      // basic validation and balance checks
      const user = (data.users || []).find(u => u.id == order.userId);
      if (!user) return res.status(400).json({ success: false, error: 'user not found' });

      // simple asset bookkeeping: ensure user has funds for buy or assets for sell
      if (order.side === 'buy') {
        const needed = (order.type === 'market' && order.price) ? (order.price * order.amount) : (order.price * order.amount);
        if ((user.balance || 0) < needed) return res.status(400).json({ success: false, error: 'insufficient balance' });
      } else if (order.side === 'sell') {
        const have = (user.assets && user.assets[order.symbol]) || 0;
        if (have < order.amount) return res.status(400).json({ success: false, error: 'insufficient asset balance' });
      }

      // delegate to engine which may assign id and placedOrder
      const result = engine.placeOrder(order);

      // persist placed order and fills
      if (result.placedOrder) {
        // ensure remaining and status
        result.placedOrder.remaining = result.placedOrder.remaining || result.placedOrder.amount;
        result.placedOrder.status = 'open';
        data.orders.push(result.placedOrder);
        try { if (sqlite) sqlite.insertOrder(result.placedOrder); } catch (e) {}
      }

      // apply fills to user balances/assets
      if (result.fills && result.fills.length) {
        result.fills.forEach(f => {
          // taker
          const takerOrder = data.orders.find(o => o.id == f.takerOrderId) || (f.takerOrderId == order.id ? order : null);
          const makerOrder = data.orders.find(o => o.id == f.makerOrderId) || null;

          const taker = (data.users || []).find(u => u.id == (takerOrder && takerOrder.userId));
          const maker = (data.users || []).find(u => u.id == (makerOrder && makerOrder.userId));

          // transfer: if taker bought, deduct balance and add asset; if taker sold, remove asset and add balance
          if (taker) {
            if (f.takerSide === 'buy') {
              taker.balance = (taker.balance || 0) - (f.price * f.amount);
              taker.assets = taker.assets || {}; taker.assets[f.symbol] = (taker.assets[f.symbol] || 0) + f.amount;
            } else {
              taker.assets = taker.assets || {}; taker.assets[f.symbol] = (taker.assets[f.symbol] || 0) - f.amount;
              taker.balance = (taker.balance || 0) + (f.price * f.amount);
            }
          }
          if (maker) {
            if (f.takerSide === 'buy') {
              // maker sold
              maker.assets = maker.assets || {}; maker.assets[f.symbol] = (maker.assets[f.symbol] || 0) - f.amount;
              maker.balance = (maker.balance || 0) + (f.price * f.amount);
            } else {
              // maker bought
              maker.balance = (maker.balance || 0) - (f.price * f.amount);
              maker.assets = maker.assets || {}; maker.assets[f.symbol] = (maker.assets[f.symbol] || 0) + f.amount;
            }
          }

          // mark orders' remaining/status
          const takerO = data.orders.find(o => o.id == f.takerOrderId);
          const makerO = data.orders.find(o => o.id == f.makerOrderId);
          if (takerO) {
            takerO.remaining = (takerO.remaining || takerO.amount) - f.amount;
            if ((takerO.remaining || 0) <= 0) takerO.status = 'filled'; else takerO.status = 'partial';
          }
          if (makerO) {
            makerO.remaining = (makerO.remaining || makerO.amount) - f.amount;
            if ((makerO.remaining || 0) <= 0) makerO.status = 'filled'; else makerO.status = 'partial';
          }

          // persist trade row
          try { if (sqlite) sqlite.insertTrade(f); } catch (e) {}
          // ensure trades array stores this fill for API and recovery
          data.trades = data.trades || [];
          data.trades.push(f);
        });
      }

      await saveData(data);
      // persist users updated
      try { if (sqlite) {
        (data.users || []).forEach(u => sqlite.insertOrUpdateUser(u));
      } } catch (e) {}
      notifyAll('orders', data.orders);
      notifyAll('trades', data.trades || []);
      notifyAll('stats', computeStats(data));
      log('order.place', order.id || (result.placedOrder && result.placedOrder.id), 'fills', (result.fills || []).length);
      
      res.json({ success: true, data: { fills: result.fills, placed: result.placedOrder } });
    } catch (err) {
      console.error('place order error', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // cancel order
  app.post('/api/order/cancel', async (req, res) => {
    try {
      const { orderId } = req.body || {};
      if (!orderId) return res.status(400).json({ success: false, error: 'orderId required' });
      // try engine cancel
      const removed = engine.cancelOrder(orderId);
      if (!removed) return res.status(404).json({ success: false, error: 'order not found or already matched' });
      // refund reserved funds / return assets (best effort)
      const order = data.orders.find(o => o.id == orderId);
      if (order) {
        // Only refund remaining portion
        const user = (data.users || []).find(u => u.id == order.userId);
        const remaining = (order.remaining != null) ? order.remaining : order.amount;
        if (user) {
          if (order.side === 'buy') {
            // refund reserved balance for remaining amount
            const refund = (order.price || 0) * (remaining || 0);
            user.balance = (user.balance || 0) + refund;
          } else if (order.side === 'sell') {
            // return remaining assets
            user.assets = user.assets || {};
            user.assets[order.symbol] = (user.assets[order.symbol] || 0) + (remaining || 0);
          }
        }
        order.status = 'cancelled';
        order.remaining = 0;
        try { if (sqlite) sqlite.insertOrder(order); } catch (e) {}
      }
      await saveData(data);
      notifyAll('orders', data.orders);
      log('order.cancel', orderId);
      res.json({ success: true });
    } catch (err) {
      console.error('cancel order error', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  const server = http.createServer(app);
  const wss = new WebSocket.Server({ server, path: '/ws' });

  function notifyAll(type, payload) {
    const msg = JSON.stringify({ type, payload });
    wss.clients.forEach(client => { if (client.readyState === WebSocket.OPEN) client.send(msg); });
  }

  // health check
  app.get('/health', (req, res) => res.json({ ok: true, sqlite: !!sqlite, time: new Date().toISOString() }));

  // list orders with basic filters and pagination
  app.get('/api/orders', (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
      const status = req.query.status;
      const userId = req.query.userId ? parseInt(req.query.userId) : null;
      const symbol = req.query.symbol;

      let list = (data.orders || []).slice().reverse();
      if (status) list = list.filter(o => (o.status || '') === status);
      if (userId) list = list.filter(o => o.userId == userId);
      if (symbol) list = list.filter(o => o.symbol == symbol);

      const start = (page - 1) * limit;
      const items = list.slice(start, start + limit);
      res.json({ success: true, data: items, meta: { total: list.length, page, limit } });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // list trades
  app.get('/api/trades', (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
      const symbol = req.query.symbol;
      let list = (data.trades || []).slice().reverse();
      if (symbol) list = list.filter(t => t.symbol == symbol);
      const start = (page - 1) * limit;
      const items = list.slice(start, start + limit);
      res.json({ success: true, data: items, meta: { total: list.length, page, limit } });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  function heartbeat() { this.isAlive = true; }

  // order detail
  app.get('/api/order/:id', (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const order = (data.orders || []).find(o => o.id == id);
      if (!order) return res.status(404).json({ success: false, error: 'order not found' });
      res.json({ success: true, data: order });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // admin cancel (simple) - accepts { orderId }
  app.post('/api/admin/order/cancel', async (req, res) => {
    try {
      const { orderId } = req.body || {};
      if (!orderId) return res.status(400).json({ success: false, error: 'orderId required' });
      const removed = engine.cancelOrder(orderId);
      if (!removed) return res.status(404).json({ success: false, error: 'order not found or already matched' });
      const order = data.orders.find(o => o.id == orderId);
      if (order) { order.status = 'cancelled'; order.remaining = 0; try { if (sqlite) sqlite.insertOrder(order); } catch (e) {} }
      await saveData(data);
      notifyAll('orders', data.orders);
      log('admin.cancel', orderId);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', heartbeat);

    // initial snapshot
    try {
      ws.send(JSON.stringify({ type: 'stats', payload: computeStats(data) }));
      ws.send(JSON.stringify({ type: 'users', payload: (data.users || []).map(u => ({ id: u.id, username: u.username, email: u.email, phone: u.phone, created_at: u.created_at })) }));
      ws.send(JSON.stringify({ type: 'kyc', payload: data.kyc || [] }));
      ws.send(JSON.stringify({ type: 'quick-contract-config', payload: data.quick_contract?.config || [] }));
      ws.send(JSON.stringify({ type: 'quick-contract-orders', payload: data.quick_contract?.orders || [] }));
      ws.send(JSON.stringify({ type: 'recharge-orders', payload: data.recharge_orders || [] }));
      ws.send(JSON.stringify({ type: 'lending-requests', payload: data.lending_requests || [] }));
      ws.send(JSON.stringify({ type: 'withdrawal-orders', payload: data.withdrawal_orders || [] }));
      ws.send(JSON.stringify({ type: 'exchange-records', payload: data.exchange_records || [] }));
    } catch (err) { console.error('ws initial send error', err); }

    ws.on('message', async (msg) => {
      try {
        const parsed = JSON.parse(msg.toString());
        if (!parsed || !parsed.type) return;
        if (parsed.type === 'new_order') {
          const order = parsed.payload || {};
          order.id = (data.orders.length ? (Math.max(...data.orders.map(o => o.id || 0)) + 1) : 1);
          order.created_at = new Date().toISOString();
          // use engine to place and match (reuse REST logic)
          const result = engine.placeOrder(order);
          // persist placed order
          if (result.placedOrder) {
            result.placedOrder.remaining = result.placedOrder.remaining || result.placedOrder.amount;
            result.placedOrder.status = 'open';
            data.orders.push(result.placedOrder);
            try { if (sqlite) sqlite.insertOrder(result.placedOrder); } catch (e) {}
          }

          // apply fills
          if (result.fills && result.fills.length) {
            result.fills.forEach(f => {
              const takerOrder = data.orders.find(o => o.id == f.takerOrderId) || (f.takerOrderId == order.id ? order : null);
              const makerOrder = data.orders.find(o => o.id == f.makerOrderId) || null;
              const taker = (data.users || []).find(u => u.id == (takerOrder && takerOrder.userId));
              const maker = (data.users || []).find(u => u.id == (makerOrder && makerOrder.userId));
              if (taker) {
                if (f.takerSide === 'buy') {
                  taker.balance = (taker.balance || 0) - (f.price * f.amount);
                  taker.assets = taker.assets || {}; taker.assets[f.symbol] = (taker.assets[f.symbol] || 0) + f.amount;
                } else {
                  taker.assets = taker.assets || {}; taker.assets[f.symbol] = (taker.assets[f.symbol] || 0) - f.amount;
                  taker.balance = (taker.balance || 0) + (f.price * f.amount);
                }
              }
              if (maker) {
                if (f.takerSide === 'buy') {
                  maker.assets = maker.assets || {}; maker.assets[f.symbol] = (maker.assets[f.symbol] || 0) - f.amount;
                  maker.balance = (maker.balance || 0) + (f.price * f.amount);
                } else {
                  maker.balance = (maker.balance || 0) - (f.price * f.amount);
                  maker.assets = maker.assets || {}; maker.assets[f.symbol] = (maker.assets[f.symbol] || 0) + f.amount;
                }
              }

              const takerO = data.orders.find(o => o.id == f.takerOrderId);
              const makerO = data.orders.find(o => o.id == f.makerOrderId);
              if (takerO) {
                takerO.remaining = (takerO.remaining || takerO.amount) - f.amount;
                takerO.status = ((takerO.remaining || 0) <= 0) ? 'filled' : 'partial';
              }
              if (makerO) {
                makerO.remaining = (makerO.remaining || makerO.amount) - f.amount;
                makerO.status = ((makerO.remaining || 0) <= 0) ? 'filled' : 'partial';
              }

              try { if (sqlite) sqlite.insertTrade(f); } catch (e) {}
              data.trades = data.trades || [];
              data.trades.push(f);
            });
          }

          // persist users and overall data
          try { if (sqlite) { (data.users || []).forEach(u => sqlite.insertOrUpdateUser(u)); } } catch (e) {}
          await saveData(data);
          notifyAll('orders', data.orders);
          notifyAll('trades', data.trades || []);
          notifyAll('stats', computeStats(data));
          log('ws.new_order', order.id, 'fills', (result.fills || []).length);
        } else if (parsed.type === 'update') {
          const { entity, id, changes } = parsed.payload || {};
          if (entity && id != null) {
            const list = data[entity];
            if (Array.isArray(list)) {
              const idx = list.findIndex(x => (x.id == id));
              if (idx >= 0) {
                list[idx] = Object.assign({}, list[idx], changes);
                await saveData(data);
                notifyAll(entity, list);
                if (entity === 'users' || entity === 'orders') notifyAll('stats', computeStats(data));
              }
            }
          }
        } else if (parsed.type === 'client_stats') {
          notifyAll('client_stats', parsed.payload || {});
        }
      } catch (err) { console.error('ws message handler error', err); }
    });

    ws.on('close', () => {});
    ws.on('error', err => console.error('ws client error', err));
  });

  const interval = setInterval(() => {
    wss.clients.forEach(ws => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping(() => {});
    });
  }, 30000);

  wss.on('close', () => clearInterval(interval));

  global.notifyAll = notifyAll;

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => console.log(`FoxPro server running on http://localhost:${PORT}`));

  process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down...');
    clearInterval(interval);
    wss.close();
    server.close(() => { console.log('HTTP server closed (SIGINT)'); process.exit(0); });
  });

  return { app, server, wss, data };
}

if (require.main === module) {
  createServer().catch(err => { console.error('Failed to start server', err); process.exit(1); });
}

module.exports = { createServer };
