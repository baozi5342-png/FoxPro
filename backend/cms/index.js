const express = require('express');
const router = express.Router();
const contentRouter = require('./content');

// 内容管理
router.use('/content', contentRouter);

module.exports = router;
