// 订单模型 - 支持现货、合约、秒合约等多种订单
const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderId: { type: String, unique: true, required: true },
  userId: { type: String, required: true, index: true },
  orderType: { type: String, enum: ['spot', 'perpetual', 'quick-contract', 'lending'], required: true },
  symbol: { type: String, required: true }, // BTC, ETH 等
  side: { type: String, enum: ['buy', 'sell', 'long', 'short'], required: true },
  orderKind: { type: String, enum: ['market', 'limit'], default: 'market' }, // 市价单/限价单
  
  // 现货/合约共用
  quantity: { type: Number, required: true }, // 数量
  price: { type: Number, required: true }, // 单价或触发价
  totalAmount: { type: Number, required: true }, // 总额
  
  // 合约特有
  leverage: { type: Number, default: 1 }, // 杠杆倍数
  stopLoss: Number, // 止损价
  takeProfit: Number, // 止盈价
  liquidationPrice: Number, // 清算价格
  
  // 秒合约特有
  duration: Number, // 秒数（30/60/120等）
  strikePrice: Number, // 行权价
  prediction: { type: String, enum: ['up', 'down'] }, // 看涨/看跌
  
  // 理财产品特有
  productId: String,
  expectedReturn: Number,
  lockPeriod: Number, // 锁定期（天）
  
  // 订单状态
  status: { type: String, enum: ['pending', 'open', 'filled', 'partial', 'cancelled', 'expired', 'failed'], default: 'pending' },
  filledQuantity: { type: Number, default: 0 }, // 已成交数量
  filledAmount: { type: Number, default: 0 }, // 已成交金额
  fee: { type: Number, default: 0 }, // 手续费
  
  // 秒合约的胜负
  result: { type: String, enum: ['pending', 'won', 'lost', 'tie'] }, // 结果
  profit: { type: Number, default: 0 }, // 盈亏
  profitRate: { type: Number, default: 0 }, // 盈亏率
  
  // 时间戳
  createdAt: { type: Date, default: Date.now },
  filledAt: Date,
  expiredAt: Date,
  closedAt: Date
}, { collection: 'orders' });

// 索引优化查询性能
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ symbol: 1, createdAt: -1 });
orderSchema.index({ status: 1 });

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;
