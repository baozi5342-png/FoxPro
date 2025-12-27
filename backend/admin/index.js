const express = require('express');
const router = express.Router();
const userRouter = require('./users');
const productRouter = require('./products');
const orderRouter = require('./orders');

// 用户管理
router.use('/users', userRouter);

// 产品管理
router.use('/products', productRouter);

// 订单管理
router.use('/orders', orderRouter);

module.exports = router;
