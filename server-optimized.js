// FoxPro Exchange - 完整后端服务器（优化版）
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const app = express();

// ============ 配置 ============
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const JWT_SECRET = process.env.JWT_SECRET || 'foxpro-secret-key-2026';

const getMongoDBURL = () => {
  if (process.env.MONGODB_URI) {
    return process.env.MONGODB_URI;
  }
  const username = encodeURIComponent('root');
  const password = encodeURIComponent('Dd112211');
  const cluster = 'cluster0.rnxc0c4.mongodb.net';
  const dbName = 'foxpro';
  return `mongodb+srv://${username}:${password}@${cluster}/${dbName}?appName=Cluster0&retryWrites=true&w=majority`;
};

// ============ 中间件 ============
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(express.static(path.join(__dirname)));

// 请求日志
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ============ 导入路由 ============
const authRoutes = require('./backend/routes/authRoutes');
const userRoutes = require('./backend/routes/userRoutes');
const assetRoutes = require('./backend/routes/assetRoutes');
const orderRoutes = require('./backend/routes/orderRoutes');
const marketRoutes = require('./backend/routes/marketRoutes');
const { verifyToken } = require('./backend/middleware/auth');

// ============ MongoDB 连接 ============
let mongoConnected = false;

async function connectMongoDB() {
  try {
    const mongoURL = getMongoDBURL();
    console.log('🔄 正在连接MongoDB...');
    
    await mongoose.connect(mongoURL, { 
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 45000
    });
    
    mongoConnected = true;
    console.log('✅ MongoDB 连接成功！');
    
    // 初始化市场数据
    await initializeMarketData();
    
    return true;
  } catch (err) {
    console.error('❌ MongoDB 连接失败:', err.message);
    mongoConnected = false;
    return false;
  }
}

// 初始化市场数据
async function initializeMarketData() {
  try {
    const Market = require('./backend/models/Market');
    const existingMarkets = await Market.countDocuments();
    
    if (existingMarkets === 0) {
      const defaultMarkets = [
        { symbol: 'BTC', name: 'Bitcoin', currentPrice: 42500, priceChangePercent24h: 2.5, rank: 1 },
        { symbol: 'ETH', name: 'Ethereum', currentPrice: 2250, priceChangePercent24h: 1.8, rank: 2 },
        { symbol: 'SOL', name: 'Solana', currentPrice: 185, priceChangePercent24h: 3.2, rank: 3 },
        { symbol: 'BNB', name: 'Binance Coin', currentPrice: 620, priceChangePercent24h: 2.1, rank: 4 },
        { symbol: 'XRP', name: 'Ripple', currentPrice: 3.15, priceChangePercent24h: 1.5, rank: 5 },
        { symbol: 'ADA', name: 'Cardano', currentPrice: 1.25, priceChangePercent24h: 2.3, rank: 6 },
        { symbol: 'DOGE', name: 'Dogecoin', currentPrice: 0.42, priceChangePercent24h: 4.2, rank: 7 },
        { symbol: 'LTC', name: 'Litecoin', currentPrice: 195, priceChangePercent24h: 1.9, rank: 8 }
      ];

      for (const market of defaultMarkets) {
        await Market.create({
          ...market,
          high24h: market.currentPrice * 1.05,
          low24h: market.currentPrice * 0.95,
          volume24h: Math.floor(Math.random() * 1000000000),
          priceChange24h: market.currentPrice * (market.priceChangePercent24h / 100),
          createdAt: new Date()
        });
      }
      
      console.log('📊 市场数据已初始化');
    }
  } catch (error) {
    console.error('初始化市场数据失败:', error.message);
  }
}

// ============ API 路由 ============

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    mongoConnected
  });
});

// 认证
app.use('/api/auth', authRoutes);

// 用户
app.use('/api/user', userRoutes);

// 资产
app.use('/api/assets', assetRoutes);

// 订单
app.use('/api/orders', orderRoutes);
app.get('/api/quick-contract/config', orderRoutes.getQuickContractConfig);
app.post('/api/quick-contract/place', verifyToken, orderRoutes.placeQuickContract);
app.post('/api/spot/place-order', verifyToken, orderRoutes.placeSpotOrder);
app.post('/api/perpetual/open-position', verifyToken, orderRoutes.openPerpetualPosition);
app.get('/api/market-klines/:symbol', orderRoutes.getKlines);

// 市场
app.use('/api/market', marketRoutes);
app.get('/api/markets', marketRoutes.getMarkets);
app.get('/api/prices', marketRoutes.getAllPrices);

// ============ 前端页面 ============
const pages = [
  '/', 'index.html', 'account', 'market', 'trade', 'exchange',
  'lending-products', 'login', 'register', 'recharge', 'withdraw',
  'admin', 'admin-login', 'assets', 'customer-support'
];

pages.forEach(page => {
  app.get(page === '/' ? '/' : '/' + page, (req, res) => {
    const fileName = page === '/' ? 'index.html' : (page.endsWith('.html') ? page : page + '.html');
    res.sendFile(path.join(__dirname, fileName));
  });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Not found'
  });
});

// ============ 启动服务器 ============
async function start() {
  try {
    // 连接数据库
    await connectMongoDB();
    
    // 启动服务器
    app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════╗
║   🚀 FoxPro Exchange Server 已启动     ║
╠════════════════════════════════════════╣
║ 服务器: http://localhost:${PORT}              ║
║ 环境: ${NODE_ENV.toUpperCase().padEnd(30)} ║
║ MongoDB: ${mongoConnected ? '✅ 已连接' : '⚠️  未连接'.padEnd(28)} ║
╚════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('❌ 启动失败:', error.message);
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGTERM', async () => {
  console.log('正在关闭...');
  if (mongoConnected) {
    await mongoose.connection.close();
  }
  process.exit(0);
});

start();

module.exports = app;
