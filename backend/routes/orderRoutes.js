// 订单路由
const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { verifyToken } = require('../middleware/auth');

// 秒合约
router.get('/quick-contract/config', orderController.getQuickContractConfig);
router.post('/quick-contract/place', verifyToken, orderController.placeQuickContract);

// 现货
router.post('/spot/place-order', verifyToken, orderController.placeSpotOrder);

// 永续合约
router.post('/perpetual/open-position', verifyToken, orderController.openPerpetualPosition);

// 订单管理
router.get('/list', verifyToken, orderController.getUserOrders);
router.get('/:orderId', verifyToken, orderController.getOrderDetail);
router.post('/:orderId/cancel', verifyToken, orderController.cancelOrder);

module.exports = router;
