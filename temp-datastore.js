// 临时内存数据存储（用于注册成功）
class TempDataStore {
  constructor() {
    this.users = [];
    this.assets = [];
    this.orders = [];
  }

  // 用户相关
  addUser(user) {
    // 检查用户是否已存在
    if (this.users.some(u => u.username === user.username)) {
      return { error: 'User already exists' };
    }
    this.users.push(user);
    return { success: true, id: user.id };
  }

  getUser(username) {
    return this.users.find(u => u.username === username);
  }

  getUserById(id) {
    return this.users.find(u => u.id === id);
  }

  // 资产相关
  addAsset(asset) {
    this.assets.push(asset);
    return { success: true };
  }

  getAsset(userId) {
    return this.assets.find(a => a.userId === userId);
  }

  // 订单相关
  addOrder(order) {
    this.orders.push(order);
    return { success: true };
  }

  getOrders(userId) {
    return this.orders.filter(o => o.userId === userId);
  }
}

module.exports = new TempDataStore();
