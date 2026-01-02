# Vercel部署问题修复指南

## 404错误原因

Vercel Free层存在以下限制：
1. 每个Deployment只能有一个API函数
2. 静态文件和API路由需要分离
3. Database文件(better-sqlite3)在Vercel上不持久化

## ✅ 解决方案

### 方案1：改用Vercel + Supabase（推荐）

```bash
# 1. 注册Supabase账户（免费）
# https://supabase.com

# 2. 创建PostgreSQL数据库

# 3. 修改server.js使用Supabase而非SQLite

# 4. 部署到Vercel
vercel --prod
```

---

### 方案2：使用Render.com部署（更简单）

```bash
# 1. 在 https://render.com 注册

# 2. 创建新的Web Service

# 3. 连接GitHub仓库

# 4. 设置环境变量

# 5. 自动部署完成
```

---

### 方案3：改用Railway.app

```bash
# 类似Render，支持完整Node.js应用
# https://railway.app
```

---

## 🚀 当前最快解决方案

### 如果你要继续用Vercel：

1. **分离前端和后端**
   - 前端：部署到Vercel（静态文件）
   - 后端：部署到Render或Railway

2. **API_BASE配置**
   ```javascript
   // api-config.js中修改：
   'foxprocs.top': 'https://your-backend-api.com/api'
   ```

### 如果你要最简单的方案：

**直接用Render部署整个应用**
- 无需分离前后端
- 支持SQLite
- 永久免费层
- 自动HTTPS

---

## 立即部署步骤

### 用Render部署（推荐，3步完成）：

```bash
# 1. 登录 https://render.com
# 2. New → Web Service
# 3. 连接GitHub：https://github.com/your-repo
# 4. Build command: npm install
# 5. Start command: npm start
# 6. Add Environment: VERCEL_ENV=render
# 7. Deploy
```

部署后获得URL，然后更新DNS：
```
CNAME foxprocs.top → your-app.onrender.com
```

---

或者，我可以帮你改造后端使用Supabase + Vercel。你想用哪个方案？
