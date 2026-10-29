import { existsSync, renameSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

if (existsSync('dist/index.html')) {
  renameSync('dist/index.html', 'dist/aplayer.html');
}
if (!existsSync('dist/aplayer.html')) {
  console.error('postbuild: dist/aplayer.html missing');
  process.exit(1);
}
execFileSync(process.execPath, ['scripts/check-dist.mjs'], { stdio: 'inherit' });
console.log('postbuild: dist/aplayer.html ready');
