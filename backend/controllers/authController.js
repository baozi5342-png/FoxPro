// 认证控制器
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const JWT_SECRET = process.env.JWT_SECRET || 'foxpro-secret-key-2026';

// 生成token
const generateToken = (user) => {
  return jwt.sign({
    id: user.id,
    username: user.username,
    email: user.email,
    isAdmin: user.isAdmin
  }, JWT_SECRET, { expiresIn: '7d' });
};

// 注册
exports.register = async (req, res) => {
  try {
    const { username, email, phone, password, country } = req.body;
    
    if (!username || !email || !phone || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields' 
      });
    }

    // 检查用户是否已存在
    const existingUser = await User.findOne({ username: username.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username already exists' 
      });
    }

    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email already registered' 
      });
    }

    const userId = 'user_' + Math.floor(100000 + Math.random() * 900000);
    const timestamp = new Date().toISOString();

    // 创建新用户
    const newUser = new User({
      id: userId,
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password: password, // 在生产环境应该加密
      phone: phone,
      country: country || 'CN',
      status: 'active',
      isAdmin: 0,
      balance: 10000, // 初始余额
      createdAt: timestamp,
      updatedAt: timestamp,
      kycStatus: 'unverified'
    });

    await newUser.save();
    const token = generateToken(newUser);

    res.json({
      success: true,
      message: 'Registration successful',
      user: { 
        id: userId, 
        username: username.toLowerCase(), 
        email: email.toLowerCase() 
      },
      token: token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Registration failed' 
    });
  }
};

// 登录
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username and password required' 
      });
    }

    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    // 密码验证（生产环境应该使用bcrypt）
    if (user.password !== password) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    if (user.status === 'disabled' || user.status === 'suspended') {
      return res.status(403).json({ 
        success: false, 
        message: 'Account is suspended' 
      });
    }

    // 更新最后登录时间
    user.lastLoginAt = new Date().toISOString();
    await user.save();

    const token = generateToken(user);

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        balance: user.balance,
        kycStatus: user.kycStatus,
        kycLevel: user.kycLevel
      },
      token: token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Login failed' 
    });
  }
};

// 获取当前用户信息
exports.getCurrentUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findOne({ id: userId }).select('-password');

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    res.json({
      success: true,
      user: user
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// 修改密码
exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Old and new passwords required' 
      });
    }

    const user = await User.findOne({ id: userId });
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    if (user.password !== oldPassword) {
      return res.status(401).json({ 
        success: false, 
        message: 'Incorrect old password' 
      });
    }

    user.password = newPassword;
    user.updatedAt = new Date().toISOString();
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};
