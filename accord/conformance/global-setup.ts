/**
 * With ACCORD_URL and ACCORD_CONTROL_URL set, the suite runs against that server as it is.
 * Without them, this starts PostgreSQL (Testcontainers) and the reference server
 * (`reference-server.ts`, a separate process, exactly as a port would run), and points the suite
 * at it.
 */
import { type ChildProcess, spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

const here = dirname(fileURLToPath(import.meta.url));

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      srv.close(() => resolve(typeof addr === 'object' && addr ? addr.port : 0));
    });
  });
}

async function waitFor(url: string, child: ChildProcess | undefined, ms: number): Promise<void> {
  const deadline = Date.now() + ms;
  for (;;) {
    if (child && child.exitCode !== null) throw new Error(`server exited (${child.exitCode})`);
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not listening yet
    }
    if (Date.now() > deadline) throw new Error(`${url} did not answer within ${ms} ms`);
    await new Promise((r) => setTimeout(r, 200));
  }
}

export default async function setup(): Promise<() => Promise<void>> {
  if (process.env.ACCORD_URL || process.env.ACCORD_CONTROL_URL) {
    if (!process.env.ACCORD_URL || !process.env.ACCORD_CONTROL_URL) {
      throw new Error('set both ACCORD_URL and ACCORD_CONTROL_URL');
    }
    await waitFor(`${process.env.ACCORD_URL}/health`, undefined, 10_000);
    return async () => {};
  }

  const pg: StartedPostgreSqlContainer = await new PostgreSqlContainer(
    'postgres:16-alpine',
  ).start();
  const [port, controlPort] = [await freePort(), await freePort()];
  const child = spawn(
    process.execPath,
    ['--import', 'tsx', '--conditions=@accordsync/source', join(here, 'reference-server.ts')],
    {
      cwd: here,
      env: {
        ...process.env,
        ACCORD_DATABASE_URL: pg.getConnectionUri(),
        ACCORD_PORT: String(port),
        ACCORD_CONTROL_PORT: String(controlPort),
      },
      stdio: ['ignore', 'inherit', 'inherit'],
    },
  );
  process.env.ACCORD_URL = `http://127.0.0.1:${port}`;
  process.env.ACCORD_CONTROL_URL = `http://127.0.0.1:${controlPort}`;
  try {
    await waitFor(`${process.env.ACCORD_URL}/health`, child, 60_000);
  } catch (e) {
    child.kill();
    await pg.stop();
    throw e;
  }
  return async () => {
    const exited = new Promise((r) => child.once('exit', r));
    child.kill('SIGTERM');
    await Promise.race([exited, new Promise((r) => setTimeout(r, 5000))]);
    await pg.stop();
  };
}
