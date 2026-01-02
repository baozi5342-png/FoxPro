// KYC认证模型
const mongoose = require('mongoose');

const kycSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },
  username: { type: String, required: true },
  
  // 基础认证（初级）
  basicStatus: { type: String, enum: ['unverified', 'pending', 'approved', 'rejected'], default: 'unverified' },
  basicSubmittedAt: Date,
  basicApprovedAt: Date,
  basicRejectReason: String,
  
  // 高级认证
  advancedStatus: { type: String, enum: ['unverified', 'pending', 'approved', 'rejected'], default: 'unverified' },
  advancedSubmittedAt: Date,
  advancedApprovedAt: Date,
  advancedRejectReason: String,
  
  // 身份信息
  fullName: String,
  idType: { type: String, enum: ['passport', 'id-card', 'driver-license', 'other'] },
  idNumber: String,
  idFrontImage: String, // 身份证正面URL
  idBackImage: String, // 身份证背面URL
  idExpiryDate: Date,
  
  // 地址信息
  country: String,
  province: String,
  city: String,
  address: String,
  postalCode: String,
  
  // 人脸识别
  faceImage: String,
  faceVerified: Boolean,
  faceVerifiedAt: Date,
  
  // 审核信息
  reviewer: String,
  reviewedAt: Date,
  notes: String,
  
  timestamps: { createdAt: { type: Date, default: Date.now }, updatedAt: Date }
}, { collection: 'kyc' });

const KYC = mongoose.model('KYC', kycSchema);
module.exports = KYC;
