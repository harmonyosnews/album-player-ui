import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const version = pkg.version;
const RELEASE = '../release';
const stage = `${RELEASE}/apui-web-${version}`;
const tarball = `${RELEASE}/apui-web-${version}.tar.gz`;

mkdirSync(RELEASE, { recursive: true });
rmSync(stage, { recursive: true, force: true });
rmSync(tarball, { force: true });
mkdirSync(stage, { recursive: true });

cpSync('dist/aplayer.html', join(stage, 'aplayer.html'));
cpSync('dist/ui', join(stage, 'ui'), { recursive: true });
cpSync('install.sh', join(stage, 'install.sh'));
cpSync('uninstall.sh', join(stage, 'uninstall.sh'));
cpSync('PACKAGE-README.md', join(stage, 'README.md'));
for (const f of ['LICENSE', 'NOTICE', 'USER-AGREEMENT.md', 'DISCLAIMER.md', 'THIRD-PARTY-NOTICES.md']) {
  cpSync(`../${f}`, join(stage, f));
}
writeFileSync(join(stage, 'VERSION'), `APUI ${version}\ncompatible: Album Player 2.19\n`);

execFileSync('tar', ['-C', stage, '-czf', tarball, '.'], { stdio: 'inherit' });
const buf = readFileSync(tarball);
const hash = createHash('sha256').update(buf).digest('hex');
writeFileSync(`${tarball}.sha256`, `${hash}  ${tarball.split('/').pop()}\n`);
console.log(`release: ${tarball}`);
console.log(`sha256: ${hash}`);
