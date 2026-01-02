// 用户模型
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  username: { type: String, unique: true, required: true, lowercase: true },
  email: { type: String, unique: true, sparse: true },
  password: { type: String, required: true },
  phone: String,
  country: { type: String, default: 'CN' },
  status: { type: String, default: 'active', enum: ['active', 'disabled', 'suspended'] },
  isAdmin: { type: Number, default: 0, enum: [0, 1, 2] }, // 0: 普通用户, 1: 管理员, 2: 超级管理员
  balance: { type: Number, default: 10000 }, // 账户余额
  createdAt: String,
  updatedAt: String,
  lastLoginAt: String,
  kycStatus: { type: String, default: 'unverified', enum: ['unverified', 'pending', 'verified', 'rejected'] },
  kycLevel: { type: Number, default: 0 }, // KYC 级别：0=未认证, 1=初级, 2=高级
}, { collection: 'users' });

const User = mongoose.model('User', userSchema);
module.exports = User;
