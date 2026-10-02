export interface Config {
  port: number;
  databaseUrl: string;
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
  return { port, databaseUrl };
}
