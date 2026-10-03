export interface Config {
  port: number;
  databaseUrl: string;
  /** Maximum PostgreSQL connections (default 20). */
  dbPoolSize: number;
}

/** Reads configuration from the environment and fails fast on anything missing or malformed. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const databaseUrl = env.ACCORD_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      'ACCORD_DATABASE_URL is required (e.g. postgres://accord:accord@localhost:5432/accord)',
    );
  }
  const port = Number(env.ACCORD_PORT ?? 8080);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`ACCORD_PORT must be a TCP port, got "${env.ACCORD_PORT}"`);
  }
  const dbPoolSize = Number(env.ACCORD_DB_POOL ?? 20);
  if (!Number.isInteger(dbPoolSize) || dbPoolSize < 2) {
    throw new Error(`ACCORD_DB_POOL must be an integer ≥ 2, got "${env.ACCORD_DB_POOL}"`);
  }
  return { port, databaseUrl, dbPoolSize };
}
