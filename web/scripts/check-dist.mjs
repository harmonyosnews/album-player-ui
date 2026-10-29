import { readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ALLOWED = new Set(['.html', '.js', '.css', '.json', '.png', '.jpg', '.jpeg', '.gif', '.ico']);
const MAX_JS = 300 * 1024;
const MAX_CSS = 80 * 1024;

let bad = [];
let js = 0;
let css = 0;
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else {
      const ext = extname(name).toLowerCase();
      if (!ALLOWED.has(ext)) bad.push(`${p} (${ext})`);
      if (ext === '.js') js += st.size;
      if (ext === '.css') css += st.size;
    }
  }
}
walk('dist');

if (bad.length) {
  console.error('禁止的静态资源扩展名:\n' + bad.join('\n'));
  process.exit(1);
}
if (!statSync('dist/aplayer.html', { throwIfNoEntry: false })) {
  console.error('缺少 dist/aplayer.html');
  process.exit(1);
}
if (statSync('dist/index.html', { throwIfNoEntry: false })) {
  console.error('dist/index.html 应重命名为 aplayer.html');
  process.exit(1);
}
if (js > MAX_JS) console.warn(`JS 体积偏大: ${(js / 1024).toFixed(1)} KB`);
if (css > MAX_CSS) console.warn(`CSS 体积偏大: ${(css / 1024).toFixed(1)} KB`);
console.log(`dist OK: js=${(js / 1024).toFixed(1)}KB css=${(css / 1024).toFixed(1)}KB`);
