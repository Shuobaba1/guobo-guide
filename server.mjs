/* 国博讲解手册 — 本地静态服务器 + DeepSeek 代理
 *
 * 用法：
 *   node server.mjs
 *   PORT=4173 node server.mjs
 *
 * 可选环境变量：
 *   DEEPSEEK_API_KEY   不在浏览器里填 Key 时，服务端可以用它兜底
 *   DEEPSEEK_BASE      默认 https://api.deepseek.com/chat/completions
 *
 * 代理只接受 POST /api/ai，并且只转发到固定的上游地址，避免变成开放代理。
 */
import http from 'node:http';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

// 读取同目录下的 .env（没有就跳过），让 DeepSeek Key 不必写进浏览器。
function loadEnvFile() {
  try {
    const raw = fsSync.readFileSync(path.join(ROOT, '.env'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m || m[1].startsWith('#')) continue;
      if (process.env[m[1]] == null) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  } catch (e) { /* 没有 .env 就跳过 */ }
}
loadEnvFile();

const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || '0.0.0.0';
const UPSTREAM = process.env.DEEPSEEK_BASE || 'https://api.deepseek.com/chat/completions';
const MAX_BODY = 2 * 1024 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

function send(res, status, body, headers) {
  res.writeHead(status, Object.assign({
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff'
  }, headers || {}));
  res.end(body);
}

function sendJSON(res, status, obj) {
  send(res, status, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8' });
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('请求体太大'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function proxyAI(req, res) {
  let payload;
  try {
    const raw = await readBody(req);
    if (!raw) throw new Error('请求体为空');
    payload = JSON.parse(raw);
  } catch (err) {
    sendJSON(res, 400, { error: { message: '请求格式错误：' + err.message } });
    return;
  }

  const auth = req.headers.authorization || (process.env.DEEPSEEK_API_KEY ? 'Bearer ' + process.env.DEEPSEEK_API_KEY : '');
  const headers = { 'Content-Type': 'application/json' };
  if (auth) headers.Authorization = auth;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 100000);
  try {
    const upstream = await fetch(UPSTREAM, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const text = await upstream.text();
    send(res, upstream.status, text, {
      'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    });
  } catch (err) {
    const message = err.name === 'AbortError' ? '上游请求超时' : err.message;
    sendJSON(res, 502, { error: { message: 'AI 代理失败：' + message } });
  } finally {
    clearTimeout(timer);
  }
}

async function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  const target = path.resolve(ROOT, '.' + pathname);
  if (!target.startsWith(ROOT + path.sep) && target !== ROOT) {
    send(res, 403, 'Forbidden');
    return;
  }
  try {
    const stat = await fs.stat(target);
    if (stat.isDirectory()) {
      const index = path.join(target, 'index.html');
      const data = await fs.readFile(index);
      send(res, 200, data, { 'Content-Type': MIME['.html'] });
      return;
    }
    const data = await fs.readFile(target);
    const ext = path.extname(target).toLowerCase();
    const isHtml = ext === '.html';
    send(res, 200, data, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': isHtml ? 'no-cache' : 'public, max-age=3600'
    });
  } catch (err) {
    if (err.code === 'ENOENT') {
      // SPA 路由使用 hash，这里只对真正的 404 返回文本，避免掩盖资源错误。
      send(res, 404, 'Not found');
    } else {
      send(res, 500, 'Server error');
    }
  }
}

function localAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const item of list || []) {
      if (item.family === 'IPv4' && !item.internal) out.push(item.address);
    }
  }
  return out;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://' + (req.headers.host || 'localhost'));
  if (url.pathname === '/api/ai/status') {
    sendJSON(res, 200, {
      ok: true,
      configured: !!process.env.DEEPSEEK_API_KEY,
      upstream: UPSTREAM
    });
    return;
  }
  if (url.pathname === '/api/ai') {
    if (req.method !== 'POST') {
      sendJSON(res, 405, { error: { message: '只支持 POST' } });
      return;
    }
    await proxyAI(req, res);
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    send(res, 405, 'Method not allowed');
    return;
  }
  await serveStatic(req, res, url);
});

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  国博讲解手册已启动');
  console.log('  本机:   http://127.0.0.1:' + PORT);
  for (const ip of localAddresses()) console.log('  局域网: http://' + ip + ':' + PORT);
  console.log('');
  console.log('  AI 代理: POST /api/ai -> ' + UPSTREAM);
  console.log('  DeepSeek Key: ' + (process.env.DEEPSEEK_API_KEY ? '服务端已配置' : '未配置（浏览器设置或 .env 里填）'));
  console.log('  提示: 浏览器里打开上面的地址；手机与电脑连同一 Wi-Fi 时用局域网地址。');
  console.log('');
});
