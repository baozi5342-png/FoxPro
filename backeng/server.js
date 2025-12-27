const express = require('express');
const bodyParser = require('body-parser');
const loginRouter = require('./auth/login');
const registerRouter = require('./auth/register');

const app = express();

// Middleware
app.use(bodyParser.json());

// Routes
app.use('/api/auth', loginRouter);
app.use('/api/auth', registerRouter);

// Start the server
const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
