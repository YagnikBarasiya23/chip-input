import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
const n = gzipSync(readFileSync('dist/chip-input.js')).length;
console.log(`dist/chip-input.js gzip: ${n} B`);
if (n > 8192) { console.error('over 8 KB budget'); process.exit(1); }
