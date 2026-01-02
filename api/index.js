// Vercel Serverless Function Entry Point
// 在 Vercel 环境中，直接从 server.js 导出 Express app

// 由于 server.js 在末尾导出了 module.exports = app
// 我们这里直接导出它
const app = require('../server');
module.exports = app;

