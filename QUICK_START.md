# 🚀 FoxPro Exchange - 快速开始指南

## 📋 前提条件

- Node.js >= 18.0.0
- npm >= 9.0.0
- MongoDB 账户（已配置）
- Render 部署账户（可选）

## ⚙️ 安装和运行

### 1. 安装依赖
```bash
cd foxpro
npm install
```

### 2. 配置环境变量
编辑或创建 `.env` 文件：
```env
PORT=3000
NODE_ENV=development
JWT_SECRET=foxpro-secret-key-2026
MONGODB_URI=mongodb+srv://root:Dd112211@cluster0.rnxc0c4.mongodb.net/foxpro?appName=Cluster0&retryWrites=true&w=majority
```

### 3. 启动服务器

**开发模式**（带自动重启）：
```bash
npm run dev
```

**生产模式**：
```bash
npm start
```

### 4. 验证服务器
访问 http://localhost:3000 查看首页

## 📡 API 快速测试

### 使用自动化脚本测试
```bash
npm test
# 或
node test-api.js
```

### 手动测试（使用curl）

#### 1. 检查健康状态
```bash
curl http://localhost:3000/api/health
```

响应：
```json
{
  "success": true,
  "status": "ok",
  "mongoConnected": true
}
```

#### 2. 获取市场行情
```bash
curl http://localhost:3000/api/markets
```

#### 3. 用户注册
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "phone": "13800138000",
    "password": "Test123456"
  }'
```

响应包含 `token`，保存它用于后续请求。

#### 4. 用户登录
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "Test123456"
  }'
```

#### 5. 获取账户信息（需要token）
```bash
TOKEN="your_token_here"
curl http://localhost:3000/api/user/account \
  -H "Authorization: Bearer $TOKEN"
```

## 🎯 核心功能测试

### 资产管理
```javascript
// 获取资产
fetch('/api/assets', {
  headers: { 'Authorization': `Bearer ${token}` }
})

// 充值
fetch('/api/assets/deposit', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({ symbol: 'USDT', amount: 1000 })
})

// 提现
fetch('/api/assets/withdraw', {
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
})
```

### 交易功能

#### 秒合约
```javascript
// 获取配置
fetch('/api/quick-contract/config')

// 下单
fetch('/api/quick-contract/place', {
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
})
```

#### 现货交易
```javascript
fetch('/api/spot/place-order', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    symbol: 'BTC',
    side: 'buy',
    quantity: 0.5,
    price: 42500
  })
})
```

#### 永续合约
```javascript
fetch('/api/perpetual/open-position', {
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
})
```

### 订单管理
```javascript
// 获取订单列表
fetch('/api/orders/list?type=spot&limit=20&page=1', {
  headers: { 'Authorization': `Bearer ${token}` }
})

// 获取订单详情
fetch(`/api/orders/${orderId}`, {
  headers: { 'Authorization': `Bearer ${token}` }
})

// 取消订单
fetch(`/api/orders/${orderId}/cancel`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
})
```

## 📊 数据库初始化

首次启动时，后端会自动：
1. ✅ 连接MongoDB数据库
2. ✅ 初始化市场行情数据（8种币种）
3. ✅ 创建必要的索引
4. ✅ 生成日志文件

可在MongoDB Atlas中查看数据：
- 数据库名称: `foxpro`
- 集合列表: users, assets, markets, orders, transactions, kyc, lending_products

## 🔐 前端认证集成

在前端HTML中自动加载token：

```html
<script>
  // 获取保存的token
  const token = localStorage.getItem('token');
  
  if (token) {
    // 所有API请求都添加token
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
    
    fetch('/api/user/account', { headers })
      .then(res => res.json())
      .then(data => console.log(data.account));
  }
</script>
```

## 🛠️ 常见问题

### 1. MongoDB连接失败
**问题**: 看到 "❌ MongoDB 连接失败"

**解决方案**:
- 检查 `.env` 中的 MONGODB_URI 是否正确
- 确保IP地址在MongoDB白名单中
- 验证用户名和密码

### 2. 端口被占用
**问题**: "EADDRINUSE: address already in use :::3000"

**解决方案**:
```bash
# 查找占用该端口的进程
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# 结束进程或使用不同的端口
PORT=3001 npm start
```

### 3. Token无效/过期
**问题**: API返回 "Invalid token" 或 401

**解决方案**:
- 重新登录获取新token
- 检查token是否正确保存
- 查看token过期时间（default: 7天）

### 4. CORS错误
**问题**: "Access to XMLHttpRequest blocked by CORS policy"

**解决方案**:
- 确保服务器已启动
- 检查 `api-config.js` 中的域名配置
- 确保前端使用的URL在允许的列表中

## 📝 文件结构概览

```
foxpro/
├── backend/                    # 后端模块
│   ├── models/                 # 数据模型
│   ├── controllers/            # 业务逻辑
│   ├── routes/                 # API路由
│   ├── middleware/             # 中间件
│   └── config/                 # 配置文件
│
├── *.html                      # 前端页面
├── styles.css                  # 前端样式
├── api-config.js              # API配置
├── auth.js                    # 前端认证模块
├── server-simple.js           # 服务器（简化版）
├── server-optimized.js        # 服务器（优化版）
├── package.json               # 依赖配置
├── .env                       # 环境变量
├── test-api.js               # API测试脚本
├── API_ENDPOINTS.js          # API文档
└── BACKEND_ARCHITECTURE.md   # 后端架构文档
```

## 🚀 部署到Render

### 1. 关联GitHub仓库
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/foxpro.git
git push -u origin main
```

### 2. 在Render上创建Service
1. 登录 https://render.com
2. 新建 "Web Service"
3. 连接GitHub仓库
4. 配置环境：
   - **Name**: foxpro-exchange
   - **Start Command**: `npm start`
   - **Environment**: Node
   - **Add Environment Variables**:
     - MONGODB_URI: `mongodb+srv://...`
     - JWT_SECRET: `your-secret-key`
     - NODE_ENV: `production`

5. 部署！

### 3. 验证部署
```bash
# 替换为你的Render URL
curl https://foxpro-xxxxx.onrender.com/api/health
```

## 📞 技术支持

### 查看日志
```bash
# 服务器日志（实时）
npm run dev

# 查看特定错误
curl http://localhost:3000/api/health
```

### 调试提示
1. 启用详细日志：在 `server-simple.js` 中设置 `DEBUG=*`
2. 检查浏览器控制台的错误
3. 使用 MongoDB Atlas 查看数据库状态
4. 使用Postman或Insomnia测试API

## ✅ 部署清单

- [ ] MongoDB 已连接
- [ ] .env 文件已配置
- [ ] npm install 已执行
- [ ] 本地测试通过
- [ ] API 健康检查 200
- [ ] 前端页面加载正常
- [ ] 用户注册功能可用
- [ ] 登录功能可用
- [ ] 市场数据显示正确
- [ ] 订单系统可用
- [ ] Render部署配置完成

---

**祝你使用愉快！** 🎉

需要帮助？查看 [BACKEND_ARCHITECTURE.md](BACKEND_ARCHITECTURE.md) 了解详细文档。
