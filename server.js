'use strict';
/*
 * Zero-dependency static file server for local dev. The app itself is fully
 * static (public/) and Vercel-deployable — this is only for running locally.
 *   node server.js   ->   http://localhost:4900
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const ais = require('./ais');

const ROOT = path.join(__dirname, 'public');
const PORT = process.env.PORT || 4900;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8', '.svg': 'image/svg+xml'
};

http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);

  // Live vessel feed (server-side so the aisstream key is never sent to the browser)
  if (rel === '/api/vessels') {
    const body = JSON.stringify(ais.getVessels());
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(body);
  }

  if (rel === '/') rel = '/index.html';
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}).listen(PORT, () => {
  ais.start();
  console.log(`SeaRoutes running → http://localhost:${PORT}`);
});
