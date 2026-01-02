// FoxPro Exchange - 最小化生产启动文件
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

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

// ============ 健康检查端点 ============
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

// ============ 模拟市场数据 ============
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

// ============ API 路由 ============

// 市场数据
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

// 模拟认证
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (username && password) {
    res.json({
      success: true,
      message: '登录成功',
      token: 'mock-token-' + Date.now(),
      user: { id: 1, username, email: username + '@foxpro.com' }
    });
  } else {
    res.status(400).json({ success: false, message: '用户名或密码不能为空' });
  }
});

app.post('/api/auth/register', (req, res) => {
  const { username, email, password } = req.body;
  if (username && email && password) {
    res.json({
      success: true,
      message: '注册成功',
      user: { id: 2, username, email }
    });
  } else {
    res.status(400).json({ success: false, message: '缺少必要字段' });
  }
});

// 模拟用户数据
app.get('/api/user/profile', (req, res) => {
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
      totalUsers: 1250,
      activeUsers: 580,
      totalVolume: 5250000,
      totalTransactions: 12580
    }
  });
});

// 用户列表
app.get('/api/admin/users', (req, res) => {
  res.json({
    success: true,
    users: [
      { id: 1, username: 'user1', email: 'user1@foxpro.com', registeredAt: '2025-12-01', status: 'active' },
      { id: 2, username: 'user2', email: 'user2@foxpro.com', registeredAt: '2025-12-02', status: 'active' },
      { id: 3, username: 'user3', email: 'user3@foxpro.com', registeredAt: '2025-12-03', status: 'inactive' }
    ],
    total: 1250
  });
});

// 初级认证审核列表
app.get('/api/admin/auth/primary', (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 1, username: 'user4', status: '待审核', submittedAt: '2025-12-28' },
      { id: 2, username: 'user5', status: '待审核', submittedAt: '2025-12-27' }
    ]
  });
});

// 高级认证审核列表
app.get('/api/admin/auth/advanced', (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 1, username: 'user6', status: '待审核', submittedAt: '2025-12-28' }
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
      { id: 1, symbol: 'BTC', amount: 100, result: 'win', createdAt: '2025-12-28' },
      { id: 2, symbol: 'ETH', amount: 50, result: 'loss', createdAt: '2025-12-28' }
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
      createdAt: '2025-12-28',
      details: 'Trade details...'
    }
  });
});

// 认证审核通过
app.post('/api/admin/auth/approve', (req, res) => {
  res.json({
    success: true,
    message: '认证已通过'
  });
});

// 认证审核拒绝
app.post('/api/admin/auth/reject', (req, res) => {
  res.json({
    success: true,
    message: '认证已拒绝'
  });
});

// 理财产品列表
app.get('/api/wealth/products', (req, res) => {
  res.json({
    success: true,
    products: [
      { id: 1, name: '30天低风险产品', rate: 8.5, minAmount: 100 },
      { id: 2, name: '90天中等产品', rate: 12.0, minAmount: 500 }
    ]
  });
});

// 兑换记录
app.get('/api/admin/exchange/records', (req, res) => {
  res.json({
    success: true,
    records: [
      { id: 1, userId: 1, from: 'BTC', to: 'USDT', amount: 0.5, createdAt: '2025-12-28' }
    ]
  });
});

// 用户兑换记录
app.get('/api/admin/exchange/user/:userId', (req, res) => {
  res.json({
    success: true,
    records: [
      { id: 1, from: 'BTC', to: 'USDT', amount: 0.5, createdAt: '2025-12-28' }
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

// 更新充值配置
app.post('/api/api/admin/recharge/config', (req, res) => {
  res.json({
    success: true,
    message: '配置已更新'
  });
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

// 更新币种充值配置
app.post('/api/api/admin/recharge/config/:coin', (req, res) => {
  res.json({
    success: true,
    message: `${req.params.coin}配置已更新`
  });
});

// 充值订单
app.get('/api/api/admin/recharge/orders', (req, res) => {
  res.json({
    success: true,
    orders: [
      { id: 1, userId: 1, coin: 'BTC', amount: 0.1, status: 'completed', createdAt: '2025-12-28' }
    ]
  });
});

// 提现记录
app.get('/api/admin/withdraw/records', (req, res) => {
  res.json({
    success: true,
    records: [
      { id: 1, userId: 1, coin: 'BTC', amount: 0.05, status: 'pending', createdAt: '2025-12-28' }
    ]
  });
});

// 前端页面路由
const pages = [
  'index', 'login', 'register', 'account', 'market', 'trade', 'exchange', 
  'lending-products', 'recharge', 'withdraw', 'admin', 'admin-login', 'assets', 'customer-support'
];

pages.forEach(page => {
  app.get(`/${page}`, (req, res) => {
    const filePath = path.join(__dirname, `${page}.html`);
    res.sendFile(filePath, (err) => {
      if (err) {
        console.warn(`页面不存在: ${page}.html`);
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
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

// ============ 启动服务器 ============
const server = app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   🚀 FoxPro Exchange 生产服务器        ║
╠════════════════════════════════════════╣
║ 地址: http://localhost:${PORT.toString().padEnd(30)}║
║ 环境: ${(process.env.NODE_ENV || 'production').toUpperCase().padEnd(33)}║
╚════════════════════════════════════════╝
  `);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('收到SIGTERM，正在关闭服务器...');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('收到SIGINT，正在关闭服务器...');
  server.close(() => {
    process.exit(0);
  });
});

// 未捕获异常处理
process.on('uncaughtException', (err) => {
  console.error('未捕获的异常:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('未处理的Promise拒绝:', reason);
  process.exit(1);
});

module.exports = app;
