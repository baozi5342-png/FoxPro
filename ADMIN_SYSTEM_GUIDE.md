# FoxPro 后台管理系统 - 完整使用指南

## 系统概述
FoxPro 后台管理系统提供了完整的平台运营管理功能，包括用户管理、币种管理、交易配置、内容管理等核心功能。

## 访问方式

### 登录
- **URL**: http://localhost:3000/admin-login.html
- **默认管理员账号**:
  - 用户名: `admin`
  - 密码: `admin123`

### 管理面板
- **URL**: http://localhost:3000/admin.html

## 功能模块说明

### 1. 仪表板 (Dashboard)
- **功能**: 展示平台关键指标
- **显示内容**:
  - 总用户数
  - 总订单数
  - 待审核认证
  - 总收入

### 2. 页面管理 (Pages)
- **功能**: 管理前端显示的页面内容
- **操作**: 创建、编辑、删除页面

### 3. 内容管理 (Content Management) ⭐ NEW
- **功能**: 编辑平台动态内容
- **可编辑页面**:
  - **关于我们** (About Us) - 平台介绍
  - **服务条款** (Terms of Service) - 用户协议
  - **白皮书** (Whitepaper) - 项目白皮书

**API 端点**:
```
GET  /api/admin/content/:contentType    - 获取内容
POST /api/admin/content/:contentType    - 保存内容
```

**支持的 contentType**:
- `about` - 关于我们
- `terms` - 服务条款
- `whitepaper` - 白皮书

### 4. 币种管理 (Coin Management) ⭐ NEW
- **功能**: 管理平台支持的交易币种
- **操作**:
  - ➕ 新增币种
  - ✏️ 编辑币种信息
  - 🗑️ 删除币种

**币种属性**:
- 币种代码 (Symbol): 如 BTC, ETH
- 币种全名 (Name): 如 Bitcoin, Ethereum
- 现价格 (Current Price): USD 美元价格
- 24小时涨幅 (%): 涨跌百分比

**API 端点**:
```
GET    /api/admin/coins              - 获取所有币种列表
POST   /api/admin/coins              - 添加新币种
DELETE /api/admin/coins/:coinId      - 删除币种
```

### 5. 秒合约管理 (Quick Contract Management) ⭐ NEW
- **功能**: 配置和管理秒合约交易系统

#### 5.1 合约配置 (Contract Configuration)
**配置项**:
- **合约周期** (Periods): 逗号分隔的秒数，默认: 30,60,120,180
- **周期收益率**:
  - 30秒: 1.5%
  - 60秒: 3%
  - 120秒: 5%
  - 180秒: 8%

**API 端点**:
```
POST /api/admin/quick-contract/config  - 保存合约配置
GET  /api/admin/quick-contract/config  - 获取配置
PUT  /api/admin/quick-contract/config  - 更新配置
```

#### 5.2 币种配置 (Coin Configuration) ⭐ NEW
**配置项**:
- **选择币种** (Select Coin): BTC, ETH, SOL, BNB, XRP
- **初始余额** (Initial Balance): 默认 10,000 USDT
- **最小投注额** (Min Bet): 默认 10 USDT
- **最大投注额** (Max Bet): 默认 50,000 USDT

**API 端点**:
```
POST /api/admin/quick-contract/coin-config  - 保存币种配置
```

#### 5.3 订单管理 (Orders Management)
- **查看**: 秒合约订单历史
- **订单字段**:
  - 订单ID
  - 用户名
  - 交易币种
  - 投注金额
  - 交易方向 (上涨/下跌)
  - 合约周期
  - 交易结果 (赢/输)
  - 创建时间

**API 端点**:
```
GET /api/admin/quick-contract/orders  - 获取订单列表
```

### 6. 用户管理 (User Management)
- **功能**: 管理平台用户
- **操作**:
  - 👀 查看用户详情
  - 💰 增加用户资金
  - 💸 扣除用户资金
  - 🎮 设置用户赢赔状态
  - 🗑️ 删除用户

**赢赔状态**:
- 正常 (Normal) - 随机结果
- 总是赢 (Always Win) - 用户总是赢
- 总是输 (Always Lose) - 用户总是输

### 7. 订单管理 (Orders)
- **功能**: 查看所有用户订单
- **显示**: 订单ID、用户、类型、金额、状态、时间

### 8. 身份认证 (Verification)
- **功能**: 审核用户身份认证申请
- **认证类型**:
  - 初级认证 (Primary Verification)
  - 高级认证 (Advanced Verification)
- **操作**: 审核、通过、拒绝

### 9. 系统设置 (Settings)
- **功能**: 配置平台基本设置
- **配置项**:
  - 平台名称
  - 平台简介
  - 交易费率

## 数据库表结构

### site_pages (页面内容表)
```sql
CREATE TABLE site_pages (
  id INTEGER PRIMARY KEY,
  pageType TEXT UNIQUE,
  heading TEXT,
  body TEXT,
  updatedAt DATETIME
)
```

### market_coins (币种表)
```sql
CREATE TABLE market_coins (
  id TEXT PRIMARY KEY,
  symbol TEXT UNIQUE,
  name TEXT,
  price REAL,
  change24h REAL,
  marketCap REAL,
  volume24h REAL,
  status TEXT,
  createdAt DATETIME,
  updatedAt DATETIME
)
```

### quick_contract_config (秒合约配置表)
```sql
CREATE TABLE quick_contract_config (
  id INTEGER PRIMARY KEY,
  symbol TEXT UNIQUE,
  initialBalance REAL,
  minBet REAL,
  maxBet REAL,
  updatedAt DATETIME
)
```

## API 完整文档

### 认证
```
POST /api/auth/admin-login           - 管理员登录
POST /api/auth/register              - 用户注册
POST /api/auth/login                 - 用户登录
```

### 内容管理
```
GET  /api/admin/content/:contentType    - 获取页面内容
POST /api/admin/content/:contentType    - 保存页面内容
GET  /api/admin/content                 - 获取所有内容
```

### 币种管理
```
GET    /api/admin/coins              - 获取所有币种
POST   /api/admin/coins              - 添加币种
DELETE /api/admin/coins/:coinId      - 删除币种
```

### 秒合约
```
GET  /api/quick-contract/config           - 获取配置
POST /api/admin/quick-contract/config     - 保存配置
GET  /api/admin/quick-contract/orders     - 获取订单
POST /api/admin/quick-contract/coin-config - 配置币种
```

### 用户管理
```
GET    /api/admin/users                       - 获取用户列表
PUT    /api/admin/users/:userId/balance      - 修改用户余额
PUT    /api/admin/users/:userId/win-setting  - 设置赢赔状态
DELETE /api/admin/users/:userId              - 删除用户
```

### 统计
```
GET  /api/admin/stats  - 获取平台统计数据
```

## 安全说明

### 认证方式
- 使用 JWT (JSON Web Token) 进行身份验证
- Token 有效期: 24 小时
- 存储位置: 浏览器 localStorage

### 权限检查
- 所有管理端点都需要有效的 admin token
- 自动校验用户权限 (`isAdmin: true`)

## 使用示例

### 添加新币种
```javascript
// 请求
POST /api/admin/coins
Headers: {
  'Authorization': 'Bearer <token>',
  'Content-Type': 'application/json'
}
Body: {
  "symbol": "BTC",
  "name": "Bitcoin",
  "price": 45000.50,
  "change24h": 2.5
}

// 响应
{
  "success": true,
  "message": "币种已添加",
  "data": {...}
}
```

### 保存页面内容
```javascript
// 请求
POST /api/admin/content/about
Headers: {
  'Authorization': 'Bearer <token>',
  'Content-Type': 'application/json'
}
Body: {
  "heading": "关于 FoxPro",
  "body": "FoxPro 是一个专业的数字资产交易平台..."
}

// 响应
{
  "success": true,
  "message": "内容已保存"
}
```

## 故障排除

### 登录失败
- 确认用户名密码正确 (admin/admin123)
- 检查服务器是否运行
- 清除浏览器 localStorage 重试

### API 返回 401
- Token 已过期，需要重新登录
- 检查请求头中的 Authorization 字段格式

### 数据库错误
- 确保 SQLite 数据库文件可访问
- 检查磁盘空间是否足够

## 后续功能规划
- [ ] 用户数据导出 (CSV/Excel)
- [ ] 批量操作功能
- [ ] 操作日志记录
- [ ] 数据备份恢复
- [ ] 定时任务配置
- [ ] 邮件通知系统

## 支持

如有问题，请联系开发团队或查看相关文档。
