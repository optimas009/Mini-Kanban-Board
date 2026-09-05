const FALLBACK =
  'postgresql://kanban_user:kanban_password@localhost:5432/mini_kanban?schema=public';

/**
 * The e2e suite truncates tables, so it must never point at a developer's
 * working database. Every helper here derives a dedicated `*_test` database
 * from DATABASE_URL, and `assertTestDatabase` refuses anything else.
 */
export const TEST_DATABASE_SUFFIX = '_test';

export function testDatabaseUrl(): string {
  const url = new URL(process.env.DATABASE_URL ?? FALLBACK);
  const name = url.pathname.replace(/^\//, '');

  if (!name.endsWith(TEST_DATABASE_SUFFIX)) {
    url.pathname = `/${name}${TEST_DATABASE_SUFFIX}`;
  }

  return url.toString();
}

export function databaseNameFrom(connectionString: string): string {
  return new URL(connectionString).pathname.replace(/^\//, '');
}

/** Same server and credentials, but connected to the always-present `postgres` database. */
export function maintenanceUrlFor(connectionString: string): string {
  const url = new URL(connectionString);
  url.pathname = '/postgres';
  url.search = '';
  return url.toString();
}

export function assertTestDatabase(connectionString: string): void {
  const name = databaseNameFrom(connectionString);

  if (!name.endsWith(TEST_DATABASE_SUFFIX)) {
    throw new Error(
      `Refusing to run destructive e2e setup against "${name}". ` +
        `The e2e database name must end with "${TEST_DATABASE_SUFFIX}".`,
    );
  }
}
