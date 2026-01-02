// 用户控制器
const User = require('../models/User');
const Asset = require('../models/Asset');

// 获取用户账户信息
exports.getAccount = async (req, res) => {
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
      account: {
        id: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        country: user.country,
        balance: user.balance,
        status: user.status,
        kycStatus: user.kycStatus,
        kycLevel: user.kycLevel,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Get account error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// 更新用户信息
exports.updateProfile = async (req, res) => {
  try {
    const { email, phone, country } = req.body;
    const userId = req.user.id;

    const user = await User.findOne({ id: userId });
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // 检查邮箱是否已被使用
    if (email && email !== user.email) {
      const existingEmail = await User.findOne({ email: email.toLowerCase() });
      if (existingEmail) {
        return res.status(400).json({ 
          success: false, 
          message: 'Email already in use' 
        });
      }
      user.email = email.toLowerCase();
    }

    if (phone) user.phone = phone;
    if (country) user.country = country;
    user.updatedAt = new Date().toISOString();

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        country: user.country
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// 获取用户余额
exports.getBalance = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findOne({ id: userId });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    res.json({
      success: true,
      balance: user.balance,
      fiatBalance: user.fiatBalance || 0
    });
  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// 调整用户余额（管理员功能）
exports.adjustBalance = async (req, res) => {
  try {
    // 检查是否是管理员
    if (req.user.isAdmin !== 1 && req.user.isAdmin !== 2) {
      return res.status(403).json({ 
        success: false, 
        message: 'Admin access required' 
      });
    }

    const { targetUserId, amount, type } = req.body; // type: add, subtract

    if (!targetUserId || !amount || !type) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields' 
      });
    }

    const user = await User.findOne({ id: targetUserId });
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Target user not found' 
      });
    }

    const oldBalance = user.balance;
    if (type === 'add') {
      user.balance += amount;
    } else if (type === 'subtract') {
      user.balance -= amount;
      if (user.balance < 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'Insufficient balance' 
        });
      }
    } else {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid type' 
      });
    }

    user.updatedAt = new Date().toISOString();
    await user.save();

    res.json({
      success: true,
      message: 'Balance adjusted successfully',
      balanceBefore: oldBalance,
      balanceAfter: user.balance
    });
  } catch (error) {
    console.error('Adjust balance error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// 获取所有用户（仅超级管理员）
exports.getAllUsers = async (req, res) => {
  try {
    if (req.user.isAdmin !== 2) {
      return res.status(403).json({ 
        success: false, 
        message: 'Super admin access required' 
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const users = await User.find({})
      .select('-password')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await User.countDocuments();

    res.json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};
