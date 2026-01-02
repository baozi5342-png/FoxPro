// 简化的FoxPro Exchange服务器 - 用于Render部署（使用MongoDB）
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'foxpro-secret-key-2026';

// ============ MongoDB 连接 ============
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
    await mongoose.connect(mongoURL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB 连接成功');
    return true;
  } catch (err) {
    console.error('❌ MongoDB 连接失败:', err.message);
    return false;
  }
}

// ============ MongoDB 用户模型 ============
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

// 中间件
app.use(cors());
app.use(express.json());

// 调试日志中间件
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ============ API 路由 ============

// 用户注册
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, phone, password } = req.body;

    if (!username || !email || !phone || !password) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // 检查用户是否存在
    const existingUser = await User.findOne({ username: username.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Username already exists' });
    }

    // 创建新用户
    const userId = 'user_' + Math.floor(100000 + Math.random() * 900000);
    const newUser = new User({
      id: userId,
      username: username.toLowerCase(),
      email: email,
      password: password,
      phone: phone,
      country: 'CN',
      status: 'active',
      isAdmin: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await newUser.save();

    const token = jwt.sign({
      id: userId,
      username: username.toLowerCase(),
      email: email,
      isAdmin: 0
    }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      message: 'Registration successful',
      user: {
        id: userId,
        username: username.toLowerCase(),
        email: email
      },
      token: token
    });
  } catch (error) {
    console.error('Registration error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 用户登录
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password required' });
    }

    const user = await User.findOne({ username: username.toLowerCase() });
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
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      },
      token: token
    });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ success: false, message: error.message });
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
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// ============ 后台管理API ============

// 获取所有用户（后台专用）
app.get('/api/admin/users', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    // 验证token
    try {
      jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    // 获取所有用户
    const users = await User.find({}, { password: 0 }).lean();

    res.json({
      success: true,
      data: users.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        country: user.country,
        status: user.status,
        createdAt: user.createdAt
      }))
    });
  } catch (error) {
    console.error('Failed to load users:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取统计数据（后台仪表盘）
app.get('/api/admin/stats', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    // 验证token
    try {
      jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    // 获取统计数据
    const totalUsers = await User.countDocuments();

    res.json({
      success: true,
      data: {
        totalUsers: totalUsers,
        totalOrders: 0,
        pendingVerifications: 0,
        totalRevenue: 0
      }
    });
  } catch (error) {
    console.error('Failed to load stats:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ 启动服务器 ============
const PORT = process.env.PORT || 3000;

async function startServer() {
  // 尝试连接MongoDB
  const mongoConnected = await connectMongoDB();

  app.listen(PORT, () => {
    console.log(`\n🚀 FoxPro Exchange 服务器运行在 http://localhost:${PORT}`);
    console.log(`📊 数据存储: ${mongoConnected ? 'MongoDB (持久化)' : '内存存储 (临时)'}`);
    console.log('\n可用的API端点:');
    console.log(`  POST /api/auth/register     - User registration`);
    console.log(`  POST /api/auth/login        - User login`);
    console.log(`  GET  /api/auth/profile      - User profile`);
    console.log(`  GET  /health                - Health check`);
  });
}

startServer();
