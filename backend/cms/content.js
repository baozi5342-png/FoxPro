const express = require('express');
const router = express.Router();

// 模拟获取所有内容
router.get('/content', (req, res) => {
  const content = [
    { id: 1, type: 'banner', title: 'Welcome to FoxPro', status: 'active' },
    { id: 2, type: 'notice', title: 'Important Update', status: 'inactive' },
    { id: 3, type: 'terms', title: 'Terms of Service', status: 'active' },
  ];

  res.json(content);
});

// 模拟更新内容
router.put('/content/:id', (req, res) => {
  const contentId = req.params.id;
  const { status } = req.body;

  if (status) {
    res.json({ message: `Content ${contentId} status updated to ${status}` });
  } else {
    res.status(400).json({ message: 'Status is required' });
  }
});

// 模拟添加新内容
router.post('/content', (req, res) => {
  const { type, title, status } = req.body;

  if (type && title && status) {
    res.json({ message: 'New content added successfully' });
  } else {
    res.status(400).json({ message: 'Type, title, and status are required' });
  }
});

module.exports = router;
