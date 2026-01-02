// 市场路由
const express = require('express');
const router = express.Router();
const marketController = require('../controllers/marketController');
const { verifyToken, requireAdmin } = require('../middleware/auth');

// 公开路由
router.get('/markets', marketController.getMarkets);
router.get('/prices', marketController.getAllPrices);
router.get('/:symbol/price', marketController.getPrice);
router.get('/:symbol/klines', marketController.getKlines);

// 管理员路由 - 更新价格
router.put('/:symbol/price', verifyToken, requireAdmin, marketController.updateMarketPrice);

module.exports = router;
