// 简化的FoxPro Exchange服务器 - 用于Render部署
const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const tempDataStore = require('./temp-datastore');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'foxpro-secret-key-2026';

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
app.post('/api/auth/register', (req, res) => {
  try {
    const { username, email, phone, password } = req.body;

    if (!username || !email || !phone || !password) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // 检查用户是否存在
    if (tempDataStore.getUser(username.toLowerCase())) {
      return res.status(400).json({ success: false, message: 'Username already exists' });
    }

    // 创建新用户
    const userId = 'user_' + Math.floor(100000 + Math.random() * 900000);
    const newUser = {
      id: userId,
      username: username.toLowerCase(),
      email: email,
      password: password,
      phone: phone,
      country: 'CN',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    tempDataStore.addUser(newUser);

    // 生成JWT Token
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
        email: email,
        phone: phone
      },
      token: token
    });
  } catch (error) {
    console.error('Registration error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 用户登录
app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password required' });
    }

    const user = tempDataStore.getUser(username.toLowerCase());
    if (!user || user.password !== password) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign({
      id: user.id,
      username: user.username,
      email: user.email,
      isAdmin: 0
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

// 获取用户信息
app.get('/api/auth/profile', (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = tempDataStore.getUserById(decoded.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone
      }
    });
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
});

// 静态文件服务
app.use(express.static(path.join(__dirname)));

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n========================================`);
  console.log(`   FoxPro Exchange Server`);
  console.log(`   Port: ${PORT}`);
  console.log(`========================================\n`);
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log(`✅ API Base: http://localhost:${PORT}/api`);
  console.log(`\nMain endpoints:`);
  console.log(`  POST /api/auth/register     - User registration`);
  console.log(`  POST /api/auth/login        - User login`);
  console.log(`  GET  /api/auth/profile      - Get user profile`);
  console.log(`  GET  /health                - Health check`);
  console.log(`\n========================================\n`);
});

module.exports = app;
