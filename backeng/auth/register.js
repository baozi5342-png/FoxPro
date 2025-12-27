const express = require('express');
const router = express.Router();

// 模拟注册接口
router.post('/register', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ message: 'Username and password are required' });
  } else {
    res.json({ message: 'Registration successful' });
  }
});

module.exports = router;
