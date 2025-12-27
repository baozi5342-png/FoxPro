const express = require('express');
const router = express.Router();

// 模拟获取钱包余额
router.get('/balance', (req, res) => {
  const walletBalance = {
    BTC: 2.5,
    ETH: 10.0,
    USDT: 50000,
  };
  
  res.json(walletBalance);
});

// 模拟充值操作
router.post('/deposit', (req, res) => {
  const { coin, amount } = req.body;

  if (coin && amount > 0) {
    // 模拟充值过程
    res.json({ message: `Successfully deposited ${amount} ${coin}` });
  } else {
    res.status(400).json({ message: 'Coin and amount are required' });
  }
});

module.exports = router;
