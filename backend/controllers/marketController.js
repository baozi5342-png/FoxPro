// 市场数据控制器
const Market = require('../models/Market');
const axios = require('axios');

// 获取所有市场行情
exports.getMarkets = async (req, res) => {
  try {
    let markets = await Market.find({}).sort({ rank: 1 });

    // 如果数据库为空，初始化默认数据
    if (markets.length === 0) {
      const defaultMarkets = [
        { symbol: 'BTC', name: 'Bitcoin', currentPrice: 42500, priceChangePercent24h: 2.5, rank: 1 },
        { symbol: 'ETH', name: 'Ethereum', currentPrice: 2250, priceChangePercent24h: 1.8, rank: 2 },
        { symbol: 'SOL', name: 'Solana', currentPrice: 185, priceChangePercent24h: 3.2, rank: 3 },
        { symbol: 'BNB', name: 'Binance Coin', currentPrice: 620, priceChangePercent24h: 2.1, rank: 4 },
        { symbol: 'XRP', name: 'Ripple', currentPrice: 3.15, priceChangePercent24h: 1.5, rank: 5 },
        { symbol: 'ADA', name: 'Cardano', currentPrice: 1.25, priceChangePercent24h: 2.3, rank: 6 },
        { symbol: 'DOGE', name: 'Dogecoin', currentPrice: 0.42, priceChangePercent24h: 4.2, rank: 7 },
        { symbol: 'LTC', name: 'Litecoin', currentPrice: 195, priceChangePercent24h: 1.9, rank: 8 }
      ];

      for (const market of defaultMarkets) {
        await Market.create({
          ...market,
          high24h: market.currentPrice * 1.05,
          low24h: market.currentPrice * 0.95,
          volume24h: Math.floor(Math.random() * 1000000000),
          priceChange24h: market.currentPrice * (market.priceChangePercent24h / 100),
          circulatingSupply: Math.floor(Math.random() * 1000000),
          totalSupply: Math.floor(Math.random() * 2000000),
          lastUpdate: new Date()
        });
      }

      markets = await Market.find({}).sort({ rank: 1 });
    }

    res.json({
      success: true,
      markets
    });
  } catch (error) {
    console.error('Get markets error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// 获取特定币种的价格
exports.getPrice = async (req, res) => {
  try {
    const { symbol } = req.params;

    let market = await Market.findOne({ symbol: symbol.toUpperCase() });

    if (!market) {
      // 创建默认价格
      market = await Market.create({
        symbol: symbol.toUpperCase(),
        currentPrice: Math.random() * 1000,
        priceChangePercent24h: (Math.random() - 0.5) * 10
      });
    }

    res.json({
      success: true,
      price: market.currentPrice,
      change24h: market.priceChangePercent24h
    });
  } catch (error) {
    console.error('Get price error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// 获取所有价格
exports.getAllPrices = async (req, res) => {
  try {
    const markets = await Market.find({}, 'symbol currentPrice priceChangePercent24h');

    const prices = {};
    markets.forEach(market => {
      prices[market.symbol] = {
        price: market.currentPrice,
        change: market.priceChangePercent24h
      };
    });

    res.json({
      success: true,
      prices
    });
  } catch (error) {
    console.error('Get all prices error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// 获取K线数据（模拟）
exports.getKlines = async (req, res) => {
  try {
    const { symbol } = req.params;
    const { timeframe } = req.query;

    const market = await Market.findOne({ symbol: symbol.toUpperCase() });
    if (!market) {
      return res.status(404).json({ 
        success: false, 
        message: 'Symbol not found' 
      });
    }

    // 生成模拟K线数据
    const klines = [];
    const basePrice = market.currentPrice;
    const now = Date.now();

    for (let i = 100; i > 0; i--) {
      const time = now - i * 60000; // 分钟级别
      const volatility = (Math.random() - 0.5) * basePrice * 0.05;
      const price = basePrice + volatility;

      klines.push({
        time,
        open: price - (Math.random() * basePrice * 0.02),
        high: price + (Math.random() * basePrice * 0.02),
        low: price - (Math.random() * basePrice * 0.02),
        close: price,
        volume: Math.floor(Math.random() * 1000000)
      });
    }

    res.json({
      success: true,
      symbol,
      timeframe,
      klines
    });
  } catch (error) {
    console.error('Get klines error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// 管理员 - 更新市场行情（模拟）
exports.updateMarketPrice = async (req, res) => {
  try {
    // 检查是否是管理员
    if (req.user.isAdmin !== 1 && req.user.isAdmin !== 2) {
      return res.status(403).json({ 
        success: false, 
        message: 'Admin access required' 
      });
    }

    const { symbol, price, change } = req.body;

    const market = await Market.findOne({ symbol: symbol.toUpperCase() });
    if (!market) {
      return res.status(404).json({ 
        success: false, 
        message: 'Market not found' 
      });
    }

    market.currentPrice = price;
    market.priceChangePercent24h = change;
    market.lastUpdate = new Date();
    await market.save();

    res.json({
      success: true,
      message: 'Price updated successfully',
      market
    });
  } catch (error) {
    console.error('Update market price error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};
