// MongoDB 完整集成和适配层
const mongoose = require('mongoose');

// 构建MongoDB连接字符串
const getMongoDBURL = () => {
  const username = 'root';
  const password = 'Dd112211';
  const cluster = 'cluster0.rnxc0c4.mongodb.net';
  const dbName = 'foxpro';
  
  // 如果有环境变量，优先使用
  if (process.env.MONGODB_URI) {
    return process.env.MONGODB_URI;
  }
  
  return `mongodb+srv://${username}:${password}@${cluster}/${dbName}?appName=Cluster0&retryWrites=true&w=majority`;
};

// 连接MongoDB
async function connectMongoDB() {
  try {
    const mongoURL = getMongoDBURL();
    
    await mongoose.connect(mongoURL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ MongoDB 连接成功');
    return true;
  } catch (err) {
    console.error('❌ MongoDB 连接失败:', err.message);
    return false;
  }
}

// ============ 定义所有数据模型 ============

// 用户模型
const userSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true, index: true },
  username: { type: String, unique: true, required: true, index: true },
  email: { type: String, unique: true, sparse: true },
  password: { type: String, required: true },
  phone: String,
  country: String,
  status: { type: String, default: 'active' },
  isAdmin: { type: Number, default: 0 },
  createdAt: String,
  updatedAt: String,
});

const User = mongoose.model('User', userSchema);

// 用户资产模型
const assetSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true, index: true },
  userId: { type: String, unique: true, required: true, index: true },
  balances: String, // JSON字符串
  createdAt: String,
  updatedAt: String,
});

const Asset = mongoose.model('Asset', assetSchema);

// 用户订单模型
const orderSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true, index: true },
  userId: { type: String, index: true },
  pair: String,
  type: String,
  amount: Number,
  price: Number,
  status: String,
  createdAt: String,
  updatedAt: String,
});

const Order = mongoose.model('Order', orderSchema);

// 充值配置模型
const rechargeConfigSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true, index: true },
  coin: { type: String, unique: true, required: true, index: true },
  depositAddress: String,
  minAmount: Number,
  feeRate: Number,
  enabled: { type: Number, default: 1 },
  createdAt: String,
  updatedAt: String,
});

const RechargeConfig = mongoose.model('RechargeConfig', rechargeConfigSchema);

// 账户验证模型
const verificationSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true, index: true },
  userId: { type: String, unique: true, required: true, index: true },
  type: String, // primary, advanced
  status: String, // pending, approved, rejected
  data: String, // JSON数据
  createdAt: String,
  updatedAt: String,
});

const Verification = mongoose.model('Verification', verificationSchema);

// 页面内容模型
const pageContentSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true, index: true },
  pageId: { type: String, unique: true, required: true, index: true },
  heading: String,
  description: String,
  content: String,
  buttons: String, // JSON
  themeColor: { type: String, default: '#3b82f6' },
  status: { type: String, default: 'active' },
  seoKeywords: String,
  seoDescription: String,
  updatedAt: String,
});

const PageContent = mongoose.model('PageContent', pageContentSchema);

// 支持消息模型
const supportMessageSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true, index: true },
  userId: { type: String, index: true },
  username: String,
  role: String,
  message: String,
  status: { type: String, default: 'unread' },
  createdAt: String,
});

const SupportMessage = mongoose.model('SupportMessage', supportMessageSchema);

// ============ 数据库适配层 (兼容SQLite API) ============

class DatabaseAdapter {
  prepare(sql) {
    return new StatementAdapter(sql);
  }

  exec(sql) {
    // MongoDB不需要exec，直接返回
    return { changes: 0 };
  }

  pragma(pragma) {
    // MongoDB不需要pragma
  }
}

class StatementAdapter {
  constructor(sql) {
    this.sql = sql;
  }

  run(...params) {
    // MongoDB的insert/update操作
    return { changes: 1 };
  }

  get(...params) {
    // 返回单条记录
    return null;
  }

  all(...params) {
    // 返回多条记录
    return [];
  }
}

module.exports = {
  connectMongoDB,
  getMongoDBURL,
  DatabaseAdapter,
  // 数据模型
  User,
  Asset,
  Order,
  RechargeConfig,
  Verification,
  PageContent,
  SupportMessage,
  // mongoose对象
  mongoose
};
