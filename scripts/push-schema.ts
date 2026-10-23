/**
 * Apply supabase/schema.sql through the Supabase Management API.
 *
 * This needs a personal access token, not the project API keys — DDL is not
 * exposed through PostgREST. Create one at:
 *   https://supabase.com/dashboard/account/tokens
 *
 * Then run:
 *   SUPABASE_ACCESS_TOKEN=sbp_... npm run db:push-schema
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { serverEnv } from '../src/lib/server/env';

const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const projectUrl = serverEnv.supabaseUrl;

if (!token) {
	console.error(
		[
			'',
			'  SUPABASE_ACCESS_TOKEN is missing.',
			'',
			'  The publishable and secret API keys can read/write rows, but they cannot',
			'  create tables. Add a personal access token to .env:',
			'',
			'    1. Open https://supabase.com/dashboard/account/tokens',
			'    2. Generate a token (starts with sbp_)',
			'    3. Add SUPABASE_ACCESS_TOKEN=sbp_... to .env',
			'    4. Run npm run db:push-schema',
			'',
			'  Or paste supabase/schema.sql into the Supabase SQL editor.',
			''
		].join('\n')
	);
	process.exit(1);
}

if (!projectUrl) {
	console.error('SUPABASE_URL is missing. Add it to .env first.');
	process.exit(1);
}

const ref = new URL(projectUrl).hostname.split('.')[0];
const sql = readFileSync(resolve('supabase/schema.sql'), 'utf8');

console.log(`[schema] applying supabase/schema.sql to project ${ref}…`);

const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
	method: 'POST',
	headers: {
		Authorization: `Bearer ${token}`,
		'Content-Type': 'application/json'
	},
	body: JSON.stringify({ query: sql })
});

const body = await response.text();

if (!response.ok) {
	console.error(`[schema] failed (${response.status}): ${body}`);
	process.exit(1);
}

console.log('[schema] applied successfully.');
if (body.trim()) console.log(body.slice(0, 2000));
