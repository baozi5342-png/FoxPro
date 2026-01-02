@echo off
setlocal enabledelayedexpansion

echo ======================================
echo   FoxPro Exchange - NGrok启动脚本
echo ======================================
echo.
echo 配置信息:
echo   域名: foxprocs.top
echo   本地服务器: http://localhost:3000
echo.

REM 检查Node.js
echo 检查 Node.js...
node --version
if errorlevel 1 (
    echo 错误: Node.js 未安装
    pause
    exit /b 1
)
echo.

REM 检查依赖
echo 检查依赖...
if not exist node_modules (
    echo 安装依赖...
    call npm install
)
echo.

REM 启动服务器和ngrok
echo 启动服务器...
start "FoxPro Server" cmd /k npm start
echo 等待服务器启动...
timeout /t 3

echo.
echo 启动 ngrok...
echo 将http://localhost:3000映射到 https://foxprocs.top
echo.

REM 使用ngrok连接（免费账户将生成随机域名）
REM 如需使用foxprocs.top需要升级到付费计划
C:\ngrok\ngrok.exe http 3000

echo.
echo 按 Ctrl+C 停止所有服务
pause
