const path = require('path');
const fs = require('fs');
let DB = null;
let AVAILABLE = false;

function init(dbPath) {
  try {
    // lazy require; if missing, return false silently
    let Database;
    try { Database = require('better-sqlite3'); } catch (e) { AVAILABLE = false; return false; }
    const fullPath = dbPath || path.join(__dirname, '..', '..', 'data', 'foxpro.db');
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    DB = new Database(fullPath);

    // create tables if not exist
    DB.prepare(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      username TEXT,
      email TEXT,
      phone TEXT,
      password TEXT,
      data TEXT
    )`).run();

    DB.prepare(`CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY,
      userId INTEGER,
      symbol TEXT,
      side TEXT,
      type TEXT,
      price REAL,
      amount REAL,
      remaining REAL,
      status TEXT,
      created_at TEXT,
      data TEXT
    )`).run();

    DB.prepare(`CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY,
      symbol TEXT,
      price REAL,
      amount REAL,
      takerOrderId INTEGER,
      makerOrderId INTEGER,
      takerSide TEXT,
      timestamp TEXT,
      data TEXT
    )`).run();

    DB.prepare(`CREATE TABLE IF NOT EXISTS markets (
      symbol TEXT PRIMARY KEY,
      status TEXT,
      minQty REAL,
      pricePrecision INTEGER,
      created_at TEXT,
      updated_at TEXT,
      data TEXT
    )`).run();

    AVAILABLE = true;
    return true;
  } catch (err) {
    DB = null;
    AVAILABLE = false;
    return false;
  }
}

function close() {
  try { if (DB) DB.close(); } catch (e) {}
}

function available() { return AVAILABLE && DB; }

function insertOrUpdateUser(user) {
  if (!DB) return false;
  const existing = DB.prepare('SELECT id FROM users WHERE id = ?').get(user.id);
  const data = JSON.stringify(user);
  if (existing) {
    DB.prepare('UPDATE users SET username = ?, email = ?, phone = ?, password = ?, data = ? WHERE id = ?')
      .run(user.username, user.email, user.phone, user.password || null, data, user.id);
  } else {
    DB.prepare('INSERT INTO users (id, username, email, phone, password, data) VALUES (?,?,?,?,?,?)')
      .run(user.id, user.username, user.email, user.phone, user.password || null, data);
  }
  return true;
}

function insertOrder(order) {
  if (!DB) return false;
  DB.prepare('INSERT OR REPLACE INTO orders (id, userId, symbol, side, type, price, amount, remaining, status, created_at, data) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .run(order.id, order.userId || null, order.symbol || null, order.side || null, order.type || null, order.price || null, order.amount || null, order.remaining || null, order.status || 'open', order.created_at || new Date().toISOString(), JSON.stringify(order));
  return true;
}

function insertTrade(trade) {
  if (!DB) return false;
  DB.prepare('INSERT INTO trades (id, symbol, price, amount, takerOrderId, makerOrderId, takerSide, timestamp, data) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(trade.id, trade.symbol, trade.price, trade.amount, trade.takerOrderId, trade.makerOrderId, trade.takerSide, trade.timestamp || new Date().toISOString(), JSON.stringify(trade));
  return true;
}

function insertOrUpdateMarket(m) {
  if (!DB) return false;
  const now = new Date().toISOString();
  const existing = DB.prepare('SELECT symbol FROM markets WHERE symbol = ?').get(m.symbol);
  const data = JSON.stringify(m || {});
  if (existing) {
    DB.prepare('UPDATE markets SET status = ?, minQty = ?, pricePrecision = ?, updated_at = ?, data = ? WHERE symbol = ?')
      .run(m.status || null, m.minQty != null ? m.minQty : null, m.pricePrecision != null ? m.pricePrecision : null, now, data, m.symbol);
  } else {
    DB.prepare('INSERT INTO markets (symbol, status, minQty, pricePrecision, created_at, updated_at, data) VALUES (?,?,?,?,?,?,?)')
      .run(m.symbol, m.status || null, m.minQty != null ? m.minQty : null, m.pricePrecision != null ? m.pricePrecision : null, now, now, data);
  }
  return true;
}

function loadAll() {
  if (!DB) return null;
  const users = DB.prepare('SELECT data FROM users').all().map(r => JSON.parse(r.data));
  const orders = DB.prepare('SELECT data FROM orders').all().map(r => JSON.parse(r.data));
  const trades = DB.prepare('SELECT data FROM trades').all().map(r => JSON.parse(r.data));
  const markets = DB.prepare('SELECT data FROM markets').all().map(r => JSON.parse(r.data));
  return { users, orders, trades };
}

module.exports = { init, close, available, insertOrUpdateUser, insertOrder, insertTrade, insertOrUpdateMarket, loadAll };
