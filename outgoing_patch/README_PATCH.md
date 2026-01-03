FoxPro outgoing_patch README

此目录包含可替换到主仓库的补丁文件，便于在本地手动应用并提交到你的远程仓库。

包含文件：
- `admin.html`：前端管理页面（完整 UI + WS 客户端退避重连）。
- `server-production.js`：后端 Express + WebSocket 实现（持久化到 data/data.json，并在状态变更时广播）。

如何应用（在你的工作区根目录下）：

1. 备份当前文件：

   copy admin.html admin.html.bak
   copy server-production.js server-production.js.bak

2. 将补丁文件复制回项目（覆盖）：

   copy outgoing_patch\admin.html .\admin.html
   copy outgoing_patch\server-production.js .\server-production.js

3. 安装依赖（如果尚未安装 ws）：

   npm install
   npm install ws --save

4. 启动服务（建议用另一个稳定终端或使用 pm2 来避免 SIGINT 中断）：

   # 在 Powershell 或 cmd 中启动
   node server-production.js

   # 使用 pm2（推荐生产环境）
   npm install -g pm2
   pm2 start server-production.js --name foxpro
   pm2 logs foxpro

5. 在浏览器打开管理页面：

   http://localhost:3000/admin

6. 测试注册并查看 admin 页面是否实时更新：

   curl -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" -d "{ \"username\": \"alice\" }"

说明与注意事项：
- `server-production.js` 在收到状态改变（新用户/新订单/更新）后会先调用 `saveData()`，再广播对应事件（如 `users`、`orders`、`stats`），以确保前端不会读取到未持久化的状态。
- 如果你在运行时遇到 `SIGINT` 导致进程被中断，优先用 `pm2` 或在独立终端运行 `node server-production.js`，不要在同一终端内连续运行 `git push` 等可能触发环境管理脚本的命令。

需要我把这些文件直接替换到项目根目录并尝试本地运行并提交吗？如果要我直接替换，请确认允许我写入 `admin.html` 和 `server-production.js`（我会先备份现有文件）。
