# FoxPro 后台管理系统使用指南

## 系统概述

完整的后台管理系统，支持对交易平台的全面管理和控制。系统地址：`http://localhost:3000/admin-system.html`

## 核心功能模块

### 1. **仪表盘 (Dashboard)**
- 实时查看系统统计数据
- 显示总用户数、活跃交易、待审核数量、总资产
- 支持数据刷新

### 2. **用户管理 (User Management)**
- 查看所有注册用户列表
- 用户信息：用户名、邮箱、电话、当前余额
- 编辑用户信息功能

### 3. **身份认证管理**

#### 初级认证审核
- 查看用户提交的初级认证（身份证信息）
- 批准或驳回认证申请
- 显示提交时间和认证状态

#### 高级认证审核
- 查看用户提交的高级认证（银行卡信息）
- 批准或驳回认证申请
- 支持审核备注

### 4. **秒合约管理**

#### 秒合约配置
- 配置秒合约的时间周期（秒数）
- 设置盈利比例（%）
- 配置最小/最大投资金额
- 保存多个配置历史

#### 秒合约交易控制
- 查看所有进行中的秒合约交易
- 手动设置用户交易的输赢结果
- 支持管理员干预交易结果
- 显示用户、金额、方向、时间等详细信息

### 5. **理财产品管理 (Wealth Products)**
- 新增理财产品（名称、周期、年化收益率、最低投资等）
- 查看已上线的理财产品列表
- 显示产品购买人数
- 删除不需要的产品

### 6. **币种兑换管理 (Exchange Rates)**
- 查看用户的币种兑换记录
- 统计各币种兑换成功率
- 记录兑换时间和用户信息

### 7. **用户余额管理 (Balance Management)**
- 选择用户后查看当前余额
- 支持增加或扣减用户余额
- 记录操作原因和时间

### 8. **充值管理 (Recharge Management)**

#### 配置充值币种
- 添加充值币种（USDT、BTC、ETH等）
- 配置网络（TRC20、ERC20、Mainnet等）
- 设置钱包地址和二维码
- 设置最小/最大充值金额

#### 充值订单审核
- 查看所有用户充值订单
- 显示订单状态（待审核、已批准、已驳回）
- 支持批准或驳回充值
- 可添加审核备注

### 9. **提现管理 (Withdraw Management)**
- 查看所有用户提现申请
- 显示提现币种、金额、地址等信息
- 订单状态追踪
- 支持处理提现申请

### 10. **借贷管理 (Lending Management)**
- 查看用户借贷申请列表
- 显示申请金额、利率（%）、期限
- 支持批准借贷申请（自动转账）
- 支持驳回借贷申请并说明原因

### 11. **页面管理 (Page Management)**
- 编辑前端各个页面的内容
- 支持首页、关于、行情、交易、资产、账户、充值、提现、客服等页面
- WYSIWYG编辑器（如集成）

### 12. **系统设置 (System Settings)**
- 查看系统状态
- 数据库连接状态
- 系统健康检查

## 如何访问后台

### 登录方式
1. 进入 `http://localhost:3000/admin-login.html`
2. 输入管理员账号：`admin`
3. 输入管理员密码：`admin123`
4. 点击登录

默认管理员账号：
```
用户名: admin
密码: admin123
```

## 关键操作流程

### 审核用户认证
1. 进入 **初级认证** 或 **高级认证** 模块
2. 查看待审核的用户认证信息
3. 点击 **批准** 或 **驳回** 按钮
4. 系统自动更新用户认证状态

### 控制用户输赢
1. 进入 **秒合约交易管理** 模块
2. 选择进行中的订单
3. 在下拉菜单中选择 **赢** 或 **输**
4. 点击 **设置结果** 按钮
5. 系统自动更新用户余额

### 管理充值流程
1. 进入 **充值管理** 模块
2. **配置充值币种**：添加支持的币种和钱包地址
3. **审核充值订单**：查看用户提交的充值请求
4. **批准充值**：用户余额自动增加
5. **驳回充值**：返还用户资金

### 处理借贷申请
1. 进入 **借贷管理** 模块
2. 查看所有待审核的借贷申请
3. 点击 **批准**：
   - 用户余额增加申请的借贷金额
   - 自动计算利息和还款期限
4. 点击 **驳回**：
   - 输入驳回原因
   - 用户会看到驳回通知

### 添加理财产品
1. 进入 **理财产品管理** 模块
2. 填写产品信息：
   - 产品名称（如：30天保本计划）
   - 周期（天数）
   - 年化收益率（%）
   - 最低投资金额
3. 点击 **➕ 添加产品**
4. 产品立即上线，用户可以购买

## API 端点概览

### 认证相关
```
POST   /api/auth/register          - 用户注册
POST   /api/auth/login             - 用户登录
GET    /api/auth/verify            - 验证 Token
POST   /api/admin/login            - 管理员登录
GET    /api/admin/verify           - 验证管理员 Token
```

### 用户管理
```
GET    /api/admin/users            - 获取所有用户
PUT    /api/admin/user/:id/status  - 修改用户状态
POST   /api/admin/user/:id/balance - 修改用户余额
DELETE /api/admin/user/:id         - 删除用户
```

### 秒合约
```
POST   /api/quick-contract/place           - 下单
GET    /api/quick-contract/orders          - 获取订单
GET    /api/admin/quick-contract/config    - 获取配置
POST   /api/admin/quick-contract/config    - 保存配置
GET    /api/admin/quick-contract/trades    - 获取待处理交易
```

### 充值提现
```
GET    /api/admin/recharge/coins           - 获取充值币种列表
POST   /api/admin/recharge/coins           - 添加充值币种
GET    /api/admin/recharge/orders          - 获取充值订单
PUT    /api/admin/recharge/orders/:id      - 更新充值订单状态
GET    /api/admin/withdraw/orders          - 获取提现订单
PUT    /api/admin/withdraw/orders/:id      - 更新提现订单状态
```

### 理财产品
```
GET    /api/wealth/products                - 获取产品列表
POST   /api/wealth/purchase                - 购买产品
GET    /api/wealth/orders                  - 获取用户订单
POST   /api/wealth/redeem                  - 提取产品
```

### 身份认证
```
GET    /api/admin/auth/primary             - 获取初级认证待审核列表
GET    /api/admin/auth/advanced            - 获取高级认证待审核列表
POST   /api/account/verification/primary   - 用户提交初级认证
POST   /api/account/verification/advanced  - 用户提交高级认证
```

### 借贷管理
```
POST   /api/lending/apply                  - 用户申请借贷
GET    /api/lending/applications           - 获取用户借贷申请
GET    /api/admin/lending/applications     - 获取所有借贷申请
POST   /api/admin/lending/approve          - 批准借贷
POST   /api/admin/lending/reject           - 驳回借贷
```

### 兑换币种
```
GET    /api/admin/exchange-rates           - 获取兑换统计
```

## 数据库表结构

系统使用 SQLite 数据库，主要表包括：

```
users                          - 用户信息
user_assets                    - 用户资产
quick_contract_orders          - 秒合约订单
quick_contract_config          - 秒合约配置
wealth_products                - 理财产品
wealth_orders                  - 理财订单
recharge_orders                - 充值订单
withdraw_orders                - 提现订单
recharge_coins                 - 充值币种配置
verification_submissions       - 身份认证提交
lending_applications           - 借贷申请
page_sections                  - 页面内容管理
```

## 安全建议

1. **定期修改密码**：建议定期修改管理员密码
2. **限制访问**：仅允许可信 IP 地址访问后台
3. **操作日志**：所有重要操作都会记录到日志
4. **备份数据**：定期备份 `foxpro.db` 数据库文件
5. **监控系统**：监控异常登录和大额操作

## 故障排查

### 后台无法加载
- 确保 Node.js 服务器正在运行：`node server.js`
- 检查端口 3000 是否被占用
- 查看浏览器控制台（F12）的错误信息

### 充值/提现不显示数据
- 确保用户已提交充值/提现申请
- 检查数据库连接
- 查看服务器日志

### 无法修改用户余额
- 确认当前登录账号是管理员
- 检查用户是否存在
- 确认输入的金额格式正确

## 支持和反馈

如遇到问题，请：
1. 查看本文档中的故障排查部分
2. 检查服务器日志
3. 联系技术支持团队

---

**最后更新**：2026年1月2日
**版本**：1.0
