const express = require('express');
const router = express.Router();

// 模拟获取用户列表
router.get('/users', (req, res) => {
  const users = [
    { id: 1, username: 'testUser', email: 'testuser@example.com', status: 'active' },
    { id: 2, username: 'anotherUser', email: 'anotheruser@example.com', status: 'inactive' },
  ];

  res.json(users);
});

// 模拟更新用户状态
router.put('/users/:id', (req, res) => {
  const userId = req.params.id;
  const { status } = req.body;

  if (status) {
    res.json({ message: `User ${userId} status updated to ${status}` });
  } else {
    res.status(400).json({ message: 'Status is required' });
  }
});

module.exports = router;
