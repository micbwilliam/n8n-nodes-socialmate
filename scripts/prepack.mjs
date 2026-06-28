// Publish-time only. Strips `devDependencies` from the package.json that goes
// into the npm tarball, so supply-chain scanners (Socket, npm audit, etc.) only
// ever see what actually ships: this node's compiled `dist/` with ZERO runtime
// dependencies. Our build/release tooling (semantic-release, gulp, eslint, …)
// is never installed by, nor bundled for, consumers — so it shouldn't appear in
// the published manifest. The repo's own package.json is restored by postpack.mjs.
//
// This runs automatically during `npm publish` (incl. semantic-release): npm
// fires prepack -> [create tarball] -> postpack. semantic-release commits the
// real package.json BEFORE the publish step, so the repo keeps its devDeps.
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';

const BACKUP = 'package.json.bak';
copyFileSync('package.json', BACKUP);

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
delete pkg.devDependencies;
writeFileSync('package.json', `${JSON.stringify(pkg, null, 2)}\n`);

console.log('[prepack] stripped devDependencies from the published package.json');
