const express = require('express');
const bodyParser = require('body-parser');
const loginRouter = require('./auth/login');
const registerRouter = require('./auth/register');
const profileRouter = require('./user/profile');
const kycRouter = require('./user/kyc');
const walletRouter = require('./wallet/balance');
const productRouter = require('./product/products');
const tradeRouter = require('./trade/orders');
const adminRouter = require('./admin');
const cmsRouter = require('./cms');

const app = express();

// Middleware
app.use(bodyParser.json());

// Routes
app.use('/api/auth', loginRouter);
app.use('/api/auth', registerRouter);
app.use('/api/user', profileRouter);
app.use('/api/user', kycRouter);
app.use('/api/wallet', walletRouter);
app.use('/api/product', productRouter);
app.use('/api/trade', tradeRouter);
app.use('/api/admin', adminRouter); // Admin routes
app.use('/api/cms', cmsRouter);     // CMS routes

// Start the server
const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
