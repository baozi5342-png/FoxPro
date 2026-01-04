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
      markets: [],
      orders: [],
      trades: []
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

  const CONFIG = {
    adminToken: process.env.ADMIN_TOKEN || 'dev-admin-token',
    fee: { maker: parseFloat(process.env.MAKER_FEE || '0.001'), taker: parseFloat(process.env.TAKER_FEE || '0.002') },
    snapshotIntervalMs: 5000
  };

  function log(...args) { console.log(new Date().toISOString(), ...args); }

  function adminAuth(req, res, next) {
    const token = req.headers['x-admin-token'] || req.query.admin_token;
    if (!token || token !== CONFIG.adminToken) return res.status(401).json({ success: false, error: 'admin auth required' });
    next();
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

    // apply a single fill to taker/maker including reserved handling and fees
    function applyFill(f) {
      try {
        const quote = (f.price || 0) * (f.amount || 0);
        const takerO = (data.orders || []).find(o => o.id == f.takerOrderId) || null;
        const makerO = (data.orders || []).find(o => o.id == f.makerOrderId) || null;
        const taker = (data.users || []).find(u => u.id == (takerO && takerO.userId)) || null;
        const maker = (data.users || []).find(u => u.id == (makerO && makerO.userId)) || null;

        const makerFee = quote * (CONFIG.fee.maker || 0);
        const takerFee = quote * (CONFIG.fee.taker || 0);

        if (taker) {
          taker.reservedBalance = taker.reservedBalance || 0;
          taker.reservedAssets = taker.reservedAssets || {};
          taker.assets = taker.assets || {};
          if (f.takerSide === 'buy') {
            // consume reservedBalance if available
            if ((taker.reservedBalance || 0) >= quote) {
              taker.reservedBalance -= quote;
            } else {
              taker.balance = (taker.balance || 0) - quote;
            }
            taker.assets[f.symbol] = (taker.assets[f.symbol] || 0) + f.amount;
            taker.balance = (taker.balance || 0) - takerFee;
          } else {
            // sell
            if ((taker.reservedAssets || {})[f.symbol] >= f.amount) {
              taker.reservedAssets[f.symbol] -= f.amount;
            } else {
              taker.assets[f.symbol] = (taker.assets[f.symbol] || 0) - f.amount;
            }
            taker.balance = (taker.balance || 0) + quote - takerFee;
          }
        }

        if (maker) {
          maker.reservedBalance = maker.reservedBalance || 0;
          maker.reservedAssets = maker.reservedAssets || {};
          maker.assets = maker.assets || {};
          if (f.takerSide === 'buy') {
            // maker sold
            if ((maker.reservedAssets || {})[f.symbol] >= f.amount) {
              maker.reservedAssets[f.symbol] -= f.amount;
            } else {
              maker.assets[f.symbol] = (maker.assets[f.symbol] || 0) - f.amount;
            }
            maker.balance = (maker.balance || 0) + quote - makerFee;
          } else {
            // maker bought
            if ((maker.reservedBalance || 0) >= quote) {
              maker.reservedBalance -= quote;
            } else {
              maker.balance = (maker.balance || 0) - quote;
            }
            maker.assets[f.symbol] = (maker.assets[f.symbol] || 0) + f.amount;
            maker.balance = (maker.balance || 0) - makerFee;
          }
        }
      } catch (e) {
        console.warn('applyFill error', e && e.message);
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

  // protect admin endpoints
  app.use('/api/admin', adminAuth);

  app.post('/api/auth/register', async (req, res) => {
    try {
      const body = req.body || {};
      const id = (data.users.length ? (Math.max(...data.users.map(u => u.id || 0)) + 1) : 1);
      const newUser = { id, username: body.username || `user${id}`, email: body.email || '', phone: body.phone || '', created_at: new Date().toISOString() };
      data.users.push(newUser);
      await saveData(data);
      // broadcast new user list and updated stats immediately
      notifyAll('users', (data.users || []).map(u => ({ id: u.id, username: u.username, email: u.email, phone: u.phone, created_at: u.created_at })));
      notifyAll('stats', computeStats(data));
        // perform cancel atomically (refund + mark)
        await performAtomicUpdate(async () => {
          const order = data.orders.find(o => o.id == orderId);
          if (order) {
            const user = (data.users || []).find(u => u.id == order.userId);
            const remaining = (order.remaining != null) ? order.remaining : order.amount;
            if (user) {
              if (order.side === 'buy') {
                const refund = (order.price || 0) * (remaining || 0);
                user.balance = (user.balance || 0) + refund;
              } else if (order.side === 'sell') {
                user.assets = user.assets || {};
                user.assets[order.symbol] = (user.assets[order.symbol] || 0) + (remaining || 0);
              }
            }
            order.status = 'cancelled';
            order.remaining = 0;
            try { if (sqlite) sqlite.insertOrder(order); } catch (e) {}
          }
        });
        notifyAll('orders', data.orders);
        log('order.cancel', orderId);
        res.json({ success: true });
      // simple asset bookkeeping: ensure user has funds for buy or assets for sell
      if (order.side === 'buy') {
        const needed = (order.type === 'market' && order.price) ? (order.price * order.amount) : (order.price * order.amount);
        if ((user.balance || 0) < needed) return res.status(400).json({ success: false, error: 'insufficient balance' });
      } else if (order.side === 'sell') {
        const have = (user.assets && user.assets[order.symbol]) || 0;
        if (have < order.amount) return res.status(400).json({ success: false, error: 'insufficient asset balance' });
      }

      // perform atomically: run engine.placeOrder and persist (with rollback on error)
      const result = await performAtomicUpdate(async () => {
        const r = engine.placeOrder(order);
        if (r.placedOrder) {
          r.placedOrder.remaining = r.placedOrder.remaining || r.placedOrder.amount;
          r.placedOrder.status = 'open';
          data.orders.push(r.placedOrder);
          try { if (sqlite) sqlite.insertOrder(r.placedOrder); } catch (e) {}
        }
        if (r.fills && r.fills.length) {
          r.fills.forEach(f => {
            // apply funds/assets and fees
            applyFill(f);
            // update order remaining/status
            const takerO = data.orders.find(o => o.id == f.takerOrderId) || (f.takerOrderId == order.id ? order : null);
            const makerO = data.orders.find(o => o.id == f.makerOrderId) || null;
            if (takerO) takerO.remaining = (takerO.remaining || takerO.amount) - f.amount, takerO.status = ((takerO.remaining || 0) <= 0) ? 'filled' : 'partial';
            if (makerO) makerO.remaining = (makerO.remaining || makerO.amount) - f.amount, makerO.status = ((makerO.remaining || 0) <= 0) ? 'filled' : 'partial';
            try { if (sqlite) sqlite.insertTrade(f); } catch (e) {}
            data.trades = data.trades || [];
            data.trades.push(f);
          });
        }
        // persist users to sqlite (best-effort)
        try { if (sqlite) { (data.users || []).forEach(u => sqlite.insertOrUpdateUser(u)); } } catch (e) {}
        return r;
      });

      // broadcast after successful persist
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

  // admin: update user fields (balance/assets) - body: { id, changes }
  app.post('/api/admin/user/update', async (req, res) => {
    try {
      const { id, changes } = req.body || {};
      if (!id) return res.status(400).json({ success: false, error: 'id required' });
      await performAtomicUpdate(async () => {
        const user = (data.users || []).find(u => u.id == id);
        if (!user) throw new Error('user not found');
        Object.assign(user, changes || {});
        try { if (sqlite) sqlite.insertOrUpdateUser(user); } catch (e) {}
      });
      notifyAll('users', (data.users || []).map(u => ({ id: u.id, username: u.username, email: u.email, phone: u.phone, created_at: u.created_at })));
      notifyAll('stats', computeStats(data));
      res.json({ success: true });
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

  // admin: set market configuration (create/update a market entry)
  app.post('/api/admin/market/set', async (req, res) => {
    try {
      const cfg = req.body || {};
      if (!cfg.symbol) return res.status(400).json({ success: false, error: 'symbol required' });
      await performAtomicUpdate(async () => {
        data.markets = data.markets || [];
        const idx = data.markets.findIndex(m => m.symbol === cfg.symbol);
        const now = new Date().toISOString();
        if (idx >= 0) {
          data.markets[idx] = Object.assign({}, data.markets[idx], cfg, { updated_at: now });
        } else {
          data.markets.push(Object.assign({ created_at: now, updated_at: now }, cfg));
        }
        try { if (sqlite) { /* persist markets if sqlite schema exists (not implemented) */ } } catch (e) {}
      });
      // persist and broadcast
      await saveData(data);
      notifyAll('market_config', data.markets || []);
      res.json({ success: true, data: data.markets || [] });
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
        // send market configuration snapshot to newly connected admin clients
        ws.send(JSON.stringify({ type: 'market_config', payload: data.markets || [] }));
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
              applyFill(f);
              const takerO = data.orders.find(o => o.id == f.takerOrderId) || (f.takerOrderId == order.id ? order : null);
              const makerO = data.orders.find(o => o.id == f.makerOrderId) || null;
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

  // periodic persistence snapshot and orderbook broadcast
  const snapshotInterval = setInterval(async () => {
    try { await saveData(data); } catch (e) { /* ignore */ }
    try {
      // broadcast orderbook for each known symbol
      if (engine && engine.orderBooks) {
        Object.keys(engine.orderBooks).forEach(sym => {
          try { notifyAll('orderbook', engine.getOrderBook(sym, 20)); } catch (e) {}
        });
      }
    } catch (e) {}
  }, CONFIG.snapshotIntervalMs || 5000);

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
