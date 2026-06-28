// Restores the full package.json (with devDependencies) after the tarball has
// been created. Pairs with prepack.mjs. Idempotent and safe if the backup is
// missing (e.g. prepack didn't run).
import { copyFileSync, existsSync, rmSync } from 'node:fs';

const BACKUP = 'package.json.bak';
if (existsSync(BACKUP)) {
	copyFileSync(BACKUP, 'package.json');
	rmSync(BACKUP);
	console.log('[postpack] restored the full package.json');
}
