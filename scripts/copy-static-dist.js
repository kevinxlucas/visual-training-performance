const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');

const files = ['game.js', 'sound-compat.js', 'config.js', 'sw.js', 'favicon.svg', 'apple-touch-icon.svg', 'manifest.webmanifest'];
for (const file of files) {
  fs.copyFileSync(path.join(root, file), path.join(dist, file));
}

fs.cpSync(path.join(root, 'public', 'vendor'), path.join(dist, 'vendor'), { recursive: true });
fs.writeFileSync(path.join(dist, '.nojekyll'), '');

console.log('Static runtime files copied to dist.');
