// 资产路由
const express = require('express');
const router = express.Router();
const assetController = require('../controllers/assetController');
const { verifyToken } = require('../middleware/auth');

// 获取资产
router.get('/', verifyToken, assetController.getAssets);
router.get('/:symbol', verifyToken, assetController.getAssetBySymbol);

// 充提
router.post('/deposit', verifyToken, assetController.deposit);
router.post('/withdraw', verifyToken, assetController.withdraw);

module.exports = router;
