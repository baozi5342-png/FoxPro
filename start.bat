@echo off
echo ======================================
echo   FoxPro Exchange 启动脚本
echo ======================================
echo.
echo 检查 Node.js...
node --version
echo.
echo 检查依赖...
if not exist node_modules (
  echo 安装依赖...
  call npm install
)
echo.
echo 启动服务器...
echo 服务器将在 http://localhost:3000 运行
echo.
echo 请在浏览器中打开：
echo   主页面: http://localhost:3000/index.html
echo   交易页: http://localhost:3000/trade.html
echo.
echo 按 Ctrl+C 停止服务器
echo.
call npm start
pause
