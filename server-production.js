// FoxPro minimal production server — clean single-file implementation (final)
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
 
      fromSymbol,
      toSymbol,
      fromAmount: amount,
      toAmount: amount * 0.95, // 5%手续费
      rate: 0.95,
      status: 'completed',
      createdAt: new Date().toISOString()
    };

    inMemoryData.exchanges.push(exchange);
    saveData();

    // FoxPro minimal production server — clean single-file implementation (final)
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
    }

    const user = inMemoryData.users.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const withdrawal = {
      id: nextWithdrawalId++,
      userId,
      username: user.username,
      symbol,
      amount,
      address,
      status: 'pending',
      appliedAt: new Date().toISOString(),
      completedAt: null,
      txHash: null
    };

    inMemoryData.withdrawal_orders.push(withdrawal);
    user.balance -= amount;
    saveData();

    // broadcast withdrawal orders and stats
    broadcast('withdrawal-orders', inMemoryData.withdrawal_orders);
    broadcast('stats', getStats());

    res.json({ success: true, message: 'Withdrawal request submitted', withdrawal });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Withdrawal request failed' });
  }
});

// 后台查看提现订单（带格式化字段）
app.get('/api/admin/withdrawal-orders', (req, res) => {
  const orders = inMemoryData.withdrawal_orders.map(w => ({
    id: w.id,
    user_id: w.userId,
    username: w.username,
    amount: w.amount,
    account: w.address || w.symbol,
    status: w.status || '待处理',
    created_at: w.appliedAt
  }));
  res.json({ success: true, data: orders });
});

// 后台批准提现
app.post('/api/admin/withdrawal/approve', (req, res) => {
  try {
    const { withdrawalId, txHash } = req.body;
    const withdrawal = inMemoryData.withdrawal_orders.find(w => w.id === withdrawalId);
    if (!withdrawal) {
      return res.status(404).json({ success: false, message: 'Withdrawal not found' });
    }

    withdrawal.status = 'completed';
    withdrawal.completedAt = new Date().toISOString();
    withdrawal.txHash = txHash || 'manual_' + Date.now();

    saveData();
    // broadcast withdrawal orders and stats
    broadcast('withdrawal-orders', inMemoryData.withdrawal_orders);
    broadcast('stats', getStats());

    res.json({ success: true, message: 'Withdrawal approved', withdrawal });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Approval failed' });
  }
});

// ============ 前端页面路由 ============
const pages = [
  'index', 'login', 'register', 'account', 'market', 'trade', 'exchange',
  'lending-products', 'recharge', 'withdraw', 'admin', 'admin-login', 'assets', 'customer-support'
];

pages.forEach(page => {
  app.get(`/${page}`, (req, res) => {
    const filePath = path.join(__dirname, `${page}.html`);
    res.sendFile(filePath, (err) => {
      if (err) res.status(404).send('Page not found');
    });
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'), (err) => {
    if (err) res.status(404).send('Home not found');
  });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Not found', path: req.path });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ success: false, message: err.message || 'Internal server error' });
});

// ============ 启动服务器 ============
const server = app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   🚀 FoxPro Exchange Server            ║
╠════════════════════════════════════════╣
║ Address: http://localhost:${PORT.toString().padEnd(28)}║
║ Users: ${inMemoryData.users.length.toString().padEnd(39)}║
║ Orders: ${inMemoryData.orders.length.toString().padEnd(38)}║
╚════════════════════════════════════════╝
  `);
});

// 初始化 WebSocket 服务
wss = new WebSocket.Server({ server, path: '/ws' });
wss.on('connection', (ws, req) => {
  console.log('WebSocket client connected');

  // send initial data snapshot
  try {
    ws.send(JSON.stringify({ type: 'stats', payload: getStats() }));
    ws.send(JSON.stringify({ type: 'users', payload: getFormattedUsers() }));
    ws.send(JSON.stringify({ type: 'kyc', payload: inMemoryData.kyc_requests }));
    ws.send(JSON.stringify({ type: 'quick-contract-config', payload: inMemoryData.quickContractPeriods }));
    ws.send(JSON.stringify({ type: 'orders', payload: inMemoryData.orders }));
    ws.send(JSON.stringify({ type: 'recharge-orders', payload: inMemoryData.recharge_orders }));
    ws.send(JSON.stringify({ type: 'lending-requests', payload: inMemoryData.lending_requests }));
    ws.send(JSON.stringify({ type: 'withdrawal-orders', payload: inMemoryData.withdrawal_orders }));
    ws.send(JSON.stringify({ type: 'exchange-records', payload: inMemoryData.exchanges }));
  } catch (e) {
    console.warn('Failed to send initial WS snapshot', e.message);
  }

  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (msg) => {
    // allow clients to send simple actions; expect JSON { action: 'reload' } or others
    try {
      const data = JSON.parse(msg.toString());
      if (data && data.action === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', payload: Date.now() }));
      }
      // other actions may be extended as needed
    } catch (err) {
      console.warn('Invalid WS message', err.message);
    }
  });

  ws.on('close', () => console.log('WebSocket client disconnected'));
});

// WS 心跳，清理死连接
const wsHeartbeatInterval = setInterval(() => {
  if (!wss) return;
  wss.clients.forEach(ws => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    try { ws.ping(() => {}); } catch (e) { }
  });
}, 30000);

// 在进程退出前清理定时器
process.on('exit', () => {
  clearInterval(wsHeartbeatInterval);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM - shutting down gracefully if possible');
  try {
    server.close(() => {
      console.log('HTTP server closed (SIGTERM)');
    });
  } catch (e) {
    console.error('Error closing server on SIGTERM:', e && e.stack ? e.stack : e);
  }
});

process.on('SIGINT', () => {
  console.log('Received SIGINT - shutting down gracefully if possible');
  try {
    server.close(() => {
      console.log('HTTP server closed (SIGINT)');
    });
  } catch (e) {
    console.error('Error closing server on SIGINT:', e && e.stack ? e.stack : e);
  }
});

module.exports = app;
