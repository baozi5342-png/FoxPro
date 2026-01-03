const http = require('http');

function postJSON(path, data) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = http.request(options, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getJSON(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'GET'
    };
    const req = http.request(options, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  try {
    console.log('Registering test user...');
    const payload = JSON.stringify({ username: 'live_user', email: 'live@example.com', password: 'pass123', phone: '13800000003' });
    const reg = await postJSON('/api/auth/register', payload);
    console.log('Register response:', reg.statusCode, reg.body);

    // Give server a moment to save
    await new Promise(r => setTimeout(r, 500));

    console.log('\nQuerying admin users...');
    const users = await getJSON('/api/admin/users');
    console.log('Users response:', users.statusCode, users.body);
  } catch (e) {
    console.error('API test error:', e && e.message ? e.message : e);
  }
})();
