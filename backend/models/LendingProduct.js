// 理财产品模型
const mongoose = require('mongoose');

const lendingProductSchema = new mongoose.Schema({
  productId: { type: String, unique: true, required: true },
  name: String,
  description: String,
  currency: { type: String, required: true }, // USDT, BTC等
  minAmount: { type: Number, required: true }, // 最低投资额
  maxAmount: { type: Number, required: true }, // 最高投资额
  lockPeriod: { type: Number, required: true }, // 锁定期（天数）
  annualRate: { type: Number, required: true }, // 年化利率
  expectedReturn: { type: Number, required: true }, // 预期收益率
  status: { type: String, enum: ['active', 'inactive', 'ended'], default: 'active' },
  totalInvested: { type: Number, default: 0 }, // 总投资额
  investorCount: { type: Number, default: 0 }, // 投资者数量
  riskLevel: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  
  // 是否自动续投
  autoRenew: { type: Boolean, default: false },
  
  createdAt: { type: Date, default: Date.now },
  startDate: Date,
  endDate: Date
}, { collection: 'lending_products' });

const LendingProduct = mongoose.model('LendingProduct', lendingProductSchema);
module.exports = LendingProduct;
