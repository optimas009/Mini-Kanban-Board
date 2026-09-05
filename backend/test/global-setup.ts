import { execSync } from 'node:child_process';

import { Client } from 'pg';

import {
  assertTestDatabase,
  databaseNameFrom,
  maintenanceUrlFor,
  testDatabaseUrl,
} from './database-url.js';

/**
 * Creates the dedicated e2e database if it does not exist and brings its schema
 * up to date. Runs once per `vitest` invocation, before any worker starts.
 */
export default async function setup(): Promise<void> {
  const url = testDatabaseUrl();
  assertTestDatabase(url);

  const name = databaseNameFrom(url);
  const admin = new Client({ connectionString: maintenanceUrlFor(url) });

  await admin.connect();

  try {
    const existing = await admin.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [name],
    );

    if (existing.rowCount === 0) {
      // Identifier cannot be parameterised; the name is derived from our own
      // URL and validated by assertTestDatabase above.
      await admin.query(`CREATE DATABASE "${name.replace(/"/g, '""')}"`);
      console.log(`[e2e] created database ${name}`);
    }
  } finally {
    await admin.end();
  }

  // Constant command string with no interpolation; the database URL is passed
  // through the environment rather than the command line.
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });
}
