// 认证路由
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

// 公开路由
router.post('/register', authController.register);
router.post('/login', authController.login);

// 需要认证的路由
router.get('/me', verifyToken, authController.getCurrentUser);
router.post('/change-password', verifyToken, authController.changePassword);

module.exports = router;
