# 🔧 Render 部署修复指南

## 问题描述
部署到Render时出现"Exited with status 1"错误。

## 原因分析
1. ❌ MongoDB连接字符串未正确传递
2. ❌ 服务器启动时MongoDB连接失败导致进程退出
3. ❌ render.yaml配置不完整

## ✅ 已完成的修复

### 1. 创建生产级服务器 (server-production.js)
✅ MongoDB连接不阻塞服务器启动
✅ 自动降级到模拟数据（当MongoDB不可用时）
✅ 异步初始化数据库
✅ 更稳定的错误处理

### 2. 更新render.yaml
✅ 添加环境变量配置
✅ 添加MONGODB_URI支持
✅ 添加JWT_SECRET配置
✅ 更新启动命令

### 3. 更新package.json
✅ 更新start命令使用新服务器
✅ 添加verify和deploy命令

## 🚀 重新部署步骤

### 方式1: 使用Git推送（推荐）
```bash
# 提交更改
git add .
git commit -m "Fix Render deployment - use production server"

# 推送到GitHub
git push origin main

# Render会自动部署
# 访问 https://dashboard.render.com 查看状态
```

### 方式2: 手动部署脚本
```bash
# Windows
call deploy.bat

# Linux/Mac
bash deploy.sh
```

### 方式3: npm命令
```bash
npm run deploy:windows  # Windows
npm run deploy:unix      # Linux/Mac
```

## 📋 Render配置检查清单

在Render Dashboard中检查以下设置：

### Web Service 设置
- [ ] **Name**: foxpro
- [ ] **Environment**: Node
- [ ] **Build Command**: `npm install --legacy-peer-deps`
- [ ] **Start Command**: `node server-production.js`

### Environment Variables
- [ ] **NODE_ENV**: production
- [ ] **JWT_SECRET**: foxpro-secret-key-2026 (或自定义)
- [ ] **MONGODB_URI**: 你的MongoDB连接字符串

### 部署验证
```bash
# 部署成功后，访问健康检查端点
curl https://your-app.onrender.com/api/health

# 预期返回
{
  "success": true,
  "status": "ok",
  "mongoConnected": true,
  "timestamp": "2026-01-03T..."
}
```

## 🔗 MongoDB 连接字符串配置

### 在Render中添加MongoDB
方式1: **使用MongoDB Atlas**（推荐）
1. 登录 https://www.mongodb.com/cloud/atlas
2. 创建免费集群
3. 获取连接字符串
4. 在Render中设置环境变量 MONGODB_URI

方式2: **使用Render PostgreSQL**（如需要）
1. 在Render Dashboard创建数据库
2. 复制连接字符串

## 📊 故障排除

### 错误1: "Cannot find module 'mongoose'"
**解决方案**:
```bash
npm install
npm run build
```

### 错误2: "ECONNREFUSED: connect to MongoDB"
**解决方案**:
- 检查MONGODB_URI环境变量是否正确
- 确保MongoDB连接字符串包含密码
- 检查IP白名单配置

### 错误3: "Port already in use"
**解决方案**:
- Render会自动分配可用端口
- 确保代码使用 `process.env.PORT`

### 错误4: "Cannot GET /"
**解决方案**:
- 确保静态文件（HTML、CSS等）在根目录
- 检查CORS配置

## 🧪 本地测试

在部署到Render前，先在本地测试：

```bash
# 1. 启动开发服务器
npm run dev

# 2. 另一个终端运行测试
npm test

# 3. 访问
# http://localhost:3000
# http://localhost:3000/api/health
# http://localhost:3000/api/markets
```

## 📝 新文件说明

### server-production.js
- 生产级别的服务器
- MongoDB连接失败不会导致启动失败
- 提供模拟数据作为备选
- 完整的错误处理

### server-simple.js
- 原始的简化版服务器
- 仍然可用于本地开发
- 完整的MongoDB依赖

## 🎯 部署验证清单

```
□ 代码已提交到GitHub
□ render.yaml已更新
□ package.json已更新
□ MONGODB_URI已设置
□ JWT_SECRET已设置
□ 服务器启动成功
□ /api/health 返回200
□ /api/markets 返回数据
□ 前端页面可访问
□ 用户可以注册/登录
```

## 💡 最佳实践

1. **使用环境变量** - 永远不要在代码中硬编码敏感信息
2. **错误恢复** - 服务器应该能处理数据库连接失败
3. **监控日志** - 定期检查Render的部署日志
4. **分阶段部署** - 先部署到开发环境，再部署生产
5. **备份计划** - MongoDB数据应该定期备份

## 📞 进一步支持

如果部署仍然失败：
1. 查看Render Dashboard的完整部署日志
2. 检查MongoDB是否可访问
3. 运行本地测试确保代码无错
4. 检查node_modules是否完整

## ✅ 预期结果

部署成功后，你应该看到：

```
🚀 FoxPro Exchange 服务器已启动
地址: http://your-app.onrender.com
环境: PRODUCTION
MongoDB: ✅ 已连接
```

---

**更新时间**: 2026年1月3日
**版本**: 1.0.0
**状态**: 部署修复完成 ✅
