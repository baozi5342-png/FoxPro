// 认证中间件
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'foxpro-secret-key-2026';

// 验证JWT token
exports.verifyToken = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'No token provided' 
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token expired' 
      });
    }
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid token' 
    });
  }
};

// 检查管理员权限
exports.requireAdmin = (req, res, next) => {
  if (!req.user || req.user.isAdmin < 1) {
    return res.status(403).json({ 
      success: false, 
      message: 'Admin access required' 
    });
  }
  next();
};

// 检查超级管理员权限
exports.requireSuperAdmin = (req, res, next) => {
  if (!req.user || req.user.isAdmin !== 2) {
    return res.status(403).json({ 
      success: false, 
      message: 'Super admin access required' 
    });
  }
  next();
};
