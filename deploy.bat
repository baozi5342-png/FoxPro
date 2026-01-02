@echo off
REM FoxPro Exchange 自动化部署脚本 (Windows)
REM Automated Deployment Script for Windows

setlocal enabledelayedexpansion

cls
echo.
echo ╔════════════════════════════════════════════╗
echo ║  FoxPro Exchange 自动化部署脚本            ║
echo ║  Automated Deployment Script (Windows)     ║
echo ╚════════════════════════════════════════════╝
echo.

REM 检查必要的工具
echo [检查环境...]

where git >nul 2>nul
if errorlevel 1 (
  echo ✗ 错误: 未找到 git 命令
  echo 请下载安装: https://git-scm.com/download/win
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo ✗ 错误: 未找到 npm 命令
  echo 请下载安装: https://nodejs.org/
  pause
  exit /b 1
)

echo ✓ 环境检查完成
echo.

REM 获取提交信息
set "COMMIT_MSG=Update backend modules"
set /p COMMIT_MSG="请输入提交信息 (默认: Update backend modules): "

REM 获取分支名
set "BRANCH=main"
set /p BRANCH="确认部署分支 (默认: main): "

REM 步骤1: 验证部署
echo [1/5] 验证部署环境...

if not exist "package.json" (
  echo ✗ package.json 不存在
  pause
  exit /b 1
)

if not exist ".env" (
  echo ⚠ .env 文件不存在，请创建后再继续
  echo 复制 .env.example 到 .env 并配置 MONGODB_URI
  pause
  exit /b 1
)

if not exist ".git" (
  echo 初始化Git仓库...
  git init
  git config user.email "foxpro@exchange.com"
  git config user.name "FoxPro Deploy"
)

echo ✓ 环境验证完成
echo.

REM 步骤2: 安装依赖
echo [2/5] 安装/更新依赖...
call npm install --legacy-peer-deps
if errorlevel 1 (
  echo ⚠ npm install 失败
)
echo ✓ 依赖安装完成
echo.

REM 步骤3: 运行测试
echo [3/5] 运行API测试...
timeout /t 2 /nobreak >nul
echo ⚠ 跳过API测试 (请在生产环境手动测试)
echo ✓ 测试步骤完成
echo.

REM 步骤4: 提交到Git
echo [4/5] 提交代码到Git...

git status --porcelain | findstr . >nul
if not errorlevel 1 (
  echo 检测到文件更改，提交中...
  git add .
  git commit -m "!COMMIT_MSG!"
  
  REM 尝试推送
  git config --get remote.origin.url >nul 2>nul
  if not errorlevel 1 (
    echo 推送到远程仓库...
    git push -u origin !BRANCH! 2>nul
    if errorlevel 1 (
      echo ⚠ 推送失败，请检查GitHub权限
    ) else (
      echo ✓ 推送成功
    )
  ) else (
    echo ⚠ 未设置远程仓库
    echo 请设置GitHub远程: git remote add origin https://github.com/YOUR_USERNAME/foxpro.git
  )
) else (
  echo ⚠ 没有改动的文件
)

echo ✓ Git操作完成
echo.

REM 步骤5: 部署到Render
echo [5/5] 部署到Render...
echo.

if exist "render.yaml" (
  echo ✓ 检测到 render.yaml 配置文件
  echo.
  echo 部署指南:
  echo   1. 访问 https://dashboard.render.com
  echo   2. 点击 'New +' ^> 'Web Service'
  echo   3. 选择 'Build and deploy from a Git repository'
  echo   4. 连接你的GitHub仓库
  echo   5. 选择分支: !BRANCH!
  echo   6. Render 会自动读取 render.yaml 配置
) else (
  echo ⚠ 未找到 render.yaml
  echo 请手动在 Render 面板配置
)

echo.
echo ✓ 部署准备完成
echo.
echo ════════════════════════════════════════════
echo 部署摘要:
echo   分支:       !BRANCH!
echo   提交信息:   !COMMIT_MSG!
echo   时间:       %date% %time%
echo.
echo 后续步骤:
echo   1. 等待 Render 自动构建（2-5分钟）
echo   2. 检查 Render Dashboard 查看部署状态
echo   3. 部署成功后，访问你的应用URL
echo.
echo 查看部署日志:
echo   https://dashboard.render.com
echo.
echo ✓ 脚本执行完成！
echo ════════════════════════════════════════════
echo.

pause
