// 订单控制器 - 处理现货、合约、秒合约、理财订单
const Order = require('../models/Order');
const Asset = require('../models/Asset');
const User = require('../models/User');
const assetController = require('./assetController');

// 生成订单ID
const generateOrderId = () => `ord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// 秒合约配置
const QUICK_CONTRACT_CONFIG = {
  'BTC/USDT': { minAmount: 10, maxAmount: 10000, winRate: 0.70 },
  'ETH/USDT': { minAmount: 10, maxAmount: 10000, winRate: 0.70 },
  'SOL/USDT': { minAmount: 10, maxAmount: 10000, winRate: 0.70 }
};

// 秒合约 - 获取配置
exports.getQuickContractConfig = async (req, res) => {
  try {
    res.json({
      success: true,
      config: QUICK_CONTRACT_CONFIG,
      durations: [30, 60, 120],
      maxLeverage: 1
    });
  } catch (error) {
    console.error('Get config error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// 秒合约 - 下单
exports.placeQuickContract = async (req, res) => {
  try {
    const { symbol, amount, duration, prediction } = req.body;
    const userId = req.user.id;

    // 验证参数
    if (!symbol || !amount || !duration || !prediction) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required parameters' 
      });
    }

    if (!['up', 'down'].includes(prediction)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid prediction (must be up or down)' 
      });
    }

    const config = QUICK_CONTRACT_CONFIG[symbol];
    if (!config) {
      return res.status(400).json({ 
        success: false, 
        message: 'Unsupported symbol' 
      });
    }

    if (amount < config.minAmount || amount > config.maxAmount) {
      return res.status(400).json({ 
        success: false, 
        message: `Amount must be between ${config.minAmount} and ${config.maxAmount}` 
      });
    }

    // 检查用户余额
    const user = await User.findOne({ id: userId });
    if (user.balance < amount) {
      return res.status(400).json({ 
        success: false, 
        message: 'Insufficient balance' 
      });
    }

    // 创建订单
    const orderId = generateOrderId();
    const order = new Order({
      orderId,
      userId,
      orderType: 'quick-contract',
      symbol,
      side: prediction === 'up' ? 'long' : 'short',
      quantity: 1,
      price: amount,
      totalAmount: amount,
      duration,
      prediction,
      status: 'open',
      createdAt: new Date(),
      expiredAt: new Date(Date.now() + duration * 1000),
      result: 'pending'
    });

    await order.save();

    // 冻结金额
    user.balance -= amount;
    await user.save();

    // 模拟交易结果（延迟执行）
    setTimeout(() => {
      simulateQuickContractResult(orderId, userId, amount, config.winRate);
    }, (duration + 1) * 1000);

    res.json({
      success: true,
      message: 'Quick contract placed successfully',
      order: {
        orderId,
        symbol,
        amount,
        duration,
        prediction,
        status: 'open',
        expiresIn: duration
      }
    });
  } catch (error) {
    console.error('Place quick contract error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// 模拟秒合约结果
const simulateQuickContractResult = async (orderId, userId, amount, winRate) => {
  try {
    const order = await Order.findOne({ orderId });
    if (!order || order.status !== 'open') return;

    const won = Math.random() < winRate;
    const profit = won ? amount * 0.8 : -amount;
    const profitRate = (profit / amount * 100).toFixed(2);

    const user = await User.findOne({ id: userId });
    user.balance += amount + profit;
    user.updatedAt = new Date().toISOString();
    await user.save();

    order.status = 'filled';
    order.result = won ? 'won' : 'lost';
    order.profit = profit;
    order.profitRate = profitRate;
    order.closedAt = new Date();
    await order.save();

    console.log(`✅ 秒合约 ${orderId} 结果: ${won ? '胜利' : '失败'}, 利润: ${profit}`);
  } catch (error) {
    console.error('Simulate result error:', error);
  }
};

// 现货交易 - 下单
exports.placeSpotOrder = async (req, res) => {
  try {
    const { symbol, side, quantity, price, orderKind } = req.body;
    const userId = req.user.id;

    if (!symbol || !side || !quantity || !price) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required parameters' 
      });
    }

    const totalAmount = quantity * price;
    const user = await User.findOne({ id: userId });

    // 检查余额
    if (side === 'buy' && user.balance < totalAmount) {
      return res.status(400).json({ 
        success: false, 
        message: 'Insufficient balance' 
      });
    }

    // 创建订单
    const orderId = generateOrderId();
    const order = new Order({
      orderId,
      userId,
      orderType: 'spot',
      symbol,
      side,
      quantity,
      price,
      totalAmount,
      orderKind: orderKind || 'market',
      status: 'filled',
      filledQuantity: quantity,
      filledAmount: totalAmount,
      fee: totalAmount * 0.001, // 0.1%手续费
      createdAt: new Date(),
      filledAt: new Date()
    });

    await order.save();

    if (side === 'buy') {
      // 更新用户余额
      user.balance -= totalAmount + order.fee;
      // 更新资产
      await assetController.updateAssetBalance(userId, symbol, quantity, 'add');
    } else {
      // 更新资产
      await assetController.updateAssetBalance(userId, symbol, quantity, 'subtract');
      // 更新用户余额
      user.balance += totalAmount - order.fee;
    }

    user.updatedAt = new Date().toISOString();
    await user.save();

    res.json({
      success: true,
      message: 'Spot order placed successfully',
      order: {
        orderId,
        symbol,
        side,
        quantity,
        price,
        totalAmount,
        fee: order.fee,
        status: 'filled'
      }
    });
  } catch (error) {
    console.error('Place spot order error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// 永续合约 - 开仓
exports.openPerpetualPosition = async (req, res) => {
  try {
    const { symbol, side, quantity, leverage, stopLoss, takeProfit } = req.body;
    const userId = req.user.id;

    if (!symbol || !side || !quantity || !leverage) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required parameters' 
      });
    }

    if (leverage < 1 || leverage > 20) {
      return res.status(400).json({ 
        success: false, 
        message: 'Leverage must be between 1 and 20' 
      });
    }

    const price = 1; // 模拟价格
    const totalAmount = quantity * price;
    const requiredMargin = totalAmount / leverage;

    const user = await User.findOne({ id: userId });
    if (user.balance < requiredMargin) {
      return res.status(400).json({ 
        success: false, 
        message: 'Insufficient margin' 
      });
    }

    // 创建订单
    const orderId = generateOrderId();
    const liquidationPrice = side === 'long' 
      ? price * (1 - 1 / leverage * 0.95)
      : price * (1 + 1 / leverage * 0.95);

    const order = new Order({
      orderId,
      userId,
      orderType: 'perpetual',
      symbol,
      side,
      quantity,
      price,
      totalAmount,
      leverage,
      stopLoss,
      takeProfit,
      liquidationPrice,
      status: 'open',
      createdAt: new Date()
    });

    await order.save();

    // 冻结保证金
    user.balance -= requiredMargin;
    user.updatedAt = new Date().toISOString();
    await user.save();

    res.json({
      success: true,
      message: 'Perpetual position opened successfully',
      order: {
        orderId,
        symbol,
        side,
        quantity,
        leverage,
        requiredMargin,
        liquidationPrice: liquidationPrice.toFixed(2),
        status: 'open'
      }
    });
  } catch (error) {
    console.error('Open perpetual position error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// 获取用户订单
exports.getUserOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, status, limit, page } = req.query;

    const skip = (parseInt(page) || 1 - 1) * (parseInt(limit) || 20);

    const query = { userId };
    if (type) query.orderType = type;
    if (status) query.status = status;

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit) || 20);

    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      orders,
      pagination: {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        total,
        pages: Math.ceil(total / (parseInt(limit) || 20))
      }
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// 获取订单详情
exports.getOrderDetail = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    const order = await Order.findOne({ orderId, userId });

    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }

    res.json({
      success: true,
      order
    });
  } catch (error) {
    console.error('Get order detail error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// 取消订单
exports.cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    const order = await Order.findOne({ orderId, userId });

    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }

    if (!['pending', 'open'].includes(order.status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot cancel this order' 
      });
    }

    // 退还冻结金额
    const user = await User.findOne({ id: userId });
    if (order.orderType === 'quick-contract') {
      user.balance += order.totalAmount;
    } else if (order.orderType === 'perpetual') {
      user.balance += order.totalAmount / order.leverage;
    }

    user.updatedAt = new Date().toISOString();
    await user.save();

    order.status = 'cancelled';
    await order.save();

    res.json({
      success: true,
      message: 'Order cancelled successfully'
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};
