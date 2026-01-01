// Vercel Serverless Function Entry Point
// 导出 Express 应用给 Vercel

const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");
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

// 数据库路径 - 在 Vercel 中使用临时目录
const dbPath = path.join(process.env.TMPDIR || '/tmp', "foxpro.db");
let db;

try {
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
} catch (err) {
  console.error("Database initialization error:", err);
  // 创建内存数据库作为备用
  db = new Database(":memory:");
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

// 创建其他表...
// (省略完整的表创建代码，这些在原 server.js 中已有)

// ========== 认证接口 ==========

// 用户注册
app.post("/api/auth/register", (req, res) => {
  const { username, email, phone, password } = req.body;

  console.log('[Register] 接收注册请求:', { username, email, phone });

  if (!username || !email || !phone || !password) {
    console.log('[Register] 缺少必填字段');
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  try {
    const existingUser = db.prepare("SELECT * FROM users WHERE username = ?").get(username.toLowerCase());
    if (existingUser) {
      console.log('[Register] 用户名已存在:', username);
      return res.status(400).json({ success: false, message: "Username already exists" });
    }

    const existingEmail = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (existingEmail) {
      console.log('[Register] 邮箱已注册:', email);
      return res.status(400).json({ success: false, message: "Email already registered" });
    }

    const existingPhone = db.prepare("SELECT * FROM users WHERE phone = ?").get(phone);
    if (existingPhone) {
      console.log('[Register] 手机号已注册:', phone);
      return res.status(400).json({ success: false, message: "Phone number already registered" });
    }

    const userId = "user_" + String(Math.floor(100000 + Math.random() * 900000));
    const now = new Date().toISOString();

    console.log('[Register] 准备创建用户:', userId);

    db.prepare(`
      INSERT INTO users (id, username, email, password, phone, country, status, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `).run(userId, username.toLowerCase(), email, password, phone, "CN", now, now);

    console.log('[Register] 用户创建成功');

    return res.json({
      success: true,
      message: "Registration successful",
      userId: userId,
      username: username,
      email: email
    });
  } catch (error) {
    console.error('[Register] Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// 用户登录
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;

  console.log('[Login] 收到登录请求:', { username });

  if (!username || !password) {
    return res.status(400).json({ success: false, message: "Missing username or password" });
  }

  try {
    const user = db.prepare("SELECT * FROM users WHERE username = ? AND password = ?")
      .get(username.toLowerCase(), password);

    if (!user) {
      console.log('[Login] 用户或密码错误');
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const token = "token_" + Buffer.from(username).toString('base64') + "_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
    
    console.log('[Login] Token 已生成:', token.substring(0, 30) + '...');
    console.log('[Login] 登录成功，返回响应');

    return res.json({
      success: true,
      message: "登录成功",
      token: token,
      userId: user.id,
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin
    });
  } catch (error) {
    console.error('[Login] Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// 验证 Token
app.get("/api/auth/verify", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  
  if (!token) {
    return res.status(401).json({ success: false, message: "未提供 Token" });
  }

  // 简单的 Token 验证
  res.json({ success: true, message: "Token valid", token: token });
});

// 静态文件服务
app.use(express.static(path.join(__dirname, "..")));

// 404 处理
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Not Found' });
});

// 导出给 Vercel
module.exports = app;
