const express = require('express');
const router = express.Router();

// 模拟获取交易订单
router.get('/orders', (req, res) => {
  const orders = [
    { id: 1, pair: 'BTC/USDT', amount: 1000, status: 'completed' },
    { id: 2, pair: 'ETH/USDT', amount: 500, status: 'pending' },
  ];

  res.json(orders);
});

// 模拟更新订单状态
router.put('/orders/:id', (req, res) => {
  const orderId = req.params.id;
  const { status } = req.body;

  if (status) {
    res.json({ message: `Order ${orderId} status updated to ${status}` });
  } else {
    res.status(400).json({ message: 'Status is required' });
  }
});

module.exports = router;
