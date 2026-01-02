// 市场行情模型
const mongoose = require('mongoose');

const marketSchema = new mongoose.Schema({
  symbol: { type: String, unique: true, required: true }, // BTC, ETH 等
  name: String,
  currentPrice: { type: Number, required: true },
  priceChange24h: { type: Number, default: 0 }, // 24h 涨跌
  priceChangePercent24h: { type: Number, default: 0 }, // 24h 涨跌百分比
  high24h: Number,
  low24h: Number,
  volume24h: Number, // 24h 交易量
  marketCap: Number,
  circulatingSupply: Number,
  totalSupply: Number,
  rank: Number, // 排名
  lastUpdate: { type: Date, default: Date.now },
  updatedAt: Date
}, { collection: 'markets' });

const Market = mongoose.model('Market', marketSchema);
module.exports = Market;
