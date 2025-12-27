const express = require('express');
const router = express.Router();

// 模拟提交KYC认证
router.post('/kyc', (req, res) => {
  const { idCard, selfie } = req.body;

  if (idCard && selfie) {
    // 模拟KYC认证过程
    res.json({ message: 'KYC submitted successfully, waiting for approval' });
  } else {
    res.status(400).json({ message: 'ID Card and Selfie are required' });
  }
});

// 模拟查看KYC状态
router.get('/kyc', (req, res) => {
  // 假设KYC状态为已认证
  const kycStatus = 'approved';
  res.json({ kycStatus });
});

module.exports = router;
