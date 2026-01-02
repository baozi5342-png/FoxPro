// 临时内存数据库（用于快速部署）
class MemoryDB {
  constructor() {
    this.data = {
      users: [],
      assets: [],
      orders: [],
      configs: []
    };
  }

  prepare(sql) {
    return {
      run: (...args) => ({ changes: 1 }),
      get: (...args) => null,
      all: (...args) => []
    };
  }

  exec(sql) {}
  pragma(p) {}
}

module.exports = MemoryDB;
