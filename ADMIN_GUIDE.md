# 后台管理系统使用指南

## 系统概述

FoxPro Exchange 的后台管理系统经过升级，现在可以全面管理所有前端页面的内容和功能。

## 功能模块

### 1. 仪表板 (Dashboard)
- **总用户数**: 显示平台注册用户总数
- **总订单数**: 显示所有交易订单数量
- **待验证**: 显示待审核的身份验证数量
- **平台收入**: 显示平台总收入（基于交易费用）

### 2. 页面管理 (Page Management)
管理所有前端页面的内容和设置。

#### 可管理的页面：
- **首页** (home) - index.html
- **关于我们** (about) - about.html
- **行情** (market) - market.html
- **交易** (trade) - trade.html
- **资产** (assets) - assets.html
- **账户** (account) - account.html
- **充值** (recharge) - recharge.html
- **提现** (withdraw) - withdraw.html
- **客服支持** (customer-support) - customer-support.html
- **服务条款** (terms) - terms.html

#### 页面编辑功能：

##### 基础内容编辑
- **页面标题**: 设置页面的主标题
- **页面描述**: 设置页面的副标题或简描述
- **主要内容**: 编写页面的主要内容（支持HTML）
- **按钮/功能文本**: 配置页面上的按钮和功能相关文本

##### 样式和主题
- **主题颜色**: 选择页面的主题色（通过颜色选择器）
- **页面状态**: 设置页面状态
  - `激活`: 页面正常显示
  - `维护中`: 显示维护提示，但页面仍可访问
  - `禁用`: 页面显示禁用标志，并隐藏内容

##### SEO优化
- **SEO关键词**: 输入页面关键词（逗号分隔）
- **SEO描述**: 输入页面的META描述

#### 操作流程：
1. 点击要编辑的页面按钮（如"首页"）
2. 编辑器会显示该页面的所有内容字段
3. 修改所需内容
4. 点击"保存页面内容"按钮保存更改
5. 页面预览会实时更新
6. 点击"删除页面"可清除该页面的所有自定义内容（会恢复为默认HTML内容）

### 3. 用户管理 (User Management)
- 查看所有注册用户列表
- 查看用户信息：用户名、邮箱、电话、状态、注册时间
- 支持实时数据更新

### 4. 订单管理 (Order Management)
- 查看所有交易订单
- 显示订单详情：ID、用户、类型、金额、状态、时间
- 支持订单查询和筛选（扩展功能）

### 5. 身份验证 (Verification Management)
- 管理用户提交的身份验证请求
- 查看验证类型：主要验证、高级验证
- 审核并批准/拒绝验证请求
- 支持验证状态追踪

### 6. 系统设置 (Settings)
- **平台名称**: 修改平台显示名称
- **平台简介**: 编写平台简介文本
- **交易费率**: 设置平台交易费率（%）

## API 接口说明

### 页面管理接口

#### 获取页面内容
```
GET /api/admin/pages/:pageId
Headers: Authorization: Bearer {adminToken}

响应:
{
  "success": true,
  "data": {
    "pageId": "home",
    "heading": "页面标题",
    "description": "页面描述",
    "content": "主要内容",
    "buttons": {},
    "themeColor": "#3b82f6",
    "status": "active",
    "seoKeywords": "关键词",
    "seoDescription": "SEO描述",
    "updatedAt": "2026-01-01T12:00:00Z"
  }
}
```

#### 保存页面内容
```
POST /api/admin/pages/:pageId
Headers: Authorization: Bearer {adminToken}
Content-Type: application/json

请求体:
{
  "heading": "页面标题",
  "description": "页面描述",
  "content": "主要内容",
  "buttons": {},
  "themeColor": "#3b82f6",
  "status": "active",
  "seoKeywords": "关键词",
  "seoDescription": "SEO描述"
}

响应:
{
  "success": true,
  "message": "页面内容已保存"
}
```

#### 删除页面内容
```
DELETE /api/admin/pages/:pageId
Headers: Authorization: Bearer {adminToken}

响应:
{
  "success": true,
  "message": "页面内容已删除"
}
```

#### 获取所有页面列表
```
GET /api/admin/pages
Headers: Authorization: Bearer {adminToken}

响应:
{
  "success": true,
  "data": [
    {
      "pageId": "home",
      "heading": "首页",
      "status": "active",
      "updatedAt": "2026-01-01T12:00:00Z"
    },
    ...
  ]
}
```

## 前端集成

### 为页面添加动态内容管理

#### 1. 导入 page-manager.js
在HTML文件中添加：
```html
<script src="page-manager.js"></script>
```

#### 2. 初始化页面管理
在页面的DOMContentLoaded事件中：
```javascript
document.addEventListener('DOMContentLoaded', () => {
  initPageManager({
    heading: '.page-heading-selector',
    description: '.page-desc-selector',
    content: '.page-content-selector'
  });
});
```

#### 3. 可用的配置选项
```javascript
initPageManager({
  heading: 'CSS选择器',      // 页面标题元素
  description: 'CSS选择器',  // 页面描述元素
  content: 'CSS选择器'       // 主要内容元素
});
```

### 页面管理器函数

#### getCurrentPageId()
获取当前页面的ID
```javascript
const pageId = getCurrentPageId();
// 返回: 'home', 'about', 'trade' 等
```

#### loadPageContent(pageId)
从后台加载特定页面的内容
```javascript
const content = await loadPageContent('home');
// 返回页面内容对象或 null
```

#### applyPageContent(pageContent, selectors)
应用内容到页面元素
```javascript
applyPageContent(pageContent, {
  heading: '.title',
  description: '.subtitle',
  content: '.main'
});
```

#### makeEditableElement(selector, key)
为管理员启用元素的快速编辑（仅管理员可用）
```javascript
makeEditableElement('.page-title', 'heading');
```

## 使用场景

### 场景1：更新首页文案
1. 登录后台管理系统
2. 选择"页面管理"
3. 点击"首页"按钮
4. 修改标题、描述和主要内容
5. 点击"保存页面内容"
6. 前端用户访问首页时会看到更新的内容

### 场景2：维护页面
1. 进入页面管理
2. 选择要维护的页面
3. 将"页面状态"设置为"维护中"
4. 保存
5. 用户访问该页面时会看到维护提示

### 场景3：禁用页面功能
1. 进入页面管理
2. 选择要禁用的页面
3. 将"页面状态"设置为"禁用"
4. 保存
5. 该页面会显示禁用标志

## 数据持久化

所有页面内容保存在 SQLite 数据库的 `page_contents` 表中：

```sql
CREATE TABLE page_contents (
  id INTEGER PRIMARY KEY,
  pageId TEXT UNIQUE,           -- 页面ID
  heading TEXT,                 -- 页面标题
  description TEXT,             -- 页面描述
  content TEXT,                 -- 主要内容
  buttons TEXT,                 -- 按钮配置（JSON）
  themeColor TEXT,              -- 主题颜色
  status TEXT,                  -- 页面状态
  seoKeywords TEXT,             -- SEO关键词
  seoDescription TEXT,          -- SEO描述
  updatedAt DATETIME            -- 最后更新时间
)
```

## 安全性

- 所有管理接口都需要有效的管理员token
- Token通过 Authorization header 传递：`Authorization: Bearer {token}`
- 非管理员用户无法访问管理接口
- 前端会自动检查用户权限

## 扩展功能（待实现）

- [ ] 页面分组管理
- [ ] 内容版本历史
- [ ] 内容审核流程
- [ ] 多语言支持
- [ ] 内容导入/导出
- [ ] 页面预览（发布前预览）
- [ ] 内容权限管理（不同管理员权限）
- [ ] 页面性能分析
- [ ] A/B 测试支持

## 故障排查

### 问题：页面内容不更新
**解决**：
1. 检查是否已保存内容
2. 清除浏览器缓存
3. 检查管理员token是否有效
4. 查看浏览器控制台是否有错误信息

### 问题：无法保存页面内容
**解决**：
1. 检查网络连接
2. 验证管理员权限
3. 查看服务器日志
4. 尝试刷新页面并重新登录

### 问题：样式改变未生效
**解决**：
1. 检查主题颜色是否正确保存
2. 清除浏览器CSS缓存
3. 强制刷新（Ctrl+Shift+R）

## 联系与支持

如有问题，请联系系统管理员或查看服务器日志以获取更详细的错误信息。
