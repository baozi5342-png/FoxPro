// 错误处理中间件
exports.errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Mongoose验证错误
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: Object.values(err.errors).map(e => e.message)
    });
  }

  // Mongoose重复键错误
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(400).json({
      success: false,
      message: `${field} already exists`
    });
  }

  // JWT错误
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }

  // 默认错误
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
};

// 404处理
exports.notFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Not found',
    path: req.path
  });
};
