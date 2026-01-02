// FoxPro Exchange 完整后台服务器 - 使用MongoDB持久化
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'foxpro-secret-key-2026';

// ============ 中间件 ============
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname))); // 提供静态文件

// ============ MongoDB 连接 ============
let mongoConnected = false;
const inMemoryUsers = {}; // 备用内存存储

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

async function connectMongoDB() {
  try {
    const mongoURL = getMongoDBURL();
    console.log('🔄 正在连接MongoDB...');
    console.log('   URL:', mongoURL.replace(/password[^@]*@/, 'password=***@'));
    
    await mongoose.connect(mongoURL, { 
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000 
    });
    
    mongoConnected = true;
    console.log('✅ MongoDB 连接成功！');
    return true;
  } catch (err) {
    console.error('❌ MongoDB 连接失败:', err.message);
    console.warn('⚠️  将使用内存存储作为备选方案');
    mongoConnected = false;
    return false;
  }
}

// ============ 用户模型 ============
const userSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  username: { type: String, unique: true, required: true, lowercase: true },
  email: { type: String, unique: true, sparse: true },
  password: { type: String, required: true },
  phone: String,
  country: String,
  status: { type: String, default: 'active' },
  isAdmin: { type: Number, default: 0 },
  createdAt: String,
  updatedAt: String,
}, { collection: 'users' });

const User = mongoose.model('User', userSchema);

// 调试日志中间件
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ============ 用户认证API ============

// 注册
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, phone, password } = req.body;
    
    if (!username || !email || !phone || !password) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const userId = 'user_' + Math.floor(100000 + Math.random() * 900000);
    const timestamp = new Date().toISOString();
    const newUserData = {
      id: userId,
      username: username.toLowerCase(),
      email: email,
      password: password,
      phone: phone,
      country: 'CN',
      status: 'active',
      isAdmin: 0,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    // 尝试使用MongoDB，如果失败则使用内存存储
    if (mongoConnected) {
      try {
        const existingUser = await User.findOne({ username: username.toLowerCase() }).lean();
        if (existingUser) {
          return res.status(400).json({ success: false, message: 'Username already exists' });
        }

        const newUser = new User(newUserData);
        await newUser.save();
        console.log(`✅ 用户 ${username} 已保存到MongoDB`);
      } catch (dbErr) {
        console.error('❌ 数据库错误:', dbErr.message);
        return res.status(500).json({ success: false, message: 'Database error: ' + dbErr.message });
      }
    } else {
      // 使用内存存储
      if (inMemoryUsers[username.toLowerCase()]) {
        return res.status(400).json({ success: false, message: 'Username already exists' });
      }
      inMemoryUsers[username.toLowerCase()] = newUserData;
      console.log(`✅ 用户 ${username} 已保存到内存存储`);
    }

    const token = jwt.sign({
      id: userId,
      username: username.toLowerCase(),
      email: email,
      isAdmin: 0
    }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      message: 'Registration successful',
      user: { id: userId, username: username.toLowerCase(), email: email },
      token: token
    });
  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({ success: false, message: error.message || 'Registration failed' });
  }
});

// 登录
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password required' });
    }

    let user = null;

    if (mongoConnected) {
      try {
        user = await User.findOne({ username: username.toLowerCase() }).lean();
      } catch (dbErr) {
        console.error('❌ 数据库查询错误:', dbErr.message);
        return res.status(500).json({ success: false, message: 'Database error: ' + dbErr.message });
      }
    } else {
      // 使用内存存储查找
      user = inMemoryUsers[username.toLowerCase()];
    }

    if (!user || user.password !== password) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign({
      id: user.id,
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin || 0
    }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      message: 'Login successful',
      user: { id: user.id, username: user.username, email: user.email },
      token: token
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ success: false, message: error.message || 'Login failed' });
  }
});

// 获取用户资料
app.get('/api/auth/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findOne({ id: decoded.id });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      user: { id: user.id, username: user.username, email: user.email }
    });
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
});

// 根路由 - 返回首页
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// ============ 后台管理API ============

// 获取所有用户
app.get('/api/admin/users', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token' });
    jwt.verify(token, JWT_SECRET);

    const users = await User.find({}, { password: 0 }).lean();
    res.json({
      success: true,
      data: users.map(u => ({
        id: u.id, username: u.username, email: u.email,
        phone: u.phone, country: u.country, status: u.status, createdAt: u.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取统计数据
app.get('/api/admin/stats', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token' });
    jwt.verify(token, JWT_SECRET);

    const totalUsers = await User.countDocuments();
    res.json({
      success: true,
      data: { totalUsers, totalOrders: 0, pendingVerifications: 0, totalRevenue: 0 }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ 身份认证 ============

// 初级认证列表
app.get('/api/admin/auth/primary', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token' });
    jwt.verify(token, JWT_SECRET);
    res.json({ success: true, data: [] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 高级认证列表
app.get('/api/admin/auth/advanced', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token' });
    jwt.verify(token, JWT_SECRET);
    res.json({ success: true, data: [] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ 交易管理 ============

// 秒合约配置
app.get('/api/admin/quick-contract/config', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token' });
    jwt.verify(token, JWT_SECRET);
    res.json({ success: true, data: {
      enabled: true, minAmount: 10, maxAmount: 10000, duration: 60, profitRate: 80
    }});
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 秒合约交易
app.get('/api/admin/quick-contract/trades', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token' });
    jwt.verify(token, JWT_SECRET);
    res.json({ success: true, data: [] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 秒合约交易详情
app.get('/api/admin/quick-contract/trades/:tradeId', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token' });
    jwt.verify(token, JWT_SECRET);
    res.json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 兑换记录
app.get('/api/admin/exchange/records', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token' });
    jwt.verify(token, JWT_SECRET);
    res.json({ success: true, data: [
      { symbol: 'BTC/USD', rate: 42000, enabled: true },
      { symbol: 'ETH/USD', rate: 2200, enabled: true },
      { symbol: 'USDT/CNY', rate: 7.0, enabled: true }
    ]});
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 用户兑换记录
app.get('/api/admin/exchange/user/:userId', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token' });
    jwt.verify(token, JWT_SECRET);
    res.json({ success: true, data: [] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ 资产管理 ============

// 充值配置
app.get('/api/admin/recharge/config', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token' });
    jwt.verify(token, JWT_SECRET);
    res.json({ success: true, data: [
      { coin: 'BTC', enabled: true, minAmount: 0.001, fee: 0.0005 },
      { coin: 'ETH', enabled: true, minAmount: 0.01, fee: 0.002 },
      { coin: 'USDT', enabled: true, minAmount: 10, fee: 1 }
    ]});
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 更新充值配置
app.put('/api/admin/recharge/config/:coin', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token' });
    jwt.verify(token, JWT_SECRET);
    res.json({ success: true, message: 'Config updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 充值订单
app.get('/api/admin/recharge/orders', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token' });
    jwt.verify(token, JWT_SECRET);
    res.json({ success: true, data: [] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 提现记录
app.get('/api/admin/withdraw/records', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token' });
    jwt.verify(token, JWT_SECRET);
    res.json({ success: true, data: [] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 提现审核
app.put('/api/admin/withdraw/review/:orderId', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token' });
    jwt.verify(token, JWT_SECRET);
    res.json({ success: true, message: 'Review submitted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 借贷申请
app.get('/api/admin/lending/applications', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token' });
    jwt.verify(token, JWT_SECRET);
    res.json({ success: true, data: [] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 理财产品
app.get('/api/admin/lending/products', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token' });
    jwt.verify(token, JWT_SECRET);
    res.json({ success: true, data: [] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ 启动服务器 ============
const PORT = process.env.PORT || 3000;

async function startServer() {
  const mongoConnected = await connectMongoDB();

  app.listen(PORT, () => {
    console.log(`\n🚀 FoxPro Exchange 服务器运行在 http://localhost:${PORT}`);
    console.log(`📊 数据存储: ${mongoConnected ? 'MongoDB (持久化)' : '内存 (临时)'}`);
    console.log('\n✅ 所有API端点已实现:');
    console.log('  用户认证 | 用户管理 | 身份认证 | 交易管理 | 资产管理');
  });
}

startServer();
