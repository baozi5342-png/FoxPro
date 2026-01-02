@echo off
REM FoxPro Exchange 部署验证脚本 (Windows)
REM 用于验证后端部署是否完整

setlocal enabledelayedexpansion

echo.
echo ════════════════════════════════════════
echo    FoxPro Exchange 部署验证
echo ════════════════════════════════════════
echo.

set PASSED=0
set FAILED=0

REM 检查文件存在
setlocal enabledelayedexpansion
for %%F in (
  "backend\models\User.js"
  "backend\models\Asset.js"
  "backend\models\Market.js"
  "backend\models\Order.js"
  "backend\models\Transaction.js"
  "backend\models\LendingProduct.js"
  "backend\models\KYC.js"
  "backend\controllers\authController.js"
  "backend\controllers\userController.js"
  "backend\controllers\assetController.js"
  "backend\controllers\orderController.js"
  "backend\controllers\marketController.js"
  "backend\routes\authRoutes.js"
  "backend\routes\userRoutes.js"
  "backend\routes\assetRoutes.js"
  "backend\routes\orderRoutes.js"
  "backend\routes\marketRoutes.js"
  "backend\middleware\auth.js"
  "backend\middleware\errorHandler.js"
  "backend\config\config.js"
  "server-simple.js"
  "server-optimized.js"
  "package.json"
  "api-config.js"
  ".env"
) do (
  if exist %%F (
    echo [OK] %%F
    set /a PASSED+=1
  ) else (
    echo [FAIL] %%F
    set /a FAILED+=1
  )
)

echo.
echo ════════════════════════════════════════
echo    验证结果
echo ════════════════════════════════════════
echo [通过] %PASSED%
echo [失败] %FAILED%
echo.

if %FAILED% equ 0 (
  echo ✓ 所有检查通过！后端部署准备就绪。
  echo.
  echo 下一步:
  echo   1. npm install        ^# 安装依赖
  echo   2. npm run dev        ^# 启动服务器
  echo   3. node test-api.js   ^# 运行API测试
  echo.
  exit /b 0
) else (
  echo ✗ 有 %FAILED% 项检查失败。
  echo.
  exit /b 1
)
