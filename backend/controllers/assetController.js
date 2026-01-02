// 资产控制器
const Asset = require('../models/Asset');
const User = require('../models/User');

// 初始化用户资产
exports.initializeAssets = async (userId) => {
  const coins = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'LTC', 'USDT'];
  
  for (const symbol of coins) {
    const existingAsset = await Asset.findOne({ userId, symbol });
    if (!existingAsset) {
      await Asset.create({
        userId,
        symbol,
        balance: 0,
        lockedBalance: 0,
        totalBalance: 0,
        availableBalance: 0,
        updatedAt: new Date()
      });
    }
  }
};

// 获取用户所有资产
exports.getAssets = async (req, res) => {
  try {
    const userId = req.user.id;

    const assets = await Asset.find({ userId });

    if (assets.length === 0) {
      // 初始化资产
      await exports.initializeAssets(userId);
      return res.json({
        success: true,
        assets: await Asset.find({ userId })
      });
    }

    res.json({
      success: true,
      assets: assets
    });
  } catch (error) {
    console.error('Get assets error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// 获取特定币种资产
exports.getAssetBySymbol = async (req, res) => {
  try {
    const { symbol } = req.params;
    const userId = req.user.id;

    let asset = await Asset.findOne({ userId, symbol: symbol.toUpperCase() });

    if (!asset) {
      // 创建新资产记录
      asset = await Asset.create({
        userId,
        symbol: symbol.toUpperCase(),
        balance: 0,
        lockedBalance: 0,
        totalBalance: 0,
        availableBalance: 0,
        updatedAt: new Date()
      });
    }

    res.json({
      success: true,
      asset: asset
    });
  } catch (error) {
    console.error('Get asset error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// 更新资产余额（内部调用，不直接暴露给前端）
exports.updateAssetBalance = async (userId, symbol, amount, type = 'add') => {
  try {
    let asset = await Asset.findOne({ userId, symbol });

    if (!asset) {
      asset = await Asset.create({
        userId,
        symbol,
        balance: 0,
        lockedBalance: 0,
        totalBalance: 0,
        availableBalance: 0,
        updatedAt: new Date()
      });
    }

    if (type === 'add') {
      asset.balance += amount;
    } else if (type === 'subtract') {
      asset.balance -= amount;
    } else if (type === 'lock') {
      asset.lockedBalance += amount;
    } else if (type === 'unlock') {
      asset.lockedBalance -= amount;
    }

    asset.totalBalance = asset.balance + asset.lockedBalance;
    asset.availableBalance = asset.balance;
    asset.updatedAt = new Date();

    await asset.save();
    return asset;
  } catch (error) {
    console.error('Update asset balance error:', error);
    throw error;
  }
};

// 充值（模拟）
exports.deposit = async (req, res) => {
  try {
    const { symbol, amount } = req.body;
    const userId = req.user.id;

    if (!symbol || !amount || amount <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid symbol or amount' 
      });
    }

    // 更新资产
    await exports.updateAssetBalance(userId, symbol.toUpperCase(), amount, 'add');

    // 更新用户总余额
    const user = await User.findOne({ id: userId });
    if (symbol.toUpperCase() === 'USDT') {
      user.balance += amount;
      user.updatedAt = new Date().toISOString();
      await user.save();
    }

    res.json({
      success: true,
      message: `Deposited ${amount} ${symbol}`,
      depositId: 'dep_' + Date.now()
    });
  } catch (error) {
    console.error('Deposit error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// 提现（模拟）
exports.withdraw = async (req, res) => {
  try {
    const { symbol, amount, address } = req.body;
    const userId = req.user.id;

    if (!symbol || !amount || amount <= 0 || !address) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid parameters' 
      });
    }

    const asset = await Asset.findOne({ userId, symbol: symbol.toUpperCase() });
    if (!asset || asset.balance < amount) {
      return res.status(400).json({ 
        success: false, 
        message: 'Insufficient balance' 
      });
    }

    // 更新资产
    await exports.updateAssetBalance(userId, symbol.toUpperCase(), amount, 'subtract');

    res.json({
      success: true,
      message: `Withdrawal of ${amount} ${symbol} submitted`,
      withdrawId: 'wth_' + Date.now()
    });
  } catch (error) {
    console.error('Withdraw error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};
