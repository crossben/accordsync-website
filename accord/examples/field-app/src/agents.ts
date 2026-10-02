import { SignJWT } from 'jose';

export const AGENTS = {
  awa: { name: 'Awa', zones: ['dakar'] },
  moussa: { name: 'Moussa', zones: ['dakar'] },
  fatou: { name: 'Fatou', zones: ['thies'] },
} as const;

export type AgentId = keyof typeof AGENTS;

/**
 * DEMO ONLY. A real app gets its token from its own auth server; the browser never holds a signing
 * secret. This matches ACCORD_DEV_SECRET in docker-compose.yml.
 */
const DEV_SECRET = 'dev-secret-change-me-at-least-32-bytes';

export function devToken(agent: AgentId): Promise<string> {
  return new SignJWT({ zones: [...AGENTS[agent].zones] })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(agent)
    .setExpirationTime('12h')
    .sign(new TextEncoder().encode(DEV_SECRET));
}

export function currentAgent(): AgentId {
  const a = new URLSearchParams(location.search).get('agent');
  return a && a in AGENTS ? (a as AgentId) : 'awa';
}
