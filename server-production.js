// FoxPro Exchange - 稳定的生产启动文件
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const app = express();

// ============ 配置 ============
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'foxpro-secret-key-2026';
const NODE_ENV = process.env.NODE_ENV || 'development';

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

// ============ MongoDB 连接 (异步，不阻塞启动) ============
let mongoConnected = false;

const getMongoDBURL = () => {
  if (process.env.MONGODB_URI) {
    return process.env.MONGODB_URI;
  }
  // 默认本地开发连接
  return 'mongodb://localhost:27017/foxpro';
};

// 异步连接MongoDB，不阻塞服务器启动
async function connectMongoDB() {
  try {
    const mongoURL = getMongoDBURL();
    console.log('🔄 正在连接MongoDB...');
    
    await mongoose.connect(mongoURL, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      retryWrites: true,
      w: 'majority'
    });
    
    mongoConnected = true;
    console.log('✅ MongoDB 连接成功！');
    
    // 初始化市场数据
    const Market = require('./backend/models/Market');
    const count = await Market.countDocuments();
    if (count === 0) {
      console.log('📊 初始化市场数据...');
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
      for (const m of defaultMarkets) {
        await Market.create(m);
      }
    }
  } catch (err) {
    console.warn('⚠️  MongoDB连接失败，服务器继续运行');
    console.warn('    错误:', err.message);
    mongoConnected = false;
  }
}

// ============ API 路由 ============

// 健康检查 (优先，不需要DB)
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    mongoConnected,
    timestamp: new Date().toISOString()
  });
});

// 静态API (不需要DB)
app.get('/api/markets', (req, res) => {
  if (mongoConnected) {
    // 从DB返回
    const Market = require('./backend/models/Market');
    Market.find({}).then(data => {
      res.json({ success: true, markets: data });
    }).catch(err => {
      res.json({ success: true, markets: getMockMarkets() });
    });
  } else {
    // 返回模拟数据
    res.json({ success: true, markets: getMockMarkets() });
  }
});

app.get('/api/prices', (req, res) => {
  const prices = {
    BTC: { price: 42500, change: 2.5 },
    ETH: { price: 2250, change: 1.8 },
    SOL: { price: 185, change: 3.2 },
    BNB: { price: 620, change: 2.1 },
    XRP: { price: 3.15, change: 1.5 },
    ADA: { price: 1.25, change: 2.3 },
    DOGE: { price: 0.42, change: 4.2 },
    LTC: { price: 195, change: 1.9 }
  };
  res.json({ success: true, prices });
});

// 导入其他路由 (如果MongoDB已连接)
if (mongoConnected || NODE_ENV === 'development') {
  try {
    const authRoutes = require('./backend/routes/authRoutes');
    const userRoutes = require('./backend/routes/userRoutes');
    const assetRoutes = require('./backend/routes/assetRoutes');
    const orderRoutes = require('./backend/routes/orderRoutes');
    const marketRoutes = require('./backend/routes/marketRoutes');
    const { verifyToken } = require('./backend/middleware/auth');

    app.use('/api/auth', authRoutes);
    app.use('/api/user', verifyToken, userRoutes);
    app.use('/api/assets', verifyToken, assetRoutes);
    app.use('/api/orders', verifyToken, orderRoutes);
    app.use('/api/market', marketRoutes);

    // 快捷路由
    app.get('/api/quick-contract/config', orderRoutes.getQuickContractConfig);
    app.post('/api/quick-contract/place', verifyToken, orderRoutes.placeQuickContract);
    app.post('/api/spot/place-order', verifyToken, orderRoutes.placeSpotOrder);
    app.post('/api/perpetual/open-position', verifyToken, orderRoutes.openPerpetualPosition);
    app.get('/api/market-klines/:symbol', orderRoutes.getKlines);
  } catch (err) {
    console.warn('⚠️  路由加载失败:', err.message);
  }
}

// 前端页面路由
const pages = ['index', 'login', 'register', 'account', 'market', 'trade', 'exchange', 
               'lending-products', 'recharge', 'withdraw', 'admin', 'admin-login', 'assets'];

pages.forEach(page => {
  app.get(`/${page}`, (req, res) => {
    res.sendFile(path.join(__dirname, `${page}.html`), (err) => {
      if (err) res.status(404).send('Page not found');
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
  console.error('错误:', err);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

// ============ 模拟市场数据 ============
function getMockMarkets() {
  return [
    { symbol: 'BTC', name: 'Bitcoin', currentPrice: 42500, priceChangePercent24h: 2.5, rank: 1 },
    { symbol: 'ETH', name: 'Ethereum', currentPrice: 2250, priceChangePercent24h: 1.8, rank: 2 },
    { symbol: 'SOL', name: 'Solana', currentPrice: 185, priceChangePercent24h: 3.2, rank: 3 },
    { symbol: 'BNB', name: 'Binance Coin', currentPrice: 620, priceChangePercent24h: 2.1, rank: 4 },
    { symbol: 'XRP', name: 'Ripple', currentPrice: 3.15, priceChangePercent24h: 1.5, rank: 5 },
    { symbol: 'ADA', name: 'Cardano', currentPrice: 1.25, priceChangePercent24h: 2.3, rank: 6 },
    { symbol: 'DOGE', name: 'Dogecoin', currentPrice: 0.42, priceChangePercent24h: 4.2, rank: 7 },
    { symbol: 'LTC', name: 'Litecoin', currentPrice: 195, priceChangePercent24h: 1.9, rank: 8 }
  ];
}

// ============ 启动服务器 ============
const server = app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   🚀 FoxPro Exchange 服务器已启动      ║
╠════════════════════════════════════════╣
║ 地址: http://localhost:${PORT}              ║
║ 环境: ${NODE_ENV.toUpperCase().padEnd(30)}║
║ MongoDB: ${mongoConnected ? '✅ 已连接' : '⚠️  离线'.padEnd(28)}║
╚════════════════════════════════════════╝
  `);

  // 异步连接MongoDB（不阻塞启动）
  connectMongoDB();
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('正在关闭服务器...');
  server.close(() => {
    if (mongoConnected) {
      mongoose.connection.close();
    }
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('正在关闭服务器...');
  server.close(() => {
    if (mongoConnected) {
      mongoose.connection.close();
    }
    process.exit(0);
  });
});

// 未捕获异常处理
process.on('uncaughtException', (err) => {
  console.error('未捕获的异常:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason);
});

module.exports = app;
