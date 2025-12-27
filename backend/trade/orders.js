const express = require('express');
const router = express.Router();

// 模拟秒合约交易订单
router.post('/contract', (req, res) => {
  const { pair, direction, amount, leverage } = req.body;

  if (pair && direction && amount > 0 && leverage > 0) {
    res.json({ message: `Contract order placed successfully. Pair: ${pair}, Direction: ${direction}, Amount: ${amount}, Leverage: ${leverage}` });
  } else {
    res.status(400).json({ message: 'Invalid contract order details' });
  }
});

// 模拟现货交易订单
router.post('/spot', (req, res) => {
  const { pair, direction, amount, price } = req.body;

  if (pair && direction && amount > 0 && price > 0) {
    res.json({ message: `Spot order placed successfully. Pair: ${pair}, Direction: ${direction}, Amount: ${amount}, Price: ${price}` });
  } else {
    res.status(400).json({ message: 'Invalid spot order details' });
  }
});

// 模拟 U本位合约交易订单
router.post('/usdt-contract', (req, res) => {
  const { pair, direction, amount, leverage } = req.body;

  if (pair && direction && amount > 0 && leverage > 0) {
    res.json({ message: `USDT contract order placed successfully. Pair: ${pair}, Direction: ${direction}, Amount: ${amount}, Leverage: ${leverage}` });
  } else {
    res.status(400).json({ message: 'Invalid U本位 contract order details' });
  }
});

module.exports = router;
