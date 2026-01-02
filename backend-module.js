// 后端模块主入口
// 用于模块化导出所有的控制器、模型和中间件

// ============ 数据模型 ============
exports.models = {
  User: require('./backend/models/User'),
  Asset: require('./backend/models/Asset'),
  Market: require('./backend/models/Market'),
  Order: require('./backend/models/Order'),
  Transaction: require('./backend/models/Transaction'),
  LendingProduct: require('./backend/models/LendingProduct'),
  KYC: require('./backend/models/KYC')
};

// ============ 控制器 ============
exports.controllers = {
  authController: require('./backend/controllers/authController'),
  userController: require('./backend/controllers/userController'),
  assetController: require('./backend/controllers/assetController'),
  orderController: require('./backend/controllers/orderController'),
  marketController: require('./backend/controllers/marketController')
};

// ============ 路由 ============
exports.routes = {
  authRoutes: require('./backend/routes/authRoutes'),
  userRoutes: require('./backend/routes/userRoutes'),
  assetRoutes: require('./backend/routes/assetRoutes'),
  orderRoutes: require('./backend/routes/orderRoutes'),
  marketRoutes: require('./backend/routes/marketRoutes')
};

// ============ 中间件 ============
exports.middleware = {
  auth: require('./backend/middleware/auth'),
  errorHandler: require('./backend/middleware/errorHandler')
};

// ============ 配置 ============
exports.config = require('./backend/config/config');

// ============ 快捷导出 ============
exports.verifyToken = exports.middleware.auth.verifyToken;
exports.requireAdmin = exports.middleware.auth.requireAdmin;
exports.requireSuperAdmin = exports.middleware.auth.requireSuperAdmin;

// ============ 工具函数 ============

/**
 * 初始化用户资产
 */
exports.initializeUserAssets = async (userId) => {
  return exports.controllers.assetController.initializeAssets(userId);
};

/**
 * 更新资产余额
 */
exports.updateAssetBalance = async (userId, symbol, amount, type = 'add') => {
  return exports.controllers.assetController.updateAssetBalance(userId, symbol, amount, type);
};

/**
 * 生成API错误响应
 */
exports.errorResponse = (message, status = 400) => {
  return {
    success: false,
    message,
    status
  };
};

/**
 * 生成API成功响应
 */
exports.successResponse = (data, message = 'Success') => {
  return {
    success: true,
    message,
    data
  };
};

// ============ 版本信息 ============
exports.version = '1.0.0';
exports.name = 'FoxPro Exchange Backend';
exports.description = '完整的加密货币交易平台后端系统';

console.log(`✅ ${exports.name} v${exports.version} 模块已加载`);
