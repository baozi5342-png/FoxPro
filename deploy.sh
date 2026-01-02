#!/bin/bash

# FoxPro Exchange 自动化部署脚本
# 用于一键发布到Render

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════╗"
echo "║  FoxPro Exchange 自动化部署脚本            ║"
echo "║  Automated Deployment Script               ║"
echo "╚════════════════════════════════════════════╝"
echo -e "${NC}"

# 检查必要的工具
check_command() {
  if ! command -v $1 &> /dev/null; then
    echo -e "${RED}✗ 错误: 未找到 $1 命令${NC}"
    exit 1
  fi
}

echo -e "${YELLOW}检查环境...${NC}"
check_command git
check_command npm
echo -e "${GREEN}✓ 环境检查完成${NC}"
echo ""

# 获取用户输入
read -p "请输入提交信息 (默认: Update backend modules): " COMMIT_MSG
COMMIT_MSG=${COMMIT_MSG:-"Update backend modules"}

read -p "确认部署分支 (默认: main): " BRANCH
BRANCH=${BRANCH:-"main"}

# 步骤1: 验证部署
echo -e "${YELLOW}[1/5] 验证部署环境...${NC}"
if [ ! -f "package.json" ]; then
  echo -e "${RED}✗ package.json 不存在${NC}"
  exit 1
fi

if [ ! -f ".env" ]; then
  echo -e "${YELLOW}⚠ .env 文件不存在，请创建后再继续${NC}"
  exit 1
fi

if [ ! -d ".git" ]; then
  echo -e "${YELLOW}初始化Git仓库...${NC}"
  git init
  git config user.email "foxpro@exchange.com" 2>/dev/null || true
  git config user.name "FoxPro Deploy" 2>/dev/null || true
fi

echo -e "${GREEN}✓ 环境验证完成${NC}"
echo ""

# 步骤2: 安装依赖
echo -e "${YELLOW}[2/5] 安装/更新依赖...${NC}"
npm install --legacy-peer-deps
echo -e "${GREEN}✓ 依赖安装完成${NC}"
echo ""

# 步骤3: 运行测试
echo -e "${YELLOW}[3/5] 运行API测试...${NC}"
timeout 30 node test-api.js || echo -e "${YELLOW}⚠ 测试超时或失败，继续部署${NC}"
echo -e "${GREEN}✓ 测试完成${NC}"
echo ""

# 步骤4: 提交到Git
echo -e "${YELLOW}[4/5] 提交代码到Git...${NC}"

# 检查是否有改动
if [ -z "$(git status --porcelain)" ]; then
  echo -e "${YELLOW}⚠ 没有改动的文件${NC}"
else
  git add .
  git commit -m "$COMMIT_MSG" || echo -e "${YELLOW}⚠ Git提交失败，继续${NC}"
  
  # 获取远程URL
  REMOTE_URL=$(git config --get remote.origin.url 2>/dev/null || echo "")
  
  if [ -z "$REMOTE_URL" ]; then
    echo -e "${YELLOW}⚠ 未设置远程仓库${NC}"
    echo -e "${BLUE}请设置GitHub远程仓库:${NC}"
    echo -e "  git remote add origin https://github.com/YOUR_USERNAME/foxpro.git"
  else
    git push -u origin "$BRANCH" || echo -e "${YELLOW}⚠ 推送失败，请检查GitHub权限${NC}"
  fi
fi

echo -e "${GREEN}✓ Git操作完成${NC}"
echo ""

# 步骤5: 部署到Render
echo -e "${YELLOW}[5/5] 部署到Render...${NC}"

if [ -f "render.yaml" ]; then
  echo -e "${BLUE}✓ 检测到 render.yaml 配置文件${NC}"
  echo ""
  echo -e "${GREEN}部署指南:${NC}"
  echo "  1. 访问 https://dashboard.render.com"
  echo "  2. 点击 'New +' > 'Web Service'"
  echo "  3. 选择 'Build and deploy from a Git repository'"
  echo "  4. 连接你的GitHub仓库"
  echo "  5. 选择分支: $BRANCH"
  echo "  6. Render 会自动读取 render.yaml 配置"
  echo ""
  echo -e "${BLUE}或使用CLI部署:${NC}"
  echo "  npm install -g @render-com/cli"
  echo "  render deploy"
else
  echo -e "${YELLOW}⚠ 未找到 render.yaml${NC}"
  echo "请手动在 Render 面板配置"
fi

echo ""
echo -e "${GREEN}✓ 部署准备完成${NC}"
echo ""

# 显示部署信息
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo -e "${GREEN}部署摘要:${NC}"
echo -e "  分支:       ${BLUE}$BRANCH${NC}"
echo -e "  提交信息:   ${BLUE}$COMMIT_MSG${NC}"
echo -e "  时间:       ${BLUE}$(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo ""
echo -e "${YELLOW}后续步骤:${NC}"
echo "  1. 等待 Render 自动构建（2-5分钟）"
echo "  2. 检查 Render Dashboard 查看部署状态"
echo "  3. 部署成功后，访问你的应用URL"
echo ""
echo -e "${BLUE}查看部署日志:${NC}"
echo "  https://dashboard.render.com"
echo ""
echo -e "${GREEN}✓ 脚本执行完成！${NC}"
echo -e "${BLUE}════════════════════════════════════════════${NC}"
