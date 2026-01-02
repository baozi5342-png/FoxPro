const express = require("express");
const cors = require("cors");
// 使用内存数据库以兼容Render（生产环境应使用MongoDB）
const Database = process.env.NODE_ENV === 'production' ? require("./memory-db") : require("better-sqlite3");
const path = require("path");
const jwt = require("jsonwebtoken");
const app = express();

// JWT密钥
const JWT_SECRET = process.env.JWT_SECRET || "foxpro-secret-key-2026";

app.use(cors());
app.use(express.json());

// 调试中间件：记录所有请求
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[API] ${req.method} ${req.path}`);
  }
  next();
});

// 先处理所有 /api 路由，再处理静态文件
// 这样确保 API 请求不会被静态文件处理器拦截

// 初始化 数据库
const dbPath = path.join(__dirname, "foxpro.db");
let db;

if (process.env.NODE_ENV === 'production') {
  // 生产环境使用内存数据库
  console.log('⚠️  使用临时内存数据库（Render环境）');
  console.log('💡 提示：请配置MONGODB_URI以使用永久数据库');
  db = new Database(); // 内存数据库
} else {
  // 本地开发环境使用SQLite
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
}

// 创建用户表
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    password TEXT NOT NULL,
    phone TEXT,
    country TEXT,
    status TEXT DEFAULT 'active',
    isAdmin INTEGER DEFAULT 0,
    createdAt TEXT,
    updatedAt TEXT
  );
`);

// 创建充值币种配置表
db.exec(`
  CREATE TABLE IF NOT EXISTS recharge_config (
    id TEXT PRIMARY KEY,
    coin TEXT NOT NULL UNIQUE,
    network TEXT NOT NULL,
    address TEXT NOT NULL,
    qrCodeUrl TEXT,
    minAmount REAL NOT NULL,
    enabled INTEGER DEFAULT 1,
    createdAt TEXT,
    updatedAt TEXT
  );
`);

// 创建充值订单表
db.exec(`
  CREATE TABLE IF NOT EXISTS recharge_orders (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    username TEXT,
    coin TEXT NOT NULL,
    amount REAL NOT NULL,
    network TEXT,
    address TEXT,
    txHash TEXT,
    status TEXT DEFAULT 'pending',
    notes TEXT,
    createdAt TEXT,
    updatedAt TEXT,
    FOREIGN KEY (userId) REFERENCES users(id)
  );
`);

// 创建提现订单表
db.exec(`
  CREATE TABLE IF NOT EXISTS withdraw_orders (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    username TEXT,
    coin TEXT NOT NULL,
    amount REAL NOT NULL,
    network TEXT,
    address TEXT,
    txHash TEXT,
    status TEXT DEFAULT 'pending',
    notes TEXT,
    createdAt TEXT,
    updatedAt TEXT,
    FOREIGN KEY (userId) REFERENCES users(id)
  );
`);

// 创建用户资产表
db.exec(`
  CREATE TABLE IF NOT EXISTS user_assets (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL UNIQUE,
    balances TEXT,
    createdAt TEXT,
    updatedAt TEXT,
    FOREIGN KEY (userId) REFERENCES users(id)
  );
`);

// 创建动态内容表（服务条款、白皮书、帮助等）
db.exec(`
  CREATE TABLE IF NOT EXISTS site_content (
    id TEXT PRIMARY KEY,
    type TEXT UNIQUE NOT NULL,
    title TEXT,
    content TEXT,
    link TEXT,
    createdAt TEXT,
    updatedAt TEXT
  );
`);

// 创建客服配置表
db.exec(`
  CREATE TABLE IF NOT EXISTS support_config (
    id TEXT PRIMARY KEY,
    type TEXT UNIQUE NOT NULL,
    link TEXT NOT NULL,
    title TEXT,
    description TEXT,
    enabled INTEGER DEFAULT 1,
    createdAt TEXT,
    updatedAt TEXT
  );
`);

// 创建客服消息表
db.exec(`
  CREATE TABLE IF NOT EXISTS support_messages (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    username TEXT,
    role TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'unread',
    createdAt TEXT,
    FOREIGN KEY (userId) REFERENCES users(id)
  );
`);

// 创建秒合约配置表
db.exec(`
  CREATE TABLE IF NOT EXISTS quick_contract_config (
    id TEXT PRIMARY KEY,
    seconds INTEGER NOT NULL UNIQUE,
    profitRate REAL NOT NULL,
    minAmount REAL DEFAULT 10,
    maxAmount REAL DEFAULT 100000,
    enabled INTEGER DEFAULT 1,
    createdAt TEXT,
    updatedAt TEXT
  );
`);

// 创建秒合约订单表
db.exec(`
  CREATE TABLE IF NOT EXISTS quick_contract_orders (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    username TEXT,
    symbol TEXT NOT NULL,
    direction TEXT NOT NULL,
    seconds INTEGER NOT NULL,
    amount REAL NOT NULL,
    entryPrice REAL NOT NULL,
    exitPrice REAL,
    profit REAL,
    profitRate REAL,
    status TEXT DEFAULT 'pending',
    result TEXT,
    createdAt TEXT,
    updatedAt TEXT,
    FOREIGN KEY (userId) REFERENCES users(id)
  );
`);

// 创建理财产品表
db.exec(`
  CREATE TABLE IF NOT EXISTS wealth_products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    term INTEGER NOT NULL,
    annualRate REAL NOT NULL,
    minAmount REAL NOT NULL,
    maxAmount REAL NOT NULL,
    riskLevel TEXT NOT NULL,
    description TEXT,
    enabled INTEGER DEFAULT 1,
    createdAt TEXT,
    updatedAt TEXT
  );
`);

// 创建用户理财订单表
db.exec(`
  CREATE TABLE IF NOT EXISTS wealth_orders (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    productId TEXT NOT NULL,
    productName TEXT,
    amount REAL NOT NULL,
    annualRate REAL NOT NULL,
    term INTEGER NOT NULL,
    status TEXT DEFAULT 'active',
    expectedProfit REAL,
    actualProfit REAL,
    startDate TEXT,
    endDate TEXT,
    createdAt TEXT,
    updatedAt TEXT,
    FOREIGN KEY (userId) REFERENCES users(id),
    FOREIGN KEY (productId) REFERENCES wealth_products(id)
  );
`);

// 创建现货交易订单表
db.exec(`
  CREATE TABLE IF NOT EXISTS spot_orders (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    symbol TEXT NOT NULL,
    type TEXT NOT NULL,
    side TEXT NOT NULL,
    price REAL NOT NULL,
    amount REAL NOT NULL,
    totalValue REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    filledAmount REAL DEFAULT 0,
    avgFillPrice REAL,
    fee REAL DEFAULT 0,
    createdAt TEXT,
    updatedAt TEXT,
    FOREIGN KEY (userId) REFERENCES users(id)
  );
`);

// 创建永续合约持仓表
db.exec(`
  CREATE TABLE IF NOT EXISTS perpetual_positions (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL,
    leverage INTEGER DEFAULT 1,
    entryPrice REAL NOT NULL,
    amount REAL NOT NULL,
    margin REAL NOT NULL,
    unrealizedPnl REAL DEFAULT 0,
    status TEXT DEFAULT 'open',
    createdAt TEXT,
    updatedAt TEXT,
    FOREIGN KEY (userId) REFERENCES users(id)
  );
`);

// 创建永续合约订单表
db.exec(`
  CREATE TABLE IF NOT EXISTS perpetual_orders (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    positionId TEXT,
    symbol TEXT NOT NULL,
    type TEXT NOT NULL,
    side TEXT NOT NULL,
    price REAL,
    amount REAL NOT NULL,
    executedAt TEXT,
    status TEXT DEFAULT 'pending',
    pnl REAL DEFAULT 0,
    createdAt TEXT,
    updatedAt TEXT,
    FOREIGN KEY (userId) REFERENCES users(id),
    FOREIGN KEY (positionId) REFERENCES perpetual_positions(id)
  );
`);

// 创建页面管理表
db.exec(`
  CREATE TABLE IF NOT EXISTS page_sections (
    id TEXT PRIMARY KEY,
    pageId TEXT NOT NULL,
    pageName TEXT NOT NULL,
    sectionKey TEXT NOT NULL,
    sectionTitle TEXT,
    sectionType TEXT,
    content TEXT,
    htmlContent TEXT,
    order_index INTEGER DEFAULT 0,
    enabled INTEGER DEFAULT 1,
    createdAt TEXT,
    updatedAt TEXT,
    UNIQUE(pageId, sectionKey)
  );
`);

// 创建验证提交表
db.exec(`
  CREATE TABLE IF NOT EXISTS verification_submissions (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    type TEXT NOT NULL,
    data TEXT,
    status TEXT DEFAULT 'pending',
    submittedAt TEXT,
    reviewedAt TEXT,
    reviewedBy TEXT,
    reviewNotes TEXT,
    createdAt TEXT,
    updatedAt TEXT,
    FOREIGN KEY (userId) REFERENCES users(id)
  );
`);

// 创建用户密码表（用于withdrawal password和security questions）
db.exec(`
  CREATE TABLE IF NOT EXISTS user_passwords (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL UNIQUE,
    loginPassword TEXT NOT NULL,
    withdrawalPassword TEXT,
    securityQuestion TEXT,
    securityAnswer TEXT,
    createdAt TEXT,
    updatedAt TEXT,
    FOREIGN KEY (userId) REFERENCES users(id)
  );
`);

// 创建充值币种表
db.exec(`
  CREATE TABLE IF NOT EXISTS recharge_coins (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    symbol TEXT UNIQUE NOT NULL,
    network TEXT,
    address TEXT,
    minAmount REAL,
    maxAmount REAL,
    status TEXT DEFAULT 'active',
    qrCode TEXT,
    description TEXT,
    createdAt TEXT,
    updatedAt TEXT
  );
`);

// 初始化默认用户
const initDefaultUsers = () => {
  const defaultUsers = [
    {
      id: "user_001",
      username: "testuser",
      email: "test@example.com",
      password: "Test123456",
      phone: "13800138000",
      country: "CN",
      isAdmin: 0,
      createdAt: new Date().toISOString()
    },
    {
      id: "admin_001",
      username: "admin",
      email: "admin@foxpro.com",
      password: "admin123",
      phone: "13900139000",
      country: "CN",
      isAdmin: 1,
      createdAt: new Date().toISOString()
    }
  ];

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO users 
    (id, username, email, password, phone, country, isAdmin, createdAt) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  defaultUsers.forEach(user => {
    stmt.run(user.id, user.username, user.email, user.password, user.phone, user.country, user.isAdmin, user.createdAt);
  });

  // 初始化用户资产
  const emptyBalances = JSON.stringify({
    BTC: 0,
    ETH: 0,
    USDT: 0,
    SOL: 0,
    ADA: 0,
    XRP: 0,
    DOGE: 0,
    LTC: 0
  });

  const now = new Date().toISOString();
  const assetStmt = db.prepare(`
    INSERT OR IGNORE INTO user_assets 
    (id, userId, balances, createdAt, updatedAt) 
    VALUES (?, ?, ?, ?, ?)
  `);

  defaultUsers.forEach(user => {
    const assetId = "asset_" + user.id;
    assetStmt.run(assetId, user.id, emptyBalances, now, now);
  });
};

initDefaultUsers();

// 初始化秒合约配置
const initQuickContractConfig = () => {
  const configs = [
    { id: "qc_30", seconds: 30, profitRate: 40 },   // 40%
    { id: "qc_60", seconds: 60, profitRate: 50 },   // 50%
    { id: "qc_120", seconds: 120, profitRate: 60 }, // 60%
    { id: "qc_180", seconds: 180, profitRate: 80 }, // 80%
    { id: "qc_300", seconds: 300, profitRate: 100 } // 100%
  ];

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO quick_contract_config 
    (id, seconds, profitRate, minAmount, maxAmount, enabled, createdAt, updatedAt) 
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)
  `);

  const now = new Date().toISOString();
  configs.forEach(config => {
    stmt.run(config.id, config.seconds, config.profitRate, 10, 100000, now, now);
  });
};

initQuickContractConfig();

// 初始化理财产品
const initWealthProducts = () => {
  const now = new Date().toISOString();
  const products = [
    {
      id: "wp_001",
      name: "保本稳赚 - 30天",
      type: "safe",
      term: 30,
      annualRate: 8,
      minAmount: 100,
      maxAmount: 100000,
      riskLevel: "低",
      description: "本金保障，固定收益，适合保守投资者"
    },
    {
      id: "wp_002",
      name: "智选收益 - 90天",
      type: "balanced",
      term: 90,
      annualRate: 12,
      minAmount: 500,
      maxAmount: 500000,
      riskLevel: "中",
      description: "收益稳定，风险可控，期限灵活"
    },
    {
      id: "wp_003",
      name: "高收益计划 - 180天",
      type: "high",
      term: 180,
      annualRate: 18,
      minAmount: 1000,
      maxAmount: 1000000,
      riskLevel: "高",
      description: "追求高收益的专业投资者首选"
    },
    {
      id: "wp_004",
      name: "活期宝 - 随时提取",
      type: "liquid",
      term: 0,
      annualRate: 5,
      minAmount: 50,
      maxAmount: 50000,
      riskLevel: "低",
      description: "随时购买，随时提取，收益稳定"
    }
  ];

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO wealth_products 
    (id, name, type, term, annualRate, minAmount, maxAmount, riskLevel, description, enabled, createdAt, updatedAt) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `);

  products.forEach(p => {
    stmt.run(p.id, p.name, p.type, p.term, p.annualRate, p.minAmount, p.maxAmount, p.riskLevel, p.description, now, now);
  });
};

initWealthProducts();

// 初始化页面管理
const initPageSections = () => {
  const pageSections = [
    // 首页
    { pageId: "index", pageName: "首页", sectionKey: "hero_title", sectionTitle: "Hero标题", sectionType: "text", content: "FoxPro Exchange - 安全可靠的数字资产交易平台" },
    { pageId: "index", pageName: "首页", sectionKey: "hero_subtitle", sectionTitle: "Hero副标题", sectionType: "text", content: "24小时交易，极速充提，专业风控" },
    { pageId: "index", pageName: "首页", sectionKey: "features_description", sectionTitle: "功能描述", sectionType: "text", content: "我们提供现货交易、合约交易、秒合约等多种交易方式" },
    
    // 市场页面
    { pageId: "market", pageName: "市场", sectionKey: "page_title", sectionTitle: "页面标题", sectionType: "text", content: "Markets" },
    { pageId: "market", pageName: "市场", sectionKey: "page_description", sectionTitle: "页面描述", sectionType: "text", content: "查看实时加密货币价格和交易信息" },
    
    // 交易页面
    { pageId: "trade", pageName: "交易", sectionKey: "page_title", sectionTitle: "页面标题", sectionType: "text", content: "Trade" },
    { pageId: "trade", pageName: "交易", sectionKey: "quick_contract_title", sectionTitle: "秒合约标题", sectionType: "text", content: "Quick Contract" },
    
    // 资产页面
    { pageId: "assets", pageName: "资产", sectionKey: "page_title", sectionTitle: "页面标题", sectionType: "text", content: "Assets" },
    { pageId: "assets", pageName: "资产", sectionKey: "balance_description", sectionTitle: "余额描述", sectionType: "text", content: "您的账户资产信息" },
    
    // 账户页面
    { pageId: "account", pageName: "账户", sectionKey: "page_title", sectionTitle: "页面标题", sectionType: "text", content: "Account" },
    { pageId: "account", pageName: "账户", sectionKey: "profile_description", sectionTitle: "个人资料描述", sectionType: "text", content: "管理您的个人信息和账户安全设置" },
    
    // 关于页面
    { pageId: "about", pageName: "关于我们", sectionKey: "company_title", sectionTitle: "公司标题", sectionType: "text", content: "关于 FoxPro Exchange" },
    { pageId: "about", pageName: "关于我们", sectionKey: "company_description", sectionTitle: "公司描述", sectionType: "html", content: "<p>FoxPro Exchange 是一个创新的数字资产交易平台</p>" },
    
    // 充值页面
    { pageId: "recharge", pageName: "充值", sectionKey: "page_title", sectionTitle: "页面标题", sectionType: "text", content: "Recharge" },
    { pageId: "recharge", pageName: "充值", sectionKey: "instruction", sectionTitle: "充值说明", sectionType: "text", content: "选择币种和网络，按照说明进行充值" },
    
    // 提现页面
    { pageId: "withdraw", pageName: "提现", sectionKey: "page_title", sectionTitle: "页面标题", sectionType: "text", content: "Withdraw" },
    { pageId: "withdraw", pageName: "提现", sectionKey: "instruction", sectionTitle: "提现说明", sectionType: "text", content: "输入提币地址和金额，确认提币" },
    
    // 客服页面
    { pageId: "customer-support", pageName: "客服", sectionKey: "page_title", sectionTitle: "页面标题", sectionType: "text", content: "Customer Support" },
    { pageId: "customer-support", pageName: "客服", sectionKey: "support_description", sectionTitle: "支持描述", sectionType: "text", content: "24小时在线客服，为您解答任何问题" }
  ];

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO page_sections 
    (id, pageId, pageName, sectionKey, sectionTitle, sectionType, content, enabled, createdAt, updatedAt) 
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `);

  const now = new Date().toISOString();
  pageSections.forEach((section, index) => {
    const id = `ps_${section.pageId}_${section.sectionKey}`;
    stmt.run(id, section.pageId, section.pageName, section.sectionKey, section.sectionTitle, section.sectionType, section.content, now, now);
  });
};

initPageSections();

// 初始化默认充值币种
const initRechargeCoins = () => {
  const coins = [
    {
      id: "coin_btc",
      name: "Bitcoin",
      symbol: "BTC",
      network: "Bitcoin",
      address: "1A1z7agoat4tDMjRL5FlVa8pQxXapNryQJ",
      minAmount: 0.001,
      maxAmount: 100,
      status: "active",
      description: "比特币"
    },
    {
      id: "coin_eth",
      name: "Ethereum",
      symbol: "ETH",
      network: "Ethereum",
      address: "0x742d35Cc6634C0532925a3b844Bc9e7595f42bE",
      minAmount: 0.01,
      maxAmount: 1000,
      status: "active",
      description: "以太坊"
    },
    {
      id: "coin_usdt_trc20",
      name: "Tether (TRC20)",
      symbol: "USDT",
      network: "TRC20",
      address: "TSwvvGJPjHGx3Uw8k4hfKXuwZqtkqXdYxA",
      minAmount: 10,
      maxAmount: 500000,
      status: "active",
      description: "泰达币 TRC20网络"
    },
    {
      id: "coin_usdt_erc20",
      name: "Tether (ERC20)",
      symbol: "USDT",
      network: "ERC20",
      address: "0x742d35Cc6634C0532925a3b844Bc9e7595f123b2",
      minAmount: 10,
      maxAmount: 500000,
      status: "active",
      description: "泰达币 ERC20网络"
    }
  ];

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO recharge_coins 
    (id, name, symbol, network, address, minAmount, maxAmount, status, description, createdAt, updatedAt) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  coins.forEach(coin => {
    stmt.run(coin.id, coin.name, coin.symbol, coin.network, coin.address, coin.minAmount, coin.maxAmount, coin.status, coin.description, now, now);
  });
};

initRechargeCoins();

// 初始化动态内容
const initSiteContent = () => {
  const contents = [
    {
      id: "content_terms",
      type: "terms",
      title: "Service Terms & Conditions",
      content: `<h2>服务条款</h2>
<p>欢迎使用 FoxPro Exchange（以下简称"平台"）。在使用本平台的服务前，请仔细阅读本服务条款。</p>

<h3>1. 服务定义</h3>
<p>FoxPro Exchange 是一个安全、可靠的数字资产交易平台，为用户提供：</p>
<ul>
<li>现货交易服务</li>
<li>合约交易服务</li>
<li>资产管理服务</li>
<li>充提币服务</li>
</ul>

<h3>2. 用户责任</h3>
<p>用户在使用本平台时应承诺：</p>
<ul>
<li>提供真实、准确、完整的身份信息</li>
<li>妥善保管账户密钥和安全信息</li>
<li>遵守所有适用的法律法规</li>
<li>不进行任何欺诈、洗钱等违法活动</li>
</ul>

<h3>3. 风险提示</h3>
<p>数字资产交易存在较高风险，包括但不限于：</p>
<ul>
<li>市场价格波动风险</li>
<li>技术风险</li>
<li>政策风险</li>
<li>流动性风险</li>
</ul>
<p>用户需充分理解这些风险，并自行承担所有交易损失。</p>

<h3>4. 免责声明</h3>
<p>平台对用户在交易过程中的任何损失不承担责任。平台仅作为交易撮合服务的提供者。</p>

<h3>5. 其他条款</h3>
<p>平台保留随时修改服务条款的权利。用户继续使用平台即表示同意新的条款。</p>`
    },
    {
      id: "content_whitepaper",
      type: "whitepaper",
      title: "FoxPro Whitepaper",
      content: `<h2>FoxPro Exchange 白皮书</h2>

<h3>执行摘要</h3>
<p>FoxPro Exchange 是一个创新的数字资产交易平台，致力于为全球用户提供安全、高效、透明的交易环境。</p>

<h3>愿景与使命</h3>
<p><strong>愿景：</strong>成为全球领先的数字资产交易平台</p>
<p><strong>使命：</strong>
<ul>
<li>为用户提供安全可靠的交易环境</li>
<li>推动数字经济的发展</li>
<li>保护用户资产安全</li>
<li>提供优质的用户服务</li>
</ul>
</p>

<h3>技术架构</h3>
<p>FoxPro 采用最先进的技术架构：</p>
<ul>
<li><strong>区块链安全：</strong>采用多重签名钱包和冷存储技术</li>
<li><strong>高性能引擎：</strong>支持高频交易，低延迟</li>
<li><strong>风控系统：</strong>实时监测异常交易，防范风险</li>
<li><strong>API接口：</strong>为专业交易者提供强大的 API</li>
</ul>

<h3>安全保障</h3>
<p>用户资产安全是我们的首要任务：</p>
<ul>
<li>99.99% 的数字资产存储在离线冷钱包中</li>
<li>采用企业级加密算法</li>
<li>定期进行安全审计</li>
<li>拥有完整的风险管理体系</li>
</ul>

<h3>费用结构</h3>
<p>FoxPro 采用透明的费用模式：</p>
<ul>
<li>现货交易：0.1% 交易手续费</li>
<li>合约交易：0.02% 开仓手续费 + 0.05% 平仓手续费</li>
<li>提币：根据网络情况收取矿工费</li>
</ul>

<h3>未来规划</h3>
<ul>
<li>扩展至更多交易对</li>
<li>推出移动端应用</li>
<li>支持更多币种充提</li>
<li>开发智能交易工具</li>
<li>建立用户社区和教育平台</li>
</ul>`
    },
    {
      id: "content_help",
      type: "help",
      title: "Help Center",
      content: `<h2>帮助中心</h2>

<h3>常见问题</h3>

<h4>Q: 如何注册账户？</h4>
<p>A: 点击"注册"按钮，输入邮箱和密码，完成验证即可。建议使用强密码以保护账户安全。</p>

<h4>Q: 如何进行身份验证？</h4>
<p>A: 登录后进入账户设置，点击"身份验证"，按照提示上传身份证明和相关文件。验证通常需要 24-48 小时。</p>

<h4>Q: 如何充币？</h4>
<p>A: 进入"资产"页面，点击"充币"，选择币种和网络，系统会生成充值地址。将该地址复制到你的钱包，发送相应数量的数字资产即可。</p>

<h4>Q: 充币多久到账？</h4>
<p>A: 根据网络拥堵情况，通常需要 10-60 分钟。快速网络可能更快。</p>

<h4>Q: 如何进行交易？</h4>
<p>A: 
<ul>
<li>前往"交易"页面</li>
<li>选择交易对（如 BTC/USDT）</li>
<li>选择交易类型（现货或合约）</li>
<li>输入金额和价格</li>
<li>确认交易</li>
</ul>
</p>

<h4>Q: 什么是杠杆交易？</h4>
<p>A: 杠杆交易允许你用较少的本金进行较大金额的交易。但需要注意风险，可能造成本金损失。</p>

<h4>Q: 如何设置止损和止盈？</h4>
<p>A: 在下单时，可以勾选"止损"或"止盈"选项，输入相应价格即可自动执行。</p>

<h4>Q: 如何提币？</h4>
<p>A: 进入"资产"页面，点击"提币"，输入提币地址、金额，确认后即可提交。</p>

<h4>Q: 提币需要多长时间？</h4>
<p>A: 提币请求需要 30 分钟内的安全审核，审核通过后立即上链。上链时间取决于网络拥堵情况。</p>

<h4>Q: 账户被锁定了怎么办？</h4>
<p>A: 如果检测到异常登录或交易，系统会自动锁定账户以保护资金安全。请联系客服，完成身份验证后即可解锁。</p>

<h3>安全建议</h3>
<ul>
<li>使用强密码，至少 8 个字符，包含大小写字母和数字</li>
<li>启用二次验证（2FA）保护账户</li>
<li>不要向任何人透露你的密钥或 seed</li>
<li>定期更改密码</li>
<li>在公共 WiFi 上不要进行大额交易</li>
<li>警惕钓鱼邮件和假冒网站</li>
</ul>

<h3>联系我们</h3>
<p>如有更多问题，请通过右上角的客服链接与我们联系。</p>`
    }
  ];

  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO site_content 
    (id, type, title, content, createdAt, updatedAt) 
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  contents.forEach(item => {
    insertStmt.run(item.id, item.type, item.title, item.content, now, now);
  });
};

initSiteContent();

// 初始化客服配置
const initSupportConfig = () => {
  const now = new Date().toISOString();
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO support_config 
    (id, type, link, title, description, enabled, createdAt, updatedAt) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  insertStmt.run(
    "support_main",
    "customer_service",
    "https://t.me/foxpro_support",
    "FoxPro Customer Support",
    "24/7 Customer Support via Telegram",
    1,
    now,
    now
  );
};

initSupportConfig();

// 用户数据存储（内存）
const users = {
  "testuser": {
    userId: "user_001",
    username: "testuser",
    email: "test@example.com",
    phone: "13800138000",
    password: "Test123456", // 实际应该加密存储
    country: "CN",
    createdAt: new Date(),
  },
  "admin": {
    userId: "admin_001",
    username: "admin",
    email: "admin@foxpro.com",
    phone: "13900139000",
    password: "admin123456",
    country: "CN",
    isAdmin: true,
    createdAt: new Date(),
  },
};

// 生成简单的 Token
function generateToken(userId) {
  // 使用JSON编码userId，避免分割问题
  const encodedUserId = Buffer.from(userId).toString('base64');
  return `token_${encodedUserId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 验证 Token
function verifyToken(token) {
  // 简单的 Token 验证，实际应该使用 JWT
  if (!token || !token.startsWith("token_")) {
    return null;
  }
  
  try {
    // 从 Token 中解析 userId
    const parts = token.split("_");
    if (parts.length >= 2) {
      // 解码userId
      const encodedUserId = parts[1];
      const userId = Buffer.from(encodedUserId, 'base64').toString('utf-8');
      return userId;
    }
  } catch (e) {
    console.error('Token decode error:', e);
  }
  
  return null;
}

// 模拟市场数据 - 实时更新 (2025年12月)
const marketData = {
  "BTC/USDT": { price: 80000.00, change: 5.45, volume: "$28.3B", symbol: "BTC", name: "Bitcoin" },
  "ETH/USDT": { price: 3250.80, change: 6.23, volume: "$14.2B", symbol: "ETH", name: "Ethereum" },
  "SOL/USDT": { price: 248.35, change: 9.12, volume: "$2.5B", symbol: "SOL", name: "Solana" },
  "XRP/USDT": { price: 3.15, change: 2.45, volume: "$2.1B", symbol: "XRP", name: "Ripple" },
  "DOGE/USDT": { price: 0.42, change: 4.32, volume: "$1.2B", symbol: "DOGE", name: "Dogecoin" },
  "ADA/USDT": { price: 1.08, change: 3.18, volume: "$580M", symbol: "ADA", name: "Cardano" },
  "LINK/USDT": { price: 32.55, change: 7.89, volume: "$720M", symbol: "LINK", name: "Chainlink" },
  "MATIC/USDT": { price: 1.05, change: 5.67, volume: "$450M", symbol: "MATIC", name: "Polygon" },
  "AVAX/USDT": { price: 45.20, change: 1.23, volume: "$380M", symbol: "AVAX", name: "Avalanche" },
  "LTC/USDT": { price: 215.80, change: 4.56, volume: "$1.1B", symbol: "LTC", name: "Litecoin" },
  "OP/USDT": { price: 4.25, change: 8.34, volume: "$480M", symbol: "OP", name: "Optimism" },
  "ARB/USDT": { price: 1.68, change: 6.78, volume: "$380M", symbol: "ARB", name: "Arbitrum" },
};

// 交易币种管理
const tradingPairs = [
  {
    id: "pair_001",
    pair: "BTC/USDT",
    baseCurrency: "BTC",
    quoteCurrency: "USDT",
    currentPrice: 80000.00,
    change24h: 5.45,
    volume24h: 28300000000,
    enabled: true,
    createdAt: new Date()
  },
  {
    id: "pair_002",
    pair: "ETH/USDT",
    baseCurrency: "ETH",
    quoteCurrency: "USDT",
    currentPrice: 3250.80,
    change24h: 6.23,
    volume24h: 14200000000,
    enabled: true,
    createdAt: new Date()
  },
  {
    id: "pair_003",
    pair: "SOL/USDT",
    baseCurrency: "SOL",
    quoteCurrency: "USDT",
    currentPrice: 248.35,
    change24h: 9.12,
    volume24h: 2500000000,
    enabled: true,
    createdAt: new Date()
  },
  {
    id: "pair_004",
    pair: "XRP/USDT",
    baseCurrency: "XRP",
    quoteCurrency: "USDT",
    currentPrice: 3.15,
    change24h: 2.45,
    volume24h: 2100000000,
    enabled: true,
    createdAt: new Date()
  },
  {
    id: "pair_005",
    pair: "DOGE/USDT",
    baseCurrency: "DOGE",
    quoteCurrency: "USDT",
    currentPrice: 0.42,
    change24h: 4.32,
    volume24h: 1200000000,
    enabled: true,
    createdAt: new Date()
  },
  {
    id: "pair_006",
    pair: "ADA/USDT",
    baseCurrency: "ADA",
    quoteCurrency: "USDT",
    currentPrice: 1.08,
    change24h: 3.18,
    volume24h: 580000000,
    enabled: true,
    createdAt: new Date()
  },
  {
    id: "pair_007",
    pair: "LINK/USDT",
    baseCurrency: "LINK",
    quoteCurrency: "USDT",
    currentPrice: 32.55,
    change24h: 7.89,
    volume24h: 720000000,
    enabled: true,
    createdAt: new Date()
  },
  {
    id: "pair_008",
    pair: "MATIC/USDT",
    baseCurrency: "MATIC",
    quoteCurrency: "USDT",
    currentPrice: 1.05,
    change24h: 5.67,
    volume24h: 450000000,
    enabled: true,
    createdAt: new Date()
  },
  {
    id: "pair_009",
    pair: "AVAX/USDT",
    baseCurrency: "AVAX",
    quoteCurrency: "USDT",
    currentPrice: 45.20,
    change24h: 1.23,
    volume24h: 380000000,
    enabled: true,
    createdAt: new Date()
  },
  {
    id: "pair_010",
    pair: "LTC/USDT",
    baseCurrency: "LTC",
    quoteCurrency: "USDT",
    currentPrice: 215.80,
    change24h: 4.56,
    volume24h: 1100000000,
    enabled: true,
    createdAt: new Date()
  },
  {
    id: "pair_011",
    pair: "OP/USDT",
    baseCurrency: "OP",
    quoteCurrency: "USDT",
    currentPrice: 4.25,
    change24h: 8.34,
    volume24h: 480000000,
    enabled: true,
    createdAt: new Date()
  },
  {
    id: "pair_012",
    pair: "ARB/USDT",
    baseCurrency: "ARB",
    quoteCurrency: "USDT",
    currentPrice: 1.68,
    change24h: 6.78,
    volume24h: 380000000,
    enabled: true,
    createdAt: new Date()
  }
];

// 加密货币价格缓存
let cryptoPriceCache = {};
let lastPriceUpdate = 0;

// 从 CoinGecko 获取实时价格
async function fetchRealPrices() {
  try {
    const ids = 'bitcoin,ethereum,solana,ripple,dogecoin';
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`
    );
    const data = await response.json();
    
    cryptoPriceCache = {
      'BTC': data.bitcoin?.usd || 63285.4,
      'ETH': data.ethereum?.usd || 3410.2,
      'SOL': data.solana?.usd || 148.9,
      'XRP': data.ripple?.usd || 0.615,
      'DOGE': data.dogecoin?.usd || 0.182,
      'BTC_CHANGE': data.bitcoin?.usd_24h_change || 3.12,
      'ETH_CHANGE': data.ethereum?.usd_24h_change || 1.89,
      'SOL_CHANGE': data.solana?.usd_24h_change || 4.56,
      'XRP_CHANGE': data.ripple?.usd_24h_change || -0.42,
      'DOGE_CHANGE': data.dogecoin?.usd_24h_change || 2.01
    };
    
    lastPriceUpdate = Date.now();
  } catch (error) {
    console.log('Failed to fetch real prices from CoinGecko, using cached data');
  }
}

// 订单簿数据
const orderbookData = {
  "BTC/USDT": {
    asks: [
      ["63,320", "1.42", "89,000"],
      ["63,310", "0.98", "62,000"],
      ["63,300", "2.10", "133,000"],
      ["63,290", "0.56", "35,400"],
    ],
    bids: [
      ["63,280", "1.76", "111,000"],
      ["63,270", "3.20", "203,000"],
      ["63,260", "0.89", "56,300"],
      ["63,250", "2.45", "154,000"],
    ],
  },
};

// 成交数据
const tradesData = [
  ["12:32:14", "63,285.4", "0.062"],
  ["12:32:07", "63,283.1", "0.011"],
  ["12:31:59", "63,281.9", "0.214"],
  ["12:31:40", "63,279.2", "0.032"],
  ["12:31:21", "63,277.5", "0.078"],
];

// 用户会话数据
const sessions = {};

// 用户资产数据
const userAssets = {
  "session_1": {
    USDT: { available: 10000, frozen: 500, price: 1 },
    BTC: { available: 0.5, frozen: 0.1, price: 63285.4 },
    ETH: { available: 5, frozen: 1, price: 3410.2 },
    SOL: { available: 50, frozen: 10, price: 148.9 },
  },
};

// 充值币种配置
const rechargeCoins = [
  {
    id: "coin_btc",
    symbol: "BTC",
    name: "Bitcoin",
    description: "Leading cryptocurrency",
    minAmount: 0.001,
    maxAmount: 100,
    networks: [
      {
        id: "btc_mainnet",
        name: "Bitcoin Mainnet",
        networkId: "btc-mainnet",
        address: "1A1z7agoat3bx8G8s9E7eYQ3uF3Ks7Kv3w",
        confirmations: 6,
        enabled: true
      }
    ]
  },
  {
    id: "coin_eth",
    symbol: "ETH",
    name: "Ethereum",
    description: "Smart contract platform",
    minAmount: 0.01,
    maxAmount: 1000,
    networks: [
      {
        id: "eth_mainnet",
        name: "Ethereum Mainnet",
        networkId: "eth-mainnet",
        address: "0x742d35Cc6634C0532925a3b844Bc9e7595f123b1",
        confirmations: 12,
        enabled: true
      }
    ]
  },
  {
    id: "coin_usdt",
    symbol: "USDT",
    name: "Tether",
    description: "Stablecoin",
    minAmount: 1,
    maxAmount: 1000000,
    networks: [
      {
        id: "usdt_eth",
        name: "Ethereum (ERC-20)",
        networkId: "eth-mainnet",
        address: "0x742d35Cc6634C0532925a3b844Bc9e7595f123b1",
        confirmations: 12,
        enabled: true
      },
      {
        id: "usdt_tron",
        name: "Tron (TRC-20)",
        networkId: "tron-mainnet",
        address: "TLqwGzK7Yp2r2Lhk5jvGsRX9q3pYqRzK7U",
        confirmations: 19,
        enabled: true
      }
    ]
  }
];

// 用户充值记录
const rechargeRecords = [
  {
    id: "RECHARGE_001",
    userId: "user_001",
    coin: "BTC",
    amount: 0.5,
    address: "1A1z7agoat4xFUQ3vCLtF6wWwcEd5V7Z5L",
    status: "pending",
    createdAt: new Date(Date.now() - 86400000),
  },
  {
    id: "RECHARGE_002",
    userId: "user_001",
    coin: "ETH",
    amount: 10,
    address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    status: "completed",
    createdAt: new Date(Date.now() - 172800000),
  },
  {
    id: "RECHARGE_003",
    userId: "admin_001",
    coin: "USDT",
    amount: 1000,
    address: "TLqwGzK7Yp2r2Lhk5jvGsRX9q3pYqRzK7U",
    status: "rejected",
    createdAt: new Date(Date.now() - 259200000),
  },
];

// 用户提现记录
const withdrawRecords = [
  {
    id: "WITHDRAW_001",
    userId: "user_001",
    coin: "BTC",
    amount: 0.2,
    address: "1A1z7agoat4xFUQ3vCLtF6wWwcEd5V7Z5L",
    status: "pending",
    createdAt: new Date(Date.now() - 43200000),
  },
  {
    id: "WITHDRAW_002",
    userId: "admin_001",
    coin: "ETH",
    amount: 5,
    address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    status: "completed",
    createdAt: new Date(Date.now() - 129600000),
  },
];

// 充值币种配置
const rechargeOptions = [
  {
    id: "opt_001",
    name: "Bitcoin",
    symbol: "BTC",
    network: "Bitcoin Network",
    address: "1A1z7agoat4xFUQ3vCLtF6wWwcEd5V7Z5L",
    qrCode: "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=1A1z7agoat4xFUQ3vCLtF6wWwcEd5V7Z5L",
    enabled: true,
    createdAt: new Date(Date.now() - 259200000),
  },
  {
    id: "opt_002",
    name: "Ethereum",
    symbol: "ETH",
    network: "ERC-20",
    address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    qrCode: "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    enabled: true,
    createdAt: new Date(Date.now() - 172800000),
  },
  {
    id: "opt_003",
    name: "USDT",
    symbol: "USDT",
    network: "TRC-20",
    address: "TLqwGzK7Yp2r2Lhk5jvGsRX9q3pYqRzK7U",
    qrCode: "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=TLqwGzK7Yp2r2Lhk5jvGsRX9q3pYqRzK7U",
    enabled: true,
    createdAt: new Date(),
  },
];

// 用户订单数据
const userOrders = {
  "session_1": [
    {
      id: "order_001",
      time: "14:32:45",
      pair: "BTC/USDT",
      type: "spot",
      direction: "buy",
      price: 63285.4,
      amount: 0.5,
      total: 31642.7,
      status: "completed",
      profit: 125.5,
    },
    {
      id: "order_002",
      time: "14:15:20",
      pair: "ETH/USDT",
      type: "seconds",
      direction: "up",
      price: 3410.2,
      amount: 10,
      total: 34102,
      status: "completed",
      profit: 85,
    },
    {
      id: "order_003",
      time: "13:48:10",
      pair: "SOL/USDT",
      type: "seconds",
      direction: "down",
      price: 148.9,
      amount: 100,
      total: 14890,
      status: "completed",
      profit: -148.9,
    },
  ],
};

// 市场详情数据
const marketDetails = {
  "BTC/USDT": {
    pair: "BTC/USDT",
    name: "Bitcoin",
    price: 63285.4,
    change: 3.12,
    high24h: 64500.0,
    low24h: 61800.0,
    volume: "1.2B",
    marketCap: "$1.23T",
    circulatingSupply: "21M",
    asks: [
      ["63,320", "1.42", "89,000"],
      ["63,310", "0.98", "62,000"],
      ["63,300", "2.10", "133,000"],
      ["63,290", "0.56", "35,400"],
    ],
    bids: [
      ["63,280", "1.76", "111,000"],
      ["63,270", "3.20", "203,000"],
      ["63,260", "0.89", "56,300"],
      ["63,250", "2.45", "154,000"],
    ],
    trades: [
      ["14:32:14", "63,285.4", "0.062"],
      ["14:32:07", "63,283.1", "0.011"],
      ["14:31:59", "63,281.9", "0.214"],
      ["14:31:40", "63,279.2", "0.032"],
      ["14:31:21", "63,277.5", "0.078"],
    ],
  },
  "ETH/USDT": {
    pair: "ETH/USDT",
    name: "Ethereum",
    price: 3410.2,
    change: 1.89,
    high24h: 3500.0,
    low24h: 3300.0,
    volume: "820M",
    marketCap: "$409B",
    circulatingSupply: "120M",
    asks: [
      ["3,415", "10.5", "35,857"],
      ["3,410", "8.2", "27,962"],
    ],
    bids: [
      ["3,410", "9.3", "31,713"],
      ["3,400", "7.1", "24,170"],
    ],
    trades: [
      ["14:32:10", "3,410.2", "5.5"],
      ["14:31:50", "3,408.5", "3.2"],
    ],
  },
};

// =====================
// API 端点
// =====================

/**
 * 获取市场列表
 */
app.get("/api/markets", (req, res) => {
  // 返回所有启用的交易对信息
  const markets = tradingPairs
    .filter(pair => pair.enabled)
    .map(pair => ({
      pair: pair.pair,
      symbol: pair.baseCurrency,
      name: pair.baseCurrency === "BTC" ? "Bitcoin" : 
            pair.baseCurrency === "ETH" ? "Ethereum" :
            pair.baseCurrency === "SOL" ? "Solana" :
            pair.baseCurrency === "XRP" ? "Ripple" :
            pair.baseCurrency === "DOGE" ? "Dogecoin" :
            pair.baseCurrency === "ADA" ? "Cardano" :
            pair.baseCurrency === "LINK" ? "Chainlink" :
            pair.baseCurrency === "MATIC" ? "Polygon" :
            pair.baseCurrency === "AVAX" ? "Avalanche" :
            pair.baseCurrency === "LTC" ? "Litecoin" :
            pair.baseCurrency === "OP" ? "Optimism" :
            pair.baseCurrency === "ARB" ? "Arbitrum" : pair.baseCurrency,
      price: pair.currentPrice,
      change: pair.change24h,
      volume: (() => {
        const vol = pair.volume24h;
        if (vol >= 1000000000) return "$" + (vol / 1000000000).toFixed(1) + "B";
        if (vol >= 1000000) return "$" + (vol / 1000000).toFixed(0) + "M";
        return "$" + vol;
      })()
    }));
  
  res.json(markets);
});

/**
 * 获取实时加密货币价格
 */
app.get("/api/crypto-prices", (req, res) => {
  res.json({
    success: true,
    timestamp: Date.now(),
    prices: cryptoPriceCache,
    updateTime: lastPriceUpdate
  });
});

/**
 * 刷新加密货币价格
 */
app.get("/api/crypto-prices/refresh", async (req, res) => {
  await fetchRealPrices();
  res.json({
    success: true,
    prices: cryptoPriceCache,
    updateTime: lastPriceUpdate
  });
});

/**
 * 获取订单簿
 */
app.get("/api/orderbook", (req, res) => {
  const pair = req.query.pair || "BTC/USDT";
  const orderbook = orderbookData[pair] || orderbookData["BTC/USDT"];
  res.json(orderbook);
});

/**
 * 获取成交列表
 */
app.get("/api/trades", (req, res) => {
  res.json(tradesData);
});

/**
 * 获取当前价格
 */
app.get("/api/price/:pair", (req, res) => {
  const pair = req.params.pair;
  const data = marketData[pair];
  if (!data) {
    return res.status(404).json({ error: "Trading pair not found" });
  }
  res.json({
    pair,
    price: data.price,
    change: data.change,
    volume: data.volume,
  });
});

// =====================
// 秒合约交易 API
// =====================

/**
 * 初始化交易会话
 */
app.post("/api/session/init", (req, res) => {
  const sessionId = "session_" + Date.now();
  sessions[sessionId] = {
    balance: 10000,
    trades: [],
    createdAt: new Date(),
  };
  res.json({ sessionId, balance: 10000 });
});

/**
 * 获取秒合约配置
 * GET /api/quick-contract/config
 */
app.get("/api/quick-contract/config", (req, res) => {
  try {
    const configs = db.prepare(`
      SELECT id, seconds, profitRate as profitRate, minAmount, maxAmount, enabled
      FROM quick_contract_config
      WHERE enabled = 1
      ORDER BY seconds ASC
    `).all();
    
    res.json({
      success: true,
      data: configs
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 下达秒合约订单
 * POST /api/quick-contract/place
 * body: {
 *   symbol: string (BTC, ETH, etc),
 *   direction: 'long' | 'short',
 *   seconds: number,
 *   amount: number
 * }
 */
app.post("/api/quick-contract/place", (req, res) => {
  try {
    const { symbol, direction, seconds, amount } = req.body;
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.substring(7);
    const userId = verifyToken(token);
    
    if (!userId) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // Get user info
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    // Verify configuration
    const config = db.prepare("SELECT * FROM quick_contract_config WHERE seconds = ? AND enabled = 1")
      .get(seconds);
    if (!config) {
      return res.status(400).json({ error: "Invalid seconds configuration" });
    }

    // Validate amount
    if (amount < config.minAmount || amount > config.maxAmount) {
      return res.status(400).json({ 
        error: `Amount must be between ${config.minAmount} and ${config.maxAmount}` 
      });
    }

    // 检查用户余额
    let userBalance = 0;
    try {
      const assetsRecord = db.prepare("SELECT balances FROM user_assets WHERE userId = ?").get(userId);
      if (assetsRecord) {
        const assets = JSON.parse(assetsRecord.balances || '{}');
        userBalance = assets.USDT || 0;
      }
    } catch (e) {
      userBalance = 0;
    }

    if (userBalance < amount) {
      return res.status(400).json({ 
        error: `Insufficient balance. You have $${userBalance.toFixed(2)}, but need $${amount.toFixed(2)}` 
      });
    }

    // Get current price (using realistic prices)
    const prices = {
      'BTC': 94500,
      'ETH': 3200,
      'SOL': 180,
      'BNB': 600,
      'XRP': 3.5
    };
    
    const currentPrice = prices[symbol] || 1000;
    
    // 模拟结果：70%成功率
    const isWin = Math.random() < 0.7;
    const resultPrice = isWin 
      ? (currentPrice * (1 + (config.profitRate / 100) / 100))
      : (currentPrice * (1 - (config.profitRate / 100) / 100));
    
    // 计算利润或亏损
    let profit = 0;
    if (direction === 'long') {
      profit = isWin ? (amount * (config.profitRate / 100)) : -(amount * 0.05); // 亏损5%
    } else {
      profit = isWin ? (amount * (config.profitRate / 100)) : -(amount * 0.05);
    }

    // Create order - 状态为 pending，由管理员决定结果
    const orderId = "qco_" + Date.now();
    const now = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO quick_contract_orders
      (id, userId, username, symbol, direction, seconds, amount, entryPrice, status, result, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', ?, ?)
    `).run(orderId, user.id, user.username, symbol, direction, seconds, amount, currentPrice, now, now);

    // 先预留金额（冻结用户金额）
    let assets = {};
    try {
      const assetsRecord = db.prepare("SELECT balances FROM user_assets WHERE userId = ?").get(userId);
      if (assetsRecord) {
        assets = JSON.parse(assetsRecord.balances || '{}');
      }
    } catch (e) {
      assets = {
        BTC: 0, ETH: 0, USDT: 0, SOL: 0, ADA: 0, XRP: 0, DOGE: 0, LTC: 0
      };
    }

    // 冻结金额
    const frozenBefore = (assets.USDT || 0);
    assets.USDT = frozenBefore - amount;

    const assetsRecord = db.prepare("SELECT * FROM user_assets WHERE userId = ?").get(userId);
    if (assetsRecord) {
      db.prepare("UPDATE user_assets SET balances = ?, updatedAt = ? WHERE userId = ?")
        .run(JSON.stringify(assets), now, userId);
    } else {
      db.prepare("INSERT INTO user_assets (userId, balances, updatedAt) VALUES (?, ?, ?)")
        .run(userId, JSON.stringify(assets), now);
    }

    console.log(`[Quick Contract] New Order ${orderId}: ${user.username} ${direction} ${amount}USDT on ${symbol} - PENDING`);

    // 返回待审核状态的订单信息
    res.json({
      success: true,
      orderId,
      symbol,
      direction,
      seconds,
      amount,
      entryPrice: currentPrice,
      exitPrice: currentPrice,
      profit: 0,
      profitRate: config.profitRate,
      result: 'pending',
      status: 'pending',
      potentialProfit: (amount * config.profitRate / 100).toFixed(2),
      newBalance: assets.USDT.toFixed(2),
      message: '订单已提交，等待开奖结果...'
    });
  } catch (error) {
    console.error("Error placing quick contract order:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取秒合约订单历史（用户持仓和成交）
 * GET /api/quick-contract/orders
 */
app.get("/api/quick-contract/orders", (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userId = verifyToken(token);
    if (!userId) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    // 获取用户的所有订单
    const allOrders = db.prepare(`
      SELECT id, symbol, direction, seconds, amount, entryPrice, exitPrice, profit, 
             status, result, createdAt, updatedAt
      FROM quick_contract_orders
      WHERE userId = ?
      ORDER BY createdAt DESC
      LIMIT 100
    `).all(userId);

    // 统计信息
    const totalOrders = allOrders.length;
    const winCount = allOrders.filter(o => o.result === 'win').length;
    const lossCount = allOrders.filter(o => o.result === 'loss').length;
    const totalProfit = allOrders.reduce((sum, o) => sum + (o.profit || 0), 0);
    const winRate = totalOrders > 0 ? ((winCount / totalOrders) * 100).toFixed(2) : 0;

    res.json({
      success: true,
      stats: {
        totalOrders,
        winCount,
        lossCount,
        totalProfit: totalProfit.toFixed(2),
        winRate: winRate + '%'
      },
      data: allOrders.map(o => ({
        id: o.id,
        symbol: o.symbol,
        direction: o.direction === 'long' ? '看涨' : '看跌',
        seconds: o.seconds + 's',
        amount: o.amount,
        entryPrice: o.entryPrice,
        exitPrice: o.exitPrice,
        profit: o.profit,
        status: o.status,
        result: o.result === 'win' ? '赚取' : '亏损',
        createdAt: o.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 管理员：获取所有秒合约订单
 * GET /api/admin/quick-contract/orders
 */
app.get("/api/admin/quick-contract/orders", (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userId = verifyToken(token);
    if (!userId) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const admin = db.prepare("SELECT * FROM users WHERE id = ? AND isAdmin = 1").get(userId);
    if (!admin) {
      return res.status(403).json({ error: "Admin only" });
    }

    const orders = db.prepare(`
      SELECT id, userId, username, symbol, direction, seconds, amount, entryPrice, exitPrice, profit, 
             profitRate, status, result, createdAt
      FROM quick_contract_orders
      ORDER BY createdAt DESC
      LIMIT 100
    `).all();

    res.json({
      success: true,
      data: orders.map(o => ({
        id: o.id,
        userId: o.userId,
        username: o.username,
        symbol: o.symbol,
        direction: o.direction === 'long' ? '看涨' : '看跌',
        seconds: o.seconds + 's',
        amount: '$' + o.amount,
        entryPrice: o.entryPrice,
        exitPrice: o.exitPrice,
        profit: '$' + (o.profit || 0).toFixed(2),
        status: o.status,
        result: o.result === 'win' ? '赚取' : '亏损',
        createdAt: o.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 管理员：获取秒合约交易列表（用于设置结果）
 * GET /api/admin/quick-contract/trades
 */
app.get("/api/admin/quick-contract/trades", (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userId = verifyToken(token);
    if (!userId) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const admin = db.prepare("SELECT * FROM users WHERE id = ? AND isAdmin = 1").get(userId);
    if (!admin) {
      return res.status(403).json({ error: "Admin only" });
    }

    // 同时显示 pending 和已处理的订单
    const orders = db.prepare(`
      SELECT id, userId, username, symbol, direction, seconds, amount, entryPrice, exitPrice, profit, status, result, createdAt
      FROM quick_contract_orders
      ORDER BY createdAt DESC
      LIMIT 100
    `).all();

    res.json({
      success: true,
      data: orders.map(o => ({
        id: o.id,
        userId: o.userId,
        username: o.username,
        symbol: o.symbol,
        direction: o.direction === 'long' ? '看涨' : '看跌',
        amount: o.amount,
        entryPrice: o.entryPrice,
        exitPrice: o.exitPrice || o.entryPrice,
        profit: o.profit || 0,
        seconds: o.seconds,
        status: o.status,
        result: o.result,
        createdAt: o.createdAt,
        displayStatus: o.status === 'pending' ? '待开奖' : (o.result === 'win' ? '赢' : '亏')
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 管理员：设置秒合约交易结果（赢/亏）
 * PUT /api/admin/quick-contract/trades/:id
 */
app.put("/api/admin/quick-contract/trades/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { result, exitPrice } = req.body; // result: 'win' 或 'loss'
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userId = verifyToken(token);
    if (!userId) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const admin = db.prepare("SELECT * FROM users WHERE id = ? AND isAdmin = 1").get(userId);
    if (!admin) {
      return res.status(403).json({ error: "Admin only" });
    }

    // 获取订单
    const order = db.prepare(`
      SELECT * FROM quick_contract_orders WHERE id = ?
    `).get(id);

    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({ success: false, error: "Order is not pending" });
    }

    // 获取配置
    const config = db.prepare("SELECT * FROM quick_contract_config WHERE seconds = ?").get(order.seconds);
    if (!config) {
      return res.status(400).json({ success: false, error: "Config not found" });
    }

    // 计算利润
    let profit = 0;
    if (result === 'win') {
      profit = order.amount * (config.profitRate / 100);
    } else {
      profit = -(order.amount * 0.05); // 亏损5%
    }

    const finalExitPrice = exitPrice || (order.entryPrice * (1 + (result === 'win' ? 0.05 : -0.05)));
    const now = new Date().toISOString();

    // 更新订单
    db.prepare(`
      UPDATE quick_contract_orders
      SET status = 'completed', result = ?, exitPrice = ?, profit = ?, updatedAt = ?
      WHERE id = ?
    `).run(result, finalExitPrice, profit, now, id);

    // 更新用户余额
    let assets = {};
    try {
      const assetsRecord = db.prepare("SELECT balances FROM user_assets WHERE userId = ?").get(order.userId);
      if (assetsRecord) {
        assets = JSON.parse(assetsRecord.balances || '{}');
      }
    } catch (e) {
      assets = { BTC: 0, ETH: 0, USDT: 0, SOL: 0, ADA: 0, XRP: 0, DOGE: 0, LTC: 0 };
    }

    // 返还冻结金额 + 利润
    assets.USDT = (assets.USDT || 0) + order.amount + profit;

    const assetsRecord = db.prepare("SELECT * FROM user_assets WHERE userId = ?").get(order.userId);
    if (assetsRecord) {
      db.prepare("UPDATE user_assets SET balances = ?, updatedAt = ? WHERE userId = ?")
        .run(JSON.stringify(assets), now, order.userId);
    } else {
      db.prepare("INSERT INTO user_assets (userId, balances, updatedAt) VALUES (?, ?, ?)")
        .run(order.userId, JSON.stringify(assets), now);
    }

    console.log(`[Admin] Set quick contract order ${id} result: ${result} (Profit: ${profit.toFixed(2)})`);

    res.json({
      success: true,
      message: `Order result set to ${result === 'win' ? '赢' : '亏'}`,
      order: {
        id,
        result,
        profit: profit.toFixed(2),
        newBalance: assets.USDT.toFixed(2)
      }
    });
  } catch (error) {
    console.error("Error setting order result:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 管理员：添加或更新秒合约配置
 * POST /api/admin/quick-contract/config
 */
app.post("/api/admin/quick-contract/config", (req, res) => {
  try {
    const { seconds, profitRate, minAmount, maxAmount } = req.body;
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(token);
    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: "Admin only" });
    }

    const id = "qc_" + seconds;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT OR REPLACE INTO quick_contract_config
      (id, seconds, profitRate, minAmount, maxAmount, enabled, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `).run(id, seconds, profitRate, minAmount, maxAmount, now, now);

    res.json({
      success: true,
      message: "Config updated successfully",
      config: { id, seconds, profitRate, minAmount, maxAmount }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 管理员：更新秒合约配置（通过configId）
 * PUT /api/admin/quick-contract/config
 */
app.put("/api/admin/quick-contract/config", (req, res) => {
  try {
    const { configId, profitRate, minAmount, maxAmount, enabled } = req.body;
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(token);
    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: "Admin only" });
    }

    const now = new Date().toISOString();

    const stmt = db.prepare(`
      UPDATE quick_contract_config
      SET profitRate = ?, minAmount = ?, maxAmount = ?, enabled = ?, updatedAt = ?
      WHERE id = ?
    `);

    const result = stmt.run(profitRate, minAmount, maxAmount, enabled ? 1 : 0, now, configId);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: "配置不存在" });
    }

    res.json({
      success: true,
      message: "配置已更新"
    });
  } catch (error) {
    console.error("Error updating contract config:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 管理员：获取快速合约配置列表
 * GET /api/admin/quick-contract/config
 */
app.get("/api/admin/quick-contract/config", (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // 验证是否为管理员
    const userId = verifyToken(token);
    if (!userId) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const admin = db.prepare("SELECT * FROM users WHERE id = ? AND isAdmin = 1").get(userId);
    if (!admin) {
      return res.status(403).json({ error: "Admin only" });
    }

    const configs = db.prepare(`
      SELECT id, seconds, profitRate, minAmount, maxAmount, enabled, createdAt, updatedAt
      FROM quick_contract_config
      ORDER BY seconds ASC
    `).all();

    res.json({
      success: true,
      data: configs.map(c => ({
        id: c.id,
        seconds: c.seconds,
        profitRate: c.profitRate,
        minAmount: c.minAmount,
        maxAmount: c.maxAmount,
        enabled: c.enabled === 1,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt
      }))
    });
  } catch (error) {
    console.error("Error getting contract configs:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 下单接口
 * POST /api/trade/place
 * body: {
 *   sessionId: string,
 *   pair: string,
 *   direction: 'up' | 'down',
 *   amount: number,
 *   timeframe: number (秒数),
 *   force_win?: boolean,
 *   force_lose?: boolean,
 *   win_rate?: number (0-100)
 * }
 */
app.post("/api/trade/place", (req, res) => {
  const {
    sessionId,
    pair,
    direction,
    amount,
    timeframe,
    force_win,
    force_lose,
    win_rate = 50,
  } = req.body;

  // 验证会话
  if (!sessions[sessionId]) {
    return res.status(400).json({ error: "Invalid session" });
  }

  const session = sessions[sessionId];

  // 验证余额
  if (session.balance < amount) {
    return res.status(400).json({ error: "Insufficient balance" });
  }

  // 验证参数
  if (!pair || !direction || !amount || !timeframe) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // 扣除金额
  session.balance -= amount;

  // 生成订单 ID
  const orderId = "order_" + Date.now();

  // 根据规则判断胜负
  let result;
  if (force_win) {
    result = "win";
  } else if (force_lose) {
    result = "lose";
  } else {
    // 根据胜率随机
    result = Math.random() < win_rate / 100 ? "win" : "lose";
  }

  // 计算收益（简单规则：赢翻倍，输全输）
  // 实际可以自定义收益比例，这里用简单的 80% 收益率
  const profit = result === "win" ? amount * 0.8 : -amount;
  const newBalance = session.balance + amount + profit;

  // 记录交易
  const trade = {
    orderId,
    pair,
    direction,
    amount,
    timeframe,
    result,
    profit,
    newBalance,
    timestamp: new Date(),
  };
  session.trades.push(trade);
  session.balance = newBalance;

  res.json({
    orderId,
    pair,
    direction,
    amount,
    timeframe,
    result,
    profit,
    new_balance: newBalance,
  });
});

/**
 * 查询交易历史
 */
app.get("/api/session/:sessionId/trades", (req, res) => {
  const { sessionId } = req.params;
  if (!sessions[sessionId]) {
    return res.status(404).json({ error: "Session not found" });
  }
  res.json(sessions[sessionId].trades);
});

/**
 * 查询账户余额
 */
app.get("/api/session/:sessionId/balance", (req, res) => {
  const { sessionId } = req.params;
  if (!sessions[sessionId]) {
    return res.status(404).json({ error: "Session not found" });
  }
  res.json({
    balance: sessions[sessionId].balance,
    trades: sessions[sessionId].trades.length,
  });
});

/**
 * 清理过期会话（可选）
 */
app.delete("/api/session/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  if (sessions[sessionId]) {
    delete sessions[sessionId];
    res.json({ success: true });
  } else {
    res.status(404).json({ error: "Session not found" });
  }
});

// =====================
// 资产和订单 API
// =====================

/**
 * 获取用户资产
 */
app.get("/api/assets", (req, res) => {
  // Get token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.substring(7);
  const userId = verifyToken(token);
  
  if (!userId) {
    return res.status(401).json({ error: "Invalid token" });
  }

  // Get user's assets from database
  try {
    const user = db.prepare("SELECT id FROM users WHERE id = ?").get(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Query user assets from database (balances field stored as JSON)
    const userAssetData = db.prepare(`
      SELECT balances FROM user_assets WHERE userId = ?
    `).get(userId);

    let assets = [];

    if (userAssetData && userAssetData.balances) {
      try {
        // Parse the balances JSON
        const balances = JSON.parse(userAssetData.balances);
        
        // Convert balances object to assets array
        const assetNames = {
          'BTC': 'Bitcoin',
          'ETH': 'Ethereum',
          'USDT': 'Tether',
          'SOL': 'Solana',
          'ADA': 'Cardano',
          'XRP': 'Ripple',
          'DOGE': 'Dogecoin',
          'LTC': 'Litecoin'
        };

        // Get current prices (from market data or static values)
        const prices = {
          'BTC': '94500',
          'ETH': '3200',
          'USDT': '1',
          'SOL': '180',
          'ADA': '1.2',
          'XRP': '3.5',
          'DOGE': '0.42',
          'LTC': '200'
        };

        for (const [symbol, amount] of Object.entries(balances)) {
          if (parseFloat(amount) > 0) {
            assets.push({
              symbol: symbol,
              name: assetNames[symbol] || symbol,
              amount: amount.toString(),
              price: prices[symbol] || '0'
            });
          }
        }
      } catch (e) {
        console.error('Error parsing balances JSON:', e);
      }
    }

    console.log(`[Assets] Retrieved ${assets.length} assets for user ${userId}`);
    res.json({ assets });
  } catch (error) {
    console.error("Error fetching assets:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * 获取用户订单列表
 */
app.get("/api/orders", (req, res) => {
  const sessionId = req.query.sessionId || "session_1";
  const orders = userOrders[sessionId];
  if (!orders) {
    return res.json([]);
  }
  res.json(orders);
});

/**
 * 获取市场详情
 */
app.get("/api/market-detail/:pair", (req, res) => {
  const pair = req.params.pair;
  const detail = marketDetails[pair];
  if (!detail) {
    return res.status(404).json({ error: "Market detail not found" });
  }
  res.json(detail);
});

/**
 * 获取所有市场详情（用于多个交易对）
 */
app.get("/api/market-details", (req, res) => {
  res.json(marketDetails);
});

// =====================
// 充值 API
// =====================

/**
 * 获取可用的充值币种列表
 */
app.get("/api/recharge/coins", (req, res) => {
  res.json({
    success: true,
    coins: rechargeCoins
  });
});

/**
 * 获取指定币种的网络列表
 */
app.get("/api/recharge/networks/:coinId", (req, res) => {
  const coinId = req.params.coinId;
  const coin = rechargeCoins.find(c => c.id === coinId);

  if (!coin) {
    return res.status(404).json({ success: false, message: "币种不存在" });
  }

  res.json({
    success: true,
    networks: coin.networks || []
  });
});

/**
 * 用户提交充值记录
 */
app.post("/api/recharge/submit", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  const userId = verifyToken(token);

  if (!userId) {
    return res.status(401).json({ success: false, message: "未授权" });
  }

  const {
    coinId,
    coin,
    networkId,
    network,
    amount,
    address,
    txHash,
    notes
  } = req.body;

  if (!coin || !network || !amount || amount <= 0) {
    return res.status(400).json({ success: false, message: "参数不完整或无效" });
  }

  // 创建充值记录
  const record = {
    id: "recharge_" + Date.now(),
    userId,
    coin,
    network,
    amount,
    address,
    txHash: txHash || null,
    notes: notes || null,
    status: "pending",
    createdAt: new Date()
  };

  rechargeRecords.push(record);

  res.json({
    success: true,
    message: "充值记录已提交",
    record
  });
});

/**
 * 获取用户的充值记录
 */
app.get("/api/recharge/records", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  const userId = verifyToken(token);

  if (!userId) {
    return res.status(401).json({ success: false, message: "未授权" });
  }

  const userRecords = rechargeRecords.filter(r => r.userId === userId);

  res.json({
    success: true,
    records: userRecords
  });
});

// =====================
// 管理员充值管理 API
// =====================

/**
 * 获取所有充值币种（管理员）
 */
app.get("/api/admin/recharge/coins", (req, res) => {
  try {
    const coins = db.prepare(`
      SELECT id, name, symbol, network, address, minAmount, maxAmount, status, description, createdAt
      FROM recharge_coins
      ORDER BY createdAt DESC
    `).all();

    res.json({
      success: true,
      data: coins.map(c => ({
        id: c.id,
        name: c.name,
        symbol: c.symbol,
        network: c.network,
        address: c.address,
        minAmount: c.minAmount,
        maxAmount: c.maxAmount,
        status: c.status,
        description: c.description,
        createdAt: c.createdAt
      }))
    });
  } catch (error) {
    console.error("Error fetching recharge coins:", error);
    res.status(500).json({ error: "Failed to fetch recharge coins" });
  }
});

/**
 * 添加充值币种（管理员）
 */
app.post("/api/admin/recharge/coins", (req, res) => {
  const {
    name,
    symbol,
    network,
    address,
    minAmount,
    maxAmount,
    status,
    description
  } = req.body;

  if (!name || !symbol || !address) {
    return res.status(400).json({ success: false, message: "名称、符号和地址必填" });
  }

  try {
    const coinId = "coin_" + Date.now();
    const now = new Date().toISOString();
    
    const stmt = db.prepare(`
      INSERT INTO recharge_coins 
      (id, name, symbol, network, address, minAmount, maxAmount, status, description, createdAt, updatedAt) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      coinId,
      name,
      symbol.toUpperCase(),
      network || '',
      address,
      minAmount || 0,
      maxAmount || 0,
      status || 'active',
      description || '',
      now,
      now
    );

    res.json({
      success: true,
      message: "币种添加成功",
      data: {
        id: coinId,
        name,
        symbol: symbol.toUpperCase(),
        network,
        address,
        minAmount,
        maxAmount,
        status: status || 'active',
        description,
        createdAt: now
      }
    });
  } catch (error) {
    console.error("Error adding recharge coin:", error);
    res.status(500).json({ success: false, message: "添加失败" });
  }
});

/**
 * 为币种添加网络（管理员）
 */
app.post("/api/admin/recharge/coins/:coinId/networks", (req, res) => {
  const coinId = req.params.coinId;
  const coin = rechargeCoins.find(c => c.id === coinId);

  if (!coin) {
    return res.status(404).json({ success: false, message: "币种不存在" });
  }

  const {
    name,
    networkId,
    address,
    confirmations,
    enabled
  } = req.body;

  if (!name || !networkId || !address) {
    return res.status(400).json({ success: false, message: "必填字段缺失" });
  }

  const newNetwork = {
    id: "network_" + Date.now(),
    name,
    networkId,
    address,
    confirmations: confirmations || 6,
    enabled: enabled !== false
  };

  if (!coin.networks) {
    coin.networks = [];
  }

  coin.networks.push(newNetwork);

  res.json({
    success: true,
    message: "网络添加成功",
    network: newNetwork
  });
});

/**
 * 删除币种网络（管理员）
 */
app.delete("/api/admin/recharge/coins/:coinId/networks/:networkId", (req, res) => {
  const { coinId, networkId } = req.params;
  const coin = rechargeCoins.find(c => c.id === coinId);

  if (!coin) {
    return res.status(404).json({ success: false, message: "币种不存在" });
  }

  const index = coin.networks?.findIndex(n => n.id === networkId);
  if (index === undefined || index === -1) {
    return res.status(404).json({ success: false, message: "网络不存在" });
  }

  coin.networks.splice(index, 1);

  res.json({
    success: true,
    message: "网络已删除"
  });
});

/**
 * 删除币种（管理员）
 */
app.delete("/api/admin/recharge/coins/:coinId", (req, res) => {
  const coinId = req.params.coinId;

  try {
    const stmt = db.prepare("DELETE FROM recharge_coins WHERE id = ?");
    const result = stmt.run(coinId);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: "币种不存在" });
    }

    res.json({
      success: true,
      message: "币种已删除"
    });
  } catch (error) {
    console.error("Error deleting recharge coin:", error);
    res.status(500).json({ success: false, message: "删除失败" });
  }
});

/**
 * 更新充值币种（管理员）
 */
app.put("/api/admin/recharge/coins/:coinId", (req, res) => {
  const coinId = req.params.coinId;
  const {
    name,
    symbol,
    network,
    address,
    minAmount,
    maxAmount,
    status,
    description
  } = req.body;

  try {
    const stmt = db.prepare(`
      UPDATE recharge_coins 
      SET name = ?, symbol = ?, network = ?, address = ?, minAmount = ?, maxAmount = ?, status = ?, description = ?, updatedAt = ?
      WHERE id = ?
    `);

    const result = stmt.run(
      name,
      symbol?.toUpperCase() || '',
      network || '',
      address,
      minAmount || 0,
      maxAmount || 0,
      status || 'active',
      description || '',
      new Date().toISOString(),
      coinId
    );

    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: "币种不存在" });
    }

    res.json({
      success: true,
      message: "币种已更新"
    });
  } catch (error) {
    console.error("Error updating recharge coin:", error);
    res.status(500).json({ success: false, message: "更新失败" });
  }
});

/**
 * 获取所有充值记录（管理员）
 */
app.get("/api/admin/recharge/orders", (req, res) => {
  try {
    // 从数据库获取充值记录
    const records = db.prepare(`
      SELECT id, userId, username, coin, amount, network, address, txHash, status, notes, createdAt 
      FROM recharge_orders 
      ORDER BY createdAt DESC
    `).all();

    res.json({
      success: true,
      data: records.map(r => ({
        id: r.id,
        userId: r.userId,
        username: r.username || '-',
        coin: r.coin,
        amount: r.amount,
        network: r.network,
        address: r.address,
        txHash: r.txHash,
        status: r.status || 'pending',
        notes: r.notes,
        createdAt: r.createdAt,
      }))
    });
  } catch (error) {
    console.error("Error fetching recharge records:", error);
    res.status(500).json({ error: "Failed to fetch recharge records" });
  }
});

/**
 * 获取所有充值记录（管理员）- 别名
 */
app.get("/api/admin/recharge/records", (req, res) => {
  try {
    // 从数据库获取充值记录
    const records = db.prepare(`
      SELECT id, userId, username, coin, amount, network, address, txHash, status, notes, createdAt 
      FROM recharge_orders 
      ORDER BY createdAt DESC
    `).all();

    res.json({
      success: true,
      data: records.map(r => ({
        id: r.id,
        userId: r.userId,
        username: r.username || '-',
        coin: r.coin,
        amount: r.amount,
        network: r.network,
        address: r.address,
        txHash: r.txHash,
        status: r.status || 'pending',
        notes: r.notes,
        createdAt: r.createdAt,
      }))
    });
  } catch (error) {
    console.error("Error fetching recharge records:", error);
    res.status(500).json({ error: "Failed to fetch recharge records" });
  }
});

/**
 * 更新充值记录状态（管理员）
 */
app.put("/api/admin/recharge/records/:recordId", (req, res) => {
  const recordId = req.params.recordId;
  const { status } = req.body;

  try {
    // 更新数据库中的记录状态
    const stmt = db.prepare("UPDATE recharge_orders SET status = ?, updatedAt = ? WHERE id = ?");
    const result = stmt.run(status || "pending", new Date().toISOString(), recordId);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: "记录不存在" });
    }

    res.json({
      success: true,
      message: "状态已更新"
    });
  } catch (error) {
    console.error("Error updating recharge record:", error);
    res.status(500).json({ success: false, message: "更新失败" });
  }
});

/**
 * 删除充值记录（管理员）
 */
app.delete("/api/admin/recharge/records/:recordId", (req, res) => {
  const recordId = req.params.recordId;
  const index = rechargeRecords.findIndex(r => r.id === recordId);

  if (index === -1) {
    return res.status(404).json({ success: false, message: "记录不存在" });
  }

  rechargeRecords.splice(index, 1);

  res.json({
    success: true,
    message: "记录已删除"
  });
});

// =====================
// 用户提现管理 API
// =====================

/**
 * 用户提现申请
 */
app.post("/api/withdraw/submit", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  const userId = verifyToken(token);

  if (!userId) {
    return res.status(401).json({ success: false, message: "未授权" });
  }

  const { coin, amount, address, network } = req.body;

  if (!coin || !amount || amount <= 0 || !address) {
    return res.status(400).json({ success: false, message: "参数不完整或无效" });
  }

  // 创建提现记录
  const record = {
    id: "withdraw_" + Date.now(),
    userId,
    coin,
    network: network || "mainnet",
    amount,
    address,
    status: "pending",
    createdAt: new Date(),
    completedAt: null
  };

  withdrawRecords.push(record);

  res.json({
    success: true,
    message: "提现申请已提交",
    record
  });
});

/**
 * 获取用户提现记录
 */
app.get("/api/withdraw/records", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  const userId = verifyToken(token);

  if (!userId) {
    return res.status(401).json({ success: false, message: "未授权" });
  }

  const userRecords = withdrawRecords.filter(r => r.userId === userId);

  res.json({
    success: true,
    records: userRecords
  });
});

/**
 * 获取所有提现记录（管理员）
 */
app.get("/api/admin/withdraw/records", (req, res) => {
  try {
    // 从数据库获取提现记录
    const records = db.prepare(`
      SELECT id, userId, username, coin, amount, network, address, txHash, status, notes, createdAt 
      FROM withdraw_orders 
      ORDER BY createdAt DESC
    `).all();

    res.json({
      success: true,
      data: records.map(r => ({
        id: r.id,
        userId: r.userId,
        username: r.username || '-',
        coin: r.coin,
        amount: r.amount,
        network: r.network,
        address: r.address,
        txHash: r.txHash,
        status: r.status || 'pending',
        notes: r.notes,
        createdAt: r.createdAt,
      }))
    });
  } catch (error) {
    console.error("Error fetching withdraw records:", error);
    res.status(500).json({ error: "Failed to fetch withdraw records" });
  }
});

/**
 * 批准或拒绝提现（管理员）
 */
app.put("/api/admin/withdraw/records/:recordId", (req, res) => {
  const recordId = req.params.recordId;
  const { status } = req.body;

  try {
    // 更新数据库中的记录状态
    const stmt = db.prepare("UPDATE withdraw_orders SET status = ?, updatedAt = ? WHERE id = ?");
    const result = stmt.run(status || "pending", new Date().toISOString(), recordId);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: "记录不存在" });
    }

    res.json({
      success: true,
      message: "状态已更新"
    });
  } catch (error) {
    console.error("Error updating withdraw record:", error);
    res.status(500).json({ success: false, message: "更新失败" });
  }
});

/**
 * 删除提现记录（管理员）
 */
app.delete("/api/admin/withdraw/records/:recordId", (req, res) => {
  const recordId = req.params.recordId;
  const index = withdrawRecords.findIndex(r => r.id === recordId);

  if (index === -1) {
    return res.status(404).json({ success: false, message: "记录不存在" });
  }

  withdrawRecords.splice(index, 1);

  res.json({
    success: true,
    message: "记录已删除"
  });
});

/**
 * 审核提现订单（通过/拒绝，附带备注）
 * POST /api/admin/withdraw/review/:recordId
 */
app.post("/api/admin/withdraw/review/:recordId", (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const adminId = verifyToken(token);
    
    if (!adminId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const admin = db.prepare("SELECT * FROM users WHERE id = ? AND isAdmin = 1").get(adminId);
    if (!admin) {
      return res.status(403).json({ success: false, error: "Admin access required" });
    }

    const { recordId } = req.params;
    const { status, notes, txHash } = req.body;

    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, error: "Invalid status" });
    }

    const order = db.prepare("SELECT * FROM withdraw_orders WHERE id = ?").get(recordId);
    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    const now = new Date().toISOString();
    
    // 更新订单状态和备注
    db.prepare(`
      UPDATE withdraw_orders 
      SET status = ?, notes = ?, txHash = ?, updatedAt = ?
      WHERE id = ?
    `).run(status === 'approved' ? 'completed' : 'rejected', notes || '', txHash || null, now, recordId);

    // 如果是审核通过，更新用户余额
    if (status === 'approved') {
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(order.userId);
      if (user) {
        const assets = db.prepare("SELECT balances FROM user_assets WHERE userId = ?").get(order.userId);
        if (assets) {
          let balances = JSON.parse(assets.balances);
          balances[order.coin] = (balances[order.coin] || 0) - order.amount;
          db.prepare("UPDATE user_assets SET balances = ?, updatedAt = ? WHERE userId = ?").run(
            JSON.stringify(balances),
            now,
            order.userId
          );
        }
      }
    }

    const updatedOrder = db.prepare("SELECT * FROM withdraw_orders WHERE id = ?").get(recordId);

    res.json({
      success: true,
      message: status === 'approved' ? '提现已批准' : '提现已拒绝',
      data: updatedOrder
    });
  } catch (error) {
    console.error("Error reviewing withdraw order:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取用户的提现订单记录（含备注和状态）
 * GET /api/withdraw/myorders
 */
app.get("/api/withdraw/myorders", (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const userId = verifyToken(token);
    
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const orders = db.prepare(`
      SELECT id, coin, amount, network, address, txHash, status, notes, createdAt, updatedAt
      FROM withdraw_orders
      WHERE userId = ?
      ORDER BY createdAt DESC
    `).all(userId);

    res.json({
      success: true,
      data: orders,
      message: "User withdraw orders retrieved successfully"
    });
  } catch (error) {
    console.error("Error fetching user withdraw orders:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================
// 充值币种设置 API
// =====================

/**
 * 获取所有充值币种设置
 */
app.get("/api/admin/recharge-options", (req, res) => {
  res.json({
    success: true,
    options: rechargeOptions
  });
});

/**
 * 用户获取充值币种列表（前端使用）
 */
/**
 * 用户获取充值币种配置
 * GET /api/recharge/config
 */
app.get("/api/recharge/config", (req, res) => {
  try {
    const configs = db.prepare(`
      SELECT id, coin, network, address, qrCodeUrl, minAmount, enabled
      FROM recharge_config
      WHERE enabled = 1
      ORDER BY coin ASC
    `).all();

    res.json({
      success: true,
      data: configs,
      message: "Recharge config retrieved successfully"
    });
  } catch (error) {
    console.error("Error fetching recharge config:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 后台获取所有充值配置
 * GET /api/admin/recharge/config
 */
app.get("/api/admin/recharge/config", (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const userId = verifyToken(token);
    
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const admin = db.prepare("SELECT * FROM users WHERE id = ? AND isAdmin = 1").get(userId);
    if (!admin) {
      return res.status(403).json({ success: false, error: "Admin access required" });
    }

    const configs = db.prepare(`
      SELECT id, coin, network, address, qrCodeUrl, minAmount, enabled, createdAt, updatedAt
      FROM recharge_config
      ORDER BY coin ASC
    `).all();

    res.json({
      success: true,
      data: configs,
      message: "All recharge config retrieved successfully"
    });
  } catch (error) {
    console.error("Error fetching admin recharge config:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 后台创建或更新充值配置
 * POST /api/admin/recharge/config
 */
app.post("/api/admin/recharge/config", (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const userId = verifyToken(token);
    
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const admin = db.prepare("SELECT * FROM users WHERE id = ? AND isAdmin = 1").get(userId);
    if (!admin) {
      return res.status(403).json({ success: false, error: "Admin access required" });
    }

    const { coin, network, address, qrCodeUrl, minAmount, enabled } = req.body;

    if (!coin || !network || !address || minAmount === undefined) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const now = new Date().toISOString();
    const id = "rc_" + Date.now();

    // 检查是否已存在
    const existing = db.prepare("SELECT * FROM recharge_config WHERE coin = ?").get(coin);
    
    if (existing) {
      // 更新
      db.prepare(`
        UPDATE recharge_config 
        SET network = ?, address = ?, qrCodeUrl = ?, minAmount = ?, enabled = ?, updatedAt = ?
        WHERE coin = ?
      `).run(network, address, qrCodeUrl || null, minAmount, enabled ? 1 : 0, now, coin);
      
      const updated = db.prepare("SELECT * FROM recharge_config WHERE coin = ?").get(coin);
      res.json({
        success: true,
        data: updated,
        message: "Recharge config updated successfully"
      });
    } else {
      // 创建
      db.prepare(`
        INSERT INTO recharge_config (id, coin, network, address, qrCodeUrl, minAmount, enabled, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, coin, network, address, qrCodeUrl || null, minAmount, enabled ? 1 : 0, now, now);
      
      const created = db.prepare("SELECT * FROM recharge_config WHERE id = ?").get(id);
      res.json({
        success: true,
        data: created,
        message: "Recharge config created successfully"
      });
    }
  } catch (error) {
    console.error("Error creating/updating recharge config:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 后台删除充值配置
 * DELETE /api/admin/recharge/config/:coin
 */
app.delete("/api/admin/recharge/config/:coin", (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const userId = verifyToken(token);
    
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const admin = db.prepare("SELECT * FROM users WHERE id = ? AND isAdmin = 1").get(userId);
    if (!admin) {
      return res.status(403).json({ success: false, error: "Admin access required" });
    }

    const { coin } = req.params;
    const result = db.prepare("DELETE FROM recharge_config WHERE coin = ?").run(coin);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: "Config not found" });
    }

    res.json({
      success: true,
      message: "Recharge config deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting recharge config:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 用户提交充值申请
 * POST /api/recharge/submit
 */
app.post("/api/recharge/submit", (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const userId = verifyToken(token);
    
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const { coin, amount, txHash, network } = req.body;

    if (!coin || !amount || amount <= 0) {
      return res.status(400).json({ success: false, error: "Invalid parameters" });
    }

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const now = new Date().toISOString();
    const id = "rch_" + Date.now();

    db.prepare(`
      INSERT INTO recharge_orders (id, userId, username, coin, amount, network, txHash, status, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, user.username, coin, amount, network || 'mainnet', txHash || null, 'pending', now, now);

    const order = db.prepare("SELECT * FROM recharge_orders WHERE id = ?").get(id);

    res.json({
      success: true,
      data: order,
      message: "Recharge order submitted successfully"
    });
  } catch (error) {
    console.error("Error submitting recharge order:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 用户获取充值订单
 * GET /api/recharge/myorders
 */
app.get("/api/recharge/myorders", (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const userId = verifyToken(token);
    
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const orders = db.prepare(`
      SELECT id, coin, amount, network, txHash, status, createdAt, updatedAt
      FROM recharge_orders
      WHERE userId = ?
      ORDER BY createdAt DESC
    `).all(userId);

    res.json({
      success: true,
      data: orders,
      message: "User recharge orders retrieved successfully"
    });
  } catch (error) {
    console.error("Error fetching user recharge orders:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 后台获取所有充值订单
 * GET /api/admin/recharge/orders
 */
app.get("/api/admin/recharge/orders", (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const userId = verifyToken(token);
    
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const admin = db.prepare("SELECT * FROM users WHERE id = ? AND isAdmin = 1").get(userId);
    if (!admin) {
      return res.status(403).json({ success: false, error: "Admin access required" });
    }

    const orders = db.prepare(`
      SELECT id, userId, username, coin, amount, network, txHash, status, createdAt, updatedAt
      FROM recharge_orders
      ORDER BY createdAt DESC
    `).all();

    res.json({
      success: true,
      data: orders,
      message: "All recharge orders retrieved successfully"
    });
  } catch (error) {
    console.error("Error fetching admin recharge orders:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/recharge/options", (req, res) => {
  const enabledOptions = rechargeOptions.filter(o => o.enabled);
  res.json({
    success: true,
    options: enabledOptions
  });
});

/**
 * 添加充值币种
 */
app.post("/api/admin/recharge-options", (req, res) => {
  const { name, symbol, network, address, qrCode, enabled } = req.body;

  if (!name || !symbol || !address) {
    return res.status(400).json({ success: false, message: "缺少必要字段" });
  }

  const newOption = {
    id: "opt_" + Date.now(),
    name,
    symbol,
    network,
    address,
    qrCode: qrCode || null,
    enabled: enabled !== false,
    createdAt: new Date()
  };

  rechargeOptions.push(newOption);

  res.json({
    success: true,
    message: "币种已添加",
    option: newOption
  });
});

/**
 * 更新充值币种
 */
app.put("/api/admin/recharge-options/:optionId", (req, res) => {
  const optionId = req.params.optionId;
  const { name, symbol, network, address, qrCode, enabled } = req.body;

  const option = rechargeOptions.find(o => o.id === optionId);
  if (!option) {
    return res.status(404).json({ success: false, message: "币种不存在" });
  }

  if (name) option.name = name;
  if (symbol) option.symbol = symbol;
  if (network) option.network = network;
  if (address) option.address = address;
  if (qrCode !== undefined) option.qrCode = qrCode;
  option.enabled = enabled !== false;
  option.updatedAt = new Date();

  res.json({
    success: true,
    message: "币种已更新",
    option
  });
});

/**
 * 删除充值币种
 */
app.delete("/api/admin/recharge-options/:optionId", (req, res) => {
  const optionId = req.params.optionId;
  const index = rechargeOptions.findIndex(o => o.id === optionId);

  if (index === -1) {
    return res.status(404).json({ success: false, message: "币种不存在" });
  }

  rechargeOptions.splice(index, 1);

  res.json({
    success: true,
    message: "币种已删除"
  });
});

// =====================
// 用户资金管理 API
// =====================

/**
 * 获取用户列表与余额（管理员）
 */
app.get("/api/admin/funds/users", (req, res) => {
  const usersList = Object.values(users).map(user => ({
    id: user.userId,
    username: user.username,
    email: user.email,
    balance: user.balance || 0,
    createdAt: user.createdAt
  }));

  res.json({
    success: true,
    users: usersList
  });
});

/**
 * 给用户添加资金（管理员）
 */
app.post("/api/admin/funds/add", (req, res) => {
  const { userId, amount, reason } = req.body;

  if (!userId || !amount || amount <= 0) {
    return res.status(400).json({ success: false, message: "参数不完整或无效" });
  }

  let targetUser = null;
  for (const user of Object.values(users)) {
    if (user.userId === userId) {
      targetUser = user;
      break;
    }
  }

  if (!targetUser) {
    return res.status(404).json({ success: false, message: "用户不存在" });
  }

  const previousBalance = targetUser.balance || 0;
  targetUser.balance = (targetUser.balance || 0) + parseFloat(amount);

  res.json({
    success: true,
    message: "资金已添加",
    userId,
    previousBalance,
    newBalance: targetUser.balance,
    amount: parseFloat(amount),
    reason: reason || "Manual credit"
  });
});

/**
 * 从用户扣除资金（管理员）
 */
app.post("/api/admin/funds/deduct", (req, res) => {
  const { userId, amount, reason } = req.body;

  if (!userId || !amount || amount <= 0) {
    return res.status(400).json({ success: false, message: "参数不完整或无效" });
  }

  let targetUser = null;
  for (const user of Object.values(users)) {
    if (user.userId === userId) {
      targetUser = user;
      break;
    }
  }

  if (!targetUser) {
    return res.status(404).json({ success: false, message: "用户不存在" });
  }

  const deductAmount = parseFloat(amount);
  if ((targetUser.balance || 0) < deductAmount) {
    return res.status(400).json({ success: false, message: "余额不足" });
  }

  const previousBalance = targetUser.balance || 0;
  targetUser.balance = previousBalance - deductAmount;

  res.json({
    success: true,
    message: "资金已扣除",
    userId,
    previousBalance,
    newBalance: targetUser.balance,
    amount: deductAmount,
    reason: reason || "Manual deduction"
  });
});

/**
 * 获取用户余额（管理员查询）
 */
app.get("/api/admin/funds/balance/:userId", (req, res) => {
  const userId = req.params.userId;

  let targetUser = null;
  for (const user of Object.values(users)) {
    if (user.userId === userId) {
      targetUser = user;
      break;
    }
  }

  if (!targetUser) {
    return res.status(404).json({ success: false, message: "用户不存在" });
  }

  res.json({
    success: true,
    userId,
    username: targetUser.username,
    balance: targetUser.balance || 0
  });
});

// =====================
// 用户认证 API
// =====================

/**
 * 用户注册
 */
app.post("/api/auth/register", (req, res) => {
  const { username, email, phone, password } = req.body;

  console.log('[Register] 接收注册请求:', { username, email, phone });

  // 验证必填字段
  if (!username || !email || !phone || !password) {
    console.log('[Register] 缺少必填字段');
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  try {
    // 检查用户名是否已存在
    const existingUser = db.prepare("SELECT * FROM users WHERE username = ?").get(username.toLowerCase());
    if (existingUser) {
      console.log('[Register] 用户名已存在:', username);
      return res.status(400).json({ success: false, message: "Username already exists" });
    }

    // 检查邮箱是否已存在
    const existingEmail = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (existingEmail) {
      console.log('[Register] 邮箱已注册:', email);
      return res.status(400).json({ success: false, message: "Email already registered" });
    }

    // 检查手机号是否已存在
    const existingPhone = db.prepare("SELECT * FROM users WHERE phone = ?").get(phone);
    if (existingPhone) {
      console.log('[Register] 手机号已注册:', phone);
      return res.status(400).json({ success: false, message: "Phone number already registered" });
    }

    // 创建新用户 - 生成6位数的用户ID
    const userId = "user_" + String(Math.floor(100000 + Math.random() * 900000));
    const now = new Date().toISOString();

    console.log('[Register] 准备创建用户:', userId);

    // 插入用户到数据库
    db.prepare(`
      INSERT INTO users (id, username, email, password, phone, country, status, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `).run(userId, username.toLowerCase(), email, password, phone, "CN", now, now);

    console.log('[Register] 用户创建成功');

    // 为新用户创建资产记录（初始为空）
    const emptyBalances = JSON.stringify({
      BTC: 0,
      ETH: 0,
      USDT: 0,
      SOL: 0,
      ADA: 0,
      XRP: 0,
      DOGE: 0,
      LTC: 0
    });

    const assetId = "asset_" + String(Math.floor(100000 + Math.random() * 900000));
    db.prepare(`
      INSERT INTO user_assets (id, userId, balances, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?)
    `).run(assetId, userId, emptyBalances, now, now);

    console.log('[Register] 资产记录创建成功');

    // 也添加到内存存储（保持兼容性）
    const newUser = {
      userId,
      username,
      email,
      phone,
      password,
      createdAt: new Date(),
      balance: 10000,
    };
    users[username.toLowerCase()] = newUser;

    console.log('[Register] 注册完成，返回成功响应');

    res.status(201).json({
      success: true,
      message: "Registration successful",
      userId,
      username,
      email,
    });
  } catch (err) {
    console.error("[Register] 注册错误:", err);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error: " + err.message 
    });
  }
});

/**
 * 用户登录
 */
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;

  console.log('[Login] 收到登录请求:', { username });

  // 验证必填字段
  if (!username || !password) {
    console.log('[Login] 缺少必填字段');
    return res.status(400).json({ success: false, message: "Username and password required" });
  }

  try {
    // 支持用用户名或邮箱登录
    let user = db.prepare("SELECT * FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?").get(
      username.toLowerCase(),
      username.toLowerCase()
    );

    console.log('[Login] 数据库查询结果:', !!user);

    if (!user) {
      console.log('[Login] 用户不存在:', username);
      return res.status(401).json({ success: false, message: "Username or password incorrect" });
    }

    // 验证密码
    if (user.password !== password) {
      console.log('[Login] 密码错误');
      return res.status(401).json({ success: false, message: "Username or password incorrect" });
    }

    // 生成 Token
    const token = generateToken(user.id);

    console.log('[Login] Token 已生成:', token.substring(0, 20) + '...');

    // 初始化用户会话
    sessions[user.id] = {
      balance: 10000,
      trades: [],
      assets: {
        USDT: { available: 10000, frozen: 0, price: 1 },
        BTC: { available: 0.5, frozen: 0, price: 63285.4 },
        ETH: { available: 2, frozen: 0, price: 3410.2 },
        SOL: { available: 10, frozen: 0, price: 148.9 },
      },
    };

    console.log('[Login] 登录成功，返回响应');

    res.json({
      success: true,
      message: "登录成功",
      token,
      userId: user.id,
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin || 0,
    });
  } catch (err) {
    console.error("[Login] 登录错误:", err);
    res.status(500).json({ success: false, message: "Internal server error: " + err.message });
  }
});

/**
 * 验证 Token
 */
app.get("/api/auth/verify", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "未提供 Token" });
  }

  const userId = verifyToken(token);

  if (!userId) {
    return res.status(401).json({ message: "无效的 Token" });
  }

  // 找到对应的用户
  let user = null;
  for (const u of Object.values(users)) {
    if (u.userId === userId) {
      user = u;
      break;
    }
  }

  if (!user) {
    return res.status(401).json({ message: "用户不存在" });
  }

  res.json({
    userId: user.userId,
    username: user.username,
    email: user.email,
    phone: user.phone,
  });
});

/**
 * 获取当前用户信息
 */
app.get("/api/auth/profile", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "未提供 Token" });
  }

  const userId = verifyToken(token);

  if (!userId) {
    return res.status(401).json({ message: "无效的 Token" });
  }

  // 找到对应的用户
  let user = null;
  for (const u of Object.values(users)) {
    if (u.userId === userId) {
      user = u;
      break;
    }
  }

  if (!user) {
    return res.status(401).json({ message: "用户不存在" });
  }

  res.json({
    userId: user.userId,
    username: user.username,
    email: user.email,
    phone: user.phone,
    country: user.country,
    createdAt: user.createdAt,
  });
});

/**
 * 用户登出
 */
app.post("/api/auth/logout", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(400).json({ message: "未提供 Token" });
  }

  const userId = verifyToken(token);

  if (userId && sessions[userId]) {
    delete sessions[userId];
  }

  res.json({ message: "已登出" });
});

// =====================
// 管理员认证 API
// =====================

/**
 * 管理员登录
 */
app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "Username and password required" });
  }

  try {
    // 检查用户是否存在且是管理员
    let user = db.prepare("SELECT * FROM users WHERE LOWER(username) = ? AND isAdmin = 1").get(
      username.toLowerCase()
    );

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials or not admin" });
    }

    // 验证密码
    if (user.password !== password) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // 生成 Token（使用现有的generateToken函数）
    const token = generateToken(user.id);

    res.json({
      message: "Admin login successful",
      token,
      userId: user.id,
      username: user.username,
      isAdmin: true
    });
  } catch (err) {
    console.error("Admin login error:", err);
    res.status(500).json({ message: "Login failed" });
  }
});

/**
 * 验证管理员 Token
 */
app.get("/api/admin/verify", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  const userId = verifyToken(token);
  
  if (!userId) {
    return res.status(401).json({ message: "Invalid token" });
  }

  try {
    const user = db.prepare("SELECT * FROM users WHERE id = ? AND isAdmin = 1").get(userId);
    
    if (!user) {
      return res.status(403).json({ message: "Not admin" });
    }

    res.json({
      userId: user.id,
      username: user.username,
      isAdmin: true
    });
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
});

/**
 * 获取所有用户列表（仅管理员）
 */
app.get("/api/admin/users", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  const userId = verifyToken(token);
  if (!userId) {
    return res.status(401).json({ message: "Invalid token" });
  }

  try {
    const admin = db.prepare("SELECT * FROM users WHERE id = ? AND isAdmin = 1").get(userId);
    if (!admin) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const users = db.prepare(`
      SELECT id, username, email, phone, country, status, createdAt FROM users
      ORDER BY createdAt DESC
    `).all();

    res.json({ success: true, data: users });
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
});

/**
 * 获取待审核的验证提交（仅管理员）
 */
app.get("/api/admin/verification-queue", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  const userId = verifyToken(token);
  if (!userId) {
    return res.status(401).json({ message: "Invalid token" });
  }

  try {
    const admin = db.prepare("SELECT * FROM users WHERE id = ? AND isAdmin = 1").get(userId);
    if (!admin) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const submissions = db.prepare(`
      SELECT vs.*, u.username, u.email FROM verification_submissions vs
      JOIN users u ON vs.userId = u.id
      WHERE vs.status = 'pending'
      ORDER BY vs.submittedAt DESC
    `).all();

    res.json({ success: true, data: submissions });
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
});

/**
 * 获取初级认证提交（管理员）
 */
app.get("/api/admin/auth/primary", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  const userId = verifyToken(token);
  if (!userId) {
    return res.status(401).json({ message: "Invalid token" });
  }

  try {
    const admin = db.prepare("SELECT * FROM users WHERE id = ? AND isAdmin = 1").get(userId);
    if (!admin) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const submissions = db.prepare(`
      SELECT vs.id, vs.userId, u.username, vs.data, vs.status, vs.submittedAt 
      FROM verification_submissions vs
      JOIN users u ON vs.userId = u.id
      WHERE vs.type = 'primary' AND vs.status = 'pending'
      ORDER BY vs.submittedAt DESC
    `).all();

    const formatted = submissions.map(s => {
      let data = {};
      try {
        data = JSON.parse(s.data || '{}');
      } catch (e) {}
      return {
        id: s.id,
        userId: s.userId,
        username: s.username,
        idNumber: data.idNumber || '',
        submittedAt: s.submittedAt,
        status: s.status
      };
    });

    res.json({ success: true, data: formatted });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch auth submissions" });
  }
});

/**
 * 获取高级认证提交（管理员）
 */
app.get("/api/admin/auth/advanced", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  const userId = verifyToken(token);
  if (!userId) {
    return res.status(401).json({ message: "Invalid token" });
  }

  try {
    const admin = db.prepare("SELECT * FROM users WHERE id = ? AND isAdmin = 1").get(userId);
    if (!admin) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const submissions = db.prepare(`
      SELECT vs.id, vs.userId, u.username, vs.data, vs.status, vs.submittedAt 
      FROM verification_submissions vs
      JOIN users u ON vs.userId = u.id
      WHERE vs.type = 'advanced' AND vs.status = 'pending'
      ORDER BY vs.submittedAt DESC
    `).all();

    const formatted = submissions.map(s => {
      let data = {};
      try {
        data = JSON.parse(s.data || '{}');
      } catch (e) {}
      return {
        id: s.id,
        userId: s.userId,
        username: s.username,
        bankCard: data.info?.bankCard || '',
        submittedAt: s.submittedAt,
        status: s.status
      };
    });

    res.json({ success: true, data: formatted });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch auth submissions" });
  }
});

/**
 * 审核验证提交（仅管理员）
 */
app.post("/api/admin/verify-submission", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  const userId = verifyToken(token);
  if (!userId) {
    return res.status(401).json({ message: "Invalid token" });
  }

  try {
    const admin = db.prepare("SELECT * FROM users WHERE id = ? AND isAdmin = 1").get(userId);
    if (!admin) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const { submissionId, status, notes } = req.body;

    if (!submissionId || !status || !['verified', 'rejected'].includes(status)) {
      return res.status(400).json({ message: "Invalid parameters" });
    }

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE verification_submissions
      SET status = ?, reviewedAt = ?, reviewedBy = ?, reviewNotes = ?, updatedAt = ?
      WHERE id = ?
    `).run(status, now, userId, notes || '', now, submissionId);

    res.json({ success: true, message: "Verification updated" });
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
});

/**
 * 获取所有订单（仅管理员）
 */
app.get("/api/admin/orders", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  const userId = verifyToken(token);
  if (!userId) {
    return res.status(401).json({ message: "Invalid token" });
  }

  try {
    const admin = db.prepare("SELECT * FROM users WHERE id = ? AND isAdmin = 1").get(userId);
    if (!admin) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const orders = db.prepare(`
      SELECT qco.*, u.username FROM quick_contract_orders qco
      JOIN users u ON qco.userId = u.id
      ORDER BY qco.createdAt DESC
      LIMIT 100
    `).all();

    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
});

/**
 * 获取系统统计（仅管理员）
 */
app.get("/api/admin/stats", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  const userId = verifyToken(token);
  if (!userId) {
    return res.status(401).json({ message: "Invalid token" });
  }

  try {
    const admin = db.prepare("SELECT * FROM users WHERE id = ? AND isAdmin = 1").get(userId);
    if (!admin) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users WHERE isAdmin = 0").get().count;
    const totalOrders = db.prepare("SELECT COUNT(*) as count FROM quick_contract_orders").get().count;
    const pendingVerifications = db.prepare("SELECT COUNT(*) as count FROM verification_submissions WHERE status = 'pending'").get().count;
    const totalRevenue = db.prepare("SELECT COALESCE(SUM(profit), 0) as total FROM quick_contract_orders WHERE result = 'win'").get().total;

    // 计算总资产
    const assetsResult = db.prepare(`
      SELECT COALESCE(SUM(CAST(json_extract(balances, '$.USDT') AS REAL)), 0) as usdt_total FROM user_assets
    `).get();
    const totalAssets = Math.floor(assetsResult?.usdt_total || 0);

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalAssets,
        dailyVolume: Math.floor(Math.random() * 5000000),
        totalProfit: Math.floor(Math.random() * 1000000),
        totalOrders,
        pendingVerifications
      }
    });
  } catch (err) {
    console.error("Get admin stats error:", err);
    res.status(500).json({ message: "Failed to get stats" });
  }
});

/**
 * GET /api/admin/assets - 获取所有用户资产（仅管理员）
 */
app.get("/api/admin/assets", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  const userId = verifyToken(token);
  if (!userId) {
    return res.status(401).json({ message: "Invalid token" });
  }

  try {
    const admin = db.prepare("SELECT * FROM users WHERE id = ? AND isAdmin = 1").get(userId);
    if (!admin) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const assets = db.prepare(`
      SELECT u.id, u.username, u.email, ua.balances FROM users u
      LEFT JOIN user_assets ua ON u.id = ua.userId
      WHERE u.isAdmin = 0
      ORDER BY u.createdAt DESC
    `).all();

    const formatted = assets.map(a => {
      const balances = a.balances ? JSON.parse(a.balances) : {};
      return {
        userId: a.id,
        username: a.username,
        email: a.email,
        btc: balances.BTC || 0,
        eth: balances.ETH || 0,
        usdt: balances.USDT || 0,
        sol: balances.SOL || 0,
        ada: balances.ADA || 0,
        xrp: balances.XRP || 0,
        doge: balances.DOGE || 0,
        ltc: balances.LTC || 0
      };
    });

    res.json({ success: true, data: formatted });
  } catch (err) {
    console.error("Get admin assets error:", err);
    res.status(500).json({ message: "Failed to get assets" });
  }
});

/**
 * POST /api/admin/user/:id/status - 修改用户状态（仅管理员）
 */
app.post("/api/admin/user/:id/status", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  const userId = verifyToken(token);
  if (!userId) {
    return res.status(401).json({ message: "Invalid token" });
  }

  try {
    const admin = db.prepare("SELECT * FROM users WHERE id = ? AND isAdmin = 1").get(userId);
    if (!admin) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const { status } = req.body;
    const targetUserId = req.params.id;

    if (!['active', 'frozen', 'banned'].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const now = new Date().toISOString();
    db.prepare("UPDATE users SET status = ?, updatedAt = ? WHERE id = ?").run(status, now, targetUserId);

    res.json({ success: true, message: "User status updated" });
  } catch (err) {
    console.error("Update user status error:", err);
    res.status(500).json({ message: "Failed to update status" });
  }
});

/**
 * POST /api/admin/control-win-loss - 控制用户输赢（仅管理员）
 */
app.post("/api/admin/control-win-loss", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  const adminId = verifyToken(token);
  if (!adminId) {
    return res.status(401).json({ message: "Invalid token" });
  }

  try {
    const admin = db.prepare("SELECT * FROM users WHERE id = ? AND isAdmin = 1").get(adminId);
    if (!admin) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const { userId, type, amount, reason } = req.body;

    // 验证参数
    if (!userId || !type || !amount || !reason) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (!['win', 'loss'].includes(type)) {
      return res.status(400).json({ message: "Invalid type" });
    }

    if (amount <= 0) {
      return res.status(400).json({ message: "Amount must be positive" });
    }

    // 获取用户信息
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 获取或初始化用户资产
    let assets = null;
    try {
      const assetsRecord = db.prepare("SELECT * FROM user_assets WHERE userId = ?").get(userId);
      if (assetsRecord) {
        assets = JSON.parse(assetsRecord.balances || '{}');
      }
    } catch (e) {
      assets = {};
    }

    if (!assets) {
      assets = {
        BTC: 0,
        ETH: 0,
        USDT: 0,
        SOL: 0,
        ADA: 0,
        XRP: 0,
        DOGE: 0,
        LTC: 0
      };
    }

    // 更新USDT余额（主要交易币种）
    const currentBalance = assets.USDT || 0;
    const newBalance = type === 'win' ? currentBalance + amount : Math.max(0, currentBalance - amount);
    
    assets.USDT = newBalance;

    // 保存更新的资产
    const now = new Date().toISOString();
    const assetsRecord = db.prepare("SELECT * FROM user_assets WHERE userId = ?").get(userId);
    
    if (assetsRecord) {
      db.prepare("UPDATE user_assets SET balances = ?, updatedAt = ? WHERE userId = ?")
        .run(JSON.stringify(assets), now, userId);
    } else {
      db.prepare("INSERT INTO user_assets (userId, balances, updatedAt) VALUES (?, ?, ?)")
        .run(userId, JSON.stringify(assets), now);
    }

    // 记录操作日志（创建一个操作日志表或在现有地方记录）
    console.log(`[CONTROL-WIN-LOSS] Admin(${admin.username}) ${type === 'win' ? '增加' : '减少'}用户(${user.username})余额$${amount}. 原因: ${reason}`);

    // 返回成功响应
    res.json({
      success: true,
      message: `Successfully updated user balance`,
      data: {
        userId,
        username: user.username,
        type,
        amount,
        previousBalance: currentBalance,
        newBalance,
        reason,
        timestamp: now
      }
    });
  } catch (err) {
    console.error("Control win/loss error:", err);
    res.status(500).json({ message: "Failed to control win/loss" });
  }
});

/**
 * DELETE /api/admin/user/:id - 删除用户（仅管理员）
 */
app.delete("/api/admin/user/:id", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  const userId = verifyToken(token);
  if (!userId) {
    return res.status(401).json({ message: "Invalid token" });
  }

  try {
    const admin = db.prepare("SELECT * FROM users WHERE id = ? AND isAdmin = 1").get(userId);
    if (!admin) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const targetUserId = req.params.id;

    // 防止删除管理员
    const targetUser = db.prepare("SELECT * FROM users WHERE id = ?").get(targetUserId);
    if (targetUser && targetUser.isAdmin) {
      return res.status(403).json({ message: "Cannot delete admin users" });
    }

    db.prepare("DELETE FROM users WHERE id = ?").run(targetUserId);

    res.json({ success: true, message: "User deleted" });
  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).json({ message: "Failed to delete user" });
  }
});

/**
 * POST /api/admin/asset/:id - 修改用户资产（仅管理员）
 */
app.post("/api/admin/asset/:id", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  const userId = verifyToken(token);
  if (!userId) {
    return res.status(401).json({ message: "Invalid token" });
  }

  try {
    const admin = db.prepare("SELECT * FROM users WHERE id = ? AND isAdmin = 1").get(userId);
    if (!admin) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const targetUserId = req.params.id;
    const { btc, eth, usdt, sol, ada, xrp, doge, ltc } = req.body;

    const balances = {
      BTC: btc || 0,
      ETH: eth || 0,
      USDT: usdt || 0,
      SOL: sol || 0,
      ADA: ada || 0,
      XRP: xrp || 0,
      DOGE: doge || 0,
      LTC: ltc || 0
    };

    const now = new Date().toISOString();

    // 检查资产记录是否存在
    const existing = db.prepare("SELECT * FROM user_assets WHERE userId = ?").get(targetUserId);

    if (existing) {
      db.prepare("UPDATE user_assets SET balances = ?, updatedAt = ? WHERE userId = ?").run(
        JSON.stringify(balances),
        now,
        targetUserId
      );
    } else {
      const assetId = "ua_" + String(Math.floor(100000000 + Math.random() * 900000000));
      db.prepare(`
        INSERT INTO user_assets (id, userId, balances, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?)
      `).run(assetId, targetUserId, JSON.stringify(balances), now, now);
    }

    res.json({ success: true, message: "Asset updated" });
  } catch (err) {
    console.error("Update asset error:", err);
    res.status(500).json({ message: "Failed to update asset" });
  }
});

/**
 * POST /api/admin/quick-contract/toggle/:id - 切换快速合约配置状态
 */
app.post("/api/admin/quick-contract/toggle/:id", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  const userId = verifyToken(token);
  if (!userId) {
    return res.status(401).json({ message: "Invalid token" });
  }

  try {
    const admin = db.prepare("SELECT * FROM users WHERE id = ? AND isAdmin = 1").get(userId);
    if (!admin) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const { enabled } = req.body;
    const configId = req.params.id;

    const now = new Date().toISOString();
    db.prepare("UPDATE quick_contract_config SET enabled = ?, updatedAt = ? WHERE id = ?").run(
      enabled ? 1 : 0,
      now,
      configId
    );

    res.json({ success: true, message: "Config updated" });
  } catch (err) {
    console.error("Toggle config error:", err);
    res.status(500).json({ message: "Failed to toggle config" });
  }
});

// =====================
// 账户管理 API
// =====================

/**
 * 提交主要验证信息
 */
app.post("/api/account/verification/primary", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "未提供 Token" });
  }

  const userId = verifyToken(token);
  if (!userId) {
    return res.status(401).json({ message: "无效的 Token" });
  }

  const { fullName, idNumber, address, dateOfBirth } = req.body;

  if (!fullName || !idNumber || !address) {
    return res.status(400).json({ message: "缺少必填字段" });
  }

  try {
    const now = new Date().toISOString();
    const submissionId = "vsub_" + String(Math.floor(100000000 + Math.random() * 900000000));
    
    db.prepare(`
      INSERT INTO verification_submissions (id, userId, type, data, status, submittedAt, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      submissionId,
      userId,
      'primary',
      JSON.stringify({ fullName, idNumber, address, dateOfBirth }),
      'pending',
      now,
      now,
      now
    );

    res.json({
      success: true,
      message: "已提交验证信息，等待审核"
    });
  } catch (err) {
    console.error("Primary verification submission error:", err);
    res.status(500).json({ message: "提交失败" });
  }
});

/**
 * 提交高级验证信息
 */
app.post("/api/account/verification/advanced", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "未提供 Token" });
  }

  const userId = verifyToken(token);
  if (!userId) {
    return res.status(401).json({ message: "无效的 Token" });
  }

  const { info } = req.body;

  try {
    const now = new Date().toISOString();
    const submissionId = "vsub_" + String(Math.floor(100000000 + Math.random() * 900000000));
    
    db.prepare(`
      INSERT INTO verification_submissions (id, userId, type, data, status, submittedAt, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      submissionId,
      userId,
      'advanced',
      JSON.stringify({ info, submittedAt: now }),
      'pending',
      now,
      now,
      now
    );

    res.json({
      success: true,
      message: "已提交高级验证信息，等待审核"
    });
  } catch (err) {
    console.error("Advanced verification submission error:", err);
    res.status(500).json({ message: "提交失败" });
  }
});

/**
 * 更改密码
 */
app.post("/api/account/change-password/:type", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "未提供 Token" });
  }

  const userId = verifyToken(token);
  if (!userId) {
    return res.status(401).json({ message: "无效的 Token" });
  }

  const { type } = req.params;
  const { currentPassword, newPassword, securityQuestion, securityAnswer } = req.body;

  if (!newPassword) {
    return res.status(400).json({ message: "新密码不能为空" });
  }

  try {
    // 检查用户是否存在
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    if (!user) {
      return res.status(404).json({ message: "用户不存在" });
    }

    const now = new Date().toISOString();

    if (type === 'login') {
      // 验证当前密码
      if (currentPassword !== user.password) {
        return res.status(400).json({ message: "当前密码不正确" });
      }

      // 更新用户登录密码
      db.prepare("UPDATE users SET password = ?, updatedAt = ? WHERE id = ?").run(newPassword, now, userId);
    } else if (type === 'withdrawal') {
      // 检查或创建用户密码记录
      let existingRecord = db.prepare("SELECT * FROM user_passwords WHERE userId = ?").get(userId);
      
      if (existingRecord) {
        db.prepare(`
          UPDATE user_passwords 
          SET withdrawalPassword = ?, securityQuestion = ?, securityAnswer = ?, updatedAt = ?
          WHERE userId = ?
        `).run(newPassword, securityQuestion || null, securityAnswer || null, now, userId);
      } else {
        const pwId = "pw_" + String(Math.floor(100000000 + Math.random() * 900000000));
        db.prepare(`
          INSERT INTO user_passwords (id, userId, loginPassword, withdrawalPassword, securityQuestion, securityAnswer, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(pwId, userId, user.password, newPassword, securityQuestion || null, securityAnswer || null, now, now);
      }
    } else {
      return res.status(400).json({ message: "无效的密码类型" });
    }

    res.json({
      success: true,
      message: "密码已更新"
    });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ message: "更新失败" });
  }
});

/**
 * 获取用户验证状态
 */
app.get("/api/account/verification-status", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "未提供 Token" });
  }

  const userId = verifyToken(token);
  if (!userId) {
    return res.status(401).json({ message: "无效的 Token" });
  }

  try {
    // 获取最新的主要验证
    const primaryVerification = db.prepare(`
      SELECT status FROM verification_submissions 
      WHERE userId = ? AND type = 'primary'
      ORDER BY submittedAt DESC
      LIMIT 1
    `).get(userId);

    // 获取最新的高级验证
    const advancedVerification = db.prepare(`
      SELECT status FROM verification_submissions 
      WHERE userId = ? AND type = 'advanced'
      ORDER BY submittedAt DESC
      LIMIT 1
    `).get(userId);

    res.json({
      primary: primaryVerification ? primaryVerification.status : 'unverified',
      advanced: advancedVerification ? advancedVerification.status : 'pending'
    });
  } catch (err) {
    console.error("Get verification status error:", err);
    res.status(500).json({ message: "获取状态失败" });
  }
});

// =====================
// 管理员 API
// =====================

/**
 * 获取仪表板统计数据
 */
app.get("/api/admin/statistics", (req, res) => {
  const adminToken = req.headers.authorization?.split(" ")[1];

  if (!adminToken) {
    return res.status(401).json({ error: "未提供 Token" });
  }

  try {
    // 从SQLite数据库获取统计数据
    const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
    const rechargeTotal = db.prepare("SELECT SUM(amount) as total FROM recharge_orders WHERE status = 'completed'").get().total || 0;
    const withdrawTotal = db.prepare("SELECT SUM(amount) as total FROM withdraw_orders WHERE status = 'completed'").get().total || 0;
    
    // 获取最近的5个用户
    const recentUsers = db.prepare(`
      SELECT id, username, email, createdAt FROM users 
      ORDER BY createdAt DESC LIMIT 5
    `).all();

    res.json({
      success: true,
      totalUsers,
      totalRecharge: rechargeTotal,
      totalWithdraw: withdrawTotal,
      dailyIncome: (rechargeTotal - withdrawTotal) * 0.01, // 假设平台收入为1%
      recentUsers: recentUsers.map(u => ({
        userId: u.id,
        username: u.username,
        email: u.email,
        createdAt: u.createdAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching statistics:", error);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
});

/**
 * 获取所有用户列表
 */
app.get("/api/admin/users", (req, res) => {
  const adminToken = req.headers.authorization?.split(" ")[1];

  if (!adminToken) {
    return res.status(401).json({ error: "未提供 Token" });
  }

  try {
    // 从数据库获取所有用户
    const allUsers = db.prepare(`
      SELECT id, username, email, phone, status, createdAt FROM users 
      ORDER BY createdAt DESC
    `).all();

    res.json({
      success: true,
      data: allUsers.map(u => ({
        id: u.id,
        username: u.username,
        email: u.email,
        phone: u.phone || "-",
        status: u.status || "active",
        createdAt: u.createdAt,
      }))
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

/**
 * 更新用户余额
 */
app.put("/api/admin/users/:userId/balance", (req, res) => {
  const adminToken = req.headers.authorization?.split(" ")[1];

  if (!adminToken) {
    return res.status(401).json({ error: "未提供 Token" });
  }

  const { userId } = req.params;
  const { amount, type, remark } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ success: false, message: "金额必须大于0" });
  }

  if (!type || !['add', 'deduct'].includes(type)) {
    return res.status(400).json({ success: false, message: "操作类型无效" });
  }

  // 找到用户
  let targetUser = null;
  for (const user of Object.values(users)) {
    if (user.userId === userId) {
      targetUser = user;
      break;
    }
  }

  if (!targetUser) {
    return res.status(404).json({ success: false, message: "用户不存在" });
  }

  // 更新余额
  const currentBalance = targetUser.balance || 10000;
  let newBalance;

  if (type === 'add') {
    newBalance = currentBalance + amount;
  } else {
    newBalance = currentBalance - amount;
    if (newBalance < 0) {
      return res.status(400).json({ success: false, message: "余额不足，无法扣减" });
    }
  }

  targetUser.balance = newBalance;

  res.json({
    success: true,
    message: "余额更新成功",
    userId,
    newBalance,
    oldBalance: currentBalance,
    type,
    amount,
    remark
  });
});

/**
 * 获取财务数据
 */
app.get("/api/admin/finance", (req, res) => {
  const adminToken = req.headers.authorization?.split(" ")[1];

  if (!adminToken) {
    return res.status(401).json({ error: "未提供 Token" });
  }

  const allUsers = Object.values(users);
  const totalDeposits = allUsers.reduce((sum, u) => sum + (u.balance || 10000), 0);
  const totalWithdrawals = 0; // 简化示例
  const balance = totalDeposits - totalWithdrawals;

  res.json({
    totalDeposits,
    totalWithdrawals,
    balance,
    transactions: [
      {
        username: "testuser",
        type: "deposit",
        amount: 1000,
        date: new Date().toISOString(),
      },
      {
        username: "testuser",
        type: "withdrawal",
        amount: 500,
        date: new Date().toISOString(),
      },
    ],
  });
});

/**
 * 获取交易记录
 */
app.get("/api/admin/transactions", (req, res) => {
  const adminToken = req.headers.authorization?.split(" ")[1];

  if (!adminToken) {
    return res.status(401).json({ error: "未提供 Token" });
  }

  const allUsers = Object.values(users);
  const transactions = [];

  allUsers.forEach(user => {
    if (sessions[user.userId] && sessions[user.userId].trades) {
      sessions[user.userId].trades.forEach(trade => {
        transactions.push({
          username: user.username,
          pair: trade.pair || "BTC/USDT",
          direction: trade.direction || "buy",
          amount: trade.amount || 0,
          result: trade.result || "pending",
          date: trade.date || new Date().toISOString(),
        });
      });
    }
  });

  res.json(transactions);
});

/**
 * 设置用户输赢状态
 */
app.put("/api/admin/users/:userId/win-setting", (req, res) => {
  const adminToken = req.headers.authorization?.split(" ")[1];

  if (!adminToken) {
    return res.status(401).json({ error: "未提供 Token" });
  }

  const { userId } = req.params;
  const { winSetting, remarks } = req.body;

  // 找到用户
  let user = null;
  for (const u of Object.values(users)) {
    if (u.userId === userId) {
      user = u;
      break;
    }
  }

  if (!user) {
    return res.status(404).json({ error: "用户不存在" });
  }

  // 更新用户的输赢设置
  user.winSetting = winSetting; // normal, win, lose
  user.remarks = remarks || "";
  user.winSettingUpdatedAt = new Date();

  res.json({
    message: "设置已保存",
    userId,
    winSetting,
    remarks,
  });
});

/**
 * 删除用户
 */
app.delete("/api/admin/users/:userId", (req, res) => {
  const adminToken = req.headers.authorization?.split(" ")[1];

  if (!adminToken) {
    return res.status(401).json({ error: "未提供 Token" });
  }

  const { userId } = req.params;

  // 找到并删除用户
  let found = false;
  for (const [key, user] of Object.entries(users)) {
    if (user.userId === userId) {
      delete users[key];
      found = true;
      break;
    }
  }

  if (!found) {
    return res.status(404).json({ error: "用户不存在" });
  }

  // 清除用户会话
  if (sessions[userId]) {
    delete sessions[userId];
  }

  res.json({ message: "用户已删除" });
});

/**
 * 更新全局输赢开关
 */
app.put("/api/admin/global-win-switch", (req, res) => {
  const adminToken = req.headers.authorization?.split(" ")[1];

  if (!adminToken) {
    return res.status(401).json({ error: "未提供 Token" });
  }

  const { enabled } = req.body;

  // 这是一个全局设置，应该存储在配置中
  const globalSettings = {
    globalWinEnabled: enabled,
    updatedAt: new Date(),
  };

  res.json({
    message: "全局设置已更新",
    globalSettings,
  });
});

// =====================
// 币种管理 API
// =====================

// 获取所有币种
app.get("/api/admin/trading-pairs", (req, res) => {
  const adminToken = req.headers.authorization?.split(" ")[1];
  if (!adminToken) {
    return res.status(401).json({ success: false, message: "未授权" });
  }

  res.json({
    success: true,
    pairs: tradingPairs
  });
});

// 创建新币种
app.post("/api/admin/trading-pairs", (req, res) => {
  const adminToken = req.headers.authorization?.split(" ")[1];
  if (!adminToken) {
    return res.status(401).json({ success: false, message: "未授权" });
  }

  const { pair, baseCurrency, quoteCurrency, currentPrice, enabled, change24h, volume24h } = req.body;

  if (!pair || !baseCurrency || !quoteCurrency || currentPrice === undefined) {
    return res.status(400).json({ success: false, message: "缺少必要字段" });
  }

  const newPair = {
    id: "pair_" + Date.now(),
    pair,
    baseCurrency,
    quoteCurrency,
    currentPrice: parseFloat(currentPrice),
    change24h: change24h || 0,
    volume24h: volume24h || 0,
    enabled: enabled !== false,
    createdAt: new Date()
  };

  tradingPairs.push(newPair);

  res.json({
    success: true,
    message: "币种已添加",
    pair: newPair
  });
});

// 更新币种
app.put("/api/admin/trading-pairs/:pairId", (req, res) => {
  const adminToken = req.headers.authorization?.split(" ")[1];
  if (!adminToken) {
    return res.status(401).json({ success: false, message: "未授权" });
  }

  const { pairId } = req.params;
  const { pair, baseCurrency, quoteCurrency, currentPrice, enabled, change24h, volume24h } = req.body;

  const pairIndex = tradingPairs.findIndex(p => p.id === pairId);
  if (pairIndex === -1) {
    return res.status(404).json({ success: false, message: "币种不存在" });
  }

  tradingPairs[pairIndex] = {
    ...tradingPairs[pairIndex],
    pair: pair || tradingPairs[pairIndex].pair,
    baseCurrency: baseCurrency || tradingPairs[pairIndex].baseCurrency,
    quoteCurrency: quoteCurrency || tradingPairs[pairIndex].quoteCurrency,
    currentPrice: currentPrice !== undefined ? parseFloat(currentPrice) : tradingPairs[pairIndex].currentPrice,
    change24h: change24h !== undefined ? change24h : tradingPairs[pairIndex].change24h,
    volume24h: volume24h !== undefined ? volume24h : tradingPairs[pairIndex].volume24h,
    enabled: enabled !== undefined ? enabled : tradingPairs[pairIndex].enabled,
    updatedAt: new Date()
  };

  res.json({
    success: true,
    message: "币种已更新",
    pair: tradingPairs[pairIndex]
  });
});

// 删除币种
app.delete("/api/admin/trading-pairs/:pairId", (req, res) => {
  const adminToken = req.headers.authorization?.split(" ")[1];
  if (!adminToken) {
    return res.status(401).json({ success: false, message: "未授权" });
  }

  const { pairId } = req.params;
  const pairIndex = tradingPairs.findIndex(p => p.id === pairId);
  if (pairIndex === -1) {
    return res.status(404).json({ success: false, message: "币种不存在" });
  }

  tradingPairs.splice(pairIndex, 1);

  res.json({
    success: true,
    message: "币种已删除"
  });
});

// 用户获取启用的币种（用于交易页面）
app.get("/api/trading-pairs", (req, res) => {
  const enabledPairs = tradingPairs.filter(p => p.enabled);
  
  res.json({
    success: true,
    pairs: enabledPairs
  });
});

// =====================
// 页面管理 API
// =====================

/**
 * 获取所有可管理的页面列表
 * GET /api/pages
 */
app.get("/api/pages", (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT DISTINCT pageId, pageName 
      FROM page_sections 
      ORDER BY pageName ASC
    `);
    const pages = stmt.all();
    res.json({
      success: true,
      data: pages
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取特定页面的所有可编辑区域
 * GET /api/pages/:pageId/sections
 */
app.get("/api/pages/:pageId/sections", (req, res) => {
  try {
    const { pageId } = req.params;
    const stmt = db.prepare(`
      SELECT id, pageId, pageName, sectionKey, sectionTitle, sectionType, content, htmlContent, enabled
      FROM page_sections 
      WHERE pageId = ?
      ORDER BY order_index ASC, createdAt ASC
    `);
    const sections = stmt.all(pageId);
    res.json({
      success: true,
      page: pageId,
      data: sections
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取特定页面区域的内容
 * GET /api/pages/:pageId/section/:sectionKey
 */
app.get("/api/pages/:pageId/section/:sectionKey", (req, res) => {
  try {
    const { pageId, sectionKey } = req.params;
    const stmt = db.prepare(`
      SELECT * FROM page_sections 
      WHERE pageId = ? AND sectionKey = ?
    `);
    const section = stmt.get(pageId, sectionKey);
    
    if (!section) {
      return res.status(404).json({ error: "Section not found" });
    }
    
    res.json({
      success: true,
      data: section
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 管理员：更新页面区域内容
 * PUT /api/admin/pages/:pageId/sections/:sectionId
 */
app.put("/api/admin/pages/:pageId/sections/:sectionId", (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(token);
    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: "Admin only" });
    }

    const { pageId, sectionId } = req.params;
    const { content, htmlContent } = req.body;

    const stmt = db.prepare(`
      UPDATE page_sections 
      SET content = ?, htmlContent = ?, updatedAt = ?
      WHERE id = ? AND pageId = ?
    `);
    
    stmt.run(content || null, htmlContent || null, new Date().toISOString(), sectionId, pageId);
    
    res.json({
      success: true,
      message: "Section updated successfully"
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 管理员：创建新的页面区域
 * POST /api/admin/pages/:pageId/sections
 */
app.post("/api/admin/pages/:pageId/sections", (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(token);
    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: "Admin only" });
    }

    const { pageId } = req.params;
    const { sectionKey, sectionTitle, sectionType, content, htmlContent } = req.body;

    if (!sectionKey) {
      return res.status(400).json({ error: "sectionKey is required" });
    }

    const id = `ps_${pageId}_${sectionKey}`;
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO page_sections 
      (id, pageId, pageName, sectionKey, sectionTitle, sectionType, content, htmlContent, enabled, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `);

    const pageInfo = db.prepare("SELECT pageName FROM page_sections WHERE pageId = ? LIMIT 1").get(pageId);
    const pageName = pageInfo?.pageName || pageId;

    stmt.run(id, pageId, pageName, sectionKey, sectionTitle || sectionKey, sectionType || 'text', content || '', htmlContent || '', now, now);

    res.json({
      success: true,
      message: "Section created successfully",
      sectionId: id
    });
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return res.status(400).json({ error: "Section key already exists for this page" });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * 管理员：删除页面区域
 * DELETE /api/admin/pages/:pageId/sections/:sectionId
 */
app.delete("/api/admin/pages/:pageId/sections/:sectionId", (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(token);
    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: "Admin only" });
    }

    const { pageId, sectionId } = req.params;

    const stmt = db.prepare(`
      DELETE FROM page_sections 
      WHERE id = ? AND pageId = ?
    `);
    
    stmt.run(sectionId, pageId);
    
    res.json({
      success: true,
      message: "Section deleted successfully"
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =====================
// 动态内容 API
// =====================

// 获取动态内容
app.get("/api/content/:type", (req, res) => {
  const { type } = req.params;
  
  try {
    const stmt = db.prepare("SELECT * FROM site_content WHERE type = ?");
    const content = stmt.get(type);
    
    if (!content) {
      return res.status(404).json({ error: "Content not found" });
    }
    
    res.json(content);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取所有动态内容
app.get("/api/content", (req, res) => {
  try {
    const stmt = db.prepare("SELECT * FROM site_content");
    const contents = stmt.all();
    res.json(contents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 管理员：更新动态内容
app.put("/api/admin/content/:id", (req, res) => {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { id } = req.params;
  const { title, content, link } = req.body;

  try {
    const stmt = db.prepare(`
      UPDATE site_content 
      SET title = ?, content = ?, link = ?, updatedAt = ? 
      WHERE id = ?
    `);
    
    stmt.run(title, content, link, new Date().toISOString(), id);
    res.json({ success: true, message: "Content updated" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =====================
// 客服配置 API
// =====================

// 获取客服信息
app.get("/api/support/config", (req, res) => {
  try {
    const stmt = db.prepare("SELECT * FROM support_config WHERE enabled = 1");
    const supports = stmt.all();
    res.json(supports);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取主客服链接
app.get("/api/support/main", (req, res) => {
  try {
    const stmt = db.prepare("SELECT * FROM support_config WHERE type = 'customer_service' AND enabled = 1");
    const support = stmt.get();
    
    if (!support) {
      return res.status(404).json({ error: "Support config not found" });
    }
    
    res.json(support);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 管理员：更新客服配置
app.put("/api/admin/support/:id", (req, res) => {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { id } = req.params;
  const { link, title, description, enabled } = req.body;

  try {
    const stmt = db.prepare(`
      UPDATE support_config 
      SET link = ?, title = ?, description = ?, enabled = ?, updatedAt = ? 
      WHERE id = ?
    `);
    
    stmt.run(link, title, description, enabled ? 1 : 0, new Date().toISOString(), id);
    res.json({ success: true, message: "Support config updated" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =====================
// 客服消息接口
// =====================

// 发送用户消息
app.post('/api/support/message', (req, res) => {
  try {
    const { userId, username, message } = req.body;
    if (!userId || !username || !message) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const stmt = db.prepare(`
      INSERT INTO support_messages (id, userId, username, role, message, status, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, userId, username, 'user', message, 'unread', new Date().toISOString());
    res.json({ success: true, id, message: "Message sent" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取用户的所有消息
app.get('/api/support/messages/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const stmt = db.prepare(`
      SELECT * FROM support_messages 
      WHERE userId = ? 
      ORDER BY createdAt ASC
    `);
    
    const messages = stmt.all(userId);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取所有未读消息（后台用）
app.get('/api/admin/support/messages/unread', (req, res) => {
  try {
    const token = req.headers.authorization;
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const stmt = db.prepare(`
      SELECT * FROM support_messages 
      WHERE status = 'unread' AND role = 'user'
      ORDER BY createdAt DESC
    `);
    
    const messages = stmt.all();
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取特定用户的所有对话（后台用）
app.get('/api/admin/support/conversation/:userId', (req, res) => {
  try {
    const token = req.headers.authorization;
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { userId } = req.params;
    const stmt = db.prepare(`
      SELECT * FROM support_messages 
      WHERE userId = ? 
      ORDER BY createdAt ASC
    `);
    
    const messages = stmt.all(userId);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 后台回复消息
app.post('/api/admin/support/reply', (req, res) => {
  try {
    const token = req.headers.authorization;
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { userId, username, message } = req.body;
    if (!userId || !username || !message) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const stmt = db.prepare(`
      INSERT INTO support_messages (id, userId, username, role, message, status, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, userId, username, 'admin', message, 'read', new Date().toISOString());
    res.json({ success: true, id, message: "Reply sent" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 标记消息为已读
app.put('/api/support/message/:id/read', (req, res) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare(`
      UPDATE support_messages 
      SET status = 'read' 
      WHERE id = ?
    `);
    
    stmt.run(id);
    res.json({ success: true, message: "Message marked as read" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =====================
// 系统诊断接口
// =====================

// 获取数据库表列表
app.get("/api/system/db-tables", (req, res) => {
  try {
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).all();
    
    res.json({
      success: true,
      tables: tables.map(t => t.name)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取用户总数
app.get("/api/system/users-count", (req, res) => {
  try {
    const result = db.prepare(`SELECT COUNT(*) as count FROM users`).get();
    res.json({
      success: true,
      count: result?.count || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取市场价格（真实数据）
app.get("/api/market/prices", (req, res) => {
  try {
    // 返回真实的加密货币价格（模拟真实交易所数据）
    const prices = {
      BTC: 45320.50,
      ETH: 2850.75,
      USDT: 1.00,
      SOL: 198.45,
      ADA: 0.98,
      XRP: 2.45,
      DOGE: 0.42,
      LTC: 142.80
    };
    
    res.json({
      success: true,
      prices: prices,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取理财产品列表
 * GET /api/wealth/products
 */
app.get("/api/wealth/products", (req, res) => {
  try {
    const products = db.prepare(`
      SELECT id, name, type, term, annualRate, minAmount, maxAmount, riskLevel, description
      FROM wealth_products
      WHERE enabled = 1
      ORDER BY annualRate DESC
    `).all();

    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 购买理财产品
 * POST /api/wealth/purchase
 */
app.post("/api/wealth/purchase", (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userId = verifyToken(token);
    if (!userId) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const { productId, amount } = req.body;

    // 获取产品信息
    const product = db.prepare("SELECT * FROM wealth_products WHERE id = ? AND enabled = 1").get(productId);
    if (!product) {
      return res.status(400).json({ error: "Product not found or disabled" });
    }

    // 验证金额
    if (amount < product.minAmount || amount > product.maxAmount) {
      return res.status(400).json({ 
        error: `Amount must be between $${product.minAmount} and $${product.maxAmount}` 
      });
    }

    // 检查用户余额
    let userBalance = 0;
    try {
      const assetsRecord = db.prepare("SELECT balances FROM user_assets WHERE userId = ?").get(userId);
      if (assetsRecord) {
        const assets = JSON.parse(assetsRecord.balances || '{}');
        userBalance = assets.USDT || 0;
      }
    } catch (e) {
      userBalance = 0;
    }

    if (userBalance < amount) {
      return res.status(400).json({ 
        error: `Insufficient balance. You have $${userBalance.toFixed(2)}, but need $${amount.toFixed(2)}` 
      });
    }

    // 计算预期收益
    const days = product.term || 1;
    const expectedProfit = (amount * product.annualRate / 100) * (days / 365);

    // 创建理财订单
    const orderId = "wo_" + Date.now();
    const now = new Date().toISOString();
    const endDate = product.term > 0 
      ? new Date(Date.now() + product.term * 24 * 60 * 60 * 1000).toISOString()
      : null;

    db.prepare(`
      INSERT INTO wealth_orders
      (id, userId, productId, productName, amount, annualRate, term, status, expectedProfit, startDate, endDate, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)
    `).run(orderId, userId, productId, product.name, amount, product.annualRate, product.term, expectedProfit, now, endDate, now, now);

    // 冻结用户余额
    let assets = {};
    try {
      const assetsRecord = db.prepare("SELECT balances FROM user_assets WHERE userId = ?").get(userId);
      if (assetsRecord) {
        assets = JSON.parse(assetsRecord.balances || '{}');
      }
    } catch (e) {
      assets = { BTC: 0, ETH: 0, USDT: 0, SOL: 0, ADA: 0, XRP: 0, DOGE: 0, LTC: 0 };
    }

    const newBalance = (assets.USDT || 0) - amount;
    assets.USDT = newBalance;

    const assetsRecord = db.prepare("SELECT * FROM user_assets WHERE userId = ?").get(userId);
    if (assetsRecord) {
      db.prepare("UPDATE user_assets SET balances = ?, updatedAt = ? WHERE userId = ?")
        .run(JSON.stringify(assets), now, userId);
    } else {
      db.prepare("INSERT INTO user_assets (userId, balances, updatedAt) VALUES (?, ?, ?)")
        .run(userId, JSON.stringify(assets), now);
    }

    console.log(`[Wealth Product] User ${userId} purchased ${product.name} for $${amount}. Expected profit: $${expectedProfit.toFixed(2)}`);

    res.json({
      success: true,
      orderId,
      productName: product.name,
      amount,
      annualRate: product.annualRate,
      term: product.term,
      expectedProfit: expectedProfit.toFixed(2),
      newBalance: newBalance.toFixed(2),
      startDate: now,
      endDate
    });
  } catch (error) {
    console.error("Error purchasing wealth product:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取用户理财订单
 * GET /api/wealth/orders
 */
app.get("/api/wealth/orders", (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userId = verifyToken(token);
    if (!userId) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const orders = db.prepare(`
      SELECT id, productName, amount, annualRate, term, status, expectedProfit, actualProfit, startDate, endDate, createdAt
      FROM wealth_orders
      WHERE userId = ?
      ORDER BY createdAt DESC
      LIMIT 100
    `).all(userId);

    // 统计收益
    const totalAmount = orders.reduce((sum, o) => sum + (o.amount || 0), 0);
    const totalExpectedProfit = orders.reduce((sum, o) => sum + (o.expectedProfit || 0), 0);
    const totalActualProfit = orders.reduce((sum, o) => sum + (o.actualProfit || 0), 0);
    const activeOrders = orders.filter(o => o.status === 'active').length;

    res.json({
      success: true,
      stats: {
        totalAmount: totalAmount.toFixed(2),
        totalExpectedProfit: totalExpectedProfit.toFixed(2),
        totalActualProfit: totalActualProfit.toFixed(2),
        activeOrders
      },
      data: orders.map(o => ({
        id: o.id,
        productName: o.productName,
        amount: o.amount,
        annualRate: o.annualRate + '%',
        term: o.term === 0 ? '活期' : (o.term + '天'),
        status: o.status === 'active' ? '进行中' : '已结束',
        expectedProfit: o.expectedProfit,
        actualProfit: o.actualProfit,
        startDate: o.startDate,
        endDate: o.endDate,
        createdAt: o.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 提取理财产品
 * POST /api/wealth/redeem
 */
app.post("/api/wealth/redeem", (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userId = verifyToken(token);
    if (!userId) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const { orderId } = req.body;

    // 获取订单信息
    const order = db.prepare("SELECT * FROM wealth_orders WHERE id = ? AND userId = ?").get(orderId, userId);
    if (!order) {
      return res.status(400).json({ error: "Order not found" });
    }

    if (order.status !== 'active') {
      return res.status(400).json({ error: "Order is not active" });
    }

    // 检查期限
    if (order.term > 0 && order.endDate) {
      const endTime = new Date(order.endDate);
      if (endTime > new Date()) {
        const daysLeft = Math.ceil((endTime - new Date()) / (24 * 60 * 60 * 1000));
        return res.status(400).json({ error: `This product matures in ${daysLeft} days. Early redemption not allowed.` });
      }
    }

    // 计算实际收益（本金 + 预期收益）
    const actualProfit = order.expectedProfit;
    const totalAmount = order.amount + actualProfit;

    // 更新订单状态
    const now = new Date().toISOString();
    db.prepare("UPDATE wealth_orders SET status = 'redeemed', actualProfit = ?, updatedAt = ? WHERE id = ?")
      .run(actualProfit, now, orderId);

    // 返还资金到用户账户
    let assets = {};
    try {
      const assetsRecord = db.prepare("SELECT balances FROM user_assets WHERE userId = ?").get(userId);
      if (assetsRecord) {
        assets = JSON.parse(assetsRecord.balances || '{}');
      }
    } catch (e) {
      assets = { BTC: 0, ETH: 0, USDT: 0, SOL: 0, ADA: 0, XRP: 0, DOGE: 0, LTC: 0 };
    }

    const newBalance = (assets.USDT || 0) + totalAmount;
    assets.USDT = newBalance;

    const assetsRecord = db.prepare("SELECT * FROM user_assets WHERE userId = ?").get(userId);
    if (assetsRecord) {
      db.prepare("UPDATE user_assets SET balances = ?, updatedAt = ? WHERE userId = ?")
        .run(JSON.stringify(assets), now, userId);
    } else {
      db.prepare("INSERT INTO user_assets (userId, balances, updatedAt) VALUES (?, ?, ?)")
        .run(userId, JSON.stringify(assets), now);
    }

    console.log(`[Wealth Product] User ${userId} redeemed order ${orderId}. Profit: $${actualProfit.toFixed(2)}, Total: $${totalAmount.toFixed(2)}`);

    res.json({
      success: true,
      orderId,
      principalAmount: order.amount,
      profit: actualProfit.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      newBalance: newBalance.toFixed(2)
    });
  } catch (error) {
    console.error("Error redeeming wealth product:", error);
    res.status(500).json({ error: error.message });
  }
});

// =====================
// Spot Trading APIs - 现货交易
// =====================

/**
 * POST /api/spot/place-order - 下单（买入/卖出）
 */
app.post("/api/spot/place-order", (req, res) => {
  try {
    const { symbol, side, price, amount } = req.body;
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.substring(7);
    const userId = verifyToken(token);
    
    if (!userId) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    // 验证参数
    if (!['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'LTC'].includes(symbol)) {
      return res.status(400).json({ error: "Invalid symbol" });
    }

    if (!['buy', 'sell'].includes(side)) {
      return res.status(400).json({ error: "Invalid side" });
    }

    if (amount <= 0 || price <= 0) {
      return res.status(400).json({ error: "Invalid amount or price" });
    }

    const totalValue = price * amount;

    // 检查余额（买入时需要检查USDT余额）
    let userBalance = 0;
    if (side === 'buy') {
      try {
        const assetsRecord = db.prepare("SELECT balances FROM user_assets WHERE userId = ?").get(userId);
        if (assetsRecord) {
          const assets = JSON.parse(assetsRecord.balances || '{}');
          userBalance = assets.USDT || 0;
        }
      } catch (e) {
        userBalance = 0;
      }

      if (userBalance < totalValue) {
        return res.status(400).json({ 
          error: `Insufficient USDT balance. You have $${userBalance.toFixed(2)}, but need $${totalValue.toFixed(2)}` 
        });
      }
    }

    // 创建订单
    const orderId = "spot_" + Date.now();
    const now = new Date().toISOString();
    const fee = totalValue * 0.001; // 0.1% 手续费

    // 模拟订单成交（90%概率立即成交）
    const isFilled = Math.random() < 0.9;
    const filledAmount = isFilled ? amount : 0;

    db.prepare(`
      INSERT INTO spot_orders
      (id, userId, symbol, type, side, price, amount, totalValue, status, filledAmount, avgFillPrice, fee, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(orderId, userId, symbol, 'limit', side, price, amount, totalValue, isFilled ? 'filled' : 'pending', filledAmount, isFilled ? price : 0, fee, now, now);

    // 如果订单成交，更新用户资产
    if (isFilled) {
      let assets = {};
      try {
        const assetsRecord = db.prepare("SELECT balances FROM user_assets WHERE userId = ?").get(userId);
        if (assetsRecord) {
          assets = JSON.parse(assetsRecord.balances || '{}');
        }
      } catch (e) {
        assets = { BTC: 0, ETH: 0, USDT: 0, SOL: 0, ADA: 0, XRP: 0, DOGE: 0, LTC: 0 };
      }

      if (side === 'buy') {
        assets.USDT = (assets.USDT || 0) - totalValue - fee;
        assets[symbol] = (assets[symbol] || 0) + amount;
      } else {
        assets[symbol] = (assets[symbol] || 0) - amount;
        assets.USDT = (assets.USDT || 0) + totalValue - fee;
      }

      const assetsRecord = db.prepare("SELECT * FROM user_assets WHERE userId = ?").get(userId);
      if (assetsRecord) {
        db.prepare("UPDATE user_assets SET balances = ?, updatedAt = ? WHERE userId = ?")
          .run(JSON.stringify(assets), now, userId);
      } else {
        db.prepare("INSERT INTO user_assets (userId, balances, updatedAt) VALUES (?, ?, ?)")
          .run(userId, JSON.stringify(assets), now);
      }
    }

    console.log(`[Spot Trading] Order ${orderId}: ${user.username} ${side.toUpperCase()} ${amount} ${symbol} at $${price} - ${isFilled ? 'FILLED' : 'PENDING'}`);

    res.json({
      success: true,
      orderId,
      symbol,
      side,
      price,
      amount,
      totalValue: totalValue.toFixed(2),
      fee: fee.toFixed(2),
      status: isFilled ? 'filled' : 'pending',
      filledAmount: filledAmount,
      message: isFilled ? 'Order filled successfully' : 'Order pending'
    });
  } catch (error) {
    console.error("Error placing spot order:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/spot/orders - 获取用户现货订单
 */
app.get("/api/spot/orders", (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.substring(7);
    const userId = verifyToken(token);
    
    if (!userId) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const orders = db.prepare("SELECT * FROM spot_orders WHERE userId = ? ORDER BY createdAt DESC").all(userId);

    res.json({
      success: true,
      total: orders.length,
      orders: orders
    });
  } catch (error) {
    console.error("Error fetching spot orders:", error);
    res.status(500).json({ error: error.message });
  }
});

// =====================
// Perpetual Futures APIs - 永续合约
// =====================

/**
 * POST /api/perpetual/open-position - 开仓（做多/做空）
 */
app.post("/api/perpetual/open-position", (req, res) => {
  try {
    const { symbol, side, leverage, price, amount } = req.body;
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.substring(7);
    const userId = verifyToken(token);
    
    if (!userId) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    // 验证参数
    if (!['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'LTC'].includes(symbol)) {
      return res.status(400).json({ error: "Invalid symbol" });
    }

    if (!['long', 'short'].includes(side)) {
      return res.status(400).json({ error: "Invalid side" });
    }

    if (leverage < 1 || leverage > 20) {
      return res.status(400).json({ error: "Leverage must be between 1x and 20x" });
    }

    if (amount <= 0 || price <= 0) {
      return res.status(400).json({ error: "Invalid amount or price" });
    }

    // 计算所需保证金
    const margin = (price * amount) / leverage;

    // 检查余额
    let userBalance = 0;
    try {
      const assetsRecord = db.prepare("SELECT balances FROM user_assets WHERE userId = ?").get(userId);
      if (assetsRecord) {
        const assets = JSON.parse(assetsRecord.balances || '{}');
        userBalance = assets.USDT || 0;
      }
    } catch (e) {
      userBalance = 0;
    }

    if (userBalance < margin) {
      return res.status(400).json({ 
        error: `Insufficient margin. You have $${userBalance.toFixed(2)}, but need $${margin.toFixed(2)}` 
      });
    }

    // 创建持仓
    const positionId = "perp_" + Date.now();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO perpetual_positions
      (id, userId, symbol, side, leverage, entryPrice, amount, margin, status, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(positionId, userId, symbol, side, leverage, price, amount, margin, 'open', now, now);

    // 冻结保证金
    let assets = {};
    try {
      const assetsRecord = db.prepare("SELECT balances FROM user_assets WHERE userId = ?").get(userId);
      if (assetsRecord) {
        assets = JSON.parse(assetsRecord.balances || '{}');
      }
    } catch (e) {
      assets = { BTC: 0, ETH: 0, USDT: 0, SOL: 0, ADA: 0, XRP: 0, DOGE: 0, LTC: 0 };
    }

    assets.USDT = (assets.USDT || 0) - margin;
    
    const assetsRecord = db.prepare("SELECT * FROM user_assets WHERE userId = ?").get(userId);
    if (assetsRecord) {
      db.prepare("UPDATE user_assets SET balances = ?, updatedAt = ? WHERE userId = ?")
        .run(JSON.stringify(assets), now, userId);
    } else {
      db.prepare("INSERT INTO user_assets (userId, balances, updatedAt) VALUES (?, ?, ?)")
        .run(userId, JSON.stringify(assets), now);
    }

    console.log(`[Perpetual Futures] Position ${positionId}: ${user.username} ${side.toUpperCase()} ${amount} ${symbol} at $${price} with ${leverage}x leverage`);

    res.json({
      success: true,
      positionId,
      symbol,
      side,
      leverage,
      entryPrice: price,
      amount,
      margin: margin.toFixed(2),
      notionalValue: (price * amount).toFixed(2),
      status: 'open'
    });
  } catch (error) {
    console.error("Error opening perpetual position:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/perpetual/close-position - 平仓
 */
app.post("/api/perpetual/close-position", (req, res) => {
  try {
    const { positionId, closePrice } = req.body;
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.substring(7);
    const userId = verifyToken(token);
    
    if (!userId) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // 获取持仓信息
    const position = db.prepare("SELECT * FROM perpetual_positions WHERE id = ? AND userId = ?").get(positionId, userId);
    if (!position || position.status !== 'open') {
      return res.status(400).json({ error: "Position not found or already closed" });
    }

    const now = new Date().toISOString();
    
    // 计算损益
    let pnl = 0;
    if (position.side === 'long') {
      pnl = (closePrice - position.entryPrice) * position.amount;
    } else {
      pnl = (position.entryPrice - closePrice) * position.amount;
    }

    // 更新持仓状态
    db.prepare("UPDATE perpetual_positions SET status = 'closed', unrealizedPnl = ?, updatedAt = ? WHERE id = ?")
      .run(pnl, now, positionId);

    // 创建平仓订单
    const orderId = "perp_close_" + Date.now();
    db.prepare(`
      INSERT INTO perpetual_orders
      (id, userId, positionId, symbol, type, side, price, amount, status, pnl, executedAt, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(orderId, userId, positionId, position.symbol, 'close', position.side === 'long' ? 'sell' : 'buy', closePrice, position.amount, 'closed', pnl, now, now, now);

    // 返还保证金加损益
    let assets = {};
    try {
      const assetsRecord = db.prepare("SELECT balances FROM user_assets WHERE userId = ?").get(userId);
      if (assetsRecord) {
        assets = JSON.parse(assetsRecord.balances || '{}');
      }
    } catch (e) {
      assets = { BTC: 0, ETH: 0, USDT: 0, SOL: 0, ADA: 0, XRP: 0, DOGE: 0, LTC: 0 };
    }

    assets.USDT = (assets.USDT || 0) + position.margin + pnl;
    
    const assetsRecord = db.prepare("SELECT * FROM user_assets WHERE userId = ?").get(userId);
    if (assetsRecord) {
      db.prepare("UPDATE user_assets SET balances = ?, updatedAt = ? WHERE userId = ?")
        .run(JSON.stringify(assets), now, userId);
    } else {
      db.prepare("INSERT INTO user_assets (userId, balances, updatedAt) VALUES (?, ?, ?)")
        .run(userId, JSON.stringify(assets), now);
    }

    console.log(`[Perpetual Futures] Position ${positionId} closed. PnL: $${pnl.toFixed(2)}`);

    res.json({
      success: true,
      orderId,
      positionId,
      closePrice,
      pnl: pnl.toFixed(2),
      returnedMargin: (position.margin + pnl).toFixed(2),
      status: 'closed'
    });
  } catch (error) {
    console.error("Error closing perpetual position:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/perpetual/positions - 获取用户永续合约持仓
 */
app.get("/api/perpetual/positions", (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.substring(7);
    const userId = verifyToken(token);
    
    if (!userId) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const positions = db.prepare("SELECT * FROM perpetual_positions WHERE userId = ? ORDER BY createdAt DESC").all(userId);

    res.json({
      success: true,
      total: positions.length,
      positions: positions
    });
  } catch (error) {
    console.error("Error fetching perpetual positions:", error);
    res.status(500).json({ error: error.message });
  }
});

// =====================
// 理财自动结算任务
// =====================

/**
 * 管理员：启用/禁用理财产品
 * POST /api/admin/wealth/toggle
 */
app.post("/api/admin/wealth/toggle", (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const adminUser = db.prepare("SELECT * FROM users WHERE id = ? AND isAdmin = 1").get(token);
    if (!adminUser) {
      return res.status(403).json({ error: "Admin only" });
    }

    const { productId, enabled } = req.body;

    const now = new Date().toISOString();
    db.prepare("UPDATE wealth_products SET enabled = ?, updatedAt = ? WHERE id = ?")
      .run(enabled ? 1 : 0, now, productId);

    console.log(`[Admin] Product ${productId} ${enabled ? 'enabled' : 'disabled'}`);

    res.json({
      success: true,
      message: enabled ? "Product enabled" : "Product disabled"
    });
  } catch (error) {
    console.error("Error toggling wealth product:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 自动结算到期的理财产品
 * 每小时检查一次是否有到期的订单
 */
const startWealthAutoSettlement = () => {
  // 每小时运行一次
  setInterval(() => {
    try {
      const now = new Date();
      
      // 获取所有活跃的定期产品订单（非活期）
      const orders = db.prepare(`
        SELECT * FROM wealth_orders 
        WHERE status = 'active' AND term > 0 AND endDate IS NOT NULL
      `).all();

      orders.forEach(order => {
        const endTime = new Date(order.endDate);
        
        // 检查是否到期
        if (endTime <= now) {
          try {
            // 计算实际收益
            const actualProfit = order.expectedProfit;
            const totalAmount = order.amount + actualProfit;
            
            // 更新订单状态
            const nowStr = new Date().toISOString();
            db.prepare("UPDATE wealth_orders SET status = 'redeemed', actualProfit = ?, updatedAt = ? WHERE id = ?")
              .run(actualProfit, nowStr, order.id);
            
            // 返还资金到用户账户
            let assets = {};
            try {
              const assetsRecord = db.prepare("SELECT balances FROM user_assets WHERE userId = ?").get(order.userId);
              if (assetsRecord) {
                assets = JSON.parse(assetsRecord.balances || '{}');
              }
            } catch (e) {
              assets = { BTC: 0, ETH: 0, USDT: 0, SOL: 0, ADA: 0, XRP: 0, DOGE: 0, LTC: 0 };
            }

            const newBalance = (assets.USDT || 0) + totalAmount;
            assets.USDT = newBalance;

            const assetsRecord = db.prepare("SELECT * FROM user_assets WHERE userId = ?").get(order.userId);
            if (assetsRecord) {
              db.prepare("UPDATE user_assets SET balances = ?, updatedAt = ? WHERE userId = ?")
                .run(JSON.stringify(assets), nowStr, order.userId);
            } else {
              db.prepare("INSERT INTO user_assets (userId, balances, updatedAt) VALUES (?, ?, ?)")
                .run(order.userId, JSON.stringify(assets), nowStr);
            }
            
            console.log(`[Auto Settlement] User ${order.userId}'s wealth order ${order.id} (${order.productName}) auto-settled. Profit: $${actualProfit.toFixed(2)}`);
          } catch (error) {
            console.error(`[Auto Settlement Error] Failed to settle order ${order.id}:`, error);
          }
        }
      });
    } catch (error) {
      console.error('[Auto Settlement Error]', error);
    }
  }, 60 * 60 * 1000); // 每小时运行一次
};

// 启动自动结算
startWealthAutoSettlement();

// =====================
// 币种管理 API
// =====================

/**
 * GET /api/admin/coins - 获取所有币种
 */
app.get("/api/admin/coins", (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "未授权" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.isAdmin) {
      return res.status(403).json({ success: false, message: "没有权限" });
    }

    // 初始化表
    try {
      db.prepare(`
        CREATE TABLE IF NOT EXISTS market_coins (
          id TEXT PRIMARY KEY,
          symbol TEXT UNIQUE,
          name TEXT,
          price REAL,
          change24h REAL DEFAULT 0,
          marketCap REAL,
          volume24h REAL,
          status TEXT DEFAULT 'active',
          createdAt DATETIME,
          updatedAt DATETIME
        )
      `).run();
    } catch (e) {}

    const coins = db.prepare("SELECT * FROM market_coins WHERE status = 'active' ORDER BY updatedAt DESC").all();
    
    res.json({
      success: true,
      data: coins || []
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/coins - 添加新币种
 */
app.post("/api/admin/coins", (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "未授权" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.isAdmin) {
      return res.status(403).json({ success: false, message: "没有权限" });
    }

    const { symbol, name, price, change24h } = req.body;

    if (!symbol || !name || typeof price !== 'number') {
      return res.status(400).json({ success: false, message: "参数不完整" });
    }

    // 初始化表
    try {
      db.prepare(`
        CREATE TABLE IF NOT EXISTS market_coins (
          id TEXT PRIMARY KEY,
          symbol TEXT UNIQUE,
          name TEXT,
          price REAL,
          change24h REAL DEFAULT 0,
          marketCap REAL,
          volume24h REAL,
          status TEXT DEFAULT 'active',
          createdAt DATETIME,
          updatedAt DATETIME
        )
      `).run();
    } catch (e) {}

    const id = Date.now().toString();
    const now = new Date().toISOString();

    try {
      db.prepare(`
        INSERT INTO market_coins (id, symbol, name, price, change24h, status, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
      `).run(id, symbol.toUpperCase(), name, price, change24h || 0, now, now);

      res.json({
        success: true,
        message: "币种已添加",
        data: { id, symbol: symbol.toUpperCase(), name, price, change24h }
      });
    } catch (error) {
      if (error.message.includes('UNIQUE constraint')) {
        return res.status(400).json({ success: false, message: "币种已存在" });
      }
      throw error;
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/admin/coins/:coinId - 删除币种
 */
app.delete("/api/admin/coins/:coinId", (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "未授权" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.isAdmin) {
      return res.status(403).json({ success: false, message: "没有权限" });
    }

    const { coinId } = req.params;

    db.prepare("UPDATE market_coins SET status = 'inactive', updatedAt = ? WHERE id = ?")
      .run(new Date().toISOString(), coinId);

    res.json({ success: true, message: "币种已删除" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/quick-contract/coin-config - 配置秒合约币种
 */
app.post("/api/admin/quick-contract/coin-config", (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "未授权" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.isAdmin) {
      return res.status(403).json({ success: false, message: "没有权限" });
    }

    const { coin, initialBalance, minBet, maxBet } = req.body;

    if (!coin || !initialBalance || !minBet || !maxBet) {
      return res.status(400).json({ success: false, message: "参数不完整" });
    }

    // 初始化表
    try {
      db.prepare(`
        CREATE TABLE IF NOT EXISTS quick_contract_config (
          id INTEGER PRIMARY KEY,
          symbol TEXT UNIQUE,
          initialBalance REAL,
          minBet REAL,
          maxBet REAL,
          updatedAt DATETIME
        )
      `).run();
    } catch (e) {}

    const now = new Date().toISOString();

    try {
      db.prepare(`
        INSERT OR REPLACE INTO quick_contract_config (symbol, initialBalance, minBet, maxBet, updatedAt)
        VALUES (?, ?, ?, ?, ?)
      `).run(coin, initialBalance, minBet, maxBet, now);

      res.json({
        success: true,
        message: "币种配置已保存"
      });
    } catch (error) {
      throw error;
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/content/:contentType - 获取页面内容
 */
app.get("/api/admin/content/:contentType", (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "未授权" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.isAdmin) {
      return res.status(403).json({ success: false, message: "没有权限" });
    }

    const { contentType } = req.params;

    // 初始化表
    try {
      db.prepare(`
        CREATE TABLE IF NOT EXISTS site_pages (
          id INTEGER PRIMARY KEY,
          pageType TEXT UNIQUE,
          heading TEXT,
          body TEXT,
          updatedAt DATETIME
        )
      `).run();
    } catch (e) {}

    const content = db.prepare("SELECT * FROM site_pages WHERE pageType = ?").get(contentType);

    res.json({
      success: true,
      data: content || { pageType: contentType, heading: '', body: '' }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/content/:contentType - 保存页面内容
 */
app.post("/api/admin/content/:contentType", (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "未授权" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.isAdmin) {
      return res.status(403).json({ success: false, message: "没有权限" });
    }

    const { contentType } = req.params;
    const { heading, body } = req.body;

    // 初始化表
    try {
      db.prepare(`
        CREATE TABLE IF NOT EXISTS site_pages (
          id INTEGER PRIMARY KEY,
          pageType TEXT UNIQUE,
          heading TEXT,
          body TEXT,
          updatedAt DATETIME
        )
      `).run();
    } catch (e) {}

    const now = new Date().toISOString();

    db.prepare(`
      INSERT OR REPLACE INTO site_pages (pageType, heading, body, updatedAt)
      VALUES (?, ?, ?, ?)
    `).run(contentType, heading, body, now);

    res.json({
      success: true,
      message: "内容已保存"
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 管理员：获取兑换币种记录
 * GET /api/admin/exchange-rates
 */
app.get("/api/admin/exchange-rates", (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userId = verifyToken(token);
    if (!userId) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const admin = db.prepare("SELECT * FROM users WHERE id = ? AND isAdmin = 1").get(userId);
    if (!admin) {
      return res.status(403).json({ error: "Admin only" });
    }

    // 从交易订单中统计用户兑换币种的情况
    const exchangeStats = db.prepare(`
      SELECT 
        u.username,
        qco.symbol as coin,
        COUNT(*) as count,
        SUM(CASE WHEN qco.result = 'win' THEN 1 ELSE 0 END) as winCount,
        ROUND(100.0 * SUM(CASE WHEN qco.result = 'win' THEN 1 ELSE 0 END) / COUNT(*), 2) as successRate,
        MAX(qco.createdAt) as createdAt
      FROM quick_contract_orders qco
      JOIN users u ON qco.userId = u.id
      GROUP BY u.username, qco.symbol
      ORDER BY qco.createdAt DESC
    `).all();

    res.json({
      success: true,
      data: exchangeStats.map(stat => ({
        username: stat.username,
        coin: stat.coin,
        amount: stat.count,
        successRate: stat.successRate + '%',
        createdAt: stat.createdAt
      }))
    });
  } catch (error) {
    console.error("Error fetching exchange rates:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 创建借贷产品表（如果不存在）
 */
db.exec(`
  CREATE TABLE IF NOT EXISTS lending_products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    minAmount REAL NOT NULL,
    maxAmount REAL NOT NULL,
    rate REAL NOT NULL,
    term INTEGER NOT NULL,
    status TEXT DEFAULT 'active',
    enabled INTEGER DEFAULT 1,
    createdAt TEXT,
    updatedAt TEXT
  );
`);

/**
 * 创建币种兑换订单表（如果不存在）
 */
db.exec(`
  CREATE TABLE IF NOT EXISTS exchange_orders (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    username TEXT,
    fromCoin TEXT NOT NULL,
    toCoin TEXT NOT NULL,
    fromAmount REAL NOT NULL,
    toAmount REAL NOT NULL,
    exchangeRate REAL NOT NULL,
    fee REAL DEFAULT 0,
    status TEXT DEFAULT 'completed',
    notes TEXT,
    createdAt TEXT,
    updatedAt TEXT,
    FOREIGN KEY (userId) REFERENCES users(id)
  );
`);

/**
 * 创建借贷应用表（如果不存在）
 */
db.exec(`
  CREATE TABLE IF NOT EXISTS lending_applications (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    username TEXT,
    amount REAL NOT NULL,
    rate REAL DEFAULT 5,
    term INTEGER DEFAULT 30,
    status TEXT DEFAULT 'pending',
    approvedAt TEXT,
    approvedBy TEXT,
    rejectionReason TEXT,
    appliedAt TEXT,
    createdAt TEXT,
    updatedAt TEXT,
    FOREIGN KEY (userId) REFERENCES users(id)
  );
`);

/**
 * 用户申请借贷
 * POST /api/lending/apply
 */
app.post("/api/lending/apply", (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userId = verifyToken(token);
    if (!userId) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    const { amount, term } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    if (!term || term < 7 || term > 365) {
      return res.status(400).json({ error: "Term must be between 7 and 365 days" });
    }

    const applicationId = "lend_" + Date.now();
    const now = new Date().toISOString();
    const rate = 5; // 默认5%利率

    db.prepare(`
      INSERT INTO lending_applications
      (id, userId, username, amount, rate, term, status, appliedAt, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
    `).run(applicationId, userId, user.username, amount, rate, term, now, now, now);

    console.log(`[Lending] User ${user.username} applied for loan: $${amount} for ${term} days`);

    res.json({
      success: true,
      applicationId,
      message: "Lending application submitted",
      amount,
      rate,
      term,
      status: "pending"
    });
  } catch (error) {
    console.error("Error applying for lending:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取用户借贷申请列表
 * GET /api/lending/applications
 */
app.get("/api/lending/applications", (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userId = verifyToken(token);
    if (!userId) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const applications = db.prepare(`
      SELECT id, amount, rate, term, status, appliedAt, createdAt
      FROM lending_applications
      WHERE userId = ?
      ORDER BY createdAt DESC
      LIMIT 100
    `).all(userId);

    res.json({
      success: true,
      data: applications.map(app => ({
        id: app.id,
        amount: app.amount,
        rate: app.rate + '%',
        term: app.term + '天',
        status: app.status === 'pending' ? '待审核' : (app.status === 'approved' ? '已批准' : '已驳回'),
        appliedAt: app.appliedAt,
        createdAt: app.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 管理员：获取所有借贷申请
 * GET /api/admin/lending/applications
 */
app.get("/api/admin/lending/applications", (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userId = verifyToken(token);
    if (!userId) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const admin = db.prepare("SELECT * FROM users WHERE id = ? AND isAdmin = 1").get(userId);
    if (!admin) {
      return res.status(403).json({ error: "Admin only" });
    }

    const applications = db.prepare(`
      SELECT id, userId, username, amount, rate, term, status, appliedAt, rejectionReason
      FROM lending_applications
      WHERE status = 'pending'
      ORDER BY appliedAt DESC
    `).all();

    res.json({
      success: true,
      data: applications.map(app => ({
        id: app.id,
        userId: app.userId,
        username: app.username,
        amount: app.amount,
        rate: app.rate,
        term: app.term,
        status: app.status,
        appliedAt: app.appliedAt,
        rejectionReason: app.rejectionReason
      }))
    });
  } catch (error) {
    console.error("Error fetching lending applications:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 管理员：批准借贷申请
 * POST /api/admin/lending/approve
 */
app.post("/api/admin/lending/approve", (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userId = verifyToken(token);
    if (!userId) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const admin = db.prepare("SELECT * FROM users WHERE id = ? AND isAdmin = 1").get(userId);
    if (!admin) {
      return res.status(403).json({ error: "Admin only" });
    }

    const { applicationId } = req.body;

    // 获取申请信息
    const application = db.prepare("SELECT * FROM lending_applications WHERE id = ?").get(applicationId);
    if (!application) {
      return res.status(400).json({ error: "Application not found" });
    }

    if (application.status !== 'pending') {
      return res.status(400).json({ error: "Application is not pending" });
    }

    const now = new Date().toISOString();

    // 更新申请状态
    db.prepare(`
      UPDATE lending_applications 
      SET status = 'approved', approvedAt = ?, approvedBy = ?, updatedAt = ?
      WHERE id = ?
    `).run(now, admin.id, now, applicationId);

    // 增加用户余额
    let assets = {};
    try {
      const assetsRecord = db.prepare("SELECT balances FROM user_assets WHERE userId = ?").get(application.userId);
      if (assetsRecord) {
        assets = JSON.parse(assetsRecord.balances || '{}');
      }
    } catch (e) {
      assets = { BTC: 0, ETH: 0, USDT: 0, SOL: 0, ADA: 0, XRP: 0, DOGE: 0, LTC: 0 };
    }

    const newBalance = (assets.USDT || 0) + application.amount;
    assets.USDT = newBalance;

    const assetsRecord = db.prepare("SELECT * FROM user_assets WHERE userId = ?").get(application.userId);
    if (assetsRecord) {
      db.prepare("UPDATE user_assets SET balances = ?, updatedAt = ? WHERE userId = ?")
        .run(JSON.stringify(assets), now, application.userId);
    } else {
      db.prepare("INSERT INTO user_assets (userId, balances, updatedAt) VALUES (?, ?, ?)")
        .run(application.userId, JSON.stringify(assets), now);
    }

    console.log(`[Lending] Admin ${admin.username} approved lending for ${application.username}: $${application.amount}`);

    res.json({
      success: true,
      message: "Lending application approved",
      applicationId,
      username: application.username,
      amount: application.amount,
      newBalance: newBalance.toFixed(2)
    });
  } catch (error) {
    console.error("Error approving lending:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 管理员：驳回借贷申请
 * POST /api/admin/lending/reject
 */
app.post("/api/admin/lending/reject", (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userId = verifyToken(token);
    if (!userId) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const admin = db.prepare("SELECT * FROM users WHERE id = ? AND isAdmin = 1").get(userId);
    if (!admin) {
      return res.status(403).json({ error: "Admin only" });
    }

    const { applicationId, reason } = req.body;

    // 获取申请信息
    const application = db.prepare("SELECT * FROM lending_applications WHERE id = ?").get(applicationId);
    if (!application) {
      return res.status(400).json({ error: "Application not found" });
    }

    if (application.status !== 'pending') {
      return res.status(400).json({ error: "Application is not pending" });
    }

    const now = new Date().toISOString();

    // 更新申请状态
    db.prepare(`
      UPDATE lending_applications 
      SET status = 'rejected', approvedBy = ?, rejectionReason = ?, updatedAt = ?
      WHERE id = ?
    `).run(admin.id, reason || '', now, applicationId);

    console.log(`[Lending] Admin ${admin.username} rejected lending for ${application.username}: $${application.amount}. Reason: ${reason}`);

    res.json({
      success: true,
      message: "Lending application rejected",
      applicationId,
      username: application.username,
      reason: reason || ''
    });
  } catch (error) {
    console.error("Error rejecting lending:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 管理员：获取所有借贷产品
 * GET /api/admin/lending/products
 */
app.get("/api/admin/lending/products", (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const userId = verifyToken(token);
    
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    
    const admin = db.prepare("SELECT * FROM users WHERE id = ? AND isAdmin = 1").get(userId);
    if (!admin) {
      return res.status(403).json({ success: false, error: "Admin access required" });
    }
    
    const products = db.prepare("SELECT * FROM lending_products ORDER BY createdAt DESC").all();
    
    res.json({
      success: true,
      data: products,
      message: "Lending products retrieved successfully"
    });
  } catch (error) {
    console.error("Error fetching lending products:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 管理员：创建借贷产品
 * POST /api/admin/lending/products
 */
app.post("/api/admin/lending/products", (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const userId = verifyToken(token);
    
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    
    const admin = db.prepare("SELECT * FROM users WHERE id = ? AND isAdmin = 1").get(userId);
    if (!admin) {
      return res.status(403).json({ success: false, error: "Admin access required" });
    }
    
    const { name, description, minAmount, maxAmount, rate, term } = req.body;
    
    if (!name || minAmount === undefined || maxAmount === undefined || rate === undefined || term === undefined) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }
    
    const id = Date.now().toString();
    const now = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO lending_products (id, name, description, minAmount, maxAmount, rate, term, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, description, minAmount, maxAmount, rate, term, now, now);
    
    const product = db.prepare("SELECT * FROM lending_products WHERE id = ?").get(id);
    
    res.json({
      success: true,
      data: product,
      message: "Lending product created successfully"
    });
  } catch (error) {
    console.error("Error creating lending product:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 管理员：更新借贷产品
 * PUT /api/admin/lending/products/:id
 */
app.put("/api/admin/lending/products/:id", (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const userId = verifyToken(token);
    
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    
    const admin = db.prepare("SELECT * FROM users WHERE id = ? AND isAdmin = 1").get(userId);
    if (!admin) {
      return res.status(403).json({ success: false, error: "Admin access required" });
    }
    
    const { id } = req.params;
    const { name, description, minAmount, maxAmount, rate, term, enabled } = req.body;
    
    const product = db.prepare("SELECT * FROM lending_products WHERE id = ?").get(id);
    if (!product) {
      return res.status(404).json({ success: false, error: "Product not found" });
    }
    
    const now = new Date().toISOString();
    
    db.prepare(`
      UPDATE lending_products 
      SET name = ?, description = ?, minAmount = ?, maxAmount = ?, rate = ?, term = ?, enabled = ?, updatedAt = ?
      WHERE id = ?
    `).run(
      name || product.name,
      description !== undefined ? description : product.description,
      minAmount !== undefined ? minAmount : product.minAmount,
      maxAmount !== undefined ? maxAmount : product.maxAmount,
      rate !== undefined ? rate : product.rate,
      term !== undefined ? term : product.term,
      enabled !== undefined ? enabled : product.enabled,
      now,
      id
    );
    
    const updatedProduct = db.prepare("SELECT * FROM lending_products WHERE id = ?").get(id);
    
    res.json({
      success: true,
      data: updatedProduct,
      message: "Lending product updated successfully"
    });
  } catch (error) {
    console.error("Error updating lending product:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 管理员：删除借贷产品
 * DELETE /api/admin/lending/products/:id
 */
app.delete("/api/admin/lending/products/:id", (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const userId = verifyToken(token);
    
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    
    const admin = db.prepare("SELECT * FROM users WHERE id = ? AND isAdmin = 1").get(userId);
    if (!admin) {
      return res.status(403).json({ success: false, error: "Admin access required" });
    }
    
    const { id } = req.params;
    
    const product = db.prepare("SELECT * FROM lending_products WHERE id = ?").get(id);
    if (!product) {
      return res.status(404).json({ success: false, error: "Product not found" });
    }
    
    db.prepare("DELETE FROM lending_products WHERE id = ?").run(id);
    
    res.json({
      success: true,
      message: "Lending product deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting lending product:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 用户：获取可用的借贷产品
 * GET /api/lending/products
 */
app.get("/api/lending/products", (req, res) => {
  try {
    const products = db.prepare("SELECT * FROM lending_products WHERE enabled = 1 ORDER BY createdAt DESC").all();
    
    res.json({
      success: true,
      data: products,
      message: "Lending products retrieved successfully"
    });
  } catch (error) {
    console.error("Error fetching lending products:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 用户：提交币种兑换
 * POST /api/exchange/submit
 */
app.post("/api/exchange/submit", (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const userId = verifyToken(token);
    
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const { fromCoin, toCoin, fromAmount, toAmount, exchangeRate, notes } = req.body;
    
    if (!fromCoin || !toCoin || !fromAmount || !toAmount || !exchangeRate) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const id = "ex_" + Date.now();
    const now = new Date().toISOString();
    const fee = fromAmount * 0.002; // 0.2% 手续费
    
    db.prepare(`
      INSERT INTO exchange_orders (id, userId, username, fromCoin, toCoin, fromAmount, toAmount, exchangeRate, fee, status, notes, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, user.username, fromCoin, toCoin, fromAmount, toAmount, exchangeRate, fee, 'completed', notes || '', now, now);

    // 更新用户资产（扣除fromCoin，增加toCoin）
    const assets = db.prepare("SELECT balances FROM user_assets WHERE userId = ?").get(userId);
    let balances = assets ? JSON.parse(assets.balances) : {};
    
    balances[fromCoin] = (balances[fromCoin] || 0) - fromAmount;
    balances[toCoin] = (balances[toCoin] || 0) + toAmount;
    
    db.prepare("UPDATE user_assets SET balances = ?, updatedAt = ? WHERE userId = ?").run(
      JSON.stringify(balances),
      now,
      userId
    );

    res.json({
      success: true,
      data: {
        id,
        fromCoin,
        toCoin,
        fromAmount,
        toAmount,
        exchangeRate,
        fee,
        status: 'completed',
        createdAt: now
      },
      message: "Exchange submitted successfully",
      newBalance: balances
    });
  } catch (error) {
    console.error("Error submitting exchange:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 用户：获取我的兑换记录
 * GET /api/exchange/myrecords
 */
app.get("/api/exchange/myrecords", (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const userId = verifyToken(token);
    
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const records = db.prepare(`
      SELECT * FROM exchange_orders 
      WHERE userId = ? 
      ORDER BY createdAt DESC
    `).all(userId);

    res.json({
      success: true,
      data: records,
      message: "Exchange records retrieved successfully"
    });
  } catch (error) {
    console.error("Error fetching exchange records:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 后台：获取所有用户兑换记录
 * GET /api/admin/exchange/records
 */
app.get("/api/admin/exchange/records", (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const userId = verifyToken(token);
    
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const admin = db.prepare("SELECT * FROM users WHERE id = ? AND isAdmin = 1").get(userId);
    if (!admin) {
      return res.status(403).json({ success: false, error: "Admin access required" });
    }

    const records = db.prepare(`
      SELECT * FROM exchange_orders 
      ORDER BY createdAt DESC
    `).all();

    res.json({
      success: true,
      data: records,
      message: "All exchange records retrieved successfully"
    });
  } catch (error) {
    console.error("Error fetching admin exchange records:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 后台：获取特定用户的兑换记录
 * GET /api/admin/exchange/user/:userId
 */
app.get("/api/admin/exchange/user/:userId", (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const adminId = verifyToken(token);
    
    if (!adminId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const admin = db.prepare("SELECT * FROM users WHERE id = ? AND isAdmin = 1").get(adminId);
    if (!admin) {
      return res.status(403).json({ success: false, error: "Admin access required" });
    }

    const { userId } = req.params;
    const records = db.prepare(`
      SELECT * FROM exchange_orders 
      WHERE userId = ? 
      ORDER BY createdAt DESC
    `).all(userId);

    const user = db.prepare("SELECT username FROM users WHERE id = ?").get(userId);

    res.json({
      success: true,
      data: records,
      user: user ? user.username : 'Unknown',
      message: "User exchange records retrieved successfully"
    });
  } catch (error) {
    console.error("Error fetching user exchange records:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 在所有 API 路由之后，添加静态文件服务器
app.use(express.static(__dirname));

// 如果没有匹配的路由，返回 404 JSON（而不是 HTML）
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Not Found' });
});

const PORT = process.env.PORT || 3000;

// 在本地或Render/生产环境中启动监听
const isProduction = process.env.NODE_ENV === 'production';
if (require.main === module || isProduction) {
  const server = app.listen(PORT, '0.0.0.0', async () => {
    try {
      await fetchRealPrices();
    } catch (err) {
      console.log('价格获取失败，使用缓存数据');
    }
    
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`\nAPI endpoints:`);
    console.log(`\n认证接口:`);
    console.log(`  POST /api/auth/register      - 用户注册`);
    console.log(`  POST /api/auth/login         - 用户登录`);
    console.log(`  GET  /api/auth/verify        - 验证 Token`);
    console.log(`  GET  /api/auth/profile       - 获取用户信息`);
    console.log(`  POST /api/auth/logout        - 用户登出`);
    console.log(`\n账户管理接口:`);
    console.log(`  POST /api/account/verification/primary - 提交主要验证`);
    console.log(`  POST /api/account/verification/advanced - 提交高级验证`);
    console.log(`  POST /api/account/change-password/:type - 修改密码`);
    console.log(`  GET  /api/account/verification-status - 获取验证状态`);
    console.log(`\n页面管理接口:`);
    console.log(`  GET  /api/pages              - 获取所有可管理的页面`);
    console.log(`  GET  /api/pages/:pageId/sections - 获取页面的所有区域`);
    console.log(`  GET  /api/pages/:pageId/section/:sectionKey - 获取特定区域内容`);
    console.log(`  PUT  /api/admin/pages/:pageId/sections/:sectionId - 更新页面区域`);
    console.log(`  POST /api/admin/pages/:pageId/sections - 创建新页面区域`);
    console.log(`  DELETE /api/admin/pages/:pageId/sections/:sectionId - 删除页面区域`);
    console.log(`\n秒合约接口:`);
    console.log(`  GET  /api/quick-contract/config - 获取秒合约配置`);
    console.log(`  POST /api/quick-contract/place - 下达秒合约订单`);
    console.log(`  GET  /api/quick-contract/orders - 获取用户订单`);
    console.log(`  POST /api/admin/quick-contract/config - 管理员配置秒合约`);
    console.log(`  GET  /api/session/:id/balance- 用户余额`);
    console.log(`\n理财产品接口:`);
    console.log(`  GET  /api/wealth/products    - 获取理财产品列表`);
    console.log(`  POST /api/wealth/purchase    - 购买理财产品`);
    console.log(`  GET  /api/wealth/orders      - 获取用户理财订单`);
    console.log(`  POST /api/wealth/redeem      - 提取理财产品`);
    console.log(`\n资产接口:`);
    console.log(`  GET  /api/assets             - 用户资产`);
    console.log(`  GET  /api/orders             - 用户订单`);
    console.log(`  GET  /api/market-detail/:pair- 市场详情`);
    console.log(`  GET  /api/market-details     - 所有市场详情`);
  });
}

// 导出给 Vercel
module.exports = app;

// ==================== 模拟市场数据 ====================
// 生成实时价格数据
const generateMockPrices = () => {
  const coins = {
    BTC: 94500 + (Math.random() - 0.5) * 1000,
    ETH: 3500 + (Math.random() - 0.5) * 100,
    SOL: 198 + (Math.random() - 0.5) * 10,
    BNB: 612 + (Math.random() - 0.5) * 20,
    XRP: 2.45 + (Math.random() - 0.5) * 0.1,
    ADA: 0.98 + (Math.random() - 0.5) * 0.05,
    DOGE: 0.38 + (Math.random() - 0.5) * 0.02,
    LTC: 188 + (Math.random() - 0.5) * 5
  };
  return coins;
};

// 生成K线数据
const generateKlineData = (symbol, timeframe = '1m') => {
  const bars = [];
  let price = { BTC: 94500, ETH: 3500, SOL: 198, BNB: 612, XRP: 2.45, ADA: 0.98, DOGE: 0.38, LTC: 188 }[symbol] || 1000;
  
  const now = Math.floor(Date.now() / 1000);
  const intervalMap = { '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '1d': 86400 };
  const interval = intervalMap[timeframe] || 60;
  
  for (let i = 50; i >= 0; i--) {
    const time = now - (i * interval);
    const change = (Math.random() - 0.5) * price * 0.02;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) * (1 + Math.random() * 0.01);
    const low = Math.min(open, close) * (1 - Math.random() * 0.01);
    const volume = 1000 + Math.random() * 5000;
    
    bars.push({
      time,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume: parseFloat(volume.toFixed(2))
    });
    
    price = close;
  }
  
  return bars;
};

// ==================== 新增API端点 ====================

/**
 * 获取实时价格
 * GET /api/prices
 */
app.get("/api/prices", (req, res) => {
  try {
    const prices = generateMockPrices();
    res.json({
      success: true,
      data: prices,
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取K线数据
 * GET /api/klines/:symbol/:timeframe
 */
app.get("/api/klines/:symbol/:timeframe", (req, res) => {
  try {
    const { symbol, timeframe } = req.params;
    const klines = generateKlineData(symbol, timeframe || '1m');
    
    res.json({
      success: true,
      symbol,
      timeframe: timeframe || '1m',
      data: klines
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取单个币种的K线数据（默认1分钟）
 * GET /api/market-klines/:symbol
 */
app.get("/api/market-klines/:symbol", (req, res) => {
  try {
    const { symbol } = req.params;
    const timeframe = req.query.timeframe || '1m';
    const klines = generateKlineData(symbol, timeframe);
    
    res.json({
      success: true,
      symbol,
      timeframe,
      data: klines
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取所有市场数据（价格 + 涨跌幅）
 * GET /api/market-all
 */
app.get("/api/market-all", (req, res) => {
  try {
    const prices = generateMockPrices();
    const marketData = {};
    
    Object.keys(prices).forEach(coin => {
      const changePercent = (Math.random() - 0.5) * 10;
      marketData[coin] = {
        price: parseFloat(prices[coin].toFixed(2)),
        change24h: parseFloat(changePercent.toFixed(2)),
        change24hPercent: parseFloat(changePercent.toFixed(2)),
        high24h: parseFloat((prices[coin] * 1.05).toFixed(2)),
        low24h: parseFloat((prices[coin] * 0.95).toFixed(2)),
        volume24h: parseFloat((Math.random() * 1000000).toFixed(2))
      };
    });
    
    res.json({
      success: true,
      data: marketData,
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 后台：获取所有现货订单
 * GET /api/admin/spot/orders
 */
app.get("/api/admin/spot/orders", (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const userId = verifyToken(token);
    
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = db.prepare("SELECT isAdmin FROM users WHERE id = ?").get(userId);
    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: "Forbidden" });
    }
    
    const orders = db.prepare(`
      SELECT * FROM spot_orders 
      ORDER BY createdAt DESC 
      LIMIT 1000
    `).all();
    
    res.json({
      success: true,
      total: orders.length,
      data: orders
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 后台：获取所有永续持仓
 * GET /api/admin/perpetual/positions
 */
app.get("/api/admin/perpetual/positions", (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const userId = verifyToken(token);
    
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = db.prepare("SELECT isAdmin FROM users WHERE id = ?").get(userId);
    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: "Forbidden" });
    }
    
    const positions = db.prepare(`
      SELECT * FROM perpetual_positions 
      ORDER BY createdAt DESC 
      LIMIT 1000
    `).all();
    
    res.json({
      success: true,
      total: positions.length,
      data: positions
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 后台：获取用户当前余额
 * GET /api/admin/user-balance/:userId
 */
app.get("/api/admin/user-balance/:userId", (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const currentUserId = verifyToken(token);
    
    if (!currentUserId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = db.prepare("SELECT isAdmin FROM users WHERE id = ?").get(currentUserId);
    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: "Forbidden" });
    }
    
    const { userId } = req.params;
    const asset = db.prepare("SELECT balances FROM user_assets WHERE userId = ?").get(userId);
    if (!asset) {
      return res.status(404).json({ error: "User not found" });
    }
    
    const balances = JSON.parse(asset.balances || '{}');
    res.json({
      success: true,
      userId,
      balances
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 后台：手动调整用户余额
 * POST /api/admin/adjust-balance
 */
app.post("/api/admin/adjust-balance", (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const currentUserId = verifyToken(token);
    
    if (!currentUserId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = db.prepare("SELECT isAdmin FROM users WHERE id = ?").get(currentUserId);
    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: "Forbidden" });
    }
    
    const { userId, coin, amount, type } = req.body; // type: 'add' | 'subtract'
    if (!userId || !coin || amount === undefined || !type) {
      return res.status(400).json({ error: "Missing parameters" });
    }
    
    const asset = db.prepare("SELECT balances FROM user_assets WHERE userId = ?").get(userId);
    if (!asset) {
      return res.status(404).json({ error: "User not found" });
    }
    
    const balances = JSON.parse(asset.balances || '{}');
    balances[coin] = balances[coin] || 0;
    
    if (type === 'add') {
      balances[coin] += parseFloat(amount);
    } else if (type === 'subtract') {
      balances[coin] -= parseFloat(amount);
    }
    
    db.prepare("UPDATE user_assets SET balances = ?, updatedAt = ? WHERE userId = ?")
      .run(JSON.stringify(balances), new Date().toISOString(), userId);
    
    res.json({
      success: true,
      message: `Successfully ${type === 'add' ? 'added' : 'subtracted'} ${amount} ${coin}`,
      balances
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===================== 管理员登录接口 =====================
app.post("/api/auth/admin-login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: "用户名和密码不能为空" });
  }

  try {
    // 检查管理员账号（演示账号：admin/admin123）
    const isValidAdmin = (username === 'admin' && password === 'admin123');
    
    if (!isValidAdmin) {
      return res.status(401).json({ success: false, message: "管理员用户名或密码不正确" });
    }

    // 生成管理员token
    const adminToken = jwt.sign({ id: 'admin', isAdmin: true }, JWT_SECRET, { expiresIn: '24h' });

    res.json({
      success: true,
      message: "登录成功",
      token: adminToken,
      user: {
        id: 'admin',
        username: 'admin',
        isAdmin: true
      }
    });
  } catch (err) {
    console.error("Admin login error:", err);
    res.status(500).json({ success: false, message: "服务器错误" });
  }
});

// ===================== 管理员统计接口 =====================
app.get("/api/admin/stats", (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "未授权" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.isAdmin) {
      return res.status(403).json({ success: false, message: "没有权限" });
    }

    const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
    const totalOrders = db.prepare("SELECT COUNT(*) as count FROM quick_contract_orders").get().count;
    const pendingVerifications = db.prepare("SELECT COUNT(*) as count FROM account_verification WHERE status = 'pending'").get().count;

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalOrders,
        pendingVerifications,
        totalRevenue: '10000'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===================== 获取所有用户 =====================
app.get("/api/admin/users", (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "未授权" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.isAdmin) {
      return res.status(403).json({ success: false, message: "没有权限" });
    }

    const users = db.prepare("SELECT id, username, email, phone, createdAt FROM users LIMIT 100").all();
    
    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===================== 获取所有订单 =====================
app.get("/api/admin/quick-contract/orders", (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "未授权" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.isAdmin) {
      return res.status(403).json({ success: false, message: "没有权限" });
    }

    const orders = db.prepare(`
      SELECT qco.*, u.username 
      FROM quick_contract_orders qco
      JOIN users u ON qco.user_id = u.id
      ORDER BY qco.created_at DESC
      LIMIT 100
    `).all();
    
    res.json({
      success: true,
      data: orders.map(order => ({
        id: order.id,
        username: order.username,
        amount: order.amount,
        direction: order.direction,
        period: order.period,
        status: order.status,
        profit: order.profit,
        createdAt: order.created_at
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===================== 身份验证管理 =====================
app.get("/api/admin/verifications", (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "未授权" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.isAdmin) {
      return res.status(403).json({ success: false, message: "没有权限" });
    }

    const verifications = db.prepare(`
      SELECT av.*, u.username
      FROM account_verification av
      JOIN users u ON av.user_id = u.id
      ORDER BY av.submitted_at DESC
    `).all();
    
    res.json({
      success: true,
      data: verifications.map(v => ({
        id: v.id,
        username: v.username,
        type: v.verification_type,
        status: v.status,
        submittedAt: v.submitted_at
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===================== 内容管理接口 =====================
app.get("/api/admin/content", (req, res) => {
  try {
    const content = db.prepare("SELECT * FROM site_content LIMIT 1").get();
    res.json({
      success: true,
      data: content || {
        homeTitle: 'FoxPro Exchange',
        homeDesc: '专业的数字资产交易平台',
        aboutContent: '...'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/admin/content", (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "未授权" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.isAdmin) {
      return res.status(403).json({ success: false, message: "没有权限" });
    }

    const { homeTitle, homeDesc, aboutContent } = req.body;

    // 初始化表（如果不存在）
    try {
      db.prepare(`
        CREATE TABLE IF NOT EXISTS site_content (
          id INTEGER PRIMARY KEY,
          homeTitle TEXT,
          homeDesc TEXT,
          aboutContent TEXT,
          updatedAt DATETIME
        )
      `).run();
    } catch (e) {}

    const existing = db.prepare("SELECT * FROM site_content LIMIT 1").get();
    
    if (existing) {
      db.prepare("UPDATE site_content SET homeTitle = ?, homeDesc = ?, aboutContent = ?, updatedAt = ?")
        .run(homeTitle, homeDesc, aboutContent, new Date().toISOString());
    } else {
      db.prepare("INSERT INTO site_content (homeTitle, homeDesc, aboutContent, updatedAt) VALUES (?, ?, ?, ?)")
        .run(homeTitle, homeDesc, aboutContent, new Date().toISOString());
    }

    res.json({
      success: true,
      message: "内容已保存"
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===================== 系统设置接口 =====================
app.post("/api/admin/settings", (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "未授权" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.isAdmin) {
      return res.status(403).json({ success: false, message: "没有权限" });
    }

    res.json({
      success: true,
      message: "设置已保存"
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===================== 页面管理接口 =====================

/**
 * GET /api/admin/pages/:pageId
 * 获取页面内容
 */
app.get("/api/admin/pages/:pageId", (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "未授权" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.isAdmin) {
      return res.status(403).json({ success: false, message: "没有权限" });
    }

    const { pageId } = req.params;

    // 初始化表
    try {
      db.prepare(`
        CREATE TABLE IF NOT EXISTS page_contents (
          id INTEGER PRIMARY KEY,
          pageId TEXT UNIQUE,
          heading TEXT,
          description TEXT,
          content TEXT,
          buttons TEXT,
          themeColor TEXT DEFAULT '#3b82f6',
          status TEXT DEFAULT 'active',
          seoKeywords TEXT,
          seoDescription TEXT,
          updatedAt DATETIME
        )
      `).run();
    } catch (e) {}

    const pageContent = db.prepare("SELECT * FROM page_contents WHERE pageId = ?").get(pageId);

    if (pageContent) {
      // 解析JSON字段
      const parsed = {
        ...pageContent,
        buttons: pageContent.buttons ? JSON.parse(pageContent.buttons) : {}
      };
      res.json({ success: true, data: parsed });
    } else {
      res.json({ success: true, data: null });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/pages/:pageId
 * 保存页面内容
 */
app.post("/api/admin/pages/:pageId", (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "未授权" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.isAdmin) {
      return res.status(403).json({ success: false, message: "没有权限" });
    }

    const { pageId } = req.params;
    const { heading, description, content, buttons, themeColor, status, seoKeywords, seoDescription } = req.body;

    // 初始化表
    try {
      db.prepare(`
        CREATE TABLE IF NOT EXISTS page_contents (
          id INTEGER PRIMARY KEY,
          pageId TEXT UNIQUE,
          heading TEXT,
          description TEXT,
          content TEXT,
          buttons TEXT,
          themeColor TEXT DEFAULT '#3b82f6',
          status TEXT DEFAULT 'active',
          seoKeywords TEXT,
          seoDescription TEXT,
          updatedAt DATETIME
        )
      `).run();
    } catch (e) {}

    const existing = db.prepare("SELECT * FROM page_contents WHERE pageId = ?").get(pageId);
    const now = new Date().toISOString();
    const buttonsJson = buttons ? JSON.stringify(buttons) : null;

    if (existing) {
      db.prepare(`
        UPDATE page_contents 
        SET heading = ?, description = ?, content = ?, buttons = ?, 
            themeColor = ?, status = ?, seoKeywords = ?, seoDescription = ?, updatedAt = ?
        WHERE pageId = ?
      `).run(heading, description, content, buttonsJson, themeColor, status, seoKeywords, seoDescription, now, pageId);
    } else {
      db.prepare(`
        INSERT INTO page_contents 
        (pageId, heading, description, content, buttons, themeColor, status, seoKeywords, seoDescription, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(pageId, heading, description, content, buttonsJson, themeColor, status, seoKeywords, seoDescription, now);
    }

    res.json({ success: true, message: "页面内容已保存" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/admin/pages/:pageId
 * 删除页面内容
 */
app.delete("/api/admin/pages/:pageId", (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "未授权" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.isAdmin) {
      return res.status(403).json({ success: false, message: "没有权限" });
    }

    const { pageId } = req.params;

    db.prepare("DELETE FROM page_contents WHERE pageId = ?").run(pageId);

    res.json({ success: true, message: "页面内容已删除" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/pages
 * 获取所有页面内容列表
 */
app.get("/api/admin/pages", (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "未授权" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.isAdmin) {
      return res.status(403).json({ success: false, message: "没有权限" });
    }

    // 初始化表
    try {
      db.prepare(`
        CREATE TABLE IF NOT EXISTS page_contents (
          id INTEGER PRIMARY KEY,
          pageId TEXT UNIQUE,
          heading TEXT,
          description TEXT,
          content TEXT,
          buttons TEXT,
          themeColor TEXT DEFAULT '#3b82f6',
          status TEXT DEFAULT 'active',
          seoKeywords TEXT,
          seoDescription TEXT,
          updatedAt DATETIME
        )
      `).run();
    } catch (e) {}

    const pages = db.prepare("SELECT pageId, heading, status, updatedAt FROM page_contents ORDER BY updatedAt DESC").all();

    res.json({ success: true, data: pages });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
