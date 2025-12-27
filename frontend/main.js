// main.js - Future interactive features

// Example: Changing the active state of navigation items
const navItems = document.querySelectorAll('.nav-item');
navItems.forEach(item => {
  item.addEventListener('click', function() {
    navItems.forEach(nav => nav.classList.remove('active'));
    this.classList.add('active');
  });
});

// Example: Switching asset tabs
const tabButtons = document.querySelectorAll('.tab-button');
const assetDetails = document.querySelector('.asset-details');

tabButtons.forEach(button => {
  button.addEventListener('click', function() {
    // Toggle active class
    tabButtons.forEach(tab => tab.classList.remove('active'));
    this.classList.add('active');

    // Change the asset details based on the selected tab
    if (this.id === 'platform-assets') {
      assetDetails.innerHTML = `<h3>Platform Assets</h3>
      <ul>
        <li>BTC: 2.5</li>
        <li>ETH: 10.0</li>
        <li>USDT: 50,000</li>
      </ul>`;
    } else if (this.id === 'investment-assets') {
      assetDetails.innerHTML = `<h3>Investment Assets</h3>
      <ul>
        <li>DeFi Fund: $50,000</li>
        <li>Loan Fund: $20,000</li>
      </ul>`;
    } else if (this.id === 'contract-assets') {
      assetDetails.innerHTML = `<h3>Contract Assets</h3>
      <ul>
        <li>BTC Margin: 0.5</li>
        <li>ETH Margin: 2.0</li>
      </ul>`;
    }
  });
});
