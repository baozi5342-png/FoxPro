const express = require('express');
const router = express.Router();

// 模拟获取所有产品
router.get('/products', (req, res) => {
  const products = [
    { id: 1, name: 'DeFi Mining', type: 'Mining', yield: '12%', status: 'active' },
    { id: 2, name: 'Pledge Mining', type: 'Mining', yield: '8%', status: 'active' },
    { id: 3, name: 'Loan', type: 'Financial', yield: '5%', status: 'inactive' },
  ];

  res.json(products);
});

// 模拟产品详情
router.get('/products/:id', (req, res) => {
  const productId = req.params.id;
  
  // 模拟返回特定产品信息
  const product = {
    id: productId,
    name: 'DeFi Mining',
    type: 'Mining',
    yield: '12%',
    description: 'High yield DeFi mining product',
    status: 'active',
    maxInvest: '5000 USDT',
    minInvest: '100 USDT'
  };

  res.json(product);
});

// 模拟产品购买
router.post('/products/:id/participate', (req, res) => {
  const productId = req.params.id;
  const { amount } = req.body;

  if (amount > 0) {
    res.json({ message: `Successfully participated in ${productId} with ${amount} USDT` });
  } else {
    res.status(400).json({ message: 'Invalid amount' });
  }
});

module.exports = router;
