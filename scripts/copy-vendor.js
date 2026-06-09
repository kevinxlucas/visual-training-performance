const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'public', 'vendor');
fs.mkdirSync(out, { recursive: true });

const copies = [
  ['node_modules/p5/lib/p5.min.js', 'p5.min.js']
];

for (const [src, dest] of copies) {
  const from = path.join(root, src);
  if (!fs.existsSync(from)) {
    throw new Error(`Vendor file missing: ${src}. Run npm install first.`);
  }
  fs.copyFileSync(from, path.join(out, dest));
}
console.log('Vendor assets copied to public/vendor.');
