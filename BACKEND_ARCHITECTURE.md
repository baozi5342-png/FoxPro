# FoxPro Exchange - 后端模块架构说明

## 📁 项目结构

```
backend/
├── models/              # 数据模型层
│   ├── User.js         # 用户模型
│   ├── Asset.js        # 资产模型
│   ├── Market.js       # 市场行情模型
│   ├── Order.js        # 订单模型（支持多种订单类型）
│   ├── Transaction.js  # 交易历史模型
│   ├── LendingProduct.js # 理财产品模型
│   └── KYC.js          # KYC认证模型
│
├── controllers/         # 控制器层 - 业务逻辑
│   ├── authController.js      # 认证逻辑（注册、登录、密码修改）
│   ├── userController.js      # 用户逻辑（账户、余额、信息更新）
│   ├── assetController.js     # 资产逻辑（充值、提现、资产查询）
│   ├── orderController.js     # 订单逻辑（下单、撤单、查询）
│   └── marketController.js    # 市场逻辑（行情、价格、K线）
│
├── routes/              # 路由层
│   ├── authRoutes.js    # 认证路由
│   ├── userRoutes.js    # 用户路由
│   ├── assetRoutes.js   # 资产路由
│   ├── orderRoutes.js   # 订单路由
│   └── marketRoutes.js  # 市场路由
│
├── middleware/          # 中间件
│   ├── auth.js         # JWT认证中间件、权限检查
│   └── errorHandler.js # 错误处理中间件
│
└── config/              # 配置
    └── config.js       # 后端全局配置
```

## 🔌 数据模型说明

### User (用户模型)
- id: 用户唯一ID
- username: 用户名（唯一）
- email: 邮箱（唯一）
- password: 密码
- phone: 电话
- country: 国家
- balance: 账户余额
- status: 账户状态 (active/disabled/suspended)
- isAdmin: 管理员级别 (0=普通用户, 1=管理员, 2=超级管理员)
- kycStatus: KYC状态 (unverified/pending/verified/rejected)
- kycLevel: KYC级别 (0=未认证, 1=初级, 2=高级)

### Asset (资产模型)
- userId: 所属用户ID
- symbol: 币种 (BTC, ETH, SOL等)
- balance: 现货余额
- lockedBalance: 冻结余额（挂单、参与理财等）
- totalBalance: 总余额
- availableBalance: 可用余额

### Market (市场行情)
- symbol: 币种代码
- name: 币种名称
- currentPrice: 当前价格
- priceChangePercent24h: 24小时涨跌幅
- high24h/low24h: 24小时最高/最低价
- volume24h: 24小时交易量
- marketCap: 市值

### Order (订单模型)
支持4种订单类型：

1. **现货订单** (orderType: 'spot')
   - symbol: 交易对
   - side: buy/sell
   - quantity: 数量
   - price: 价格
   - fee: 手续费
   - status: pending/filled/cancelled

2. **秒合约** (orderType: 'quick-contract')
   - duration: 30/60/120秒
   - prediction: up/down
   - result: pending/won/lost
   - profit: 盈亏金额
   - 自动执行，时间到后获得结果

3. **永续合约** (orderType: 'perpetual')
   - side: long/short
   - leverage: 杠杆倍数 (1-20x)
   - stopLoss: 止损价
   - takeProfit: 止盈价
   - liquidationPrice: 清算价格
   - status: open/closed/liquidated

4. **理财产品** (orderType: 'lending')
   - productId: 产品ID
   - expectedReturn: 预期收益
   - lockPeriod: 锁定期
   - status: ongoing/completed/default

### Transaction (交易历史)
- type: deposit/withdraw/trade/fee/transfer/refund/bonus
- amount: 金额
- balanceBefore/After: 交易前后余额
- status: pending/confirmed/failed/completed
- orderId: 关联订单ID（如果有）

## 🔐 认证和权限

### JWT Token 验证
- 所有需要认证的API都需要在headers中提供：
  ```
  Authorization: Bearer <token>
  ```
- Token有效期：7天
- 包含用户信息: id, username, email, isAdmin

### 权限级别
1. **无认证** - 公开API（注册、登录、市场行情）
2. **普通用户** (isAdmin=0) - 基本操作（账户管理、交易、充提）
3. **管理员** (isAdmin=1) - 用户管理、参数调整
4. **超级管理员** (isAdmin=2) - 完全控制权限

## 📡 API路由整合

### 基础路由
```
/api/health                    - 健康检查

/api/auth/*                    - 认证路由
/api/user/*                    - 用户路由
/api/assets/*                  - 资产路由
/api/orders/*                  - 订单路由
/api/market/*                  - 市场路由
```

### 快捷访问
```
/api/quick-contract/config     - 秒合约配置
/api/quick-contract/place      - 秒合约下单
/api/spot/place-order          - 现货下单
/api/perpetual/open-position   - 合约开仓
/api/market-klines/:symbol     - K线数据
/api/markets                   - 所有市场
/api/prices                    - 所有价格
```

## 🎯 前端如何使用后端API

### 1. 用户认证
```javascript
// 注册
const regRes = await fetch('/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, email, phone, password })
});
const { token, user } = await regRes.json();
localStorage.setItem('token', token);

// 登录
const loginRes = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, password })
});
const { token } = await loginRes.json();

// 后续请求都需要token
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token}`
};
```

### 2. 获取账户信息
```javascript
const res = await fetch('/api/user/account', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const { account } = await res.json();
console.log(account.balance, account.kycStatus);
```

### 3. 查询资产
```javascript
const res = await fetch('/api/assets', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { assets } = await res.json();
// assets: [{ symbol: 'BTC', balance: 0.5, lockedBalance: 0 }, ...]
```

### 4. 下单操作

#### 秒合约
```javascript
const res = await fetch('/api/quick-contract/place', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    symbol: 'BTC/USDT',
    amount: 100,
    duration: 60,
    prediction: 'up'
  })
});
const { order } = await res.json();
// 60秒后自动结算，获得结果
```

#### 现货交易
```javascript
const res = await fetch('/api/spot/place-order', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    symbol: 'BTC',
    side: 'buy',
    quantity: 0.5,
    price: 42500,
    orderKind: 'market'
  })
});
```

#### 永续合约
```javascript
const res = await fetch('/api/perpetual/open-position', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    symbol: 'BTC',
    side: 'long',
    quantity: 1,
    leverage: 10,
    stopLoss: 38000,
    takeProfit: 47000
  })
});
```

### 5. 充值和提现
```javascript
// 充值
const res = await fetch('/api/assets/deposit', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    symbol: 'USDT',
    amount: 1000
  })
});

// 提现
const res = await fetch('/api/assets/withdraw', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    symbol: 'BTC',
    amount: 0.5,
    address: 'wallet_address'
  })
});
```

### 6. 查询订单
```javascript
// 获取订单列表
const res = await fetch('/api/orders/list?type=spot&limit=20&page=1', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { orders, pagination } = await res.json();

// 获取订单详情
const res = await fetch(`/api/orders/${orderId}`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { order } = await res.json();

// 取消订单
const res = await fetch(`/api/orders/${orderId}/cancel`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
});
```

### 7. 获取市场数据
```javascript
// 获取所有市场
const res = await fetch('/api/markets');
const { markets } = await res.json();

// 获取所有价格
const res = await fetch('/api/prices');
const { prices } = await res.json();

// 获取K线数据
const res = await fetch('/api/market-klines/BTC?timeframe=1m');
const { klines } = await res.json();
```

## 🔧 管理员功能

### 调整用户余额
```javascript
const res = await fetch('/api/user/adjust-balance', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminToken}`
  },
  body: JSON.stringify({
    targetUserId: 'user_123456',
    amount: 1000,
    type: 'add' // 'add' 或 'subtract'
  })
});
```

### 获取所有用户
```javascript
const res = await fetch('/api/user/all?page=1&limit=20', {
  headers: { 'Authorization': `Bearer ${adminToken}` }
});
const { data, pagination } = await res.json();
```

### 更新市场价格
```javascript
const res = await fetch('/api/market/BTC/price', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminToken}`
  },
  body: JSON.stringify({
    price: 45000,
    change: 5.5
  })
});
```

## 🚀 部署指南

### 本地开发
```bash
npm install
npm run dev
# 服务器运行在 http://localhost:3000
```

### 生产部署 (Render)
1. 推送代码到GitHub
2. 在Render上创建新的Web Service
3. 配置环境变量：
   - MONGODB_URI: MongoDB连接字符串
   - JWT_SECRET: JWT密钥
   - NODE_ENV: production
4. 设置启动命令：`npm start`
5. 部署完成后访问分配的URL

### 数据库连接验证
```bash
# 检查健康状态
curl http://localhost:3000/api/health
# 返回: { success: true, status: "ok", mongoConnected: true }
```

## 📝 注意事项

1. **密码加密** - 当前示例中密码未加密，生产环境应使用bcrypt
2. **错误处理** - 所有错误都返回 { success: false, message: "..." }
3. **速率限制** - 生产环境应添加API速率限制
4. **日志记录** - 所有API操作都有日志输出
5. **数据验证** - 所有输入都进行了基本验证
6. **交易确认** - 秒合约会在指定时间后自动结算

## 🆘 故障排除

### MongoDB连接失败
- 检查MongoDB URI是否正确
- 验证用户名和密码
- 确保IP地址在MongoDB白名单中

### Token过期
- 前端需要处理401错误
- 需要重新登录获取新token

### API返回404
- 检查路由是否正确
- 确保使用了正确的HTTP方法（GET/POST/PUT等）
- 验证路径参数是否正确

### 订单执行失败
- 检查用户余额是否充足
- 验证订单参数是否有效
- 查看MongoDB中的订单记录

---

**开发者:** FoxPro Team  
**最后更新:** 2026年1月3日  
**版本:** 1.0.0
