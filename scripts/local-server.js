const fs = require('fs');
const http = require('http');
const path = require('path');
const resultsHandler = require('../api/results');

function loadEnv(file = path.join(__dirname, '..', '.env.local')) {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith('#') || !line.includes('=')) continue;
    const [key, ...rest] = line.split('=');
    if (!process.env[key]) process.env[key] = rest.join('=').trim();
  }
}

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

loadEnv();

const root = path.join(__dirname, '..');
const publicRoot = path.join(root, 'public');
const port = Number(process.env.PORT || 5175);

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/results')) return resultsHandler(req, res);
  const urlPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  const rel = urlPath === '/' ? 'index.html' : urlPath.slice(1);
  const candidates = [path.join(root, rel), path.join(publicRoot, rel)];
  const file = candidates.find((candidate) => candidate.startsWith(root) && fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  if (!file) {
    res.statusCode = 404;
    res.end('Not found');
    return;
  }
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Visual Training Performance local server: http://127.0.0.1:${port}`);
});
