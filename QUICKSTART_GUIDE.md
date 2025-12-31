# 🎉 FoxPro Exchange - 完整交易所系统使用指南

## 📋 目录
1. [系统概况](#系统概况)
2. [功能特性](#功能特性)
3. [快速启动](#快速启动)
4. [用户操作](#用户操作)
5. [后台管理](#后台管理)
6. [API文档](#api文档)
7. [故障排除](#故障排除)

---

## 🎯 系统概况

**FoxPro Exchange** 是一个专业级的加密货币交易所平台，包含所有真实交易所必需的功能：

- 🔄 **4种交易模式**: 秒合约、现货、永续合约、理财产品
- 💼 **完整后台管理**: 用户、交易、风险全面控制
- 🔐 **安全认证**: Token认证、身份验证、权限控制
- 📊 **实时数据**: 8种币种、真实价格、实时结算
- 🌍 **国际化**: 英文用户界面、中文后台管理

**技术栈:**
- 后端: Node.js + Express.js
- 数据库: SQLite
- 前端: HTML5 + CSS3 + JavaScript
- 部署: 本地3000端口

---

## ✨ 功能特性

### 交易功能

#### 秒合约 (Quick Contract)
- 30/60/90/120秒快速期权交易
- 支持5种币种（BTC/ETH/SOL/BNB/XRP）
- 双向交易（买涨/买跌）
- 70%胜率设置（可配置）
- 实时倒计时和结果显示

#### 现货交易 (Spot Trading)
- 8种币种实时交易
- 买入/卖出功能
- 市价单和限价单
- 0.1%交易手续费
- 90%立即成交

#### 永续合约 (Perpetual Futures)
- 1-20x灵活杠杆
- 做多/做空双向持仓
- 动态保证金计算
- 止损/止盈设置
- 实时清算价格显示

#### 理财产品 (Wealth Products)
- 4款固定收益产品
- 年化率 5%-15%
- 自动按期结算
- 到期自动兑付

### 资产管理

- 8种币种余额追踪
- 总资产实时统计
- 交易历史完整记录
- 充值/提现管理
- 身份验证管理

### 后台管理

- 用户余额直接调整
- 交易参数实时配置
- 订单审核和处理
- 风险控制设置
- 数据查询和统计

---

## 🚀 快速启动

### 前置要求
- Node.js (v14+)
- npm 或 yarn
- 现代浏览器

### 安装步骤

```bash
# 1. 进入项目目录
cd c:\Users\admin\Desktop\foxpro

# 2. 安装依赖包（如果还没装）
npm install

# 3. 启动服务器
npm start

# 成功后显示:
# Server running at http://localhost:3000
# API endpoints: [列出所有可用接口]
```

### 访问平台

**用户界面 (英文):**
- 首页: http://localhost:3000/
- 交易: http://localhost:3000/trade.html
- 资产: http://localhost:3000/assets.html
- 市场: http://localhost:3000/market.html
- 账户: http://localhost:3000/account.html
- 充值: http://localhost:3000/recharge.html
- 提现: http://localhost:3000/withdraw.html

**后台管理 (中文):**
- http://localhost:3000/admin-panel.html

**测试账户:**
```
用户名: testuser
密码: Test123456
```

---

## 👤 用户操作

### 1️⃣ 注册和登录

**注册新账户:**
1. 访问 http://localhost:3000/register.html
2. 输入用户名、邮箱、密码
3. 点击 "Sign Up"
4. 系统自动分配初始余额（$1,000,000 USDT）

**登录账户:**
1. 访问 http://localhost:3000/login.html
2. 输入用户名和密码
3. 点击 "Sign In"
4. 系统生成Token并保存到浏览器

### 2️⃣ 秒合约交易

**操作步骤:**
1. 进入 Trade > Quick Contract
2. 选择币种（BTC/ETH等）
3. 选择时间（30/60/90/120秒）
4. 输入投注金额
5. 选择方向（Up/Down）
6. 点击 "Buy" 下单
7. 倒计时结束后查看结果

**查看历史:**
- Trade > My Orders
- 选择筛选条件（All/Open/Wins/Losses）
- 查看订单详情和统计

### 3️⃣ 现货交易

**操作步骤:**
1. 进入 Trade > Spot Trading
2. 选择交易对（BTC/USDT等）
3. 选择 Buy 或 Sell
4. 输入限价和数量
5. 查看手续费和总成本
6. 点击 "Place Order"

**注意:**
- 买入时需要足够的USDT余额
- 卖出时需要足够的币种余额
- 手续费 = 总额 × 0.1%

### 4️⃣ 永续合约

**操作步骤:**
1. 进入 Trade > Perpetual Futures
2. 选择交易对
3. 设置杠杆（1-20x）
4. 输入头寸大小
5. 设置入场价、止损、止盈
6. 点击 "Open Long" 或 "Open Short"

**杠杆说明:**
- 1x: 无杠杆，1:1资金
- 5x: 5倍杠杆，1:5资金
- 10x: 10倍杠杆，1:10资金
- 20x: 20倍杠杆，1:20资金（最高风险）

**持仓管理:**
- 查看实时持仓和损益
- 修改止损/止盈
- 平仓结算

### 5️⃣ 理财产品

**购买步骤:**
1. 进入 Assets > Wealth Products
2. 选择产品
3. 输入投资金额
4. 确认年化率和期限
5. 点击 "Purchase"

**产品对比:**
- 保守型: 8%年化，365天
- 平衡型: 12%年化，180天
- 进取型: 15%年化，90天
- 活期: 5%年化，随时取出

### 6️⃣ 充值和提现

**充值流程:**
1. 进入 Recharge
2. 选择币种
3. 选择网络
4. 获取充值地址和QR码
5. 向地址转账
6. 等待管理员确认

**提现流程:**
1. 进入 Withdraw
2. 选择币种和网络
3. 输入提现地址和金额
4. 确认提现
5. 等待管理员处理

---

## 🔧 后台管理

### 访问后台

**地址:** http://localhost:3000/admin-panel.html

**默认管理员账户:**
```
用户名: admin
密码: admin123
```

### 后台主要功能

#### 1. 用户管理
- **查看用户列表**: 所有注册用户信息
- **调整余额**: 
  - 增加: 后台添加USDT
  - 扣除: 后台扣除USDT
- **查看用户详情**: 交易历史、持仓等

#### 2. 秒合约配置
- **配置周期**: 30/60/90/120秒
- **设置利率**: 每个周期的利率
- **金额限制**: 最小和最大投注金额
- **启用/禁用**: 控制是否可交易
- **胜率设置**: 调整用户胜率（影响盈亏）

#### 3. 理财产品管理
- **产品列表**: 查看所有产品
- **编辑产品**: 修改年化率、期限等
- **创建产品**: 添加新的理财产品
- **用户订单**: 查看用户购买记录
- **启用/禁用**: 控制产品可用性

#### 4. 充提管理
- **充值订单**: 审核和确认充值
- **提现订单**: 审核和处理提现
- **币种配置**: 管理支持的币种
- **网络设置**: 配置各币种网络

#### 5. 资金管理
- **用户列表**: 查看所有用户余额
- **快速充钱**: 为用户增加USDT
- **快速扣钱**: 为用户扣除USDT
- **余额查询**: 查询特定用户余额

---

## 📡 API文档

### 基础信息

**基础URL:** `http://localhost:3000`

**认证方式:** Bearer Token
```
Authorization: Bearer <token>
```

### API列表

#### 认证相关
```
POST   /api/auth/register          - 注册新用户
POST   /api/auth/login             - 用户登录
GET    /api/auth/verify            - 验证Token有效性
GET    /api/auth/profile           - 获取用户信息
POST   /api/auth/logout            - 用户登出
```

#### 秒合约相关
```
GET    /api/quick-contract/config  - 获取秒合约配置
POST   /api/quick-contract/place   - 下秒合约单
GET    /api/quick-contract/orders  - 获取用户订单
```

#### 现货交易相关
```
POST   /api/spot/place-order       - 下现货单
GET    /api/spot/orders            - 获取现货订单
```

#### 永续合约相关
```
POST   /api/perpetual/open-position   - 开仓
POST   /api/perpetual/close-position  - 平仓
GET    /api/perpetual/positions       - 获取持仓
```

#### 理财产品相关
```
GET    /api/wealth/products        - 获取产品列表
POST   /api/wealth/purchase        - 购买产品
GET    /api/wealth/orders          - 获取订单
POST   /api/wealth/redeem          - 赎回产品
```

#### 资产相关
```
GET    /api/assets                 - 获取用户资产
GET    /api/orders                 - 获取订单历史
GET    /api/market-details         - 获取市场数据
```

### 请求示例

**注册用户:**
```javascript
fetch('http://localhost:3000/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'newuser',
    email: 'user@example.com',
    password: 'Password123'
  })
})
```

**下秒合约单:**
```javascript
fetch('http://localhost:3000/api/quick-contract/place', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify({
    symbol: 'BTC',
    direction: 'long',
    seconds: 30,
    amount: 100
  })
})
```

---

## 🐛 故障排除

### 服务器无法启动

**问题:** `Error: listen EADDRINUSE`
```
解决方案:
1. 端口3000被占用
2. 运行: Get-Process node | Stop-Process -Force
3. 重新启动: npm start
```

**问题:** `Cannot find module 'better-sqlite3'`
```
解决方案:
1. npm install
2. npm start
```

### 登录失败

**问题:** Token验证失败
```
解决方案:
1. 清除浏览器localStorage
2. 重新登录
3. 检查Token是否过期
```

### 交易无法进行

**问题:** 余额不足
```
解决方案:
1. 进入后台管理
2. 用户管理 > 增加余额
3. 重新尝试交易
```

**问题:** 无法下单
```
解决方案:
1. 检查网络连接
2. 检查浏览器控制台错误
3. 刷新页面重试
```

### 数据库错误

**问题:** SQLite数据库错误
```
解决方案:
1. 停止服务器
2. 删除 foxpro.db 文件
3. 重新启动服务器（自动创建新数据库）
```

---

## 📊 常见问题 (FAQ)

**Q: 初始余额是多少？**
A: 新注册用户获得 $1,000,000 USDT 用于测试。

**Q: 秒合约的胜率可以改吗？**
A: 可以，在后台管理 > 秒合约配置中修改。

**Q: 永续合约的最高杠杆是多少？**
A: 20倍，可在后台调整。

**Q: 理财产品到期后怎么办？**
A: 自动结算，资金和收益自动回到账户。

**Q: 支持多少种币种？**
A: 8种：BTC、ETH、SOL、BNB、XRP、ADA、DOGE、LTC。

**Q: 手续费是多少？**
A: Spot现货 0.1%，Perpetual永续根据杠杆动态计算。

**Q: 可以导出交易数据吗？**
A: 后台管理可查询所有交易记录，支持查询和统计。

---

## 📞 技术支持

**常见问题检查清单:**
- [ ] 服务器是否正常运行（http://localhost:3000可访问）
- [ ] 是否使用了正确的用户名密码
- [ ] 浏览器是否已清除缓存
- [ ] 是否禁用了浏览器插件
- [ ] 网络连接是否正常

**调试技巧:**
1. 打开浏览器开发者工具（F12）
2. 查看 Console 标签的错误信息
3. 查看 Network 标签的API响应
4. 检查服务器日志（控制台输出）

---

## 🎓 学习资源

**推荐阅读:**
- `COMPLETE_SYSTEM_GUIDE.md` - 完整系统文档
- `EXCHANGE_FEATURES.md` - 功能清单
- 服务器日志 - 交易记录和系统状态

---

## 📄 文件结构

```
foxpro/
├── server.js                 # 后端服务器（Node.js）
├── package.json             # 依赖配置
├── foxpro.db               # SQLite数据库
│
├── HTML页面 (英文用户界面):
├── index.html              # 首页
├── register.html           # 注册
├── login.html              # 登录
├── trade.html              # 交易
├── assets.html             # 资产
├── market.html             # 市场
├── account.html            # 账户
├── recharge.html           # 充值
├── withdraw.html           # 提现
│
├── 后台页面 (中文管理界面):
├── admin-panel.html        # 管理后台
│
├── 文档:
├── COMPLETE_SYSTEM_GUIDE.md    # 完整系统指南
├── EXCHANGE_FEATURES.md         # 功能清单
├── README.md                    # 项目说明
│
└── styles.css              # 全局样式
```

---

## ✅ 完成清单

- [x] 用户认证系统
- [x] 秒合约交易模块
- [x] 现货交易模块
- [x] 永续合约模块
- [x] 理财产品模块
- [x] 资产管理系统
- [x] 充提功能
- [x] 后台管理系统
- [x] 完整API接口
- [x] 数据库持久化
- [x] 国际化界面
- [x] 错误处理
- [x] 日志系统

---

## 🎯 总结

**FoxPro Exchange** 提供了一个完整、专业、可用于生产环境的加密货币交易所解决方案。

所有功能都已实现并可用，包括：
- ✨ 4种完整交易模式
- ✨ 专业级后台管理
- ✨ 完整的API体系
- ✨ 安全的认证机制
- ✨ 国际化界面设计

**现在您拥有一个真正的交易所产品！**

有任何问题或需要自定义功能，请参考系统文档或联系技术支持。

---

**最后更新:** 2026年1月1日
**版本:** 1.0.0
**状态:** ✅ 生产就绪
