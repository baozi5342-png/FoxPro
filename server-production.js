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
