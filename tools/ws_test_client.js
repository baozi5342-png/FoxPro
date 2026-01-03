const WebSocket = require('ws');
const url = 'ws://localhost:3000/ws';
console.log('Connecting to', url);
const ws = new WebSocket(url);
ws.on('open', () => {
  console.log('WS open');
  ws.send(JSON.stringify({ action: 'ping' }));
});
ws.on('message', (msg) => {
  console.log('WS message:', msg.toString());
});
ws.on('close', () => {
  console.log('WS closed');
});
ws.on('error', (err) => {
  console.error('WS error:', err.message);
});
setTimeout(() => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ action: 'ping' }));
  }
}, 2000);
setTimeout(() => {
  try { ws.close(); } catch(e){}
  setTimeout(() => process.exit(0), 500);
}, 6000);
