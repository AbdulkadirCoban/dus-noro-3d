// dist klasörünü GitHub Pages gibi bir alt dizin altında servis eder: /dus-noro-3d/
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PREFIX = '/dus-noro-3d/';
const ROOT = path.resolve('dist');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.glb': 'model/gltf-binary' };

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (!url.startsWith(PREFIX)) {
    res.writeHead(404).end('alt dizin dışında');
    return;
  }
  const file = path.join(ROOT, url.slice(PREFIX.length) || 'index.html');
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end('yok');
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(4173, () => console.log('hazır'));
