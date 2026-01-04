Windows / 本地 环境准备（简明）

1) 安装依赖

```bash
# 安装项目依赖
npm install

# 可选：安装 SQLite 原生驱动（建议在目标机器上安装以启用持久化）
npm install better-sqlite3 --save
```

注意（Windows）:
- 若 `better-sqlite3` 安装失败，需安装 Visual C++ Build Tools（或完整的 Visual Studio）并确保有 Python 可用。
- 推荐安装 "Desktop development with C++" 工作负载，或者安装官方的 Build Tools：
  https://visualstudio.microsoft.com/visual-cpp-build-tools/
- 安装后在新的终端中重试 `npm install better-sqlite3`。

2) 启动服务

```bash
# 直接启动
node server-production.js

# 或使用 pm2 以避免被意外终止
npx pm2 start server-production.js --name foxpro
npx pm2 logs foxpro
```

3) 简单验证

```bash
# 健康检查
curl http://localhost:3000/health

# 运行内置的测试脚本（另启终端）
node tools/api_test.js
node tools/order_test.js
node tools/ws_test_client.js
```

4) 运行时说明
- 如果环境无法编译 `better-sqlite3`，服务器会回退到基于 `data/data.json` 的文件持久化模式。
- 若要启用 SQLite，请先确保 `better-sqlite3` 安装成功，然后重启服务。
