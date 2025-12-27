const express = require('express');
const router = express.Router();

// 模拟获取用户个人信息
router.get('/profile', (req, res) => {
  // 假设用户信息已经存在
  const userProfile = {
    username: 'testUser',
    email: 'testuser@example.com',
    phone: '123-456-7890',
    kycStatus: 'pending', // KYC 状态
  };
  
  res.json(userProfile);
});

// 更新用户信息
router.put('/profile', (req, res) => {
  const { username, email, phone } = req.body;
  
  // 模拟更新用户信息
  if (username && email && phone) {
    res.json({ message: 'Profile updated successfully' });
  } else {
    res.status(400).json({ message: 'All fields are required' });
  }
});

module.exports = router;
