// 后端配置文件
module.exports = {
  // 服务器配置
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // JWT配置
  jwt: {
    secret: process.env.JWT_SECRET || 'foxpro-secret-key-2026',
    expiresIn: '7d'
  },

  // MongoDB配置
  mongodb: {
    uri: process.env.MONGODB_URI || getDefaultMongoDBURI()
  },

  // CORS配置
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:5000', process.env.FRONTEND_URL],
    credentials: true
  },

  // 支持的币种
  supportedCoins: ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'LTC', 'USDT'],

  // 秒合约配置
  quickContract: {
    durations: [30, 60, 120],
    minAmount: 10,
    maxAmount: 10000,
    winRate: 0.70,
    fee: 0.01 // 1%
  },

  // 现货配置
  spot: {
    fee: 0.001, // 0.1%
    minOrderAmount: 10
  },

  // 合约配置
  perpetual: {
    minLeverage: 1,
    maxLeverage: 20,
    maintenanceMargin: 0.05, // 5%
    initialMargin: 0.10 // 10%
  },

  // 理财配置
  lending: {
    minAmount: 100,
    maxAmount: 1000000
  }
};

function getDefaultMongoDBURI() {
  const username = encodeURIComponent('root');
  const password = encodeURIComponent('Dd112211');
  const cluster = 'cluster0.rnxc0c4.mongodb.net';
  const dbName = 'foxpro';
  return `mongodb+srv://${username}:${password}@${cluster}/${dbName}?appName=Cluster0&retryWrites=true&w=majority`;
}
