// FoxPro minimal production server — clean single-file implementation (fixed)
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

  let data = await loadData();

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
      notifyAll('users', data.users.map(u => ({ id: u.id, username: u.username, email: u.email, phone: u.phone, created_at: u.created_at })));
      notifyAll('stats', computeStats(data));
      res.json({ success: true, data: newUser });
    } catch (err) {
      console.error('register error', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/admin/quick-contract/config', (req, res) => res.json({ success: true, data: data.quick_contract?.config || [] }));

  const server = http.createServer(app);
  const wss = new WebSocket.Server({ server, path: '/ws' });

  function notifyAll(type, payload) {
    const msg = JSON.stringify({ type, payload });
    wss.clients.forEach(client => { if (client.readyState === WebSocket.OPEN) client.send(msg); });
  }

  function heartbeat() { this.isAlive = true; }

  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', heartbeat);

    // initial snapshot
    ws.send(JSON.stringify({ type: 'stats', payload: computeStats(data) }));
    ws.send(JSON.stringify({ type: 'users', payload: (data.users || []).map(u => ({ id: u.id, username: u.username, email: u.email, phone: u.phone, created_at: u.created_at })) }));
    ws.send(JSON.stringify({ type: 'kyc', payload: data.kyc || [] }));
    ws.send(JSON.stringify({ type: 'quick-contract-config', payload: data.quick_contract?.config || [] }));
    ws.send(JSON.stringify({ type: 'quick-contract-orders', payload: data.quick_contract?.orders || [] }));
    ws.send(JSON.stringify({ type: 'recharge-orders', payload: data.recharge_orders || [] }));
    ws.send(JSON.stringify({ type: 'lending-requests', payload: data.lending_requests || [] }));
    ws.send(JSON.stringify({ type: 'withdrawal-orders', payload: data.withdrawal_orders || [] }));
    ws.send(JSON.stringify({ type: 'exchange-records', payload: data.exchange_records || [] }));

    ws.on('message', async (msg) => {
      try {
        const parsed = JSON.parse(msg.toString());
        if (!parsed || !parsed.type) return;
        if (parsed.type === 'new_order') {
          const order = parsed.payload || {};
          order.id = (data.orders.length ? (Math.max(...data.orders.map(o => o.id || 0)) + 1) : 1);
          order.created_at = new Date().toISOString();
          data.orders.push(order);
          await saveData(data);
          notifyAll('orders', data.orders);
          notifyAll('stats', computeStats(data));
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
