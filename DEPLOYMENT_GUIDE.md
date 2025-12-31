# FoxPro Exchange - 部署指南

## 📋 域名配置

您的域名: **foxprocs.top**

## 🚀 部署步骤

### 1. 域名指向服务器

将 `foxprocs.top` 的DNS A记录指向您的服务器IP地址:

```
主机记录: @ 或 foxprocs.top
记录类型: A
记录值: 您的服务器IP地址
```

### 2. 服务器配置

#### 使用Nginx反向代理（推荐）

```nginx
server {
    listen 80;
    listen 443 ssl http2;
    server_name foxprocs.top www.foxprocs.top;

    # SSL证书配置（可选，使用Let's Encrypt免费证书）
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # HTTP重定向到HTTPS
    if ($scheme != "https") {
        return 301 https://$server_name$request_uri;
    }

    # 反向代理Node.js应用
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 静态文件缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 7d;
        cache_control max-age=604800;
    }
}
```

#### 使用Apache

```apache
<VirtualHost *:80>
    ServerName foxprocs.top
    ServerAlias www.foxprocs.top
    
    # HTTP重定向到HTTPS
    Redirect permanent / https://foxprocs.top/
</VirtualHost>

<VirtualHost *:443>
    ServerName foxprocs.top
    ServerAlias www.foxprocs.top
    
    SSLEngine on
    SSLCertificateFile /path/to/cert.pem
    SSLCertificateKeyFile /path/to/key.pem
    
    ProxyPreserveHost On
    ProxyPass / http://localhost:3000/
    ProxyPassReverse / http://localhost:3000/
</VirtualHost>
```

### 3. Node.js应用配置

#### 环境变量设置

在服务器上创建 `.env` 文件（可选）：

```env
NODE_ENV=production
PORT=3000
DOMAIN=foxprocs.top
```

#### 启动应用

```bash
# 方法1: 直接运行
npm start

# 方法2: 使用PM2管理（推荐）
npm install -g pm2
pm2 start server.js --name "foxpro"
pm2 startup
pm2 save
```

### 4. SSL证书配置（推荐使用HTTPS）

#### 使用Let's Encrypt免费证书

```bash
# 安装Certbot
sudo apt-get install certbot python3-certbot-nginx

# 获取证书
sudo certbot certonly --nginx -d foxprocs.top -d www.foxprocs.top

# 自动续期
sudo certbot renew --dry-run
```

## 🔧 API调用原理

系统已自动配置为动态获取API基础URL：

```javascript
const API_BASE = (() => {
  const protocol = window.location.protocol;
  const host = window.location.host;
  return `${protocol}//${host}/api`;
})();
```

这意味着：
- 访问 `https://foxprocs.top` → API调用 `https://foxprocs.top/api`
- 访问 `http://localhost:3000` → API调用 `http://localhost:3000/api`
- 访问任何其他域名 → 自动适配该域名的API

**无需修改代码即可支持多个域名！**

## 📦 数据库备份

```bash
# 备份SQLite数据库
cp foxpro.db foxpro.db.backup

# 从备份恢复
cp foxpro.db.backup foxpro.db
```

## 🔐 安全建议

1. **HTTPS必须** - 所有用户认证都需要HTTPS
2. **CORS配置** - 配置受信任的源
3. **Rate Limiting** - 实现API速率限制
4. **数据库加密** - 敏感数据加密存储
5. **定期备份** - 每天备份数据库

## 📊 监控和日志

### 检查Node.js应用状态

```bash
# 查看PM2进程
pm2 list

# 查看应用日志
pm2 logs foxpro

# 查看错误日志
pm2 logs foxpro --err
```

### Nginx日志

```bash
# 访问日志
tail -f /var/log/nginx/access.log

# 错误日志
tail -f /var/log/nginx/error.log
```

## 🧪 测试部署

部署完成后，测试以下URL：

```
https://foxprocs.top/              # 首页
https://foxprocs.top/login.html    # 登录页
https://foxprocs.top/trade.html    # 交易页
https://foxprocs.top/assets.html   # 资产页
https://foxprocs.top/api/prices    # API测试
```

## 📞 故障排除

### 连接被拒绝

检查Node.js应用是否运行：
```bash
pm2 status
ps aux | grep node
```

### API返回404

确保Nginx反向代理配置正确，检查日志：
```bash
tail -f /var/log/nginx/error.log
```

### CORS错误

确保浏览器和服务器使用相同的协议（HTTP或HTTPS）

### 数据库锁定

停止应用，删除 `.db-wal` 和 `.db-shm` 文件：
```bash
pm2 stop foxpro
rm foxpro.db-wal foxpro.db-shm
pm2 start foxpro
```

## ✅ 部署检查清单

- [ ] 域名DNS已正确配置
- [ ] Node.js应用在服务器运行
- [ ] Nginx/Apache已配置反向代理
- [ ] SSL证书已安装
- [ ] 数据库正常工作
- [ ] API调用成功（测试/api/prices）
- [ ] 静态文件加载正常
- [ ] 用户登录功能正常
- [ ] 交易功能正常
- [ ] 备份策略已实施

---

**部署成功后，应用将在 https://foxprocs.top 运行！** 🎉
