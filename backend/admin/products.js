const express = require('express');
const router = express.Router();

// 模拟获取产品列表
router.get('/products', (req, res) => {
  const products = [
    { id: 1, name: 'DeFi Mining', status: 'active' },
    { id: 2, name: 'Pledge Mining', status: 'inactive' },
  ];

  res.json(products);
});

// 模拟上架/下架产品
router.put('/products/:id', (req, res) => {
  const productId = req.params.id;
  const { status } = req.body;

  if (status) {
    res.json({ message: `Product ${productId} status updated to ${status}` });
  } else {
    res.status(400).json({ message: 'Status is required' });
  }
});

module.exports = router;
