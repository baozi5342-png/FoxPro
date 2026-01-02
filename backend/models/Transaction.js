// 交易历史模型 - 记录所有充值、提现、交易等
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  txId: { type: String, unique: true, required: true },
  userId: { type: String, required: true, index: true },
  type: { type: String, enum: ['deposit', 'withdraw', 'trade', 'fee', 'transfer', 'refund', 'bonus'], required: true },
  currency: String, // 币种
  amount: { type: Number, required: true }, // 金额
  balanceBefore: Number, // 交易前余额
  balanceAfter: Number, // 交易后余额
  
  // 充提相关
  walletAddress: String,
  transactionHash: String,
  network: String, // blockchain network
  confirmations: { type: Number, default: 0 },
  
  // 交易相关
  orderId: String,
  orderDetails: {},
  
  // 状态
  status: { type: String, enum: ['pending', 'confirmed', 'failed', 'completed'], default: 'pending' },
  description: String,
  
  // 时间
  createdAt: { type: Date, default: Date.now, index: true },
  confirmedAt: Date,
  completedAt: Date
}, { collection: 'transactions' });

transactionSchema.index({ userId: 1, createdAt: -1 });

const Transaction = mongoose.model('Transaction', transactionSchema);
module.exports = Transaction;
