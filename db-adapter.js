// 数据库适配层 - 使用sql.js替代better-sqlite3
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

let db = null;

// 初始化数据库
async function initDatabase() {
  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, 'foxpro.db');
  
  // 尝试加载现有数据库文件
  let data = null;
  if (fs.existsSync(dbPath)) {
    try {
      data = fs.readFileSync(dbPath);
    } catch (err) {
      console.log('无法读取数据库文件，创建新数据库');
    }
  }
  
  db = new SQL.Database(data);
  
  // 自动保存功能
  const autoSave = () => {
    try {
      const data = db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(dbPath, buffer);
    } catch (err) {
      console.error('保存数据库失败:', err.message);
    }
  };
  
  // 每秒保存一次
  setInterval(autoSave, 1000);
  
  return db;
}

// 包装类以兼容better-sqlite3 API
class Database {
  constructor(filePath) {
    // 实际初始化会在initDatabase中进行
  }
  
  prepare(sql) {
    return new Statement(db, sql);
  }
  
  exec(sql) {
    try {
      db.run(sql);
    } catch (err) {
      console.error('执行SQL失败:', sql, err);
    }
  }
  
  pragma(pragma) {
    // sql.js不需要pragma设置
  }
}

class Statement {
  constructor(database, sql) {
    this.db = database;
    this.sql = sql;
  }
  
  run(...params) {
    try {
      this.db.run(this.sql, params);
      return { changes: this.db.getRowsModified() };
    } catch (err) {
      console.error('运行SQL失败:', this.sql, err);
      throw err;
    }
  }
  
  get(...params) {
    try {
      const result = this.db.exec(this.sql, params);
      if (result && result[0]) {
        const columns = result[0].columns;
        const values = result[0].values[0];
        const row = {};
        columns.forEach((col, i) => {
          row[col] = values[i];
        });
        return row;
      }
      return null;
    } catch (err) {
      console.error('查询单行失败:', this.sql, err);
      throw err;
    }
  }
  
  all(...params) {
    try {
      const result = this.db.exec(this.sql, params);
      if (result && result[0]) {
        const columns = result[0].columns;
        return result[0].values.map(values => {
          const row = {};
          columns.forEach((col, i) => {
            row[col] = values[i];
          });
          return row;
        });
      }
      return [];
    } catch (err) {
      console.error('查询多行失败:', this.sql, err);
      throw err;
    }
  }
}

module.exports = {
  Database,
  initDatabase
};
