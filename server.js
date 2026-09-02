/**
 * server.js — Servidor local nativo de Node.js para NC Caliman Gestor de Paquetes
 * No requiere paquetes externos (usa módulos nativos http, https, fs, path).
 * Servidor estático + Proxy /api/send-email hacia Resend API.
 */
import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ── PROXY ENDPOINT: /api/send-email ─────────────────────────────
  if (req.url === '/api/send-email' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const authHeader = req.headers['authorization'] || '';
      
      const resendReq = https.request('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        }
      }, (resendRes) => {
        let resendData = '';
        resendRes.on('data', chunk => { resendData += chunk; });
        resendRes.on('end', () => {
          res.writeHead(resendRes.statusCode, { 'Content-Type': 'application/json' });
          res.end(resendData);
        });
      });

      resendReq.on('error', (err) => {
        console.error('[Server Proxy Error]:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Error de servidor proxy: ' + err.message }));
      });

      resendReq.write(body);
      resendReq.end();
    });
    return;
  }

  // ── SERVIDOR DE ARCHIVOS ESTÁTICOS ──────────────────────────────
  let reqPath = decodeURIComponent(req.url.split('?')[0]);
  let filePath = path.join(PUBLIC_DIR, reqPath === '/' ? 'index.html' : reqPath);
  
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 NC Caliman Gestor Paquetes corriendo en http://localhost:${PORT}`);
});
