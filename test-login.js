const http = require('http');

const postData = JSON.stringify({
  username: 'newuser2026',
  password: 'test123456'
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = http.request(options, (res) => {
  console.log('HTTP Status:', res.statusCode);
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    console.log('Response:', data);
    console.log('Parsed:', JSON.stringify(JSON.parse(data), null, 2));
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
});

req.write(postData);
req.end();
