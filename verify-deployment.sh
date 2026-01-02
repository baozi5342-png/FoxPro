#!/bin/bash

# FoxPro Exchange 部署验证脚本
# 用于验证后端部署是否完整

echo "╔════════════════════════════════════════╗"
echo "║   FoxPro Exchange 部署验证             ║"
echo "╚════════════════════════════════════════╝"
echo ""

# 颜色代码
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查计数
PASSED=0
FAILED=0

# 检查函数
check_file() {
  if [ -f "$1" ]; then
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
  else
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
  fi
}

check_dir() {
  if [ -d "$1" ]; then
    echo -e "${GREEN}✓${NC} $1/"
    ((PASSED++))
  else
    echo -e "${RED}✗${NC} $1/"
    ((FAILED++))
  fi
}

# ============ 检查后端模型 ============
echo ""
echo "📁 后端模型层："
check_file "backend/models/User.js"
check_file "backend/models/Asset.js"
check_file "backend/models/Market.js"
check_file "backend/models/Order.js"
check_file "backend/models/Transaction.js"
check_file "backend/models/LendingProduct.js"
check_file "backend/models/KYC.js"

# ============ 检查后端控制器 ============
echo ""
echo "🎮 后端控制器层："
check_file "backend/controllers/authController.js"
check_file "backend/controllers/userController.js"
check_file "backend/controllers/assetController.js"
check_file "backend/controllers/orderController.js"
check_file "backend/controllers/marketController.js"

# ============ 检查后端路由 ============
echo ""
echo "🛣️  后端路由层："
check_file "backend/routes/authRoutes.js"
check_file "backend/routes/userRoutes.js"
check_file "backend/routes/assetRoutes.js"
check_file "backend/routes/orderRoutes.js"
check_file "backend/routes/marketRoutes.js"

# ============ 检查中间件 ============
echo ""
echo "⚙️  中间件："
check_file "backend/middleware/auth.js"
check_file "backend/middleware/errorHandler.js"

# ============ 检查配置 ============
echo ""
echo "⚙️  配置文件："
check_file "backend/config/config.js"

# ============ 检查前端文件 ============
echo ""
echo "🎨 前端页面："
check_file "index.html"
check_file "login.html"
check_file "register.html"
check_file "account.html"
check_file "market.html"
check_file "trade.html"
check_file "exchange.html"
check_file "lending-products.html"
check_file "admin.html"
check_file "admin-login.html"
check_file "styles.css"

# ============ 检查主要文件 ============
echo ""
echo "📜 主要文件："
check_file "server-simple.js"
check_file "server-optimized.js"
check_file "package.json"
check_file "api-config.js"
check_file "auth.js"
check_file ".env"

# ============ 检查文档 ============
echo ""
echo "📚 文档："
check_file "BACKEND_ARCHITECTURE.md"
check_file "QUICK_START.md"
check_file "API_ENDPOINTS.js"

# ============ 检查测试脚本 ============
echo ""
echo "🧪 测试："
check_file "test-api.js"

# ============ 检查目录结构 ============
echo ""
echo "📁 目录结构："
check_dir "backend"
check_dir "backend/models"
check_dir "backend/controllers"
check_dir "backend/routes"
check_dir "backend/middleware"
check_dir "backend/config"

# ============ 检查依赖 ============
echo ""
echo "📦 依赖检查："
if grep -q '"express"' package.json; then
  echo -e "${GREEN}✓${NC} express"
  ((PASSED++))
else
  echo -e "${RED}✗${NC} express"
  ((FAILED++))
fi

if grep -q '"mongoose"' package.json; then
  echo -e "${GREEN}✓${NC} mongoose"
  ((PASSED++))
else
  echo -e "${RED}✗${NC} mongoose"
  ((FAILED++))
fi

if grep -q '"cors"' package.json; then
  echo -e "${GREEN}✓${NC} cors"
  ((PASSED++))
else
  echo -e "${RED}✗${NC} cors"
  ((FAILED++))
fi

if grep -q '"jsonwebtoken"' package.json; then
  echo -e "${GREEN}✓${NC} jsonwebtoken"
  ((PASSED++))
else
  echo -e "${RED}✗${NC} jsonwebtoken"
  ((FAILED++))
fi

# ============ 检查环境变量 ============
echo ""
echo "🔐 环境变量："
if [ -f ".env" ]; then
  if grep -q "MONGODB_URI" .env; then
    echo -e "${GREEN}✓${NC} MONGODB_URI 已配置"
    ((PASSED++))
  else
    echo -e "${YELLOW}⚠${NC} MONGODB_URI 未配置"
    ((FAILED++))
  fi
  
  if grep -q "JWT_SECRET" .env; then
    echo -e "${GREEN}✓${NC} JWT_SECRET 已配置"
    ((PASSED++))
  else
    echo -e "${YELLOW}⚠${NC} JWT_SECRET 未配置"
    ((FAILED++))
  fi
else
  echo -e "${YELLOW}⚠${NC} .env 文件未找到 (创建 .env 基于 .env.example)"
  ((FAILED++))
fi

# ============ 最终报告 ============
echo ""
echo "╔════════════════════════════════════════╗"
echo "║            验证结果                    ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}✓ 通过: $PASSED${NC}"
echo -e "${RED}✗ 失败: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ 所有检查通过！后端部署准备就绪。${NC}"
  echo ""
  echo "下一步:"
  echo "  1. npm install        # 安装依赖"
  echo "  2. npm run dev        # 启动服务器"
  echo "  3. npm test           # 运行API测试"
  exit 0
else
  echo -e "${RED}❌ 有 $FAILED 项检查失败。请检查上述问题。${NC}"
  echo ""
  echo "常见问题:"
  echo "  - .env 文件缺失: 复制 .env.example 到 .env 并配置"
  echo "  - 缺少文件: 检查git clone是否完整"
  echo "  - 缺少依赖: 运行 npm install"
  exit 1
fi
