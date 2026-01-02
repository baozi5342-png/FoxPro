#!/usr/bin/env node

/**
 * FoxPro Exchange 后端API测试脚本
 * 用于验证后端API是否正常工作
 */

const http = require('http');
const https = require('https');

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

let testsPassed = 0;
let testsFailed = 0;

// 测试用例
const tests = [
  {
    name: '健康检查',
    method: 'GET',
    path: '/api/health',
    expectStatus: 200,
    body: null
  },
  {
    name: '获取市场',
    method: 'GET',
    path: '/api/markets',
    expectStatus: 200,
    body: null
  },
  {
    name: '获取所有价格',
    method: 'GET',
    path: '/api/prices',
    expectStatus: 200,
    body: null
  },
  {
    name: '秒合约配置',
    method: 'GET',
    path: '/api/quick-contract/config',
    expectStatus: 200,
    body: null
  },
  {
    name: '用户注册',
    method: 'POST',
    path: '/api/auth/register',
    expectStatus: 200,
    body: {
      username: `testuser_${Date.now()}`,
      email: `test_${Date.now()}@example.com`,
      phone: '13800138000',
      password: 'Test123456'
    }
  }
];

// HTTP请求函数
function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const protocol = url.protocol === 'https:' ? https : http;
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = protocol.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data ? JSON.parse(data) : null
        });
      });
    });

    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// 运行单个测试
async function runTest(test) {
  try {
    console.log(`\n▶️  测试: ${test.name}`);
    console.log(`   ${test.method} ${test.path}`);
    
    const result = await makeRequest(test.method, test.path, test.body);
    
    if (result.status === test.expectStatus) {
      console.log(`✅ 通过 (${result.status})`);
      testsPassed++;
      return true;
    } else {
      console.log(`❌ 失败 - 期望 ${test.expectStatus}, 得到 ${result.status}`);
      testsFailed++;
      return false;
    }
  } catch (error) {
    console.log(`❌ 错误: ${error.message}`);
    testsFailed++;
    return false;
  }
}

// 主测试函数
async function runTests() {
  console.log('🧪 FoxPro Exchange 后端API测试');
  console.log(`📍 基础URL: ${BASE_URL}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  for (const test of tests) {
    await runTest(test);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📊 测试结果: ${testsPassed} 通过, ${testsFailed} 失败`);
  console.log(`成功率: ${testsPassed}/${testsPassed + testsFailed}`);
  
  if (testsFailed === 0) {
    console.log('✅ 所有测试通过！');
    process.exit(0);
  } else {
    console.log('❌ 有测试失败');
    process.exit(1);
  }
}

// 等待服务器启动
function waitForServer(attempts = 30) {
  return new Promise((resolve) => {
    const checkServer = async () => {
      try {
        const result = await makeRequest('GET', '/api/health');
        if (result.status === 200) {
          console.log('✅ 服务器已启动');
          resolve();
          return;
        }
      } catch (error) {
        // 继续重试
      }
      
      attempts--;
      if (attempts > 0) {
        console.log(`⏳ 等待服务器启动... (${30 - attempts}/30)`);
        setTimeout(checkServer, 1000);
      } else {
        console.error('❌ 服务器无法连接');
        process.exit(1);
      }
    };
    
    checkServer();
  });
}

// 启动测试
async function start() {
  console.log('🔄 正在检查服务器连接...');
  await waitForServer();
  await runTests();
}

start();
