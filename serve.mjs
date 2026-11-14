#!/usr/bin/env node
/**
 * serve.mjs — 零依赖静态服务器
 * 用法: node serve.mjs [port]
 */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)));
const PORT = Number(process.argv[2] || process.env.PORT || 5173);
const URL_BASE = `http://127.0.0.1:${PORT}/`;
const OPEN = process.argv.includes('--open');
const LAN = process.argv.includes('--lan');
const HOST = LAN ? '0.0.0.0' : '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.map': 'application/json',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/index.html';

    const target = normalize(join(ROOT, pathname));
    if (!target.startsWith(ROOT)) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    let file = target;
    try {
      const st = await stat(file);
      if (st.isDirectory()) file = join(file, 'index.html');
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404 Not Found');
      return;
    }

    const buf = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(buf);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end('500 ' + err.message);
  }
});

function openBrowser(url) {
  try {
    spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  } catch {}
}

server.on('error', async (err) => {
  if (err.code === 'EADDRINUSE') {
    let mine = false;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 1500);
      const res = await fetch(URL_BASE, { signal: ctrl.signal });
      const html = await res.text();
      clearTimeout(timer);
      mine = res.ok && /DSSF|鸡胚|鸡胚光谱/.test(html);
    } catch {}
    if (mine) {
      console.log(`端口 ${PORT} 上已有本演示在运行，直接复用它。`);
      if (OPEN) openBrowser(URL_BASE);
      process.exit(0);
    }
    console.error(`端口 ${PORT} 被其他程序占用，请关掉占用程序后再试。`);
    process.exit(1);
  }
  console.error('启动失败：' + err.message);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`DSSF-Net 演示已启动：${URL_BASE}`);
  if (LAN) {
    const nets = networkInterfaces();
    const ips = Object.values(nets)
      .flat()
      .filter((n) => n && n.family === 'IPv4' && !n.internal)
      .map((n) => n.address);
    ips.forEach((ip) => console.log(`手机 / 同网设备：http://${ip}:${PORT}/`));
    console.log('手机打不开时，请在 Windows 防火墙里允许 Node.js 的“专用网络”访问。');
  }
  console.log('如果浏览器没有自动打开，把上面的地址复制到浏览器即可。');
  console.log('按 Ctrl+C 或直接关闭本窗口即停止服务。');
  if (OPEN) openBrowser(URL_BASE);
});
