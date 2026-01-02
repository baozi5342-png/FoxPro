// MongoDB 数据库初始化和配置
const mongoose = require('mongoose');

// 获取MongoDB连接URL
const getMongoURL = () => {
  // 从环境变量读取，或使用默认值
  const mongoURL = process.env.MONGODB_URI || 'mongodb+srv://<db_username>:<db_password>@cluster0.rnxc0c4.mongodb.net/foxpro?appName=Cluster0';
  return mongoURL;
};

// 连接到MongoDB
async function connectDB() {
  try {
    const mongoURL = getMongoURL();
    
    // 检查是否还有占位符
    if (mongoURL.includes('<db_username>')) {
      console.warn('⚠️  警告: MongoDB连接字符串中还有占位符，请设置MONGODB_URI环境变量');
      console.warn('使用本地数据（数据将不会持久化）');
      return null;
    }

    await mongoose.connect(mongoURL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ MongoDB连接成功');
    return mongoose.connection;
  } catch (err) {
    console.error('❌ MongoDB连接失败:', err.message);
    console.warn('应用将以本地内存模式运行（数据不持久化）');
    return null;
  }
}

// 定义用户模型
const userSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  username: { type: String, unique: true, required: true },
  email: { type: String, unique: true },
  password: { type: String, required: true },
  phone: String,
  country: String,
  status: { type: String, default: 'active' },
  isAdmin: { type: Number, default: 0 },
  createdAt: String,
  updatedAt: String,
});

const User = mongoose.model('User', userSchema);

// 定义资产模型
const assetSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  userId: { type: String, unique: true, required: true },
  balances: String, // JSON字符串
  createdAt: String,
  updatedAt: String,
});

const Asset = mongoose.model('Asset', assetSchema);

// 定义订单模型
const orderSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  userId: String,
  pair: String,
  type: String,
  amount: Number,
  price: Number,
  status: String,
  createdAt: String,
  updatedAt: String,
});

const Order = mongoose.model('Order', orderSchema);

// 定义充值配置模型
const rechargeConfigSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  coin: { type: String, unique: true, required: true },
  depositAddress: String,
  minAmount: Number,
  feeRate: Number,
  enabled: { type: Number, default: 1 },
  createdAt: String,
  updatedAt: String,
});

const RechargeConfig = mongoose.model('RechargeConfig', rechargeConfigSchema);

module.exports = {
  connectDB,
  mongoose,
  User,
  Asset,
  Order,
  RechargeConfig,
  getMongoURL
};
