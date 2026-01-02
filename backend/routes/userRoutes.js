// 用户路由
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken, requireAdmin } = require('../middleware/auth');

// 需要认证的路由
router.get('/account', verifyToken, userController.getAccount);
router.put('/profile', verifyToken, userController.updateProfile);
router.get('/balance', verifyToken, userController.getBalance);

// 管理员路由
router.post('/adjust-balance', verifyToken, requireAdmin, userController.adjustBalance);
router.get('/all', verifyToken, requireAdmin, userController.getAllUsers);

module.exports = router;
