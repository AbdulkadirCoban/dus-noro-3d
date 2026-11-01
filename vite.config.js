import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Derleme bittikten sonra dist içindeki tüm dosyaları önbelleğe alan service worker'ı üretir.
function serviceWorker() {
  return {
    name: 'dus-service-worker',
    apply: 'build',
    closeBundle() {
      const dist = path.resolve('dist');
      const files = [];
      const walk = (dir) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          const p = path.join(dir, e.name);
          if (e.isDirectory()) walk(p);
          else if (e.name !== 'sw.js') files.push(path.relative(dist, p).replaceAll('\\', '/'));
        }
      };
      walk(dist);
      const hash = crypto.createHash('sha256');
      for (const f of files.sort()) hash.update(f).update(fs.readFileSync(path.join(dist, f)));
      const version = hash.digest('hex').slice(0, 12);
      const tpl = fs.readFileSync(path.resolve('src/sw.template.js'), 'utf8');
      fs.writeFileSync(path.join(dist, 'sw.js'), tpl.replace('__VERSION__', version).replace('__FILES__', JSON.stringify(['./', ...files.map((f) => `./${f}`)])));
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [serviceWorker()],
  build: { target: 'es2020', chunkSizeWarningLimit: 1500 },
});
