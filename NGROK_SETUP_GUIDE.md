# NGrok 配置指南

## 配置信息

- **令牌**: 37gEQ2q7D85RJa0DmPdSVHcCZqy_33pfcBiXXWtpJKx8qwRMR
- **域名**: foxprocs.top
- **本地端口**: 3000

## 配置步骤

### 1. 令牌配置（已完成）
```bash
C:\ngrok\ngrok.exe config add-authtoken 37gEQ2q7D85RJa0DmPdSVHcCZqy_33pfcBiXXWtpJKx8qwRMR
```
令牌已保存到 `C:\Users\admin\AppData\Local/ngrok/ngrok.yml`

### 2. 启动应用

#### 方法一：使用NGrok启动脚本（推荐）
```bash
.\start-with-ngrok.bat
```
这个脚本会：
- 启动本地Node.js服务器（端口3000）
- 启动ngrok，将localhost:3000映射到https://foxprocs.top

#### 方法二：手动启动
```bash
# 终端1：启动Node.js服务器
npm start

# 终端2：启动ngrok
C:\ngrok\ngrok.exe http --domain=foxprocs.top 3000
```

### 3. 访问应用
启动后，你可以通过以下地址访问：
- **本地**: http://localhost:3000
- **远程**: https://foxprocs.top

## 常见命令

### 查看ngrok配置
```bash
C:\ngrok\ngrok.exe config add-authtoken --help
```

### 查看ngrok状态
```bash
C:\ngrok\ngrok.exe http --domain=foxprocs.top 3000 -log=stdout
```

### 重新配置令牌
```bash
C:\ngrok\ngrok.exe config add-authtoken <新令牌>
```

## 注意事项

1. **域名绑定**: foxprocs.top 域名必须在你的ngrok账户中注册并绑定
2. **证书**: ngrok会自动生成HTTPS证书，无需手动配置
3. **可用性**: 只要ngrok进程运行，https://foxprocs.top 就可以访问
4. **日志**: 可以在ngrok控制面板 http://localhost:4040 查看请求日志

## 环境配置建议

为了完整使用，可在 `.env` 文件中添加：
```
NGROK_AUTH_TOKEN=37gEQ2q7D85RJa0DmPdSVHcCZqy_33pfcBiXXWtpJKx8qwRMR
NGROK_DOMAIN=foxprocs.top
SERVER_URL=https://foxprocs.top
LOCAL_PORT=3000
```

## 故障排除

### ngrok连接失败
- 检查令牌是否正确：`C:\ngrok\ngrok.exe authtoken 37gEQ2q7D85RJa0DmPdSVHcCZqy_33pfcBiXXWtpJKx8qwRMR`
- 检查域名是否在ngrok账户中注册
- 检查网络连接

### 本地服务器无响应
- 确保npm start在另一个终端运行
- 检查端口3000是否被占用：`netstat -ano | findstr :3000`
- 查看server.js的日志输出

### HTTPS证书问题
- ngrok自动处理证书，无需配置
- 浏览器会显示ngrok证书（这是正常的）
