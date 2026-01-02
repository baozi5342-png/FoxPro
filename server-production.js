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
  withdrawal_orders: [] // 提现订单
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

    res.json({ success: true, message: 'Advanced KYC submission successful', kyc: kycRequest });
  } catch (err) {
    console.error('Advanced KYC submit error:', err);
    res.status(500).json({ success: false, message: 'Advanced KYC submission failed' });
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
    registeredAt: u.createdAt.split('T')[0],
    status: u.status,
    kyc_status: u.kyc_status
  }));

  res.json({ success: true, data: users, total: users.length });
});

// ============ KYC认证审核（后台）============
app.get('/api/admin/auth/primary', (req, res) => {
  const requests = inMemoryData.kyc_requests.filter(k => k.type === 'primary');
  res.json({
    success: true,
    data: requests.map(k => ({
      id: k.id,
      userId: k.userId,
      username: k.username,
      name: k.name,
      idNumber: k.idNumber,
      idType: k.idType,
      status: k.status,
      submittedAt: k.submittedAt.split('T')[0]
    }))
  });
});

app.get('/api/admin/auth/advanced', (req, res) => {
  const requests = inMemoryData.kyc_requests.filter(k => k.type === 'advanced');
  res.json({
    success: true,
    data: requests.map(k => ({
      id: k.id,
      userId: k.userId,
      username: k.username,
      status: k.status,
      submittedAt: k.submittedAt.split('T')[0]
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
    res.json({ success: true, message: 'KYC rejected' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Rejection failed' });
  }
});

// ============ 秒合约配置（后台管理 + 前端查询）============
app.get('/api/admin/quick-contract/config', (req, res) => {
  res.json({
    success: true,
    config: {
      minBet: 1,
      maxBet: 10000,
      duration: 60,
      returnRate: 0.85
    }
  });
});

// 前端查询秒合约配置
app.get('/api/quick-contract/config', (req, res) => {
  res.json({
    success: true,
    config: {
      minBet: 1,
      maxBet: 10000,
      duration: 60,
      returnRate: 0.85
    }
  });
});

// 秒合约交易列表（后台）
app.get('/api/admin/quick-contract/trades', (req, res) => {
  const trades = inMemoryData.orders.map(o => ({
    id: o.id,
    userId: o.userId,
    username: o.username,
    symbol: o.symbol,
    amount: o.amount,
    result: o.result,
    createdAt: o.createdAt.split('T')[0]
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

    res.json({ success: true, message: 'Exchange completed', exchange });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Exchange failed' });
  }
});

// 后台查看兑换记录
app.get('/api/admin/exchange/records', (req, res) => {
  res.json({ success: true, data: inMemoryData.exchanges });
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

    res.json({ success: true, message: 'Recharge request submitted', order });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Recharge request failed' });
  }
});

// 后台查看充值订单
app.get('/api/admin/recharge/orders', (req, res) => {
  res.json({ success: true, data: inMemoryData.recharge_orders });
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

    res.json({ success: true, message: 'Lending application submitted', lending });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lending application failed' });
  }
});

// 后台查看借贷申请
app.get('/api/admin/lending/requests', (req, res) => {
  res.json({ success: true, data: inMemoryData.lending_requests });
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

    res.json({ success: true, message: 'Withdrawal request submitted', withdrawal });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Withdrawal request failed' });
  }
});

// 后台查看提现订单
app.get('/api/admin/withdrawal/orders', (req, res) => {
  res.json({ success: true, data: inMemoryData.withdrawal_orders });
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

process.on('SIGTERM', () => {
  console.log('Shutting down...');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('Shutting down...');
  server.close(() => process.exit(0));
});

module.exports = app;
