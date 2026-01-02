// API端点总结 - 完整的后端API接口

/*
========== 认证相关 ==========
POST /api/auth/register
  请求: { username, email, phone, password, country }
  返回: { success, user, token }

POST /api/auth/login
  请求: { username, password }
  返回: { success, user, token }

GET /api/auth/me
  需要认证: YES (token)
  返回: { success, user }

POST /api/auth/change-password
  需要认证: YES
  请求: { oldPassword, newPassword }
  返回: { success, message }

========== 用户相关 ==========
GET /api/user/account
  需要认证: YES
  返回: { success, account }

PUT /api/user/profile
  需要认证: YES
  请求: { email, phone, country }
  返回: { success, user }

GET /api/user/balance
  需要认证: YES
  返回: { success, balance, fiatBalance }

POST /api/user/adjust-balance (管理员)
  需要认证: YES
  权限: 管理员
  请求: { targetUserId, amount, type:'add'|'subtract' }
  返回: { success, balanceBefore, balanceAfter }

GET /api/user/all (管理员)
  需要认证: YES
  权限: 管理员
  返回: { success, data, pagination }

========== 资产相关 ==========
GET /api/assets
  需要认证: YES
  返回: { success, assets[] }

GET /api/assets/:symbol
  需要认证: YES
  返回: { success, asset }

POST /api/assets/deposit
  需要认证: YES
  请求: { symbol, amount }
  返回: { success, message, depositId }

POST /api/assets/withdraw
  需要认证: YES
  请求: { symbol, amount, address }
  返回: { success, message, withdrawId }

========== 订单相关 ==========
秒合约:
GET /api/quick-contract/config
  需要认证: NO
  返回: { success, config, durations, maxLeverage }

POST /api/quick-contract/place
  需要认证: YES
  请求: { symbol, amount, duration, prediction:'up'|'down' }
  返回: { success, order }

现货:
POST /api/spot/place-order
  需要认证: YES
  请求: { symbol, side:'buy'|'sell', quantity, price, orderKind }
  返回: { success, order }

合约:
POST /api/perpetual/open-position
  需要认证: YES
  请求: { symbol, side, quantity, leverage, stopLoss, takeProfit }
  返回: { success, order }

订单管理:
GET /api/orders/list?type=spot&status=filled&limit=20&page=1
  需要认证: YES
  返回: { success, orders[], pagination }

GET /api/orders/:orderId
  需要认证: YES
  返回: { success, order }

POST /api/orders/:orderId/cancel
  需要认证: YES
  返回: { success, message }

========== 市场相关 ==========
GET /api/markets
  需要认证: NO
  返回: { success, markets[] }

GET /api/prices
  需要认证: NO
  返回: { success, prices }

GET /api/market/:symbol/price
  需要认证: NO
  返回: { success, price, change24h }

GET /api/market/:symbol/klines?timeframe=1m
  需要认证: NO
  返回: { success, symbol, timeframe, klines[] }

PUT /api/market/:symbol/price (管理员)
  需要认证: YES
  权限: 管理员
  请求: { price, change }
  返回: { success, market }

========== 系统 ==========
GET /api/health
  需要认证: NO
  返回: { success, status, mongoConnected }

========== 说明 ==========
- 所有需要认证的请求都需要在headers中加入:
  Authorization: Bearer <token>
  
- 支持的币种: BTC, ETH, SOL, BNB, XRP, ADA, DOGE, LTC, USDT

- 秒合约时长: 30, 60, 120 秒

- 永续合约杠杆: 1-20x

- 错误响应格式: { success: false, message: "错误信息" }
*/

module.exports = {
  endpoints: {
    auth: [
      { method: 'POST', path: '/api/auth/register', requiresAuth: false },
      { method: 'POST', path: '/api/auth/login', requiresAuth: false },
      { method: 'GET', path: '/api/auth/me', requiresAuth: true },
      { method: 'POST', path: '/api/auth/change-password', requiresAuth: true }
    ],
    user: [
      { method: 'GET', path: '/api/user/account', requiresAuth: true },
      { method: 'PUT', path: '/api/user/profile', requiresAuth: true },
      { method: 'GET', path: '/api/user/balance', requiresAuth: true },
      { method: 'POST', path: '/api/user/adjust-balance', requiresAuth: true, adminOnly: true },
      { method: 'GET', path: '/api/user/all', requiresAuth: true, adminOnly: true }
    ],
    assets: [
      { method: 'GET', path: '/api/assets', requiresAuth: true },
      { method: 'GET', path: '/api/assets/:symbol', requiresAuth: true },
      { method: 'POST', path: '/api/assets/deposit', requiresAuth: true },
      { method: 'POST', path: '/api/assets/withdraw', requiresAuth: true }
    ],
    orders: [
      { method: 'GET', path: '/api/quick-contract/config', requiresAuth: false },
      { method: 'POST', path: '/api/quick-contract/place', requiresAuth: true },
      { method: 'POST', path: '/api/spot/place-order', requiresAuth: true },
      { method: 'POST', path: '/api/perpetual/open-position', requiresAuth: true },
      { method: 'GET', path: '/api/orders/list', requiresAuth: true },
      { method: 'GET', path: '/api/orders/:orderId', requiresAuth: true },
      { method: 'POST', path: '/api/orders/:orderId/cancel', requiresAuth: true }
    ],
    market: [
      { method: 'GET', path: '/api/markets', requiresAuth: false },
      { method: 'GET', path: '/api/prices', requiresAuth: false },
      { method: 'GET', path: '/api/market/:symbol/price', requiresAuth: false },
      { method: 'GET', path: '/api/market/:symbol/klines', requiresAuth: false },
      { method: 'PUT', path: '/api/market/:symbol/price', requiresAuth: true, adminOnly: true }
    ]
  }
};
