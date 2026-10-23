/**
 * Delete the local SQLite database (including WAL/SHM sidecars).
 * Use it when the demo data or a schema change leaves you stuck:
 *
 *   npm run db:reset
 */
import { existsSync, rmSync } from 'node:fs';
import { serverEnv } from '../src/lib/server/env';

const targets = [serverEnv.dbPath, `${serverEnv.dbPath}-wal`, `${serverEnv.dbPath}-shm`];
let removed = 0;

for (const target of targets) {
	if (!existsSync(target)) continue;
	rmSync(target, { force: true });
	removed += 1;
	console.log(`  removed ${target}`);
}

if (!removed) {
	console.log(`  nothing to remove at ${serverEnv.dbPath}`);
} else {
	console.log(`  database reset at ${serverEnv.dbPath}`);
}
