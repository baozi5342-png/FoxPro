const express = require('express');
const router = express.Router();

// 模拟登录接口
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (username === 'test' && password === 'password') {
    res.json({ message: 'Login successful' });
  } else {
    res.status(401).json({ message: 'Invalid credentials' });
  }
});

module.exports = router;
