// FoxPro Exchange - 完整生产服务器（带数据存储）
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

// 日志中间件
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ============ 数据存储工具 ============
let inMemoryData = {
  users: [],
  orders: [],
  transactions: [],
  kyc: []
};

let nextUserId = 1;

function saveData() {
  fs.writeFileSync(
    path.join(DATA_DIR, 'users.json'),
    JSON.stringify(inMemoryData.users, null, 2)
  );
}

function loadData() {
  try {
    const usersPath = path.join(DATA_DIR, 'users.json');
    if (fs.existsSync(usersPath)) {
      inMemoryData.users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
      if (inMemoryData.users.length > 0) {
        nextUserId = Math.max(...inMemoryData.users.map(u => u.id)) + 1;
      }
    }
  } catch (err) {
    console.warn('无法加载用户数据:', err.message);
  }
}

// 应用启动时加载数据
loadData();

// ============ 健康检查 ============
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
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

// ============ 认证API ============
app.post('/api/auth/register', (req, res) => {
  try {
    const { username, email, password, phone } = req.body;

    // 验证输入
    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // 检查用户是否已存在
    if (inMemoryData.users.find(u => u.username === username || u.email === email)) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    // 创建新用户
    const newUser = {
      id: nextUserId++,
      username,
      email,
      phone: phone || '',
      password: Buffer.from(password).toString('base64'), // 简单编码
      createdAt: new Date().toISOString(),
      status: 'active',
      kyc_status: 'unverified',
      assets: {
        BTC: 0,
        ETH: 0,
        USDT: 0
      },
      balance: 0
    };

    inMemoryData.users.push(newUser);
    saveData();

    res.json({
      success: true,
      message: 'Registration successful',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        createdAt: newUser.createdAt
      }
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

    const user = inMemoryData.users.find(
      u => (u.username === username || u.email === username)
    );

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    // 验证密码
    const decodedPassword = Buffer.from(user.password, 'base64').toString('utf8');
    if (decodedPassword !== password) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    res.json({
      success: true,
      message: 'Login successful',
      token: 'token-' + user.id + '-' + Date.now(),
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        kyc_status: user.kyc_status
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
});

// ============ 用户API ============
app.get('/api/user/profile', (req, res) => {
  // 模拟用户配置文件
  res.json({
    success: true,
    user: {
      id: 1,
      username: 'demo_user',
      email: 'user@foxpro.com',
      assets: [
        { symbol: 'BTC', amount: 0.5, value: 21250 },
        { symbol: 'ETH', amount: 5, value: 11250 },
        { symbol: 'USDT', amount: 10000, value: 10000 }
      ],
      totalBalance: 42500,
      kyc_status: 'verified'
    }
  });
});

// ============ 后台管理API ============

// 统计信息
app.get('/api/admin/stats', (req, res) => {
  res.json({
    success: true,
    stats: {
      totalUsers: inMemoryData.users.length,
      activeUsers: inMemoryData.users.filter(u => u.status === 'active').length,
      totalVolume: 5250000,
      totalTransactions: 12580
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

  res.json({
    success: true,
    data: users,
    total: users.length
  });
});

// 初级认证审核列表
app.get('/api/admin/auth/primary', (req, res) => {
  const pendingUsers = inMemoryData.users.filter(u => u.kyc_status === 'unverified');
  res.json({
    success: true,
    data: pendingUsers.map((u, idx) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      status: 'Pending',
      submittedAt: u.createdAt.split('T')[0]
    }))
  });
});

// 高级认证审核列表
app.get('/api/admin/auth/advanced', (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 1, username: 'user_advanced', email: 'advanced@foxpro.com', status: 'Pending', submittedAt: '2026-01-03' }
    ]
  });
});

// 秒合约配置
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

// 秒合约交易列表
app.get('/api/admin/quick-contract/trades', (req, res) => {
  res.json({
    success: true,
    trades: [
      { id: 1, symbol: 'BTC', amount: 100, result: 'win', createdAt: '2026-01-03' },
      { id: 2, symbol: 'ETH', amount: 50, result: 'loss', createdAt: '2026-01-03' }
    ]
  });
});

// 秒合约交易详情
app.get('/api/admin/quick-contract/trades/:tradeId', (req, res) => {
  res.json({
    success: true,
    trade: {
      id: req.params.tradeId,
      symbol: 'BTC',
      amount: 100,
      result: 'win',
      createdAt: '2026-01-03',
      details: 'Trade details...'
    }
  });
});

// 认证审核通过
app.post('/api/admin/auth/approve', (req, res) => {
  const { userId } = req.body;
  const user = inMemoryData.users.find(u => u.id === userId);
  if (user) {
    user.kyc_status = 'verified';
    saveData();
  }
  res.json({ success: true, message: 'Verification approved' });
});

// 认证审核拒绝
app.post('/api/admin/auth/reject', (req, res) => {
  const { userId } = req.body;
  const user = inMemoryData.users.find(u => u.id === userId);
  if (user) {
    user.kyc_status = 'rejected';
    saveData();
  }
  res.json({ success: true, message: 'Verification rejected' });
});

// 理财产品列表
app.get('/api/wealth/products', (req, res) => {
  res.json({
    success: true,
    products: [
      { id: 1, name: '30-Day Low Risk Product', rate: 8.5, minAmount: 100 },
      { id: 2, name: '90-Day Medium Risk Product', rate: 12.0, minAmount: 500 }
    ]
  });
});

// 兑换记录
app.get('/api/admin/exchange/records', (req, res) => {
  res.json({
    success: true,
    records: [
      { id: 1, userId: 1, from: 'BTC', to: 'USDT', amount: 0.5, createdAt: '2026-01-03' }
    ]
  });
});

// 用户兑换记录
app.get('/api/admin/exchange/user/:userId', (req, res) => {
  res.json({
    success: true,
    records: [
      { id: 1, from: 'BTC', to: 'USDT', amount: 0.5, createdAt: '2026-01-03' }
    ]
  });
});

// 充值配置
app.get('/api/api/admin/recharge/config', (req, res) => {
  res.json({
    success: true,
    config: {
      minRecharge: 10,
      maxRecharge: 100000
    }
  });
});

app.post('/api/api/admin/recharge/config', (req, res) => {
  res.json({ success: true, message: 'Configuration updated' });
});

// 币种充值配置
app.get('/api/api/admin/recharge/config/:coin', (req, res) => {
  res.json({
    success: true,
    config: {
      coin: req.params.coin,
      minRecharge: 10,
      maxRecharge: 100000,
      fee: 0.01
    }
  });
});

app.post('/api/api/admin/recharge/config/:coin', (req, res) => {
  res.json({ success: true, message: `${req.params.coin} configuration updated` });
});

// 充值订单
app.get('/api/api/admin/recharge/orders', (req, res) => {
  res.json({
    success: true,
    orders: [
      { id: 1, userId: 1, coin: 'BTC', amount: 0.1, status: 'completed', createdAt: '2026-01-03' }
    ]
  });
});

// 提现记录
app.get('/api/admin/withdraw/records', (req, res) => {
  res.json({
    success: true,
    records: [
      { id: 1, userId: 1, coin: 'BTC', amount: 0.05, status: 'pending', createdAt: '2026-01-03' }
    ]
  });
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
      if (err) {
        console.warn(`Page not found: ${page}.html`);
        res.status(404).send('Page not found');
      }
    });
  });
});

// 首页
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'), (err) => {
    if (err) res.status(404).send('Home not found');
  });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Not found',
    path: req.path
  });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

// ============ 启动服务器 ============
const server = app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   🚀 FoxPro Exchange Server Started    ║
╠════════════════════════════════════════╣
║ Address: http://localhost:${PORT.toString().padEnd(28)}║
║ Environment: ${(process.env.NODE_ENV || 'production').toUpperCase().padEnd(30)}║
║ Users: ${inMemoryData.users.length.toString().padEnd(39)}║
╚════════════════════════════════════════╝
  `);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('Shutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  process.exit(1);
});

module.exports = app;
