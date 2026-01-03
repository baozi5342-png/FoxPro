// FoxPro Exchange - 完整生产服务器（完整的数据流）
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');

// 确保data目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ============ 中间件 ============
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(express.static(path.join(__dirname)));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ============ WebSocket (实时双向流) ============
const WebSocket = require('ws');
let wss;
function broadcast(type, payload) {
  if (!wss) return;
  const message = JSON.stringify({ type, payload });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function getStats() {
  return {
    totalUsers: inMemoryData.users.length,
    activeUsers: inMemoryData.users.filter(u => u.status === 'active').length,
    totalVolume: inMemoryData.orders.length * 100,
    totalTransactions: inMemoryData.orders.length + inMemoryData.exchanges.length + inMemoryData.recharge_orders.length
  };
}

function getFormattedUsers() {
  return inMemoryData.users.map(u => ({
    id: u.id,
    username: u.username,
    email: u.email,
    phone: u.phone,
    created_at: u.createdAt,
    status: u.status || 'active',
    kyc_status: u.kyc_status || 'unverified'
  }));
}

// ============ 内存数据存储 ============
let inMemoryData = {
  users: [],
  kyc_requests: [],  // KYC认证申请
  orders: [],        // 秒合约订单
  products: [],      // 理财产品
  exchanges: [],     // 兑换记录
  recharge_config: {
    address: 'Default Address',
    minAmount: 10,
    maxAmount: 100000
  },
  recharge_orders: [],  // 充值订单
  lending_requests: [], // 借贷申请
  withdrawal_orders: [], // 提现订单
  quickContractPeriods: [ // 秒合约周期配置
    { id: 1, seconds: 30, profitRate: 40 },
    { id: 2, seconds: 60, profitRate: 50 },
    { id: 3, seconds: 120, profitRate: 60 },
    { id: 4, seconds: 180, profitRate: 80 },
    { id: 5, seconds: 300, profitRate: 100 }
  ]
};

let nextUserId = 1;
let nextKycId = 1;
let nextOrderId = 1;
let nextProductId = 1;
let nextExchangeId = 1;
let nextRechargeOrderId = 1;
let nextLendingId = 1;
let nextWithdrawalId = 1;

function saveData() {
  fs.writeFileSync(
    path.join(DATA_DIR, 'data.json'),
    JSON.stringify(inMemoryData, null, 2)
  );
}

function loadData() {
  try {
    const dataPath = path.join(DATA_DIR, 'data.json');
    if (fs.existsSync(dataPath)) {
      const loaded = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      inMemoryData = { ...inMemoryData, ...loaded };
      if (inMemoryData.users.length > 0) {
        nextUserId = Math.max(...inMemoryData.users.map(u => u.id)) + 1;
      }
      if (inMemoryData.kyc_requests.length > 0) {
        nextKycId = Math.max(...inMemoryData.kyc_requests.map(k => k.id)) + 1;
      }
      if (inMemoryData.orders.length > 0) {
        nextOrderId = Math.max(...inMemoryData.orders.map(o => o.id)) + 1;
      }
      if (inMemoryData.products.length > 0) {
        nextProductId = Math.max(...inMemoryData.products.map(p => p.id)) + 1;
      }
      if (inMemoryData.exchanges.length > 0) {
        nextExchangeId = Math.max(...inMemoryData.exchanges.map(e => e.id)) + 1;
      }
    }
  } catch (err) {
    console.warn('Failed to load data:', err.message);
  }
}

loadData();

// ============ 健康检查 ============
app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
});

// ============ 市场数据 ============
const mockMarkets = [
  { symbol: 'BTC', name: 'Bitcoin', currentPrice: 42500, priceChangePercent24h: 2.5, rank: 1 },
  { symbol: 'ETH', name: 'Ethereum', currentPrice: 2250, priceChangePercent24h: 1.8, rank: 2 },
  { symbol: 'SOL', name: 'Solana', currentPrice: 185, priceChangePercent24h: 3.2, rank: 3 },
  { symbol: 'BNB', name: 'Binance Coin', currentPrice: 620, priceChangePercent24h: 2.1, rank: 4 },
  { symbol: 'XRP', name: 'Ripple', currentPrice: 3.15, priceChangePercent24h: 1.5, rank: 5 },
  { symbol: 'ADA', name: 'Cardano', currentPrice: 1.25, priceChangePercent24h: 2.3, rank: 6 },
  { symbol: 'DOGE', name: 'Dogecoin', currentPrice: 0.42, priceChangePercent24h: 4.2, rank: 7 },
  { symbol: 'LTC', name: 'Litecoin', currentPrice: 195, priceChangePercent24h: 1.9, rank: 8 }
];

app.get('/api/markets', (req, res) => {
  res.json({ success: true, markets: mockMarkets });
});

app.get('/api/prices', (req, res) => {
  const prices = {};
  mockMarkets.forEach(m => {
    prices[m.symbol] = { price: m.currentPrice, change: m.priceChangePercent24h };
  });
  res.json({ success: true, prices });
});

// ============ 认证 API ============
app.post('/api/auth/register', (req, res) => {
  try {
    const { username, email, password, phone } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    if (inMemoryData.users.find(u => u.username === username || u.email === email)) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    const newUser = {
      id: nextUserId++,
      username,
      email,
      phone: phone || '',
      password: Buffer.from(password).toString('base64'),
      createdAt: new Date().toISOString(),
      status: 'active',
      kyc_status: 'unverified',
      balance: 0
    };

    inMemoryData.users.push(newUser);
    saveData();

    res.json({
      success: true,
      message: 'Registration successful',
      user: { id: newUser.id, username: newUser.username, email: newUser.email }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Registration failed' });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password required' });
    }

    const user = inMemoryData.users.find(u => (u.username === username || u.email === username));
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const decodedPassword = Buffer.from(user.password, 'base64').toString('utf8');
    if (decodedPassword !== password) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    res.json({
      success: true,
      message: 'Login successful',
      token: 'token-' + user.id + '-' + Date.now(),
      user: { id: user.id, username: user.username, email: user.email, kyc_status: user.kyc_status }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
});

// ============ KYC认证提交（用户端） ============
app.post('/api/auth/submit-kyc/primary', (req, res) => {
  try {
    const { userId, name, idNumber, idType } = req.body;
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

process.on('SIGTERM', () => {
  console.log('Shutting down...');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('Shutting down...');
  server.close(() => process.exit(0));
});

module.exports = app;
