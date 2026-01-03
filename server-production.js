// FoxPro Exchange - 完整生产服务器（完整的数据流）
const express = require('express');
const cors = require('cors');
// Minimal production-ready server for FoxPro (outgoing patch)
// Includes: Express REST API, WebSocket server, persistence (data/data.json), broadcasts

const fs = require('fs').promises;
const path = require('path');
const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const DATA_FILE = path.join(__dirname, '..', 'data', 'data.json');

async function loadData() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    // initialize default structure when missing
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
    orders: (data.orders || []).length + (data.quick_contract?.orders || []).length,
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

  // REST endpoints used by frontend/admin
  app.get('/api/admin/stats', (req, res) => {
    res.json({ success: true, data: computeStats(data) });
  });

  app.get('/api/admin/users', (req, res) => {
    const formatted = (data.users || []).map(u => ({ id: u.id, username: u.username, email: u.email, phone: u.phone, created_at: u.created_at }));
    res.json({ success: true, data: formatted });
  });

  app.get('/api/admin/kyc', (req, res) => {
    const type = req.query.type || 'primary';
    // front-end expects arrays
    const list = (data.kyc || []).filter(k => (k.type || 'primary') === type);
    res.json({ success: true, data: list });
  });

  // simplified register endpoint — persists then broadcasts
  app.post('/api/auth/register', async (req, res) => {
    try {
      const body = req.body || {};
      const id = (data.users.length ? (Math.max(...data.users.map(u=>u.id||0)) + 1) : 1);
      const newUser = {
        id,
        username: body.username || `user${id}`,
        email: body.email || '',
        phone: body.phone || '',
        created_at: new Date().toISOString()
      };
      data.users.push(newUser);
      await saveData(data);
      // broadcasts will be handled by broadcaster below via notifyAll
      notifyAll('users', data.users.map(u => ({ id: u.id, username: u.username, email: u.email, phone: u.phone, created_at: u.created_at })));
      notifyAll('stats', computeStats(data));
      res.json({ success: true, data: newUser });
    } catch (err) {
      console.error('register error', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // other minimal endpoints as placeholders
  app.get('/api/admin/quick-contract/config', (req, res) => {
    res.json({ success: true, data: data.quick_contract?.config || [] });
  });

  const server = http.createServer(app);

  // WebSocket server
  const wss = new WebSocket.Server({ server, path: '/ws' });

  // notifyAll will be assigned after wss defined
  global._wss = wss;

  function notifyAll(type, payload) {
    const msg = JSON.stringify({ type, payload });
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    });
  }

  // heartbeat for detecting dead clients
  function heartbeat() { this.isAlive = true; }

  wss.on('connection', (ws, req) => {
    ws.isAlive = true;
    ws.on('pong', heartbeat);

    // send initial snapshot
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
        // Expected shape: { type: 'new_order'|'update'|'client_stats', payload: {...} }
        if (!parsed || !parsed.type) return;

        if (parsed.type === 'new_order') {
          const order = parsed.payload || {};
          order.id = (data.orders.length ? (Math.max(...data.orders.map(o=>o.id||0)) + 1) : 1);
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
          // broadcast client-reported stats to others (non-authoritative)
          notifyAll('client_stats', parsed.payload || {});
        }
      } catch (err) {
        console.error('ws message handler error', err);
      }
    });

    ws.on('close', () => {});
    ws.on('error', err => console.error('ws client error', err));
  });

  // periodic ping
  const interval = setInterval(() => {
    wss.clients.forEach(ws => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping(() => {});
    });
  }, 30000);

  wss.on('close', () => clearInterval(interval));

  // expose notifyAll for external use in this module
  global.notifyAll = notifyAll;

  // start server
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => console.log(`FoxPro server running on http://localhost:${PORT}`));

  // graceful shutdown
  process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down...');
    clearInterval(interval);
    wss.close();
    server.close(() => {
      console.log('HTTP server closed (SIGINT)');
      process.exit(0);
    });
  });

  return { app, server, wss, data };
}

// Run when executed directly
if (require.main === module) {
  createServer().catch(err => {
    console.error('Failed to start server', err);
    process.exit(1);
  });
}

module.exports = { createServer };

    }

    const kycRequest = {
      id: nextKycId++,
      userId,
      username: user.username,
      type: 'primary',
      name,
      idNumber,
      idType,
      status: 'pending',
      submittedAt: new Date().toISOString(),
      approvedAt: null
    };

    inMemoryData.kyc_requests.push(kycRequest);
    saveData();

    res.json({ success: true, message: 'KYC submission successful', kyc: kycRequest });
  } catch (err) {
    console.error('KYC submit error:', err);
    res.status(500).json({ success: false, message: 'KYC submission failed' });
  }
});

app.post('/api/auth/submit-kyc/advanced', (req, res) => {
  try {
    const { userId, videoUrl, faceData } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID required' });
    }

    const user = inMemoryData.users.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const kycRequest = {
      id: nextKycId++,
      userId,
      username: user.username,
      type: 'advanced',
      videoUrl,
      status: 'pending',
      submittedAt: new Date().toISOString(),
      approvedAt: null
    };

    inMemoryData.kyc_requests.push(kycRequest);
    saveData();

    broadcast('kyc', inMemoryData.kyc_requests);

    res.json({ success: true, message: 'Advanced KYC submission successful', kyc: kycRequest });
  } catch (err) {
    console.error('Advanced KYC submit error:', err);
    res.status(500).json({ success: false, message: 'Advanced KYC submission failed' });
  }
});

// Helper: extract user id from simple token format 'token-<id>-<ts>' used by this demo
function getUserIdFromAuthHeader(req) {
  try {
    const auth = req.headers['authorization'] || req.headers['Authorization'];
    if (!auth) return null;
    const parts = auth.split(' ');
    if (parts.length !== 2) return null;
    const token = parts[1];
    if (!token.startsWith('token-')) return null;
    const segments = token.split('-');
    const id = parseInt(segments[1], 10);
    return Number.isInteger(id) ? id : null;
  } catch (e) {
    return null;
  }
}

// Compatibility routes used by frontend: /api/account/verification/:type
app.post('/api/account/verification/primary', (req, res) => {
  try {
    const userId = getUserIdFromAuthHeader(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Not authenticated' });

    const user = inMemoryData.users.find(u => u.id === userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const { fullName, idNumber, address, dateOfBirth } = req.body;
    const kycRequest = {
      id: nextKycId++,
      userId,
      username: user.username,
      type: 'primary',
      name: fullName || '',
      idNumber: idNumber || '',
      idType: 'idcard',
      residence: address || '',
      extra: { dateOfBirth: dateOfBirth || null },
      status: 'pending',
      submittedAt: new Date().toISOString(),
      approvedAt: null
    };

    inMemoryData.kyc_requests.push(kycRequest);
    saveData();
    broadcast('kyc', inMemoryData.kyc_requests);

    res.json({ success: true, message: 'KYC submitted', kyc: kycRequest });
  } catch (err) {
    console.error('Primary KYC submit error (compat):', err);
    res.status(500).json({ success: false, message: 'Submission failed' });
  }
});

app.post('/api/account/verification/advanced', (req, res) => {
  try {
    const userId = getUserIdFromAuthHeader(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Not authenticated' });

    const user = inMemoryData.users.find(u => u.id === userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Frontend may send files incorrectly via JSON; accept generic fields
    const { facePhoto, idCard, info } = req.body || {};
    const kycRequest = {
      id: nextKycId++,
      userId,
      username: user.username,
      type: 'advanced',
      videoUrl: null,
      faceData: info || null,
      status: 'pending',
      submittedAt: new Date().toISOString(),
      approvedAt: null
    };

    inMemoryData.kyc_requests.push(kycRequest);
    saveData();
    broadcast('kyc', inMemoryData.kyc_requests);

    res.json({ success: true, message: 'Advanced KYC submitted', kyc: kycRequest });
  } catch (err) {
    console.error('Advanced KYC submit error (compat):', err);
    res.status(500).json({ success: false, message: 'Submission failed' });
  }
});

// Frontend compatibility: get verification status for current user
app.get('/api/account/verification-status', (req, res) => {
  try {
    const userId = getUserIdFromAuthHeader(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Not authenticated' });

    const primary = inMemoryData.kyc_requests.filter(k => k.userId === userId && k.type === 'primary')
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))[0];
    const advanced = inMemoryData.kyc_requests.filter(k => k.userId === userId && k.type === 'advanced')
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))[0];

    res.json({ success: true, primary: primary ? primary.status : 'pending', advanced: advanced ? advanced.status : 'pending' });
  } catch (err) {
    console.error('Verification status error:', err);
    res.status(500).json({ success: false, message: 'Failed to get status' });
  }
});

// 兼容前端 /api/account 路由：接收用户端的 KYC 提交（Primary）
app.post('/api/account/verification/primary', (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.split(' ')[1];
    let userId = null;
    if (token && token.startsWith('token-')) {
      const parts = token.split('-');
      userId = parseInt(parts[1], 10);
    }

    if (!userId) return res.status(401).json({ success: false, message: 'Not authorized' });

    const { fullName, idNumber, address, dateOfBirth } = req.body;
    if (!fullName || !idNumber || !address) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const user = inMemoryData.users.find(u => u.id === userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const kycRequest = {
      id: nextKycId++,
      userId,
      username: user.username,
      type: 'primary',
      name: fullName,
      idNumber,
      idType: 'id',
      residence: address,
      status: 'pending',
      submittedAt: new Date().toISOString(),
      approvedAt: null
    };

    inMemoryData.kyc_requests.push(kycRequest);
    saveData();
    broadcast('kyc', inMemoryData.kyc_requests);

    res.json({ success: true, message: 'Submitted for review' });
  } catch (err) {
    console.error('Account primary verification error:', err);
    res.status(500).json({ success: false, message: 'Submission failed' });
  }
});

// 兼容前端 /api/account 路由：接收用户端的 KYC 提交（Advanced）
app.post('/api/account/verification/advanced', (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.split(' ')[1];
    let userId = null;
    if (token && token.startsWith('token-')) {
      const parts = token.split('-');
      userId = parseInt(parts[1], 10);
    }

    if (!userId) return res.status(401).json({ success: false, message: 'Not authorized' });

    const { info } = req.body;
    const user = inMemoryData.users.find(u => u.id === userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const kycRequest = {
      id: nextKycId++,
      userId,
      username: user.username,
      type: 'advanced',
      info: info || '',
      status: 'pending',
      submittedAt: new Date().toISOString(),
      approvedAt: null
    };

    inMemoryData.kyc_requests.push(kycRequest);
    saveData();
    broadcast('kyc', inMemoryData.kyc_requests);

    res.json({ success: true, message: 'Submitted for review' });
  } catch (err) {
    console.error('Account advanced verification error:', err);
    res.status(500).json({ success: false, message: 'Submission failed' });
  }
});

// 兼容前端 /api/account 验证状态查询
app.get('/api/account/verification-status', (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.split(' ')[1];
    let userId = null;
    if (token && token.startsWith('token-')) {
      const parts = token.split('-');
      userId = parseInt(parts[1], 10);
    }
    if (!userId) return res.status(401).json({ message: 'Not authorized' });

    const userKyc = inMemoryData.kyc_requests.filter(k => k.userId === userId);
    const primary = userKyc.find(k => k.type === 'primary');
    const advanced = userKyc.find(k => k.type === 'advanced');

    res.json({
      primary: primary ? primary.status : 'unsubmitted',
      advanced: advanced ? advanced.status : 'unsubmitted'
    });
  } catch (err) {
    console.error('Verification status error:', err);
    res.status(500).json({ message: 'Error' });
  }
});

// ============ 后台管理 API ============

// 统计信息
app.get('/api/admin/stats', (req, res) => {
  res.json({
    success: true,
    stats: {
      totalUsers: inMemoryData.users.length,
      activeUsers: inMemoryData.users.filter(u => u.status === 'active').length,
      totalVolume: inMemoryData.orders.length * 100,
      totalTransactions: inMemoryData.orders.length + inMemoryData.exchanges.length + inMemoryData.recharge_orders.length
    }
  });
});

// 用户列表
app.get('/api/admin/users', (req, res) => {
  const users = inMemoryData.users.map(u => ({
    id: u.id,
    username: u.username,
    email: u.email,
    phone: u.phone,
    created_at: u.createdAt,
    status: u.status || 'active',
    kyc_status: u.kyc_status || 'unverified'
  }));

  res.json({ success: true, data: users, total: users.length });
});

// ============ KYC认证审核（后台）============
app.get('/api/admin/kyc', (req, res) => {
  const type = req.query.type || 'primary';
  const requests = inMemoryData.kyc_requests.filter(k => k.type === type);
  res.json({
    success: true,
    data: requests.map(k => ({
      id: k.id,
      user_id: k.userId,
      username: k.username,
      full_name: k.name,
      id_number: k.idNumber,
      id_type: k.idType,
      residence: k.residence || '-',
      status: k.status,
      created_at: k.submittedAt
    }))
  });
});


// 批准认证
app.post('/api/admin/auth/approve', (req, res) => {
  try {
    const { kycId } = req.body;
    const kyc = inMemoryData.kyc_requests.find(k => k.id === kycId);
    if (!kyc) {
      return res.status(404).json({ success: false, message: 'KYC request not found' });
    }

    kyc.status = 'approved';
    kyc.approvedAt = new Date().toISOString();
    
    const user = inMemoryData.users.find(u => u.id === kyc.userId);
    if (user) {
      user.kyc_status = 'verified';
    }

    saveData();
    // broadcast kyc/users/stats changes
    broadcast('kyc', inMemoryData.kyc_requests);
    broadcast('users', getFormattedUsers());
    broadcast('stats', getStats());

    res.json({ success: true, message: 'KYC approved' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Approval failed' });
  }
});

// 拒绝认证
app.post('/api/admin/auth/reject', (req, res) => {
  try {
    const { kycId } = req.body;
    const kyc = inMemoryData.kyc_requests.find(k => k.id === kycId);
    if (!kyc) {
      return res.status(404).json({ success: false, message: 'KYC request not found' });
    }

    kyc.status = 'rejected';
    saveData();
    broadcast('kyc', inMemoryData.kyc_requests);
    broadcast('users', getFormattedUsers());
    broadcast('stats', getStats());

    res.json({ success: true, message: 'KYC rejected' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Rejection failed' });
  }
});

// ============ 秒合约配置管理 ============
// 前端查询秒合约配置
app.get('/api/quick-contract/config', (req, res) => {
  res.json({
    success: true,
    data: inMemoryData.quickContractPeriods
  });
});

// 后台查询秒合约配置
app.get('/api/admin/quick-contract/config', (req, res) => {
  res.json({
    success: true,
    data: inMemoryData.quickContractPeriods
  });
});

// 后台更新秒合约配置
app.post('/api/admin/quick-contract/config', (req, res) => {
  try {
    const { periods } = req.body;
    if (!Array.isArray(periods) || periods.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid periods data' });
    }

    inMemoryData.quickContractPeriods = periods.map((p, idx) => ({
      id: p.id || idx + 1,
      seconds: p.seconds,
      profitRate: p.profitRate
    }));

    saveData();
    // broadcast quick contract config change
    broadcast('quick-contract-config', inMemoryData.quickContractPeriods);

    res.json({ success: true, message: 'Config updated', data: inMemoryData.quickContractPeriods });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Update failed' });
  }
});

// 秒合约交易列表（后台）
app.get('/api/admin/quick-contract/orders', (req, res) => {
  const trades = inMemoryData.orders.map(o => ({
    id: o.id,
    user_id: o.userId,
    username: o.username,
    product: o.symbol,
    amount: o.amount,
    direction: o.prediction,
    period: o.period || '-',
    status: o.result === 'win' ? '成功' : '失败',
    created_at: o.createdAt
  }));
  res.json({ success: true, data: trades });
});

// 用户下秒合约订单（前端）
app.post('/api/quick-contract/place-order', (req, res) => {
  try {
    const { userId, symbol, amount, prediction } = req.body;
    if (!userId || !symbol || !amount) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const user = inMemoryData.users.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // 模拟订单结果
    const result = Math.random() > 0.5 ? 'win' : 'loss';
    const profit = result === 'win' ? amount * 0.85 : -amount;

    const order = {
      id: nextOrderId++,
      userId,
      username: user.username,
      symbol,
      amount,
      prediction,
      result,
      profit,
      createdAt: new Date().toISOString(),
      completedAt: new Date(Date.now() + 60000).toISOString()
    };

    inMemoryData.orders.push(order);
    user.balance += profit;
    saveData();

    // broadcast order and stats updates
    broadcast('orders', inMemoryData.orders);
    broadcast('stats', getStats());

    res.json({ success: true, message: 'Order placed', order });
  } catch (err) {
    console.error('Order error:', err);
    res.status(500).json({ success: false, message: 'Order failed' });
  }
});

// ============ 理财产品（后台管理 + 前端显示）============
app.get('/api/wealth/products', (req, res) => {
  res.json({
    success: true,
    products: inMemoryData.products.length > 0 ? inMemoryData.products : [
      { id: 1, name: '30-Day Low Risk', rate: 8.5, minAmount: 100 },
      { id: 2, name: '90-Day Medium', rate: 12.0, minAmount: 500 }
    ]
  });
});

// 后台新增理财产品
app.post('/api/admin/wealth/products', (req, res) => {
  try {
    const { name, rate, minAmount, maxAmount, duration } = req.body;
    if (!name || !rate) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const product = {
      id: nextProductId++,
      name,
      rate,
      minAmount: minAmount || 100,
      maxAmount: maxAmount || 100000,
      duration: duration || 30,
      createdAt: new Date().toISOString()
    };

    inMemoryData.products.push(product);
    saveData();

    res.json({ success: true, message: 'Product created', product });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Creation failed' });
  }
});

// ============ 币种兑换（用户下单 + 后台查看）============
app.post('/api/exchange/convert', (req, res) => {
  try {
    const { userId, fromSymbol, toSymbol, amount } = req.body;
    if (!userId || !fromSymbol || !toSymbol || !amount) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const user = inMemoryData.users.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const exchange = {
      id: nextExchangeId++,
      userId,
      username: user.username,
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

    // broadcast exchange records and stats
    broadcast('exchange-records', inMemoryData.exchanges);
    broadcast('stats', getStats());

    res.json({ success: true, message: 'Exchange completed', exchange });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Exchange failed' });
  }
});

// 后台查看充值订单（带格式化字段）
app.get('/api/admin/recharge-orders', (req, res) => {
  const orders = inMemoryData.recharge_orders.map(o => ({
    id: o.id,
    user_id: o.userId,
    username: o.username,
    amount: o.amount,
    method: o.method || 'transfer',
    status: o.status || '待处理',
    created_at: o.createdAt
  }));
  res.json({ success: true, data: orders });
});

// 后台查看兑换汇率
app.get('/api/admin/exchange-rates', (req, res) => {
  const rates = [
    { id: 1, from_currency: 'USDT', to_currency: 'CNY', rate: 7.2, fee_rate: 0.5, updated_at: new Date().toISOString() },
    { id: 2, from_currency: 'BTC', to_currency: 'USDT', rate: 45000, fee_rate: 1, updated_at: new Date().toISOString() },
    { id: 3, from_currency: 'ETH', to_currency: 'USDT', rate: 2500, fee_rate: 1, updated_at: new Date().toISOString() }
  ];
  res.json({ success: true, data: rates });
});

// 后台查看兑换记录（带格式化字段）
app.get('/api/admin/exchange-records', (req, res) => {
  const records = inMemoryData.exchanges.map(e => ({
    id: e.id,
    user_id: e.userId,
    username: e.username,
    from_currency: e.fromSymbol,
    amount: e.fromAmount,
    to_currency: e.toSymbol,
    exchanged_amount: e.toAmount,
    created_at: e.createdAt
  }));
  res.json({ success: true, data: records });
});

// ============ 充值管理（后台配置 + 前端查询 + 用户申请）============
app.get('/api/recharge/config', (req, res) => {
  res.json({ success: true, config: inMemoryData.recharge_config });
});

// 后台更新充值配置
app.post('/api/admin/recharge/config', (req, res) => {
  try {
    const { address, minAmount, maxAmount } = req.body;
    if (address) inMemoryData.recharge_config.address = address;
    if (minAmount) inMemoryData.recharge_config.minAmount = minAmount;
    if (maxAmount) inMemoryData.recharge_config.maxAmount = maxAmount;
    
    saveData();
    res.json({ success: true, message: 'Config updated', config: inMemoryData.recharge_config });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Config update failed' });
  }
});

// 用户提交充值申请
app.post('/api/recharge/apply', (req, res) => {
  try {
    const { userId, amount, txHash } = req.body;
    if (!userId || !amount) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const user = inMemoryData.users.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const order = {
      id: nextRechargeOrderId++,
      userId,
      username: user.username,
      amount,
      txHash: txHash || 'manual',
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    inMemoryData.recharge_orders.push(order);
    saveData();

    // broadcast recharge orders and stats
    broadcast('recharge-orders', inMemoryData.recharge_orders);
    broadcast('stats', getStats());

    res.json({ success: true, message: 'Recharge request submitted', order });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Recharge request failed' });
  }
});

// ============ 借贷申请（用户提交 + 后台查看）============
app.post('/api/lending/apply', (req, res) => {
  try {
    const { userId, productId, amount, term } = req.body;
    if (!userId || !amount) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const user = inMemoryData.users.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const lending = {
      id: nextLendingId++,
      userId,
      username: user.username,
      productId,
      amount,
      term: term || 30,
      status: 'pending',
      appliedAt: new Date().toISOString(),
      approvedAt: null
    };

    inMemoryData.lending_requests.push(lending);
    saveData();

    // broadcast lending requests and stats
    broadcast('lending-requests', inMemoryData.lending_requests);
    broadcast('stats', getStats());

    res.json({ success: true, message: 'Lending application submitted', lending });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lending application failed' });
  }
});

// 后台查看借贷产品（带格式化字段）
app.get('/api/admin/lending-products', (req, res) => {
  const products = [
    { id: 1, name: '30天理财', interest_rate: 5, term_days: 30, min_amount: 100 },
    { id: 2, name: '90天理财', interest_rate: 8, term_days: 90, min_amount: 1000 },
    { id: 3, name: '180天理财', interest_rate: 12, term_days: 180, min_amount: 5000 }
  ];
  res.json({ success: true, data: products });
});

// 后台查看借贷申请（带格式化字段）
app.get('/api/admin/lending-requests', (req, res) => {
  const requests = inMemoryData.lending_requests.map(r => ({
    id: r.id,
    user_id: r.userId,
    username: r.username,
    product_id: r.productId,
    amount: r.amount,
    term_days: r.term || 30,
    status: r.status || '待审核',
    created_at: r.appliedAt
  }));
  res.json({ success: true, data: requests });
});

// ============ 提现管理（用户申请 + 后台查看）============
app.post('/api/withdrawal/apply', (req, res) => {
  try {
    const { userId, symbol, amount, address } = req.body;
    if (!userId || !symbol || !amount || !address) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
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
