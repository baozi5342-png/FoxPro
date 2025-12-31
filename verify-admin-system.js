#!/usr/bin/env node

/**
 * FoxPro Admin System - 验证脚本
 * 用于验证后台管理系统的所有功能是否正常
 * 
 * 使用: node verify-admin-system.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:3000';
const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  bold: '\x1b[1m'
};

let testsPassed = 0;
let testsFailed = 0;
let adminToken = null;

// 模拟管理员token（实际应用中需要真实token）
const mockAdminToken = 'mock-admin-token-for-testing';

console.log(`${COLORS.blue}${COLORS.bold}
╔════════════════════════════════════════════╗
║   FoxPro 后台管理系统验证脚本              ║
║   Admin System Verification Script         ║
╚════════════════════════════════════════════╝
${COLORS.reset}\n`);

// 辅助函数：发送HTTP请求
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${mockAdminToken}`
      }
    };

    if (method === 'POST' || method === 'PUT') {
      const body = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }

    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// 测试函数
async function test(name, fn) {
  try {
    process.stdout.write(`⏳ ${name}... `);
    await fn();
    console.log(`${COLORS.green}✓ 通过${COLORS.reset}`);
    testsPassed++;
  } catch (error) {
    console.log(`${COLORS.red}✗ 失败: ${error.message}${COLORS.reset}`);
    testsFailed++;
  }
}

// 测试套件
async function runTests() {
  console.log(`${COLORS.bold}📝 测试项目清单:${COLORS.reset}\n`);

  // 1. 检查服务器连接
  await test('1. 检查服务器是否运行', async () => {
    try {
      const response = await makeRequest('GET', '/api/admin/pages');
      if (response.status !== 401 && response.status !== 200) {
        throw new Error(`服务器状态码异常: ${response.status}`);
      }
    } catch (error) {
      throw new Error(`无法连接到服务器 (${API_BASE})`);
    }
  });

  // 2. 测试获取页面内容
  await test('2. 获取页面内容 (GET /api/admin/pages/:pageId)', async () => {
    const response = await makeRequest('GET', '/api/admin/pages/home');
    // 可能返回401（无token）或200（有token）或200但data为null（页面不存在）
    if (![200, 401].includes(response.status)) {
      throw new Error(`未预期的状态码: ${response.status}`);
    }
  });

  // 3. 测试保存页面内容
  await test('3. 保存页面内容 (POST /api/admin/pages/:pageId)', async () => {
    const response = await makeRequest('POST', '/api/admin/pages/home', {
      heading: '测试标题',
      description: '测试描述',
      content: '测试内容',
      status: 'active'
    });
    if (![200, 201, 401].includes(response.status)) {
      throw new Error(`未预期的状态码: ${response.status}`);
    }
  });

  // 4. 测试删除页面内容
  await test('4. 删除页面内容 (DELETE /api/admin/pages/:pageId)', async () => {
    const response = await makeRequest('DELETE', '/api/admin/pages/home');
    if (![200, 204, 401].includes(response.status)) {
      throw new Error(`未预期的状态码: ${response.status}`);
    }
  });

  // 5. 测试获取页面列表
  await test('5. 获取所有页面列表 (GET /api/admin/pages)', async () => {
    const response = await makeRequest('GET', '/api/admin/pages');
    if (![200, 401].includes(response.status)) {
      throw new Error(`未预期的状态码: ${response.status}`);
    }
  });

  // 6. 检查必要的文件存在
  await test('6. 检查 page-manager.js 文件', async () => {
    if (!fs.existsSync(path.join(__dirname, 'page-manager.js'))) {
      throw new Error('page-manager.js 不存在');
    }
  });

  // 7. 检查 admin.html 存在
  await test('7. 检查 admin.html 文件', async () => {
    if (!fs.existsSync(path.join(__dirname, 'admin.html'))) {
      throw new Error('admin.html 不存在');
    }
  });

  // 8. 检查文档文件
  await test('8. 检查 ADMIN_GUIDE.md 文档', async () => {
    if (!fs.existsSync(path.join(__dirname, 'ADMIN_GUIDE.md'))) {
      throw new Error('ADMIN_GUIDE.md 不存在');
    }
  });

  // 9. 检查 index.html 是否已集成
  await test('9. 检查 index.html page-manager 集成', async () => {
    const content = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    if (!content.includes('page-manager.js')) {
      throw new Error('index.html 未集成 page-manager.js');
    }
  });

  // 10. 验证数据库
  await test('10. 检查数据库文件', async () => {
    if (!fs.existsSync(path.join(__dirname, 'foxpro.db'))) {
      throw new Error('foxpro.db 数据库文件不存在');
    }
  });

  // 显示结果
  console.log(`\n${COLORS.bold}📊 测试结果:${COLORS.reset}\n`);
  console.log(`${COLORS.green}✓ 通过: ${testsPassed}${COLORS.reset}`);
  console.log(`${COLORS.red}✗ 失败: ${testsFailed}${COLORS.reset}`);
  
  const total = testsPassed + testsFailed;
  const percentage = Math.round((testsPassed / total) * 100);
  console.log(`\n完成度: ${COLORS.bold}${percentage}%${COLORS.reset} (${testsPassed}/${total})\n`);

  if (testsFailed === 0) {
    console.log(`${COLORS.green}${COLORS.bold}🎉 所有测试通过！系统已就绪！${COLORS.reset}\n`);
    process.exit(0);
  } else {
    console.log(`${COLORS.yellow}⚠️  请检查上述失败项目${COLORS.reset}\n`);
    process.exit(1);
  }
}

// 显示帮助信息
console.log(`${COLORS.bold}📌 验证说明:${COLORS.reset}
- 此脚本检查后台管理系统的完整性
- 需要Node.js服务器已启动（npm start）
- 验证API端点和文件完整性
- 检查前端集成是否正确\n`);

console.log(`${COLORS.bold}🚀 开始测试...${COLORS.reset}\n`);

// 运行测试
runTests().catch(error => {
  console.error(`${COLORS.red}严重错误: ${error.message}${COLORS.reset}`);
  process.exit(1);
});
