// Prepares the files published at https://proxyforgame.com/companion/: the userscript itself
// and pfg-companion.meta.js, its metadata block alone, which userscript managers poll for updates.
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const source = fs.readFileSync(path.join(root, 'src', 'pfg-companion.user.js'), 'utf8');
const meta = source.match(/^\/\/ ==UserScript==\r?\n[\s\S]*?^\/\/ ==\/UserScript==\r?\n/m);
if (!meta) throw new Error('UserScript metadata block not found');

fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, 'pfg-companion.user.js'), source);
fs.writeFileSync(path.join(dist, 'pfg-companion.meta.js'), meta[0]);
console.log(`dist/ ready, version ${meta[0].match(/@version\s+(\S+)/)?.[1]}`);
