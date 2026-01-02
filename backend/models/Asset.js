// 资产模型 - 用户持有的资产
const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  symbol: { type: String, required: true }, // BTC, ETH, SOL 等
  balance: { type: Number, default: 0 }, // 现货余额
  lockedBalance: { type: Number, default: 0 }, // 冻结余额（挂单等）
  totalBalance: { type: Number, default: 0 }, // 总余额
  fiatBalance: { type: Number, default: 0 }, // 法币余额
  availableBalance: { type: Number, default: 0 }, // 可用余额
  updatedAt: Date,
  createdAt: { type: Date, default: Date.now }
}, { collection: 'assets' });

// 复合索引用于快速查询
assetSchema.index({ userId: 1, symbol: 1 }, { unique: true });

const Asset = mongoose.model('Asset', assetSchema);
module.exports = Asset;
