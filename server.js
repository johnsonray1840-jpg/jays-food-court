const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

let PORT = parseInt(process.env.PORT, 10) || 3000;
const PUBLIC_DIR = __dirname;
const MENU_FILE = path.join(__dirname, 'data', 'menu.json');
const ORDERS_FILE = path.join(__dirname, 'data', 'orders.json');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function readJSON(file, fallback = []) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API 1: GET /api/menu
  if (pathname === '/api/menu' && method === 'GET') {
    const menu = readJSON(MENU_FILE);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(menu));
    return;
  }

  // API 2: POST /api/orders (Production Order Placement)
  if (pathname === '/api/orders' && method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const orderData = JSON.parse(body);
        if (!orderData.phone || !orderData.items || !orderData.items.length) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Incomplete order payload' }));
          return;
        }

        const orders = readJSON(ORDERS_FILE, []);
        const orderId = 'JFC-' + Math.floor(1000 + Math.random() * 9000);

        const newOrder = {
          id: orderId,
          createdAt: new Date().toISOString(),
          customerName: orderData.customerName || 'Guest Customer',
          phone: orderData.phone,
          address: orderData.address || 'Agbani, Enugu',
          items: orderData.items,
          subtotal: orderData.subtotal,
          discount: orderData.discount || 0,
          deliveryFee: orderData.deliveryFee || 500,
          total: orderData.total,
          paymentMode: orderData.paymentMode || 'transfer',
          status: 'confirmed',
          eta: '18 - 25 Mins',
          rider: {
            name: 'Chinedu Okafor',
            phone: '07087426626',
            rating: '4.9 ★'
          }
        };

        orders.unshift(newOrder);
        writeJSON(ORDERS_FILE, orders);

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, order: newOrder }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      }
    });
    return;
  }

  // API 3: GET /api/orders/:id (Live Tracking Endpoint)
  if (pathname.startsWith('/api/orders/') && !pathname.endsWith('/status') && method === 'GET') {
    const orderId = pathname.replace('/api/orders/', '').trim().toUpperCase();
    const orders = readJSON(ORDERS_FILE, []);
    const found = orders.find(o => o.id === orderId);

    if (found) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(found));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Order not found' }));
    }
    return;
  }

  // API 4: GET /api/orders (Kitchen Desk List)
  if (pathname === '/api/orders' && method === 'GET') {
    const orders = readJSON(ORDERS_FILE, []);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(orders));
    return;
  }

  // API 5: PUT /api/orders/:id/status (Kitchen Status Update)
  if (pathname.match(/^\/api\/orders\/[^\/]+\/status$/) && method === 'PUT') {
    const orderId = pathname.split('/')[3].toUpperCase();
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { status } = JSON.parse(body);
        const orders = readJSON(ORDERS_FILE, []);
        const idx = orders.findIndex(o => o.id === orderId);

        if (idx !== -1) {
          orders[idx].status = status;
          if (status === 'cooking') orders[idx].eta = '15 - 20 Mins';
          if (status === 'dispatched') orders[idx].eta = '5 - 10 Mins';
          if (status === 'delivered') orders[idx].eta = 'Delivered';
          writeJSON(ORDERS_FILE, orders);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, order: orders[idx] }));
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Order not found' }));
        }
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid payload' }));
      }
    });
    return;
  }

  // STATIC FILE SERVING
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '') safePath = '/index.html';

  const filePath = path.join(PUBLIC_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

function startServer(portToTry) {
  server.listen(portToTry, () => {
    console.log(`\n======================================================`);
    console.log(` Jay's Food Court Engine running on port: ${portToTry}`);
    console.log(` Storefront: http://localhost:${portToTry}`);
    console.log(` Kitchen:    http://localhost:${portToTry}/kitchen.html`);
    console.log(`======================================================\n`);
  });
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`⚠️ Port ${PORT} is in use, auto-switching to port ${PORT + 1}...`);
    PORT += 1;
    startServer(PORT);
  } else {
    console.error('Server error:', err);
  }
});

startServer(PORT);
