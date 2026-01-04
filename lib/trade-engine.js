class TradeEngine {
  constructor(data) {
    this.data = data; // shared persistent object
    this.orderBooks = {}; // symbol -> { buys: [limit orders desc], sells: [limit orders asc] }
    this.nextTradeId = (data.trades && data.trades.length) ? Math.max(...data.trades.map(t=>t.id||0))+1 : 1;
    this.nextOrderId = (data.orders && data.orders.length) ? Math.max(...data.orders.map(o=>o.id||0))+1 : 1;
  }

  _ensureBook(symbol) {
    if (!this.orderBooks[symbol]) {
      this.orderBooks[symbol] = { buys: [], sells: [] };
    }
  }

  // place order: { id?, userId, symbol, side: 'buy'|'sell', type: 'limit'|'market', price, amount }
  placeOrder(order) {
    const symbol = order.symbol;
    this._ensureBook(symbol);
    const book = this.orderBooks[symbol];
    // assign id if missing
    if (!order.id) order.id = this.nextOrderId++;

    const remaining = Number(order.amount) || 0;
    let left = remaining;
    const fills = [];

    const takeSide = order.side === 'buy' ? 'sells' : 'buys';
    const bookSide = book[takeSide];

    // match against bookSide
    if (bookSide && bookSide.length) {
      // ensure sorted: sells asc, buys desc
      const sorted = bookSide;
      let i = 0;
      while (i < sorted.length && left > 0) {
        const maker = sorted[i];
        const priceOk = (order.type === 'market') || (order.side === 'buy' ? (order.price >= maker.price) : (order.price <= maker.price));
        if (!priceOk && order.type === 'limit') break;

        const tradeAmount = Math.min(left, maker.remaining || maker.amount);
        const tradePrice = maker.price;
        const trade = {
          id: this.nextTradeId++,
          symbol,
          price: tradePrice,
          amount: tradeAmount,
          takerOrderId: order.id || null,
          makerOrderId: maker.id || null,
          takerSide: order.side,
          timestamp: new Date().toISOString()
        };
        fills.push(trade);
        left -= tradeAmount;
        maker.remaining = (maker.remaining || maker.amount) - tradeAmount;
        if ((maker.remaining || 0) <= 0) {
          // remove maker
          sorted.splice(i, 1);
        } else {
          i++;
        }
      }
    }

    // if it's a limit order and still has remaining, add to book
    let placedOrder = null;
    if (order.type === 'limit' && left > 0) {
      const newOrder = Object.assign({}, order);
      newOrder.amount = Number(order.amount) || 0;
      newOrder.remaining = left;
      // push into appropriate book and sort
      const sideArr = order.side === 'buy' ? book.buys : book.sells;
      sideArr.push(newOrder);
      if (order.side === 'buy') {
        sideArr.sort((a,b)=> (b.price - a.price));
      } else {
        sideArr.sort((a,b)=> (a.price - b.price));
      }
      placedOrder = newOrder;
    }

    // return fills and placedOrder; persistence is handled by server
    if (!this.data.trades) this.data.trades = [];
    fills.forEach(f => this.data.trades.push(f));

    // update order statuses (filled/partial)
    // Note: server will call saveData afterwards

    return { fills, placedOrder, remaining: left };
  }

  // restore open orders into internal orderBooks from persisted orders array
  restoreBooks(orders) {
    if (!Array.isArray(orders)) return;
    orders.forEach(o => {
      try {
        if (!o || o.status === 'filled' || o.status === 'cancelled') return;
        const symbol = o.symbol;
        this._ensureBook(symbol);
        const sideArr = o.side === 'buy' ? this.orderBooks[symbol].buys : this.orderBooks[symbol].sells;
        const copy = Object.assign({}, o);
        // ensure numeric fields
        copy.amount = Number(copy.amount || 0);
        copy.remaining = Number(copy.remaining != null ? copy.remaining : copy.amount);
        sideArr.push(copy);
      } catch (e) {
        // ignore malformed orders
      }
    });
    // sort books
    Object.keys(this.orderBooks).forEach(sym => {
      this.orderBooks[sym].buys.sort((a,b)=> (b.price - a.price));
      this.orderBooks[sym].sells.sort((a,b)=> (a.price - b.price));
    });
    // ensure nextOrderId is above existing ids
    const maxOrder = (orders && orders.length) ? Math.max(...orders.map(o=>o.id||0)) : 0;
    if (maxOrder >= this.nextOrderId) this.nextOrderId = maxOrder + 1;
  }

  // cancel order by id — returns true if cancelled and rolled back into book removal
  cancelOrder(orderId) {
    for (const symbol of Object.keys(this.orderBooks)) {
      const book = this.orderBooks[symbol];
      for (const side of ['buys','sells']) {
        const idx = book[side].findIndex(o => o.id == orderId);
        if (idx >= 0) {
          const removed = book[side].splice(idx,1)[0];
          // mark in shared orders
          if (this.data.orders) {
            const oi = this.data.orders.findIndex(o => o.id == orderId);
            if (oi >= 0) this.data.orders[oi].status = 'cancelled';
          }
          return removed;
        }
      }
    }
    return null;
  }

  // return a lightweight snapshot of orderbook for a symbol
  getOrderBook(symbol, depth = 20) {
    this._ensureBook(symbol);
    const book = this.orderBooks[symbol];
    // aggregate by price level
    const agg = (arr, desc) => {
      const map = new Map();
      arr.forEach(o => {
        const p = Number(o.price || 0);
        map.set(p, (map.get(p) || 0) + (Number(o.remaining != null ? o.remaining : o.amount) || 0));
      });
      const rows = Array.from(map.entries()).map(([price, size]) => ({ price, size }));
      rows.sort((a,b)=> desc ? (b.price - a.price) : (a.price - b.price));
      return rows.slice(0, depth);
    };
    return {
      symbol,
      bids: agg(book.buys || [], true),
      asks: agg(book.sells || [], false),
      ts: new Date().toISOString()
    };
  }
}

module.exports = TradeEngine;
