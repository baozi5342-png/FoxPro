// main.js - Future interactive features

// Example: Changing the active state of navigation items
const navItems = document.querySelectorAll('.nav-item');
navItems.forEach(item => {
  item.addEventListener('click', function() {
    navItems.forEach(nav => nav.classList.remove('active'));
    this.classList.add('active');
  });
});

// 获取用户信息并展示
document.addEventListener('DOMContentLoaded', () => {
  fetch('/api/user/profile')
    .then(response => response.json())
    .then(data => {
      document.querySelector('.account-overview p').textContent = `Welcome, ${data.username}`;
    })
    .catch(error => console.error('Error fetching user data:', error));
});

// 获取产品列表并展示
document.addEventListener('DOMContentLoaded', () => {
  fetch('/api/product/products')
    .then(response => response.json())
    .then(data => {
      const productList = document.querySelector('.market-list ul');
      data.forEach(product => {
        const li = document.createElement('li');
        li.textContent = `${product.name} - ${product.yield}`;
        productList.appendChild(li);
      });
    })
    .catch(error => console.error('Error fetching products:', error));
});

// 提交交易订单
document.getElementById('buy-btn').addEventListener('click', () => {
  const pair = document.getElementById('pair').value;
  const direction = 'buy';
  const amount = document.getElementById('amount').value;
  const price = document.getElementById('price').value;

  fetch('/api/trade/spot', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ pair, direction, amount, price }),
  })
    .then(response => response.json())
    .then(data => {
      alert(data.message);
    })
    .catch(error => console.error('Error submitting trade order:', error));
});
